'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {renderReader,load}=require('../translation-reader.cjs');
const root=path.resolve(__dirname,'../translation-readings');
let count=0,bytes=0;
function write(book,name,query) {
  const html=renderReader({book,...query},true);
  fs.mkdirSync(path.join(root,book),{recursive:true});
  fs.writeFileSync(path.join(root,book,`${name}.html`),html);
  count++;bytes+=Buffer.byteLength(html);
}
const dates=load('jft').map(r=>r.id);
for(const book of ['gbr','jft','tonight','baby','grey']) {
  const ids=['baby','grey'].includes(book)?dates:[...dates,...load(book).flatMap(r=>[r.id,r.id.slice(0,5)])];
  for(const reading of new Set(ids)) write(book,reading,{reading});
  if(['baby','grey'].includes(book)) {
    for(const section of load(book).sections) write(book,`section-${section.id}`,{section:section.id,reading:'01-01'});
  }
}
console.log(`Built ${count} translation-ready pages (${(bytes/1024/1024).toFixed(1)} MB).`);
