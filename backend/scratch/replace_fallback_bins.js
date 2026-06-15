const fs = require('fs');
let content = fs.readFileSync('src/unified-leg-logic.helper.ts', 'utf8');
content = content.replace(/const allBinDefs = \[\s*\{ key: 'BL 140 Down'[\s\S]*?\{ key: 'BL 380 Up'.*\}\s*\];/m, "const allBinDefs = blBeltGateMatrix.map(b => ({ key: b.gateLabel, lo: b.minWeight, hi: b.maxWeight }));");
fs.writeFileSync('src/unified-leg-logic.helper.ts', content);
console.log('Replaced fallback bins with blBeltGateMatrix');
