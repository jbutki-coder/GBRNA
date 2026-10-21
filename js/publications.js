(() => {
  'use strict';
  const search=document.getElementById('issueSearch');
  const series=document.getElementById('issueSeries');
  const order=document.getElementById('issueOrder');
  const rows=[...document.querySelectorAll('.issue-row')];
  function filter(){
    const query=search.value.trim().toLowerCase();
    let shown=0;
    for(const section of document.querySelectorAll('.publication-section')){
      let count=0;
      const list=section.querySelector('.issue-list');
      [...list.children].sort((a,b)=>(Number(a.dataset.order)-Number(b.dataset.order))*(order.value==='newest'?-1:1)).forEach(row=>{
        row.hidden=Boolean((series.value&&section.dataset.series!==series.value)||(query&&!row.textContent.toLowerCase().includes(query)));
        if(!row.hidden){count++;shown++;}
        list.append(row);
      });
      section.hidden=count===0;
      section.querySelector('[data-issue-count]').textContent=`${count} issues`;
    }
    document.getElementById('issueResults').textContent=shown?`${shown} of ${rows.length} issues`:'No issues match your search.';
  }
  search.addEventListener('input',filter);series.addEventListener('change',filter);order.addEventListener('change',filter);
  filter();
})();
