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
    return pool.request().query("SELECT * FROM machine_config");
}).then(result => {
    console.table(result.recordset);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
