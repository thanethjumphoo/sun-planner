const fs = require('fs');
['src/dps/dps-fillet.service.ts', 'src/dps/dps-bil.service.ts'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/from '\.\/dps-plan\.entity';/g, "from '../dps-plan.entity';");
  fs.writeFileSync(file, content);
});
console.log('Fixed DPS entity imports');
