const fs = require('fs');

let content = fs.readFileSync('src/pages/MPSPlan.tsx', 'utf8');

// Fix 'bilColLabels' unused
content = content.replace(/const bilColLabels = \[[\s\S]*?\];/g, '');

// Fix Object.entries(v.sizes) type issue
content = content.replace(/Object\.entries\(v\.sizes\)\.forEach\(\(\[bilSz, qty\]\) =>/g, "Object.entries(v.sizes).forEach(([bilSz, qty]: [string, any]) =>");
content = content.replace(/Object\.entries\(v\.sizes \|\| \{\}\)\.forEach\(\(\[sz, qty\]\) =>/g, "Object.entries(v.sizes || {}).forEach(([sz, qty]: [string, any]) =>");
content = content.replace(/Object\.entries\(r\.sizes \|\| \{\}\)\.forEach\(\(\[sz, qty\]\) =>/g, "Object.entries(r.sizes || {}).forEach(([sz, qty]: [string, any]) =>");
content = content.replace(/Object\.entries\(r\.blSizes \|\| \{\}\)\.forEach\(\(\[sz, qty\]\) =>/g, "Object.entries(r.blSizes || {}).forEach(([sz, qty]: [string, any]) =>");
content = content.replace(/Object\.entries\(drSizes \|\| \{\}\)\.forEach\(\(\[sz, qty\]\) =>/g, "Object.entries(drSizes || {}).forEach(([sz, qty]: [string, any]) =>");

// Fix isBil unused
content = content.replace(/const isBil = rowData\.name\.includes\('BIL'\);/g, '');

fs.writeFileSync('src/pages/MPSPlan.tsx', content);
console.log('Fixed MPSPlan.tsx TS errors');
