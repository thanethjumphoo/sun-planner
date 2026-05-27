const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'MPSPlan.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const target1 = `  bil: {
    title: 'Bone in Leg',
    rmPrefix: 'RM BIL',
    yieldLabel: 'BIL Yield',
    sizeBreakdownTitle: 'BIL Size Breakdown',
    netLabel: 'Net BIL Available',
  }
};`;

const replacement1 = `  bil: {
    title: 'Bone in Leg',
    rmPrefix: 'RM BIL',
    yieldLabel: 'BIL Yield',
    sizeBreakdownTitle: 'BIL Size Breakdown',
    netLabel: 'Net BIL Available',
  },
  bl: {
    title: 'BL Processing',
    rmPrefix: 'RM BL',
    yieldLabel: 'BL Yield',
    sizeBreakdownTitle: 'BL Size Breakdown',
    netLabel: 'Net BL Available',
  }
};`;

code = code.replace(target1, replacement1);

const target2 = `  const renderSupplyModal = () => {
    if (!showSupplyModal || !selectedSupply) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-500" />
                Supply Breakdown - {selectedDate}
              </h2>
            </div>
            <button onClick={() => setShowSupplyModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white border border-gray-200 p-4 rounded-xl">
                <div className="text-gray-500 text-sm font-medium mb-1">Internal (Farm) Intake</div>
                <div className="text-2xl font-bold text-gray-900">{Number(selectedSupply.internalRmKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
              </div>
              <div className="bg-white border border-gray-200 p-4 rounded-xl">
                <div className="text-gray-500 text-sm font-medium mb-1">External Purchased RM</div>
                <div className="text-2xl font-bold text-gray-900">{Number(selectedSupply.externalRmKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
              </div>
              <div className="bg-white border border-gray-200 p-4 rounded-xl">
                <div className="text-gray-500 text-sm font-medium mb-1">{pc.rmPrefix} Intake (Gross)</div>
                <div className="text-2xl font-bold text-gray-900">{Number(selectedSupply.originalSupplyKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <div className="text-blue-600 text-sm font-medium mb-1">{pc.netLabel}</div>
                <div className="text-2xl font-bold text-blue-900">{Number(selectedSupply.netSupplyKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
              </div>
            </div>

            {renderSizeBreakdown()}
          </div>
        </div>
      </div>
    );
  };`;

const replacement2 = `  const renderSupplyModal = () => {
    if (!showSupplyModal || !selectedSupply) return null;

    const isBl = partId === 'bl';

    let blBreakdown = { "BL": { kg: 0, sizes: {} }, "BL-TH": { kg: 0 }, "BL-DR": { kg: 0 } };
    if (isBl && selectedSupply.byProducts) {
        try {
            blBreakdown = JSON.parse(selectedSupply.byProducts);
        } catch(e) {}
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-500" />
                Supply Breakdown - {selectedDate}
              </h2>
            </div>
            <button onClick={() => setShowSupplyModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            {isBl ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                   <div className="text-blue-600 text-sm font-medium mb-1">RM BL (Debone)</div>
                   <div className="text-2xl font-bold text-gray-900">{blBreakdown['BL']?.kg?.toLocaleString(undefined, {maximumFractionDigits:0}) || 0} kg</div>
                 </div>
                 <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                   <div className="text-orange-600 text-sm font-medium mb-1">RM BL-TH (สะโพก)</div>
                   <div className="text-2xl font-bold text-gray-900">{blBreakdown['BL-TH']?.kg?.toLocaleString(undefined, {maximumFractionDigits:0}) || 0} kg</div>
                 </div>
                 <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                   <div className="text-emerald-600 text-sm font-medium mb-1">RM BL-DR (น่อง)</div>
                   <div className="text-2xl font-bold text-gray-900">{blBreakdown['BL-DR']?.kg?.toLocaleString(undefined, {maximumFractionDigits:0}) || 0} kg</div>
                 </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white border border-gray-200 p-4 rounded-xl">
                  <div className="text-gray-500 text-sm font-medium mb-1">Internal (Farm) Intake</div>
                  <div className="text-2xl font-bold text-gray-900">{Number(selectedSupply.internalRmKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-xl">
                  <div className="text-gray-500 text-sm font-medium mb-1">External Purchased RM</div>
                  <div className="text-2xl font-bold text-gray-900">{Number(selectedSupply.externalRmKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-xl">
                  <div className="text-gray-500 text-sm font-medium mb-1">{pc.rmPrefix} Intake (Gross)</div>
                  <div className="text-2xl font-bold text-gray-900">{Number(selectedSupply.originalSupplyKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                  <div className="text-blue-600 text-sm font-medium mb-1">{pc.netLabel}</div>
                  <div className="text-2xl font-bold text-blue-900">{Number(selectedSupply.netSupplyKg || 0).toLocaleString(undefined, {maximumFractionDigits:0})} kg</div>
                </div>
              </div>
            )}

            {renderSizeBreakdown()}
          </div>
        </div>
      </div>
    );
  };`;

code = code.replace(target2, replacement2);

fs.writeFileSync(filePath, code);
console.log('MPSPlan.tsx patched successfully');
