const fs = require('fs');
const path = require('path');

const mpsPlanPath = path.join(__dirname, 'src', 'pages', 'MPSPlan.tsx');
let content = fs.readFileSync(mpsPlanPath, 'utf8');

const hoistTargetStr = "const isMainProductSpec = (itemCode: string): boolean => {";

const functionStr = `
  const renderDemandByYieldTreeGroup = (
    title: string,
    themeColor: string,
    ordersList: any[],
    typeFilter: 'coproduct' | 'byproduct',
    currentSupply: any
  ) => {
    let byProductsSupply: Record<string, { name: string; qty: number; processName?: string }> = {};
    if (currentSupply && currentSupply.byProducts) {
      try {
        byProductsSupply = JSON.parse(currentSupply.byProducts);
      } catch (e) {
        console.error('Error parsing byProducts', e);
      }
    }

    const resolveByproductName = (key: string): string => {
      if (byProductsSupply[key]?.name) return byProductsSupply[key].name;
      if (specs[key]) return specs[key].erpItemDesc || specs[key].erpItemCode || key;
      const foundSpec: any = Object.values(specs).find((s: any) =>
        s.masterYieldIds?.split(',').map((id: any) => id.trim()).includes(key)
      );
      if (foundSpec) return foundSpec.erpItemDesc || foundSpec.erpItemCode || key;
      return key;
    };

    interface GroupedItem {
      name: string;
      supplyQty: number;
      demandQty: number;
      orders: any[];
    }

    const groupedMap: Record<string, GroupedItem> = {};

    const getOrCreateGroup = (name: string): GroupedItem => {
      if (!groupedMap[name]) groupedMap[name] = { name, supplyQty: 0, demandQty: 0, orders: [] };
      return groupedMap[name];
    };

    Object.keys(byProductsSupply).forEach(key => {
      const sInfo = byProductsSupply[key];
      if (sInfo && sInfo.qty > 0) {
        const nodeType = yieldNodeTypeMap.get(key);
        const isMatch = typeFilter === 'coproduct' ? nodeType === 'CO-PRODUCT' : nodeType === 'BY-PRODUCT';
        if (isMatch) {
          const name = resolveByproductName(key);
          const grp = getOrCreateGroup(name);
          grp.supplyQty += sInfo.qty;
        }
      }
    });

    ordersList.forEach(o => {
      const spec = specs[o.itemCode];
      const bpId = spec?.masterYieldIds?.split(',').map((id: any) => id.trim())[0];
      const key = bpId || o.itemCode;
      const name = resolveByproductName(key);
      const grp = getOrCreateGroup(name);
      grp.demandQty += o.qty;
      grp.orders.push(o);
    });

    const groups = Object.values(groupedMap);
    if (groups.length === 0) return null;

    const borderTheme = themeColor === 'purple' ? 'border-purple-200 bg-purple-50/20' : 'border-amber-200 bg-amber-50/20';
    const titleTheme = themeColor === 'purple' ? 'text-purple-700' : 'text-amber-700';
    const lineTheme = themeColor === 'purple' ? 'bg-purple-500' : 'bg-amber-500';
    const expandedBorder = themeColor === 'purple' ? 'border-purple-200' : 'border-amber-200';
    const hoverTheme = themeColor === 'purple' ? 'hover:bg-purple-50/50' : 'hover:bg-amber-50/50';

    return (
      <div className={\`border \${borderTheme} rounded-xl p-4 space-y-3\`}>
        <p className={\`text-[10px] font-bold \${titleTheme} uppercase tracking-wider\`}>{title}</p>
        <div className="space-y-1">
          {groups.map(group => {
            const supplyQty = Math.round(group.supplyQty);
            const demandQty = Math.round(group.demandQty);
            const remaining = supplyQty - demandQty;
            if (supplyQty === 0 && demandQty === 0) return null;
            const isExpanded = expandedSizeBins[group.name] || false;
            const ords = group.orders;

            return (
              <div key={group.name}>
                <div
                  className={\`bg-white rounded-lg p-2.5 border border-gray-100 flex items-center gap-3 cursor-pointer \${hoverTheme} transition-colors\`}
                  onClick={() => setExpandedSizeBins((prev: any) => ({ ...prev, [group.name]: !prev[group.name] }))}
                >
                  <div className={\`w-2 h-8 rounded-full \${lineTheme}\`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-600 uppercase">{group.name}</span>
                      {ords.length > 0 && (
                        <span className="text-[9px] text-gray-400">
                          {isExpanded ? '▲' : '▼'} {ords.length} orders
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs mt-0.5">
                      <span className="text-emerald-600">Supply: <b>{supplyQty.toLocaleString()}</b></span>
                      <span className="text-orange-600">Demand: <b>{demandQty.toLocaleString()}</b></span>
                      <span className={remaining >= 0 ? 'text-blue-600' : 'text-red-600 font-bold'}>
                        {remaining >= 0 ? 'Rem' : 'Short'}: <b>{Math.abs(remaining).toLocaleString()}</b>
                      </span>
                    </div>
                  </div>
                </div>
                {isExpanded && ords.length > 0 && (
                  <div className={\`ml-5 mt-1 mb-2 border-l-2 \${expandedBorder} pl-3 space-y-1\`}>
                    {ords.map((ord: any, idx: number) => {
                      const spec = specs[ord.itemCode];
                      return (
                      <div key={idx} className="flex items-center gap-2 text-[11px] py-1 px-2 bg-white/80 rounded border border-gray-100">
                        <span className={\`px-1.5 py-0.5 rounded text-[9px] font-bold \${ord.type === 'chilled' ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'}\`}>
                          {ord.type === 'chilled' ? 'C' : 'F'}
                        </span>
                        {Number(spec?.icutSpeed) > 0 && (
                          <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-tighter">
                            I-CUT
                          </span>
                        )}
                        <span className="font-bold text-gray-700">{ord.soNumber}</span>
                        <span className="text-gray-400 text-[10px]">{ord.itemCode}</span>
                        <span className="ml-auto font-bold text-gray-900">{Math.round(ord.qty).toLocaleString()} kg</span>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

`;

