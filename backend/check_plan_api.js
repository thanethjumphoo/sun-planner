const http = require('http');
async function run() {
  http.get('http://localhost:3333/api/mps/plans?partType=bil', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const plans = JSON.parse(data);
      const latest = plans.find(p => p.partType === 'leg');
      console.log('Latest Leg Plan ID:', latest?.id);
      if (latest) {
        http.get(`http://localhost:3333/api/mps/plans/${latest.id}`, res2 => {
          let data2 = '';
          res2.on('data', chunk => data2 += chunk);
          res2.on('end', () => {
            const planDetails = JSON.parse(data2);
            const orders = planDetails.data?.orders || planDetails.data?.mpsPlanOrders || [];
            console.log('Total orders in plan:', orders.length);
            const bpOrders = orders.filter(o => o.itemCode === '111119118');
            console.log('Orders for 111119118:', bpOrders);
          });
        });
      }
    });
  });
}
run();
