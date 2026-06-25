const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('planner.sqlite');
db.all("SELECT id, erp_item_code, part_type FROM product_spec WHERE erp_item_code = '111119118'", (err, rows) => {
  if (err) console.error(err);
  console.log("Rows:", rows);
});
