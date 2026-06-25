const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3333,
  path: '/api/mps/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      console.log('Response:', parsed);
    } catch(e) {
      console.log('Raw response:', data.substring(0, 1000));
    }
  });
});

req.on('error', error => {
  console.error('Request Error:', error.message);
});

req.write(JSON.stringify({
  partType: 'leg',
  targetMonth: '2026-06'
}));
req.end();
