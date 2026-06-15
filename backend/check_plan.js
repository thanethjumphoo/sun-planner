fetch("http://localhost:3333/api/mps/plans/220")
.then(res => res.json())
.then(data => {
  data.data.supplyBreakdown.forEach(s => {
    if(s.byProducts) {
      const bp = JSON.parse(s.byProducts);
      const bl = bp['BL-DEBONE'];
      if(bl && Object.keys(bl.sizes).length === 0) {
        console.log("EMPTY ON", s.productionDate);
      }
    }
  });
  console.log("Done checking.");
})
.catch(console.error);
