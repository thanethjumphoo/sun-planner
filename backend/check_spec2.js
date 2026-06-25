const http = require('http');
async function run() {
  http.get('http://localhost:3333/api/product-spec', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const specs = JSON.parse(data);
      const spec = specs.find(s => s.erpItemCode === '111119118');
      console.log('Spec for 111119118:', spec);
    });
  });
}
run();
