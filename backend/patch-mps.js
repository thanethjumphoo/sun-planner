const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'mps.controller.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add BlBeltGateMatrix to imports
if (!code.includes('BlBeltGateMatrix')) {
    code = code.replace(
        `import { MasterYield } from './master-yield.entity';`,
        `import { MasterYield } from './master-yield.entity';\nimport { BlBeltGateMatrix } from './bl-belt-gate-matrix.entity';`
    );
}

// 2. Inject BlBeltGateMatrix Repository
if (!code.includes('blBeltGateMatrixRepo')) {
    code = code.replace(
        `@InjectRepository(MachineConfig)`,
        `@InjectRepository(BlBeltGateMatrix)\n    private blBeltGateMatrixRepo: Repository<BlBeltGateMatrix>,\n\n    @InjectRepository(MachineConfig)`
    );
}

// 3. Inject new logic into generatePlan around Step 4 (Chill Orders)
// I will not replace the whole order logic yet, but I'll add the matrix fetch.
const fetchMatrixTarget = `    // Step 4: Map CHILL Orders First`;
const fetchMatrixReplacement = `    // Step 4: Map CHILL Orders First (Flexible Lead Time: Ship Date -1 to -3 Days) — WITH Size Matching
    
    // For BL Processing, fetch Belt Gate Matrix
    const blBeltGateMatrix = isBl ? await this.blBeltGateMatrixRepo.find({ order: { priority: 'ASC' }}) : [];
    
    // For BL Processing, we need an I-CUT capacity tracker
    const iCutCapacityTracker = new Map<string, number>(); // date -> used kg
    const MAX_ICUT_CAPACITY = 20000; // Example static capacity, should come from MachineConfig
`;

if (!code.includes('blBeltGateMatrix = isBl')) {
    code = code.replace(
        `    // Step 4: Map CHILL Orders First (Flexible Lead Time: Ship Date -1 to -3 Days) — WITH Size Matching`,
        fetchMatrixReplacement
    );
}

fs.writeFileSync(filePath, code);
console.log('mps.controller.ts patched successfully');
