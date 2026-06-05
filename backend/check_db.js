const { DataSource } = require('typeorm');
const ProductSpec = require('./src/entities/productSpec.entity').ProductSpec;
const MasterYield = require('./src/entities/masterYield.entity').MasterYield;

const ds = new DataSource({
  type: 'sqlite',
  database: './database.sqlite',
  entities: [ProductSpec, MasterYield]
});

ds.initialize().then(async () => {
  const spec = await ds.manager.findOneBy(ProductSpec, { erpItemCode: '111149201' });
  console.log('Spec 111149201 masterYieldIds:', spec?.masterYieldIds);
  
  const ids = spec?.masterYieldIds ? spec.masterYieldIds.split(',').map(id => id.trim()) : [];
  
  if (ids.length > 0) {
     for (const id of ids) {
        const yieldNode = await ds.manager.findOneBy(MasterYield, { id: id });
        console.log(`Mapped ID ${id} -> Name: ${yieldNode?.name}, Type: ${yieldNode?.type}`);
     }
  }

  const luksunNai = await ds.manager.find(MasterYield, { where: { name: 'ลูกสันใน' } });
  console.log('Nodes named "ลูกสันใน":');
  luksunNai.forEach(n => console.log(` - ID: ${n.id}, Name: ${n.name}, Type: ${n.type}, Parent: ${n.parentId}`));

  process.exit(0);
});
