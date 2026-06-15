const fs = require('fs');
let content = fs.readFileSync('src/unified-leg-logic.helper.ts', 'utf8');
content = content.replace(/const allBinDefs = blBeltGateMatrix\.map[\s\S]*?\)\);/m, `const allBinDefs = [
        { key: 'BL 140 Down', lo: 0, hi: 140 },
        { key: 'BL 140-160', lo: 140, hi: 160 },
        { key: 'BL 160-180', lo: 160, hi: 180 },
        { key: 'BL 180-200', lo: 180, hi: 200 },
        { key: 'BL 200-220', lo: 200, hi: 220 },
        { key: 'BL 220-240', lo: 220, hi: 240 },
        { key: 'BL 240-260', lo: 240, hi: 260 },
        { key: 'BL 260-280', lo: 260, hi: 280 },
        { key: 'BL 280-300', lo: 280, hi: 300 },
        { key: 'BL 300-320', lo: 300, hi: 320 },
        { key: 'BL 320-340', lo: 320, hi: 340 },
        { key: 'BL 340-360', lo: 340, hi: 360 },
        { key: 'BL 360-380', lo: 360, hi: 380 },
        { key: 'BL 380 Up', lo: 380, hi: 9999 }
      ];`);
fs.writeFileSync('src/unified-leg-logic.helper.ts', content);
console.log('Reverted fallback bins');
