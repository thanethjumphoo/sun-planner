require('dotenv').config({ path: '../.env' });
const { MpsController } = require('./dist/mps.controller.js');
const { MpsService } = require('./dist/mps.service.js');

// I will run the API request via curl instead to ensure it hits the running NestJS server!
