(() => {
  'use strict';
  const zones = [
    ['US Eastern','America/New_York'],['US Central','America/Chicago'],
    ['US Mountain','America/Denver'],['US Pacific','America/Los_Angeles'],
    ['Alaska','America/Anchorage'],['Hawaii','Pacific/Honolulu'],
    ['Arizona','America/Phoenix'],['Puerto Rico / US Virgin Islands','America/Puerto_Rico'],
    ['UK','Europe/London'],['Netherlands / Germany / France','Europe/Berlin'],
    ['Poland','Europe/Warsaw'],['Norway / Sweden','Europe/Stockholm'],
    ['South Africa','Africa/Johannesburg'],['Kenya','Africa/Nairobi'],
    ['Brazil (Brasilia)','America/Sao_Paulo'],['India','Asia/Kolkata'],
    ['Philippines','Asia/Manila'],['Japan','Asia/Tokyo'],
    ['Australia (Sydney)','Australia/Sydney'],['New Zealand','Pacific/Auckland']
  ];
  function nextMeeting(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric'}).formatToParts(now);
    let year = Number(parts.find(p=>p.type==='year').value);
    let month = Number(parts.find(p=>p.type==='month').value)-1;
    for (let i=0;i<2;i++,month++) {
      const first = new Date(Date.UTC(year,month,1));
      const day = 1+(7-first.getUTCDay())%7;
      let instant = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),day,19));
      // At this afternoon hour, the Eastern DST offset is stable for the day.
      const hour = Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(instant));
      instant = new Date(instant.getTime()+(14-hour)*3600000);
      if (instant >= now) return instant;
    }
  }
  function format(date, timeZone) {
    return new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports={nextMeeting,format,zones};
  if (typeof document === 'undefined') return;
  const table = document.getElementById('regionalTimeZones');
  if (!table) return;
  const date = nextMeeting();
  document.getElementById('regionalNextDate').textContent = 'Next meeting: '+new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(date)+'.';
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('regionalLocalTime').textContent = 'In your device\'s time zone: '+format(date,localZone)+'.';
  table.replaceChildren(...zones.map(([label,zone])=>{
    const row=document.createElement('tr');
    const name=document.createElement('th');name.scope='row';name.textContent=label;
    const time=document.createElement('td');time.textContent=format(date,zone);
    row.append(name,time);return row;
  }));
})();
