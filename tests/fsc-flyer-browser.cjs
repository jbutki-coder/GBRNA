'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4199';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});
 try{
  fs.mkdirSync('draft-maps/fsc-checks',{recursive:true});
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:950}});
   await page.goto(base+'/fsc/#registration');
   const img=page.locator('#registration .flyer-frame img');
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(i=>i.decode());
   assert.ok(await img.evaluate(i=>i.naturalWidth>1000&&i.naturalHeight>1400));
   const source=await img.getAttribute('src');
   for(const link of await page.locator('#registration a').all())assert.equal(await link.getAttribute('href'),source);
   const response=await page.request.get(base+source);
   assert.equal(response.status(),200);
   assert.match(response.headers()['content-type'],/image\/png/);
   assert.match(await page.locator('#registration .notice').textContent(),/June 10, 2026/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`draft-maps/fsc-checks/flyer-${width}.png`});
   await page.close();
  }
  console.log('PASS: FSC flyer renders on phone/desktop; full-size and download links serve the new local image; deadline note retained.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
