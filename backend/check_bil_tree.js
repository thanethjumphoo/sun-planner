const sql = require('mssql');
require('dotenv').config({path: '.env'});

async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: process.env.DB_HOST,
      database: process.env.DB_NAME,
      options: {encrypt: false, trustServerCertificate: true}
    });
    
    const bilQuery = await pool.request().query("SELECT * FROM master_yield");
    const nodes = bilQuery.recordset;
    
    const node = nodes.find(n => n.id === '61C3423E-F36B-1410-8FBD-004B1A6D4ABE');
    if (node) {
      const parent = nodes.find(n => n.id === node.parentId);
      if (parent) {
        const children = nodes.filter(n => n.parentId === parent.id);
        console.log('Children of parent:', children.map(c => ({ name: c.name, type: c.type, id: c.id, yield: c.yieldPercentage })));
      }
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
