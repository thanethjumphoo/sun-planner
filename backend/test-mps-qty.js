const { DataSource } = require('typeorm');
const { MpsPlan, MpsPlanOrder } = require('./src/mps-plan.entity');
const { StgErpOrderLine } = require('./src/stg-erp-order-line.entity');
// Need to add all entities needed for connection, or just use query builder directly without all entities if possible.
