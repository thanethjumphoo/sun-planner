const fs = require('fs');

const extract = (code) => {
  const lines = code.split('\n');
  return lines.map((l, i) => ({l, i: i+1}))
    .filter(x => x.l.match(/^ *(?:const|function|let|class)\s+\w+\s*=?\s*(?:async\s*)?(?:\([^)]*\)|.*?=>)/) || x.l.includes('useEffect') || x.l.includes('useMemo'))
    .map(x => x.i + ': ' + x.l.trim());
};

const mps = fs.readFileSync('frontend/src/pages/MPSPlan.tsx', 'utf8');
const dps = fs.readFileSync('frontend/src/pages/DPSPlan.tsx', 'utf8');

fs.writeFileSync('frontend/src/pages/function_summary.txt', '--- MPSPlan ---\n' + extract(mps).join('\n') + '\n--- DPSPlan ---\n' + extract(dps).join('\n'));
console.log('Done');
