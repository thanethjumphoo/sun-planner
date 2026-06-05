const { DataSource } = require('typeorm');

const dataSource = new DataSource({
  type: 'mssql',
  host: '127.0.0.1',
  port: 1433,
  username: 'sa',
  password: 'Your_password123',
  database: 'sun_planner',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
});

async function run() {
  await dataSource.initialize();
  
  const specs = await dataSource.query(`SELECT erp_item_code, master_yield_ids FROM product_specs`);
  const yieldNodes = await dataSource.query(`SELECT id, type, parent_id FROM master_yield`);
  
  const findNode = (id) => yieldNodes.find(n => n.id === id);
  
  const isByproductSpec = (spec) => {
    if (!spec || !spec.master_yield_ids) return false;
    const ids = spec.master_yield_ids.split(',').map(id => id.trim());
    return ids.some(id => {
      const node = findNode(id);
      return node && node.type === 'BY-PRODUCT';
    });
  };
  
  const byProductItemCodes = specs.filter(s => isByproductSpec(s)).map(s => s.erp_item_code);
  console.log("Total ByProduct item codes:", byProductItemCodes.length);
  
  await dataSource.destroy();
}

run().catch(console.error);
