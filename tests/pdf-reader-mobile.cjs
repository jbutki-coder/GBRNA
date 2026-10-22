'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_URL||'http://127.0.0.1:4197';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});
  try{
    fs.mkdirSync('draft-maps/pdf-reader-checks',{recursive:true});
    for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:width<900});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      // Exercise the same reading-view fallback needed by iPhone Safari.
      await page.addInitScript(()=>Object.defineProperty(Element.prototype,'requestFullscreen',{value:undefined,configurable:true}));
      await page.goto(base+'/pdf-reader.html?url=%2Fliterature%2Flibrary%2Fwhen-it-works.pdf&page=2');
      await page.locator('#pdf-page-2 canvas').waitFor({state:'visible',timeout:60000});
      await page.waitForFunction(()=>document.getElementById('pdf-page-2').dataset.renderGeneration!=='-1');
      assert.ok(await page.locator('#pdfScroll #tradition-six-hosting-notice').count(),'Hosting statement stays inside the document scroll area');
      const stage=await page.locator('#readerStage').boundingBox();
      assert.ok(stage.height>height*(width<height?0.45:0.2),`Document must have usable screen height: ${width}x${height}, ${stage.height}`);
      const canvas=await page.locator('#pdf-page-2 canvas').boundingBox();
      assert.ok(canvas.width>=width*0.9||width>1100,'Document uses phone width');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.locator('#fullScreen').click();
      assert.equal(await page.locator('#fullScreen').getAttribute('aria-pressed'),'true');
      const focused=await page.locator('#readerStage').boundingBox();
      assert.ok(focused.height>stage.height,'Reading view frees screen space without native fullscreen');
      await page.screenshot({path:`draft-maps/pdf-reader-checks/focused-${width}.png`});
      for(let n=0;n<8;n++)await page.locator('#zoomIn').click();
      await page.waitForFunction(()=>document.getElementById('zoomReadout').textContent==='220%');
      await page.waitForTimeout(500);
      const edges=await page.evaluate(()=>{
        const scroll=document.getElementById('pdfScroll');scroll.style.scrollBehavior='auto';scroll.scrollLeft=0;
        const left=document.querySelector('#pdf-page-2 canvas').getBoundingClientRect().left;
        scroll.scrollLeft=scroll.scrollWidth;
        return {left,right:scroll.scrollLeft,width:scroll.scrollWidth,client:scroll.clientWidth};
      });
      assert.ok(edges.left>=-1,'Zoomed page left edge remains reachable');
      assert.ok(edges.right>0&&edges.width>edges.client,'Zoomed document can pan horizontally: '+JSON.stringify(edges));
      await page.locator('#fitWidth').click();
      await page.waitForFunction(()=>document.getElementById('zoomReadout').textContent==='100%');
      await page.locator('#nextPage').click();
      await page.waitForFunction(()=>document.getElementById('pageReadout').textContent.startsWith('3 /'));
      await page.locator('#fullScreen').click();
      assert.equal(await page.locator('#fullScreen').getAttribute('aria-pressed'),'false');
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('PASS: phone, small phone, landscape and desktop document space; fullscreen fallback, zoom/pan, fit width and navigation.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
