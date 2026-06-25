const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = 'C:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/database.sqlite';

if (fs.existsSync(dbPath)) {
  const db = new sqlite3.Database(dbPath);
  db.all("SELECT id, mpsPlanId, soNumber, itemDesc, quantityKg FROM mps_plan_orders ORDER BY id DESC LIMIT 5", [], (err, rows) => {
    if (err) {
      console.error('SQLite Error:', err);
    } else {
      console.log('SQLite latest MpsPlanOrders:');
      console.table(rows);
    }
    db.close();
  });
} else {
  console.log('SQLite db not found');
}
