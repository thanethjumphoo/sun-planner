import { Calendar, Download, Package, PieChart, ShoppingCart, AlertTriangle, MoreHorizontal, AlertCircle, Clock, Cpu, Sparkles, CheckCircle, ChevronRight, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time overview of chicken production and capacity planning.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2">
            <Calendar size={16} />
            Today, Oct 24
          </button>
          <button className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-red-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 group">
            <Download size={16} className="group-hover:-translate-y-0.5 transition-transform" />
            Generate Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-slide-up delay-100">
        {[
          { title: "Total Production", val: "124.5", unit: "Tons", trend: "+5.2%", icon: Package, color: "text-blue-600", bg: "bg-blue-50", down: false },
          { title: "Overall Yield", val: "86.4", unit: "%", trend: "+1.1%", icon: PieChart, color: "text-emerald-600", bg: "bg-emerald-50", down: false },
          { title: "Order Fill Rate", val: "98.2", unit: "%", trend: "-0.5%", icon: ShoppingCart, color: "text-orange-600", bg: "bg-orange-50", down: true },
          { title: "Active Downtime", val: "1.5", unit: "Hrs", trend: "-12%", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", down: false }
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.down ? TrendingDownIcon : TrendingUpIcon;
          return (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden hover:-translate-y-1">
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 ease-out bg-current" style={{ color: kpi.color.replace('text-', '') }}></div>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color}`}>
                  <Icon size={22} />
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${kpi.down ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <TrendIcon size={12} />
                  {kpi.trend}
                </span>
              </div>
              <h3 className="text-gray-500 text-sm font-medium">{kpi.title}</h3>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-gray-900 tracking-tight">{kpi.val}</span>
                <span className="text-sm text-gray-500 font-medium">{kpi.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up delay-200">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-50 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>

          <div className="flex justify-between items-center mb-6 relative z-10">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Production vs Demand</h3>
              <p className="text-sm text-gray-500">7-Day MPS Execution Tracking</p>
            </div>
            <button className="text-gray-400 hover:text-gray-700 p-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"><MoreHorizontal size={20} /></button>
          </div>

          {/* Mock Chart Area using CSS */}
          <div className="flex-1 flex items-end gap-2 h-64 mt-4 relative pb-6 border-b border-gray-100 z-10">
            {/* Y-axis labels */}
            <div className="absolute left-0 inset-y-0 w-8 flex flex-col justify-between text-xs text-gray-400 pb-6 font-medium">
              <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
            </div>

            {/* Grid lines */}
            <div className="absolute left-10 right-0 inset-y-0 flex flex-col justify-between pb-6 pointer-events-none">
              <div className="border-b border-gray-100 w-full h-0"></div>
              <div className="border-b border-gray-100/50 w-full h-0 border-dashed"></div>
              <div className="border-b border-gray-100/50 w-full h-0 border-dashed"></div>
              <div className="border-b border-gray-100/50 w-full h-0 border-dashed"></div>
              <div className="border-b border-gray-200 w-full h-0"></div>
            </div>

            {/* Bars */}
            <div className="ml-10 flex-1 flex justify-around items-end h-full relative z-10">
              {[60, 80, 45, 90, 75, 50, 65].map((h, i) => (
                <div key={i} className="w-1/12 group/bar relative flex justify-center items-end h-full">
                  {/* Tooltip */}
                  <div className="absolute bottom-[calc(100%+10px)] opacity-0 group-hover/bar:opacity-100 group-hover/bar:translate-y-[-5px] bg-gray-900 text-white text-xs py-1.5 px-2.5 rounded-lg transition-all duration-200 whitespace-nowrap shadow-xl z-20 pointer-events-none flex flex-col gap-1 items-center">
                    <span className="font-bold">{h} Tons</span>
                    <span className="text-[10px] text-gray-400">Demand: {Math.floor(h + (Math.random() * 20 - 10))}</span>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>

                  {/* Demand Line indicator */}
                  <div className="w-4 absolute bg-blue-500 rounded-full z-20 shadow-sm" style={{ bottom: `${h + (Math.random() * 20 - 10)}%`, height: '4px' }}></div>

                  {/* Main Bar */}
                  <div className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-md hover:from-orange-400 hover:to-orange-300 transition-all cursor-pointer shadow-sm relative overflow-hidden" style={{ height: `${h}%` }}>
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* X-axis labels */}
            <div className="absolute bottom-0 left-10 right-0 flex justify-around text-xs text-gray-500 pt-2 font-medium">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-5 z-10">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 shadow-sm"></span><span className="text-sm text-gray-600 font-medium">Actual Production</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-1 rounded-full bg-blue-500 shadow-sm"></span><span className="text-sm text-gray-600 font-medium">Planned Demand</span></div>
          </div>
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full opacity-50 -z-0 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-center mb-4 relative z-10">
              <h3 className="text-lg font-bold text-gray-900">Critical Alerts</h3>
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">2 New</span>
            </div>
            <div className="space-y-3 relative z-10">
              <div className="flex gap-3 items-start p-3 rounded-xl bg-red-50/80 border border-red-100 hover:bg-red-50 transition-colors cursor-pointer">
                <div className="mt-0.5 text-red-500 bg-white rounded-full p-1 shadow-sm"><AlertCircle size={16} /></div>
                <div>
                  <h4 className="text-sm font-semibold text-red-900">Capacity Overload</h4>
                  <p className="text-xs text-red-600 mt-1 leading-snug">Fillet Dept exceeds 105% capacity for tomorrow's DPS plan.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-3 rounded-xl bg-amber-50/80 border border-amber-100 hover:bg-amber-50 transition-colors cursor-pointer">
                <div className="mt-0.5 text-amber-500 bg-white rounded-full p-1 shadow-sm"><Clock size={16} /></div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">Pending Approvals</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-snug">3 MPS scenarios waiting for Executive approval.</p>
                </div>
              </div>
            </div>
            <button className="w-full mt-4 py-2 text-sm text-orange-600 font-semibold hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center gap-1">
              View Alert Center <ArrowRight size={14} />
            </button>
          </div>

          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-2xl border border-gray-800 shadow-lg p-6 text-white relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 opacity-10 transform group-hover:rotate-12 transition-transform duration-500">
              <Sparkles size={120} />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <Cpu className="text-orange-400" size={20} />
              <h3 className="text-lg font-bold">AI Planner Insights</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4 relative z-10">System detected an opportunity to improve Yield Allocation.</p>

            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md border border-white/10 relative z-10">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Suggested Action</div>
              <div className="text-sm font-medium leading-relaxed">Re-allocate 2,000 birds to <span className="text-orange-300">Cut Part Line B</span> to maximize inner fillet yield by +0.5%.</div>
            </div>

            <button className="w-full mt-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-sm font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)] relative z-10 flex items-center justify-center gap-2">
              <CheckCircle size={16} />
              Apply Recommendation
            </button>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-slide-up delay-300">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Today's DPS Progress</h3>
            <p className="text-xs text-gray-500 mt-0.5">Department Production Schedule Execution</p>
          </div>
          <button className="text-sm font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            View Full Board <ChevronRight size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 text-gray-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Planned (Tons)</th>
                <th className="px-6 py-4">Actual (Tons)</th>
                <th className="px-6 py-4 w-1/4">Progress</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { name: "Whole Bird", plan: 45.0, act: 20.5, prog: 45, stat: "On Track", statColor: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                { name: "Fillet", plan: 30.0, act: 12.0, prog: 40, stat: "Behind", statColor: "bg-amber-100 text-amber-700 border-amber-200" },
                { name: "Leg", plan: 25.0, act: 15.0, prog: 60, stat: "On Track", statColor: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                { name: "Wing", plan: 15.0, act: 10.5, prog: 70, stat: "Ahead", statColor: "bg-blue-100 text-blue-700 border-blue-200" }
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-500">Line A, Line B</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{row.plan.toFixed(1)}</td>
                  <td className="px-6 py-4 text-gray-900 font-bold">{row.act.toFixed(1)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-1000 ${row.prog < 50 && row.stat === 'Behind' ? 'bg-amber-400' : row.stat === 'Ahead' ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${row.prog}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-8">{row.prog}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${row.statColor}`}>
                      {row.stat}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Add these to imports at the top
function TrendingUpIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>;
}

function TrendingDownIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>;
}
