const sql = require('mssql')
require('dotenv').config()

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASS || 'Your_password123',
    server: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'sun_planner',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
}

async function run() {
    try {
        await sql.connect(config)
        const result = await sql.query(`
            UPDATE master_yield 
            SET type = 'BY-PRODUCT'
            WHERE name IN (
                N'หนังติดมันเกรด A', 
                N'เศษ BL no.2', 
                N'กระดูกน่องสะโพกติดข้อเต็ม', 
                N'กระดูกน่อง', 
                N'BL แผ่น', 
                N'เศษเนื้อแข้งติดกระดูก',
                N'ข้อสั้น'
            ) AND type = 'PRODUCT'
        `);
        console.log("Rows affected:", result.rowsAffected);
    } catch (err) {
        console.error(err)
    } finally {
        process.exit()
    }
}

run()
