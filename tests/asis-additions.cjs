'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4195';
const entries=JSON.parse(fs.readFileSync('data/asis-literature-additions.json')).additions;
for(const item of entries){
 const bytes=fs.readFileSync('.'+item.pdf);
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);
}
assert.equal(new Set(entries.map(x=>x.sha256)).size,16);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});
 try{
  fs.mkdirSync('draft-maps/asis-checks',{recursive:true});
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:950}});
   await page.goto(base+'/asis-ips/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.ip-card').count(),39);
   for(const [status,count] of Object.entries({approved:6,carena:5,review:16,original:9})){
    await page.locator(`[data-filter="${status}"]`).click();
    assert.equal(await page.locator('.ip-card:visible').count(),count);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`draft-maps/asis-checks/originals-${width}.png`});
   for(const id of ['original-am-i-an-addict','original-fourth-step-inventory','original-living-the-program']){
    for(const n of [1,2]){
     await page.goto(base+'/pdf-reader.html?'+new URLSearchParams({url:`/asis-ips/pdfs/${id}.pdf`,page:String(n)}),{waitUntil:'domcontentloaded'});
     await page.locator('#readerStatus').waitFor({state:'hidden',timeout:60000});
     assert.equal(await page.locator('#readerError').isVisible(),false);
     const canvas=page.locator(`#pdf-page-${n} canvas`);
     await canvas.waitFor({state:'visible',timeout:60000});
     const bounds=await canvas.boundingBox();
     if(id!=='original-living-the-program'||n===2)assert.ok(bounds.width>bounds.height,'sideways scan opens in corrected landscape orientation');
     await canvas.screenshot({path:`draft-maps/asis-checks/${id}-${n}-${width}.png`});
    }
   }
   await page.close();
  }
  console.log('PASS: 16 hosted additions, correct status counts, and automatic orientation on phone/desktop.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
