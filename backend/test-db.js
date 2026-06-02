const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all('SELECT erpItemCode, isExternalRmAllowed FROM product_spec WHERE isExternalRmAllowed = 1', (err, rows) => {
  console.log(JSON.stringify(rows));
});
