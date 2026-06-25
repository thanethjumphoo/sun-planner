const http = require('http');

async function run() {
  const payload = JSON.stringify({
    targetMonth: '2026-06',
    partType: 'bil'
  });

  const req = http.request({
    hostname: 'localhost',
    port: 3333,
    path: '/api/mps/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      try {
        console.log('Response body:', JSON.parse(data));
      } catch (e) {
        console.log('Response body:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request failed:', e.message);
  });

  req.write(payload);
  req.end();
}

run();
