const fs = require('fs');
['src/mps/mps-fillet.service.ts', 'src/mps/mps-bil.service.ts'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/from '\.\//g, "from '../");
  fs.writeFileSync(file, content);
});
console.log('Fixed imports');
