'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const base=process.env.SITE_URL||'http://127.0.0.1:4196';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH,headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1050}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/legal/',{waitUntil:'networkidle'});
    await page.locator('#legalSearch').waitFor();
    assert.equal(await page.locator('.legal-row:visible').count(),32);
    await page.selectOption('#legalGroup','arna');
    assert.equal(await page.locator('.legal-row:visible').count(),4);
    await page.selectOption('#legalKind','Filing');
    assert.equal(await page.locator('.legal-row:visible').count(),2);
    await page.fill('#legalSearch','demurrer');
    assert.equal(await page.locator('.legal-row:visible').count(),1);
    await page.fill('#legalSearch','no-such-document');
    assert.equal(await page.locator('#legalEmpty:visible').count(),1);
    await page.fill('#legalSearch','');
    await page.selectOption('#legalKind','');
    await page.selectOption('#legalGroup','');
    fs.mkdirSync(path.join(root,'draft-maps/legal-checks'),{recursive:true});
    await page.screenshot({path:path.join(root,'draft-maps/legal-checks/desktop.png')});
    for(const viewport of [{width:390,height:844},{width:768,height:1024}]){
      await page.setViewportSize(viewport);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
      assert.equal(await page.locator('.legal-row:visible').count(),32);
      await page.screenshot({path:path.join(root,`draft-maps/legal-checks/${viewport.width}.png`)});
    }
    const docs=require('../data/legal-documents.json').documents;
    for(const doc of docs){
      const response=await page.request.get(base+doc.pdf);
      assert.equal(response.status(),200,doc.title);
      assert.equal((await response.body()).subarray(0,5).toString(),'%PDF-',doc.title);
    }
    const href=await page.locator('.legal-row .legal-actions a').first().getAttribute('href');
    await page.goto(base+href,{waitUntil:'networkidle'});
    await page.locator('canvas').first().waitFor({state:'visible',timeout:60000});
    await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>c.width>100&&c.height>100));
    assert.deepEqual(errors,[]);
    console.log('Legal browser: filters, empty state, desktop/mobile layouts, 32 PDF responses, and reader rendering passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
