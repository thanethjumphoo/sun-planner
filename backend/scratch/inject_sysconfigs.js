const fs = require('fs');
['src/mps/mps-fillet.service.ts', 'src/mps/mps-bil.service.ts'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Inject in generatePlan for BL logic
  content = content.replace(/const getMachineConfig = \(key: string, defaults: any\) => \{/g, `const sysConfigList = await this.systemConfigService.getAllConfigs();
    const sysConfigs = sysConfigList.reduce((acc, c) => { acc[c.configKey] = c.configValue; return acc; }, {});
    const getMachineConfig = (key: string, defaults: any) => {`);

  // Pass sysConfigs to executeBlPlanGeneration
  content = content.replace(/masterYieldRepo: this\.masterYieldRepo,\n\s+blBeltGateMatrixRepo: this\.blBeltGateMatrixRepo,\n\s+bilWeightDistRepo: this\.bilWeightDistRepo,/g, `masterYieldRepo: this.masterYieldRepo,
          blBeltGateMatrixRepo: this.blBeltGateMatrixRepo,
          bilWeightDistRepo: this.bilWeightDistRepo,
          sysConfigs,`);

  // Inject in generateUnifiedLegPlan
  content = content.replace(/const machineConfigs = await this\.machineConfigRepo\.find\(\{ where: \{ isActive: true \} \}\);/g, `const machineConfigs = await this.machineConfigRepo.find({ where: { isActive: true } });
    const sysConfigList = await this.systemConfigService.getAllConfigs();
    const sysConfigs = sysConfigList.reduce((acc, c) => { acc[c.configKey] = c.configValue; return acc; }, {});`);

  // Pass sysConfigs to executeUnifiedLegPlanGeneration
  content = content.replace(/bilWeightDistRepo: this\.bilWeightDistRepo,\n\s+chickenReceivingService: this\.chickenReceivingService,/g, `bilWeightDistRepo: this.bilWeightDistRepo,
        chickenReceivingService: this.chickenReceivingService,
        sysConfigs,`);

  fs.writeFileSync(file, content);
});
console.log('Injected sysConfigs passing');
