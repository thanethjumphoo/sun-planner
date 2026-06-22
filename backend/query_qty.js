const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'sqlite',
  database: 'C:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/database.sqlite'
});
ds.initialize().then(async () => {
  const res = await ds.query(`SELECT mpo.id, mpo.soNumber, mpo.itemCode, mpo.itemDesc, mpo.quantityKg, mp.partType FROM mps_plan_orders mpo JOIN mps_plans mp ON mpo.mpsPlanId = mp.id WHERE mpo.itemDesc LIKE '%HERB FED BL 240-260 G%'`);
  console.table(res);
  process.exit(0);
});
