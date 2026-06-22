const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/local.db');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
    process.exit(0);
});
