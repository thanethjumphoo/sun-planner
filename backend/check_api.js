const http = require('http');
async function run() {
  http.get('http://localhost:3333/api/master-yield', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const nodes = JSON.parse(data);
      const map = new Map();
      const traverse = (nList) => {
        if (!nList) return;
        nList.forEach(n => {
          map.set(n.id, n.type);
          traverse(n.children);
        });
      };
      traverse(nodes);
      console.log('Total nodes mapped:', map.size);
      const ids = Array.from(map.keys());
      console.log('Sample IDs:', ids.slice(0, 5));
      const hasUpper = map.has('55C3423E-F36B-1410-8FBD-004B1A6D4ABE');
      const hasLower = map.has('55C3423E-F36B-1410-8FBD-004B1A6D4ABE'.toLowerCase());
      console.log('Has uppercase?', hasUpper);
      console.log('Has lowercase?', hasLower);
    });
  });
}
run();
