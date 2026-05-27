const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'mssql', host: 'localhost', port: 1433,
  username: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true },
});
ds.initialize().then(async () => {
  // Check what node 0C23433E is
  const r = await ds.query("SELECT id, name, type, parentId FROM master_yield WHERE id = '0C23433E-F36B-1410-8FC5-004B1A6D4ABE'");
  console.log('Node 0C23433E:', JSON.stringify(r, null, 2));

  // Find its parent chain
  if (r.length > 0 && r[0].parentId) {
    const p = await ds.query("SELECT id, name, type, parentId FROM master_yield WHERE id = @0", [r[0].parentId]);
    console.log('Parent:', JSON.stringify(p, null, 2));
    if (p.length > 0 && p[0].parentId) {
      const gp = await ds.query("SELECT id, name, type, parentId FROM master_yield WHERE id = @0", [p[0].parentId]);
      console.log('Grandparent:', JSON.stringify(gp, null, 2));
    }
  }

  // Also check 61C3423E (BL UNSIZED node)
  const r2 = await ds.query("SELECT id, name, type, parentId FROM master_yield WHERE id = '61C3423E-F36B-1410-8FBD-004B1A6D4ABE'");
  console.log('\nNode 61C3423E (BL UNSIZED):', JSON.stringify(r2, null, 2));
  if (r2.length > 0 && r2[0].parentId) {
    const p2 = await ds.query("SELECT id, name, type, parentId FROM master_yield WHERE id = @0", [r2[0].parentId]);
    console.log('Parent:', JSON.stringify(p2, null, 2));
  }

  await ds.destroy();
}).catch(e => console.error(e.message));
