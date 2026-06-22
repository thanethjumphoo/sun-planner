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
    return pool.request().query(`SELECT mpo.id, mpo.soNumber, mpo.itemCode, mpo.itemDesc, mpo.quantityKg, mp.partType FROM mps_plan_orders mpo JOIN mps_plans mp ON mpo.mpsPlanId = mp.id WHERE mpo.itemDesc LIKE '%HERB FED BL 240-260 G%'`);
}).then(result => {
    console.table(result.recordset);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
