'use strict';
(() => {
  const destinations={'#library':'/library/','#download':'/library/#downloads','#asis-ips':'/asis-ips/','#fsc':'/fsc/','#newcomer':'/#about'};
  function redirectLegacySection(){
    const target=destinations[location.hash];
    if(target)location.replace(target);
  }
  redirectLegacySection();
  window.addEventListener('hashchange',redirectLegacySection);
})();
