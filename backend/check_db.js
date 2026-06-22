const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'sqlite',
  database: 'C:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/database.sqlite'
});
ds.initialize().then(async () => {
  const res = await ds.query(`SELECT * FROM stg_product_spec WHERE erpItemCode = '111114213'`);
  console.log(res);
  process.exit(0);
});
