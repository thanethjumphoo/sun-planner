const fs = require('fs');
['src/mps/mps-fillet.service.ts', 'src/mps/mps-bil.service.ts'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ executeUnifiedLegPlanGeneration \}/g, "import { SystemConfigService } from '../system-config/system-config.service';\nimport { executeUnifiedLegPlanGeneration }");
  content = content.replace(/private chickenReceivingService: ChickenReceivingService,/g, "private chickenReceivingService: ChickenReceivingService,\n    private systemConfigService: SystemConfigService,");
  fs.writeFileSync(file, content);
});
console.log('Injected SystemConfigService');
