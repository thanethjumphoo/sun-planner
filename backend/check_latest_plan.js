fetch("http://localhost:3333/api/mps/plans")
.then(res => res.json())
.then(plans => {
  const bilPlans = plans.filter(p => p.partType === 'bil');
  if(bilPlans.length > 0) {
    const maxPlan = bilPlans.reduce((prev, current) => (prev.id > current.id) ? prev : current);
    console.log("Latest BIL Plan:", maxPlan.id, maxPlan.targetMonth);
    
    // fetch its details
    fetch("http://localhost:3333/api/mps/plans/" + maxPlan.id)
      .then(r => r.json())
      .then(d => {
        // find a day with max supply
        const supplies = d.data.supplyBreakdown;
        const s = supplies.find(x => x.productionDate.startsWith("2026-06-11"));
        console.log("June 11 byProducts:", s ? s.byProducts : "No supply");
      });
  }
})
.catch(console.error);
