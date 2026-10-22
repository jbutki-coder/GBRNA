'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4196';
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
  try {
    fs.mkdirSync('draft-maps/announcement-checks',{recursive:true});
    for(const [label,width] of [['desktop',1440],['mobile',390]]) {
      const page=await browser.newPage({viewport:{width,height:900},timezoneId:'Europe/Warsaw'});
      await page.route('**/gc.zgo.at/**',route=>route.abort());
      await page.goto(base+'/#announcements');
      await page.waitForFunction(()=>document.querySelector('#regionalTimeZones').rows.length===20);
      await page.locator('.announcement-times summary').click();
      const section=page.locator('#announcements');
      for(const img of await section.locator('img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(img=>img.decode());
        assert.ok(await img.evaluate(img=>img.naturalWidth>0));
      }
      assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${label}: section overflow`);
      assert.match(await page.locator('#regionalLocalTime').textContent(),/time zone/);
      await section.screenshot({path:`draft-maps/announcement-checks/${label}.png`});
      const flyer=page.locator('#regional-meeting .announcement-flyer');
      assert.match(await flyer.getAttribute('src'),/ar4na-meeting-november-2026.png/);
      const href=await flyer.locator('..').getAttribute('href');
      assert.equal((await page.request.get(base+href)).status(),200);
      await page.close();
    }
    console.log('PASS: desktop/mobile layout, all announcement images, 20 timezone rows, and full-size AR4NA flyer.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
