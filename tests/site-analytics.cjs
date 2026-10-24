'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const express=require('express');
const {execFileSync}=require('node:child_process');
const {injectAnalytics,installAnalytics}=require('../analytics.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const pages=execFileSync('git',['ls-files','-z','*.html','*.htm'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of pages){
  const html=require('node:fs').readFileSync(path.join(root,file),'utf8');
  assert.equal((html.match(/\/js\/site-analytics\.js/g)||[]).length,1,file);
  assert.ok(!html.includes('data-goatcounter='),file);
 }
 const app=express();
 const batches=[];
 const analytics=installAnalytics(app,root,{token:'test-only-token',fetch:async(url,options)=>{batches.push(JSON.parse(options.body));return {ok:true}}});
 app.get('/dynamic',(_req,res)=>res.type('html').send('<html><head></head><body>Dynamic page</body></html>'));
 app.use(analytics.serveHtml);
 app.use(express.static(root));
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  const legacy='<html><head></head><body></body></html><script data-goatcounter="old" src="//gc.zgo.at/count.js"></script>';
  const injected=injectAnalytics(legacy);
  assert.equal((injected.match(/site-analytics\.js/g)||[]).length,1);
  assert.ok(!injected.includes('data-goatcounter'));
  assert.equal(injectAnalytics(injected),injected);
  for(const url of ['/','/meetings/','/publications/','/library/','/pdf-reader.html','/documents/ar4na/arna-detailed-meeting-list.html','/dynamic']){
   const response=await fetch(base+url);
   assert.equal(response.status,200);
   const text=await response.text();
   assert.equal((text.match(/site-analytics\.js/g)||[]).length,1,url);
   assert.ok(!text.includes('data-goatcounter='),url);
  }
  const pdf='/documents/ar4na/ar4na-business-minutes-2026-09-29.pdf';
  await fetch(base+pdf+'?private=not-shared');
  await fetch(base+pdf,{headers:{Range:'bytes=0-99'}});
  await fetch(base+'/documents/ar4na/ar4na-business-minutes-2026-09-15.pdf',{headers:{DNT:'1'}});
  await analytics.flush();
  assert.equal(batches.flatMap(x=>x.hits).length,1,'range requests deduplicate and DNT is respected');
  assert.ok(!JSON.stringify(batches).includes('private'));
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});
  const page=await browser.newPage();
  await page.route('https://gc.zgo.at/count.js',route=>route.fulfill({contentType:'application/javascript',body:'window.analyticsHits=[];window.goatcounter.count=function(hit){window.analyticsHits.push(hit)};window.goatcounter.count({path:window.goatcounter.path});'}));
  await page.goto(base+'/documents/ar4na/arna-detailed-meeting-list.html');
  await page.waitForFunction(()=>window.analyticsHits);
  assert.equal(await page.evaluate(()=>document.compatMode),'CSS1Compat','injection preserves HTML standards mode');
  assert.equal((await page.evaluate(()=>window.analyticsHits)).length,1);
  await page.evaluate(()=>{
   const a=document.createElement('a');a.href='/example.pdf?secret=hidden';a.download='example.pdf';a.textContent='Example';document.body.append(a);
   a.addEventListener('click',e=>e.preventDefault());a.click();
   const audio=document.createElement('audio');audio.src='/audio/example.mp3?signature=hidden';document.body.append(audio);
   audio.dispatchEvent(new Event('playing'));audio.dispatchEvent(new Event('playing'));
   audio.dispatchEvent(new Event('ended'));audio.dispatchEvent(new Event('playing'));
  });
  const hits=await page.evaluate(()=>window.analyticsHits);
  assert.equal(hits.filter(x=>x.path==='download:/example.pdf').length,1);
  assert.equal(hits.filter(x=>x.path==='audio-play:/audio/example.mp3').length,2,'resume is not another play, replay after ending is');
  assert.ok(!JSON.stringify(hits).includes('hidden'));
  console.log('PASS: site-wide HTML injection, legacy deduplication, private query removal, file counting, range deduplication, DNT, downloads and audio play/replay.');
 }finally{await browser?.close();analytics.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
