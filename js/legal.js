'use strict';
(() => {
  const search=document.getElementById('legalSearch');
  const group=document.getElementById('legalGroup');
  const kind=document.getElementById('legalKind');
  const sections=[...document.querySelectorAll('.legal-section')].map(section=>({section,rows:[...section.querySelectorAll('.legal-row')].map(row=>({row,text:row.textContent.toLowerCase()}))}));
  function update(){
    const terms=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let total=0;
    for(const {section,rows} of sections){
      let count=0;
      for(const {row,text} of rows){
        const matches=(!group.value||section.dataset.group===group.value)&&(!kind.value||row.dataset.kind===kind.value)&&terms.every(term=>text.includes(term));
        row.hidden=!matches;
        if(matches)count++;
      }
      section.hidden=count===0;
      section.querySelector('[data-group-count]').textContent=`${count} ${count===1?'document':'documents'}`;
      total+=count;
    }
    document.getElementById('legalResults').textContent=`${total} ${total===1?'document':'documents'}`;
    document.getElementById('legalEmpty').hidden=total!==0;
  }
  search.addEventListener('input',update);
  group.addEventListener('change',update);
  kind.addEventListener('change',update);
})();
