'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4195';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});
 try{
  fs.mkdirSync('draft-maps/asis-checks',{recursive:true});
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:950}});
   await page.goto(base+'/asis-ips/',{waitUntil:'domcontentloaded'});
   await page.locator('#four-folds-of-recovery').waitFor({state:'visible'});
   assert.match(await page.locator('#resultsStatus').textContent(),/Showing all 39 literature pieces/);
   assert.equal(await page.locator('.ip-card').count(),39);
   await page.locator('[data-filter="review"]').click();
   assert.equal(await page.locator('.ip-card:visible').count(),16);
   await page.fill('#ipSearch','4 folds');
   assert.equal(await page.locator('.ip-card:visible').count(),1);
   const card=page.locator('#four-folds-of-recovery');
   assert.equal(await card.getAttribute('data-status'),'review');
   await card.scrollIntoViewIfNeeded();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`draft-maps/asis-checks/four-folds-${width}.png`});
   const pdf=await page.request.get(base+'/asis-ips/pdfs/the-four-folds-of-recovery.pdf');
   assert.equal(pdf.status(),200);
   assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
   await card.locator('a').click();
   await page.waitForURL('**/pdf-reader.html?**');
   await page.waitForFunction(()=>document.getElementById('pageReadout').textContent==='1 / 2',null,{timeout:60000});
   await page.locator('#readerStatus').waitFor({state:'hidden',timeout:60000});
   assert.equal(await page.locator('#readerError').isVisible(),false);
   if(await page.locator('#nextPage').isEnabled())await page.locator('#nextPage').click();
   await page.locator('#pdf-page-2').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'start'}));
   await page.locator('#pdf-page-2 canvas').waitFor({state:'visible',timeout:60000});
   await page.close();
  }
  console.log('PASS: Four Folds IP is searchable under Review & Input, PDF is hosted locally, and both pages open on phone/desktop.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
