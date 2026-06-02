const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT name, yieldPercentage, type FROM master_yield WHERE type='CATEGORY'", (err, rows) => {
  if (err) console.error(err);
  console.log(rows);
});
