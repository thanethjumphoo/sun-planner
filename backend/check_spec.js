const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Your_password123',
    server: '127.0.0.1', 
    database: 'sun_planner',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};
sql.connect(config).then(pool => {
    return pool.request().query("SELECT * FROM master_yield WHERE id = '0C5069F0-6F5A-F111-A9AC-E0071B8A3D2C'");
}).then(result => {
    console.table(result.recordset);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
