const sql = require('mssql');
require('dotenv').config({ path: '.env.development' });

async function run() {
  try {
    const config = {
      user: 'sa', // I need to guess the username, usually sa
      password: process.env.DB_PASSWORD, // or I can just use the typeorm logic
      ...
