/* Both books share the same reader shell, stylesheet and navigation engine. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const bookPath=path.join(root,'grey-book-study/book.json');
const book=JSON.parse(fs.readFileSync(bookPath,'utf8'));
for(const source of Object.values(book.sources)) if(source.citation.includes('Forward')) Object.assign(source,{page:'i',pageEnd:'i',location:'Forward',citation:'Grey Book, p. i (Forward)'});
fs.writeFileSync(bookPath,JSON.stringify(book,null,2)+'\n');
let html=fs.readFileSync(path.join(root,'baby-blue-study/index.html'),'utf8');
html=html.replaceAll('20261010-text3','20261010-readers2').replaceAll('20261010-readers1','20261010-readers2');
fs.writeFileSync(path.join(root,'baby-blue-study/index.html'),html);
html=html.replace('<body>','<body data-book="grey">').replaceAll('Baby Blue Basic Text','Grey Book').replaceAll('Baby Blue Study','Grey Book Study').replaceAll('Baby Blue','Grey Book').replaceAll('baby-blue-third-edition-revised-screen-reading.pdf','grey-book-memphis-1981-review-form.pdf');
html=html.replace('href="/grey-book-study/">Grey Book Study','href="/grey-book-study/" aria-current="page">Grey Book Study').replace('href="/baby-blue-study/" aria-current="page">Grey Book Study','href="/baby-blue-study/">Baby Blue Study');
html=html.replace('href="https://gbrna.onrender.com/baby-blue-study/"','href="https://gbrna.onrender.com/grey-book-study/"').replace('return=%2Fbaby-blue-study%2F','return=%2Fgrey-book-study%2F');
html=html.replace('Back to Just For Today','Back to Grey Book Reflection').replace('title=Baby%20Blue%20Basic%20Text','title=Grey%20Book');
html=html.replace('Open the related source passage from Just For Today.','Read the source passage from your daily Grey Book Reflection.');
fs.writeFileSync(path.join(root,'grey-book-study/index.html'),html);
console.log('Grey Book shell generated; run extract-grey-book-study.py to rebuild book data.');
