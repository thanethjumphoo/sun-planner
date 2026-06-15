async function run() {
  try {
    const res = await fetch('http://localhost:3333/api/mps/generate-unified-leg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMonth: '2026-06', partType: 'bl' })
    });
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}

run();