content = content.replace(hoistTargetStr, functionStr + hoistTargetStr);

// In the RIGHT panel, replace the calls to pass selectedSupply
content = content.replace(
  "{renderDemandByYieldTreeGroup('Demand by Co-Product', 'purple', coproductOrders, 'coproduct')}",
  "{renderDemandByYieldTreeGroup('Demand by Co-Product', 'purple', coproductOrders, 'coproduct', selectedSupply)}"
);
content = content.replace(
  "{renderDemandByYieldTreeGroup('Demand by By-Product', 'amber', byproductOrders, 'byproduct')}",
  "{renderDemandByYieldTreeGroup('Demand by By-Product', 'amber', byproductOrders, 'byproduct', selectedSupply)}"
);

// In the LEFT panel (Section 4.6), add the call!
const bilSectionContent = `const process3ByProducts = (selectedSupply as any)._process3ByProducts || {};
                        const bpKeys = Object.keys(process3ByProducts);
                        if (bpKeys.length === 0) return <div className="text-sm text-amber-600 italic">No Process 3 By-Products generated yet.</div>;
                        
                        const byproductOrders = selectedDailyOrders.filter((o: any) => getProductType(o.itemCode) === 'byproduct');

                        return (
                          <div className="space-y-6">`;

const replacementContent = `const process3ByProducts = (selectedSupply as any)._process3ByProducts || {};
                        const bpKeys = Object.keys(process3ByProducts);
                        
                        const byproductOrders = selectedDailyOrders.filter((o: any) => getProductType(o.itemCode) === 'byproduct' && Math.round(Number(o.qty)) > 0);

                        return (
                          <div className="space-y-6">
                            {/* Demand by By-Product Summary — expandable */}
                            {renderDemandByYieldTreeGroup('Demand by By-Product', 'amber', byproductOrders, 'byproduct', selectedSupply)}

                            {bpKeys.length === 0 && <div className="text-sm text-amber-600 italic">No Process 3 By-Products generated yet.</div>}
`;

content = content.replace(bilSectionContent, replacementContent);

fs.writeFileSync(mpsPlanPath, content);
console.log('Modified MPSPlan.tsx successfully!');
