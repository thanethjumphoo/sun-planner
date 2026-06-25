const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/master-yield/nodes');
    const nodes = res.data;
    console.log('Total nodes:', nodes.length);
    const node = nodes.find(n => n.id.toLowerCase() === '64c3423e-f36b-1410-8fbd-004b1a6d4abe');
    console.log('Found Node 64c3423e:', node);

    const node2 = nodes.find(n => n.id.toLowerCase() === '55c3423e-f36b-1410-8fbd-004b1a6d4abe');
    console.log('Found Node 55c3423e:', node2);

    const types = new Set(nodes.map(n => n.type));
    console.log('All types:', Array.from(types));

  } catch(e) {
    console.error(e);
  }
}
test();
