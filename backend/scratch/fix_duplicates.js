const fs = require('fs');
['src/mps/mps-fillet.service.ts', 'src/mps/mps-bil.service.ts'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const sysConfigList = await this\.systemConfigService\.getAllConfigs\(\);\n\s+const sysConfigs = sysConfigList\.reduce\(\(acc, c\) => \{ acc\[c\.configKey\] = c\.configValue; return acc; \}, \{\}\);\n\s+const sysConfigList = await this\.systemConfigService\.getAllConfigs\(\);\n\s+const sysConfigs = sysConfigList\.reduce\(\(acc, c\) => \{ acc\[c\.configKey\] = c\.configValue; return acc; \}, \{\}\);/g, `const sysConfigList = await this.systemConfigService.getAllConfigs();
    const sysConfigs = sysConfigList.reduce((acc, c) => { acc[c.configKey] = c.configValue; return acc; }, {});`);
  fs.writeFileSync(file, content);
});
console.log('Fixed duplicates');
