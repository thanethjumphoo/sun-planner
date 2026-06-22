const sql = require('mssql');
(async () => {
  try {
    await sql.connect('mssql://sa:YourStrong!Passw0rd@localhost/sun_planner');
    const result = await sql.query("SELECT id, so_number, item_code, quantity_kg FROM mps_plan_orders WHERE so_number='1411012602907'");
    console.log(JSON.stringify(result.recordset, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    sql.close();
  }
})();
