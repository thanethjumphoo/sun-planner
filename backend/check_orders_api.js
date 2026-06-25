const http = require('http');
async function run() {
  http.get('http://localhost:3333/api/mps/approved-orders/2026-06-07?partType=bil', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const orders = JSON.parse(data);
      console.log('Orders on 2026-06-07:', orders.map(o => ({ itemCode: o.itemCode, qty: o.quantityKg })));
    });
  });
}
run();
