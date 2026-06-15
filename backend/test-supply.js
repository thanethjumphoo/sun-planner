async function run() {
  try {
    const plansRes = await fetch('http://localhost:3333/api/mps/plans?partType=bl');
    const plansData = await plansRes.json();
    const plan = plansData.results ? plansData.results[0] : plansData[0];
    
    const detailRes = await fetch(`http://localhost:3333/api/mps/plans/${plan.id}`);
    const detailData = await detailRes.json();
    
    const dates = [...new Set(detailData.data.supplyBreakdown.map(s => s.productionDate))];
    console.log(dates);
  } catch (err) {
    console.error(err);
  }
}
run();
