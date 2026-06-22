const fs = require('fs');

const toridasPcsPerDay = 3 * 4 * 1500 * 16;
const foodmatePcsPerDay = 1 * 1 * 6000 * 16;
const AVG_BL_PIECE_WEIGHT_KG = 0.25;
const toridasKgPerDay = Math.round(toridasPcsPerDay * AVG_BL_PIECE_WEIGHT_KG * 0.75);
const foodmateKgPerDay = Math.round(foodmatePcsPerDay * AVG_BL_PIECE_WEIGHT_KG * 0.70);
const DEBONE_CAPACITY_KG_PER_DAY = toridasKgPerDay + foodmateKgPerDay;

console.log('DEBONE_CAPACITY_KG_PER_DAY:', DEBONE_CAPACITY_KG_PER_DAY);
