const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'mps.controller.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Convert CRLF to LF for easier replacement
code = code.replace(/\\r\\n/g, '\\n');

if (!code.includes('executeBlPlanGeneration')) {
    code = code.replace(
        `import { MasterYield } from './master-yield.entity';`,
        `import { MasterYield } from './master-yield.entity';\\nimport { executeBlPlanGeneration } from './bl-logic.helper';`
    );
}

// Update categoryMap
const catTarget = `      'fillet': ['สันใน'],
      'bil': ['BIL L/C'],
    };`;
const catReplace = `      'fillet': ['สันใน'],
      'bil': ['BIL L/C'],
      'bl': ['BL'],
    };`;

if (code.includes(catTarget)) {
    code = code.replace(catTarget, catReplace);
}

// Override generatePlan for BL
const target = `    return await this.dataSource.transaction(async (manager) => {
      const targetMonth = body.targetMonth;
      const partType = body.partType || 'fillet';`;

const replacement = `    return await this.dataSource.transaction(async (manager) => {
      const targetMonth = body.targetMonth;
      const partType = body.partType || 'fillet';

      // BL Allocation Override
      if (partType === 'bl') {
          return await executeBlPlanGeneration(body, manager, {
              machineConfigs,
              getItemCodesByPartType: (pt) => this.getItemCodesByPartType(pt),
              parseLocalDate: (val) => {
                  if (!val) return null;
                  if (val instanceof Date) {
                      const y = val.getFullYear();
                      const m = String(val.getMonth() + 1).padStart(2, '0');
                      const d = String(val.getDate()).padStart(2, '0');
                      return \`\${y}-\${m}-\${d}\`;
                  }
                  if (typeof val === 'string') return val.split('T')[0];
                  return null;
              },
              formatDate: (val) => {
                  if (typeof val === 'string') return val;
                  const y = val.getFullYear();
                  const m = String(val.getMonth() + 1).padStart(2, '0');
                  const d = String(val.getDate()).padStart(2, '0');
                  return \`\${y}-\${m}-\${d}\`;
              }
          });
      }`;

if (code.includes(target) && !code.includes('BL Allocation Override')) {
    code = code.replace(target, replacement);
    fs.writeFileSync(filePath, code);
    console.log('mps.controller.ts patched for BL integration successfully');
} else {
    console.log('Already patched or target not found');
}
