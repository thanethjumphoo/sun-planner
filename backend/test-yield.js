const { DataSource } = require('typeorm');
const myDataSource = new DataSource({
  type: 'sqlite',
  database: 'backend/sun-planner.sqlite',
  entities: ['backend/dist/**/*.entity.js']
});
myDataSource.initialize().then(async () => {
  const nodes = await myDataSource.query('SELECT * FROM master_yield');
  const cat = nodes.filter(n => n.type === 'CATEGORY' && n.name === 'BIL L/C');
  console.log('BIL CATEGORIES:', cat);
  let ids = [];
  const collect = (p) => {
    const c = nodes.filter(n => n.parentId === p);
    for (const x of c) { ids.push(x.id); collect(x.id); }
  };
  cat.forEach(c => { ids.push(c.id); collect(c.id); });
  const items = nodes.filter(n => n.type === 'PRODUCT' && ids.includes(n.id) && n.erpItemCode).map(n => n.erpItemCode);
  console.log('BIL Items:', items);
}).catch(console.error);
