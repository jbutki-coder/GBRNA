'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4195';
const archived=fs.readFileSync('documents/ar4na/arna-detailed-meeting-list.html','utf8');
assert.ok(!archived.includes('83762823910'));
assert.ok(archived.includes('89128118093'));
assert.ok(archived.includes('Historical directory disclaimer'));
const schedule=JSON.parse(fs.readFileSync('data/meeting-schedule.json','utf8'));
const meetings=Array.isArray(schedule)?schedule:Object.values(schedule).find(Array.isArray);
for(const meeting of meetings.filter(x=>/Okanagan/.test(x.name)))assert.equal(meeting.joinUrl,'https://us02web.zoom.us/j/89128118093');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});
 try{
  fs.mkdirSync('draft-maps/ar4na-checks',{recursive:true});
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:950}});
   await page.goto(base+'/#ar4na-records',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#regional-meeting + #ar4na-records').count(),1);
   assert.equal(await page.locator('#ar4na-records a[href$=".pdf"]').count(),3);
   await page.locator('#ar4na-records').screenshot({path:`draft-maps/ar4na-checks/announcement-${width}.png`});
   await page.locator('#ar4na-records a[href$=".html"]').click();
   await page.waitForURL('**/arna-detailed-meeting-list.html');
   assert.ok(await page.locator('.intro').innerText().then(x=>x.includes('not the current AR4NA meeting schedule')));
   for(const href of await page.locator('a[href*="89128118093"]').evaluateAll(els=>els.map(x=>x.href)))assert.equal(href,'https://us02web.zoom.us/j/89128118093');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`draft-maps/ar4na-checks/directory-${width}.png`});
   for(const date of ['2026-09-01','2026-09-15','2026-09-29']){
    const response=await page.request.get(base+'/documents/ar4na/ar4na-business-minutes-'+date+'.pdf');
    assert.equal(response.status(),200);
    assert.equal((await response.body()).subarray(0,5).toString(),'%PDF-');
   }
   await page.close();
  }
  console.log('PASS: AR4NA announcement placement, historical disclaimer, current Okanagan credentials, and three hosted business minutes on phone/desktop.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
