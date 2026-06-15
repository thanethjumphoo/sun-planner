export const MPS_CONSTANTS = {
  // Part Types
  PART_TYPES: {
    FILLET: 'fillet',
    BIL: 'bil',
    BL: 'bl',
    LEG: 'leg',
  },

  // Category Names from Master Yield
  CATEGORIES: {
    FILLET: ['สันใน'],
    BIL: ['BIL L/C', 'BIL S/C'],
    BL: ['BL Processing', 'RM: BL (ทั้งชิ้น)', 'RM: BLDR (น่อง)', 'RM: BLT (สะโพก)'],
  },

  // Item Keywords (Used in Order Descriptions & ByProducts)
  KEYWORDS: {
    BL_BLOCK: ['BL BLOCK', 'BL_BLOCK', 'BLBLOCK'],
    BL_TH: ['BL TH', 'BL-TH', 'BLTH', 'สะโพก'],
    BL_DR: ['BL DR', 'BL-DR', 'BLDR', 'น่อง'],
    BLK: ['BLK'],
    BL_DEBONE: ['BL-DEBONE', 'BL', 'BL (Debone)'],
  },

  // Customer Grade Ranking Priorities
  GRADE_WEIGHTS: {
    'A+': 1,
    'A': 2,
    'GRADE A': 2,
    'B': 3,
    'GRADE B': 3,
    'C': 4,
    'D': 5,
    'DEFAULT': 6,
    '-': 7,
  },

  // Default values before moving to SystemConfig (Phase 2)
  DEFAULTS: {
    MAX_LEAD_DAYS: 90,
    CHILLED_OFFSET_DAYS: 1,
    FREEZE_OFFSET_DAYS: 5,
    FREEZE_PROD_ADD_DAYS: 4,
    BIL_YIELD: 0.25,
    BL_TH_RATIO: 0.75,
    BL_DR_RATIO: 0.75,
    FILLET_YIELD: 0.04,
    FILLET_GRADE_B_WASTE_MULTIPLIER: 0.907, // to match Net Fillet
    SLAUGHTER_YIELD: 0.9575 * 0.95, // Common SLAUGHTER base yield
    ICUT_COPRODUCT_YIELD: 0.20,
    MANUAL_PRODUCT_YIELD: 0.90,
    ICUT_SPEED: 1000,
  },

  // Machine Defaults
  MACHINES: {
    ICUT: {
      DEFAULT_HOURS_PER_SHIFT: 9.58,
      DEFAULT_SHIFTS_PER_DAY: 2,
      get MAX_HOURS_PER_DAY() {
        return Math.round(this.DEFAULT_HOURS_PER_SHIFT * this.DEFAULT_SHIFTS_PER_DAY);
      }
    }
  }
};
