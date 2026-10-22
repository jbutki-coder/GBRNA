'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4196';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH,headless:true});
  try{
    fs.mkdirSync('draft-maps/navigation-checks',{recursive:true});
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/library/',{waitUntil:'networkidle'});
      assert.equal(await page.locator('.global-tabs a').count(),16);
      assert.equal(await page.locator('.literature-book-card').count(),require('../data/literature-library.json').books.length);
      const baby=page.locator('[data-literature-open-book="baby-blue-screen-reading"]');
      await baby.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{const i=document.querySelector('[data-literature-open-book="baby-blue-screen-reading"] img');return i.complete&&i.naturalWidth>0});
      assert.match(await baby.locator('img').getAttribute('src'),/baby-blue-screen-reading-cover/);
      await baby.click();
      await page.waitForURL('**/pdf-reader.html?**');
      assert.match(new URL(page.url()).searchParams.get('url'),/baby-blue-third-edition-revised-screen-reading.pdf/);
      await page.goto(base+'/library/',{waitUntil:'networkidle'});
      await page.screenshot({path:`draft-maps/navigation-checks/library-${width}.png`});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.goto(base+'/#07-13');
      await page.waitForSelector('[data-audio-player]');
      await page.waitForSelector('[data-source-audio-player]',{state:'attached'});
      assert.equal(await page.locator('.global-tabs a').count(),16);
      assert.equal(await page.locator('.home-section-nav a').count(),5);
      assert.equal(await page.locator('[data-audio-player]').count(),1);
      assert.equal(await page.locator('.project-intro-actions').count(),0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`draft-maps/navigation-checks/home-${width}.png`});
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const page=await browser.newPage();
    for(const [hash,target]of [['library','/library/'],['download','/library/#downloads'],['fsc','/fsc/'],['asis-ips','/asis-ips/']]){
      await page.goto(base+'/#'+hash);
      await page.waitForURL(base+target);
    }
    const context=await browser.newContext();
    const html=await (await context.request.get(base+'/index.html')).text();
    const nav=html.match(/<nav class="global-tabs"[\s\S]*?<\/nav>/)[0];
    for(const [,url]of nav.matchAll(/href="(\/[^"]*)"/g))assert.equal((await context.request.get(base+url)).status(),200,url);
    console.log('Navigation browser: desktop/mobile menus, Library covers/reader, daily audio, four legacy redirects, and destination responses passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
