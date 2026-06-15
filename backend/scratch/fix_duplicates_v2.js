const fs = require('fs');
['src/mps/mps-fillet.service.ts', 'src/mps/mps-bil.service.ts'].forEach(file => {
  let lines = fs.readFileSync(file, 'utf8').split('\n');
  let output = [];
  let found = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // We want to keep the FIRST occurrence of sysConfigList inside generatePlan, but wait!
    // generateUnifiedLegPlan and generatePlan BOTH need it.
    // Actually, looking at the previous search, lines 363 and 365 are identical.
    
    // Let's just remove lines that match exactly if they are followed by the same line.
    // A simpler way: Find line containing 'const sysConfigList =' and check if the previous 2 lines also contained it.
    if (line.includes('const sysConfigList =')) {
      if (lines[i-2] && lines[i-2].includes('const sysConfigList =')) {
        // Skip this line and the next line (const sysConfigs = ...)
        i++;
        continue;
      }
    }
    output.push(line);
  }
  
  fs.writeFileSync(file, output.join('\n'));
});
console.log('Fixed duplicates properly');
