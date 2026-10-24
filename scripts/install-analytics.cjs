'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {injectAnalytics}=require('../analytics.cjs');
const root=path.resolve(__dirname,'..');
const files=execFileSync('git',['ls-files','-z','*.html','*.htm'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
let changed=0;
for(const file of files){
 const target=path.join(root,file);
 const before=fs.readFileSync(target,'utf8');
 const after=injectAnalytics(before);
 if(after!==before){fs.writeFileSync(target,after);changed++;}
}
// Prepare only the analytics edit for a page that has unrelated local work.
if(process.argv.includes('--prepare-clean-fsc')){
 const cleanFsc=execFileSync('git',['show','HEAD:fsc/index.html'],{cwd:root,encoding:'utf8'});
 fs.mkdirSync(path.join(root,'draft-maps/analytics'),{recursive:true});
 fs.writeFileSync(path.join(root,'draft-maps/analytics/fsc-publish.html'),injectAnalytics(cleanFsc));
}
console.log(`Installed shared analytics in ${changed} of ${files.length} HTML pages.`);
