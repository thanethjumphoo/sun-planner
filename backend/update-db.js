const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // for local dev
    trustServerCertificate: true
  }
};

async function updateMatrix() {
  try {
    await sql.connect(config);
    console.log('Connected to DB');

    const replaceRules = [
      { old: 'BL 180 Down', new: 'BL 140 Down' },
      { old: 'BL 180-210', new: 'BL 140-160' },
      { old: 'BL 210-230', new: 'BL 160-180' },
      { old: 'BL 230-260', new: 'BL 180-200' },
      { old: 'BL 260-280', new: 'BL 200-220' },
      { old: 'BL 280-310', new: 'BL 220-240' },
      { old: 'BL 310-330', new: 'BL 240-260' },
      { old: 'BL 330-360', new: 'BL 260-280' },
      { old: 'BL 360-390', new: 'BL 280-300' },
      { old: 'BL 390-410', new: 'BL 300-320' },
      { old: 'BL 410-440', new: 'BL 320-340' },
      { old: 'BL 440-460', new: 'BL 340-360' },
      { old: 'BL 460-490', new: 'BL 360-380' },
      { old: 'BL 490 Up', new: 'BL 380 Up' }
    ];

    for (const rule of replaceRules) {
      await sql.query`UPDATE bl_belt_gate_matrix SET rmSize = ${rule.new} WHERE rmSize = ${rule.old}`;
      console.log(`Updated ${rule.old} to ${rule.new}`);
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updateMatrix();
