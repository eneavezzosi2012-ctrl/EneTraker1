// Migrazione dati: azzera profilo e piani di default, mantiene le partite FIP
(function(){
  if(localStorage.getItem('enea_data_version') === '10') return;
  try {
    const pRaw = localStorage.getItem('enea_profile');
    if(pRaw){
      const p = JSON.parse(pRaw);
      if(p && p.name === 'Enea' && p.age === 13)
        localStorage.setItem('enea_profile', JSON.stringify({name:"",age:0,weight:0,height:0}));
    }
  } catch {}
  ['enea_custom_schedule','enea_custom_meal_plan'].forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });
  localStorage.setItem('enea_data_version', '10');
})();
