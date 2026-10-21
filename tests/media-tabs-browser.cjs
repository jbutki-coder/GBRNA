'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const issues=require('../data/publications.json').issues;
const collections=require('../data/audio-library.json');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
  fs.mkdirSync('draft-maps/media-checks',{recursive:true});
  try{
    for(const [label,width] of [['desktop',1440],['mobile',390]]){
      const page=await browser.newPage({viewport:{width,height:950}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/gc.zgo.at/**',r=>r.abort());
      await page.goto('http://127.0.0.1:4196/publications/');
      await page.waitForFunction(()=>document.getElementById('issueResults').textContent==='59 of 59 issues');
      assert.equal(await page.locator('.issue-row').count(),59);
      await page.selectOption('#issueSeries','arna');
      assert.equal(await page.locator('.issue-row:visible').count(),13);
      await page.fill('#issueSearch','March 2024');
      assert.equal(await page.locator('.issue-row:visible').count(),1);
      await page.fill('#issueSearch','no such issue');
      assert.match(await page.locator('#issueResults').textContent(),/No issues/);
      await page.fill('#issueSearch','');await page.selectOption('#issueSeries','');await page.selectOption('#issueOrder','oldest');
      assert.equal(await page.locator('#na-way .issue-row').first().getAttribute('id'),'na-way-19');
      await page.selectOption('#issueOrder','newest');
      assert.ok(await page.locator('main').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      await page.screenshot({path:`draft-maps/media-checks/publications-${label}.png`});
      await page.goto('http://127.0.0.1:4196/audio/');
      await page.waitForFunction(()=>document.querySelectorAll('[data-audio-library-collection] option').length===6);
      for(let index=0;index<collections.length;index++){
        await page.selectOption('[data-audio-library-collection]',String(index));
        assert.equal(await page.locator('[data-audio-library-episode] option').count(),collections[index].tracks.length+1);
        await page.selectOption('[data-audio-library-episode]','0');
        assert.equal(await page.locator('[data-audio-library-player]').getAttribute('src'),collections[index].tracks[0].audioUrl);
      }
      assert.ok(await page.locator('main').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      await page.screenshot({path:`draft-maps/media-checks/audio-${label}.png`});
      await page.goto('http://127.0.0.1:4196/#07-13');
      await page.waitForSelector('[data-audio-player]');
      await page.waitForSelector('[data-source-audio-player]',{state:'attached'});
      assert.equal(await page.locator('[data-audio-library]').count(),0,'Only collection player moved');
      assert.equal(await page.locator('[data-audio-player]').count(),1,'Daily player stays home');
      await page.locator('[data-speed]').click();
      assert.ok(!(await page.locator('[data-speed]').textContent()).includes('1× Speed'));
      assert.equal(errors.length,0,errors.join('\n'));
      await page.close();
    }
    const request=await browser.newContext();
    for(const issue of issues) assert.equal((await request.request.head('http://127.0.0.1:4196'+issue.pdf)).status(),200,issue.id);
    const page=await request.newPage();
    await page.goto('http://127.0.0.1:4196/publications/');
    await page.locator('#arna-2024-03 .issue-actions a').first().click();
    await page.waitForSelector('.pdf-page canvas',{timeout:45000});
    assert.equal(await page.locator('#readerError').isVisible(),false);
    console.log('PASS: desktop/mobile publication filtering/sorting, all 59 local PDFs, PDF reader, all 5 audio collections, and home daily/source players.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
