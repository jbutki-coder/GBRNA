'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const catalog=require('../data/literature-library.json');
const base=process.env.SITE_URL||'http://127.0.0.1:4198';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH,headless:true});
  try{
    fs.mkdirSync('draft-maps/library-checks',{recursive:true});
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/library/',{waitUntil:'networkidle'});
      await page.waitForFunction(total=>document.getElementById('libraryResults').textContent===`${total} of ${total} titles`,catalog.books.length);
      assert.equal(await page.locator('.library-collection').count(),catalog.categories.length);
      assert.equal(await page.locator('.literature-book-card:visible').count(),catalog.books.length);
      await page.selectOption('#libraryCategory','history');
      assert.equal(await page.locator('.literature-book-card:visible').count(),8);
      await page.fill('#librarySearch','Southern');
      assert.equal(await page.locator('.literature-book-card:visible').count(),1);
      const cover=page.locator('[data-literature-open-book="southern-exposure"]');
      await cover.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{const i=document.querySelector('[data-literature-open-book="southern-exposure"] img');return i.complete&&i.naturalWidth>0});
      await cover.click();
      assert.equal(await page.locator('[data-literature-reader]').isVisible(),true);
      assert.match(await page.locator('[data-literature-frame]').getAttribute('src'),/southern-exposure.pdf/);
      assert.match(await page.locator('[data-literature-download]').getAttribute('href'),/southern-exposure.pdf/);
      await page.locator('.literature-reader-close').click();
      await page.fill('#librarySearch','no-such-title');
      assert.match(await page.locator('#libraryResults').textContent(),/No titles/);
      await page.fill('#librarySearch','');
      await page.selectOption('#libraryCategory','steps');
      assert.equal(await page.locator('.literature-book-card:visible').count(),12);
      await page.fill('#librarySearch','Vito');
      assert.equal(await page.locator('.literature-book-card:visible').count(),1);
      await page.locator('[data-literature-open-book="vito-step-guide"]').click();
      assert.match(await page.locator('[data-literature-frame]').getAttribute('src'),/vito-step-guide.pdf/);
      await page.locator('.literature-reader-close').click();
      await page.fill('#librarySearch','');
      await page.selectOption('#libraryCategory','traditions');
      assert.equal(await page.locator('.literature-book-card:visible').count(),5);
      await page.selectOption('#libraryCategory','chapter-drafts');
      assert.equal(await page.locator('.literature-book-card:visible').count(),10);
      await page.fill('#librarySearch','More Will Be Revealed');
      await page.locator('[data-literature-open-book="bt-draft-more-revealed"]').click();
      assert.match(await page.locator('[data-literature-frame]').getAttribute('src'),/bt-draft-more-revealed.pdf/);
      await page.locator('.literature-reader-close').click();
      await page.locator('.library-categories a[href="/library/#history"]').click();
      assert.equal(await page.locator('.literature-book-card:visible').count(),catalog.books.length);
      assert.equal(await page.locator('#libraryCategory').inputValue(),'');
      for(const image of await page.locator('.literature-book-card img').all()){
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(i=>i.decode());
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`draft-maps/library-checks/library-${width}.png`});
      await page.locator('#history').scrollIntoViewIfNeeded();
      await page.screenshot({path:`draft-maps/library-checks/history-${width}.png`});
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const context=await browser.newContext();
    for(const book of catalog.books.filter(b=>b.sha256)){
      const response=await context.request.get(base+book.pdf,{headers:{Range:'bytes=0-31'}});
      assert.ok([200,206].includes(response.status()),book.id);
      assert.equal((await response.body()).subarray(0,5).toString(),'%PDF-',book.id);
    }
    const page=await context.newPage();
    await page.goto(base+'/pdf-reader.html?url=%2Fliterature%2Flibrary%2Fwhen-it-works.pdf');
    await page.locator('canvas').first().waitFor({state:'visible',timeout:60000});
    console.log('Library browser: desktop/mobile, all covers, six sections, search/filter/empty states, chapter manuscript reader, local PDF links, and reader rendering passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
