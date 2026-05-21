import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Sun, Menu, LayoutDashboard, TrendingUp, CalendarDays,
  Truck, Activity, Users, Settings,
  ClipboardList, Scale, RefreshCw, PieChart, Scissors, ChevronDown, ChevronRight
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type SubItem = { title: string; icon: LucideIcon; path: string };
type MenuItem = { title: string; icon: LucideIcon; path?: string; subItems?: SubItem[] };
type MenuGroup = { label: string; items: MenuItem[] };

const menuGroups: MenuGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" }
    ]
  },
  {
    label: "Planning",
    items: [
      { title: "Demand Management", icon: TrendingUp, path: "/demand-management" },
      { title: "Chicken Receiving", icon: Truck, path: "/chicken-receiving" }
    ]
  },
  {
    label: "Part",
    items: [
      {
        title: "Fillet",
        icon: Scissors,
        subItems: [
          { title: "MPS", icon: CalendarDays, path: "/fillet/mps" },
          { title: "DPS", icon: Activity, path: "/fillet/dps" },
          { title: "Manual Operation", icon: Users, path: "/fillet/manual-operation" }
        ]
      },
      {
        title: "Bone in leg",
        icon: Scissors,
        subItems: [
          { title: "MPS", icon: CalendarDays, path: "/bil/mps" },
          { title: "DPS", icon: Activity, path: "/bil/dps" },
          { title: "Manual Operation", icon: Users, path: "/bil/manual-operation" }
        ]
      }
    ]
  },
  {
    label: "Supply Chain",
    items: [
      { title: "Master Yield", icon: PieChart, path: "/master-yield" },
      { title: "Weight Distribution", icon: Scale, path: "/weight-distribution" },
      { title: "Product Spec", icon: ClipboardList, path: "/product-spec" },
    ]
  },
  {
    label: "System Data",
    items: [
      { title: "ERP Integration Hub", icon: RefreshCw, path: "/erp-integration" },
      { title: "Machine & Flow Setup", icon: Settings, path: "/machine-setup" }
      /*{ title: "Reports & Analytics", icon: BarChart3, path: "/reports" },
      { title: "Master Data", icon: Database, path: "/master-data" },
      { title: "Workflow & Alerts", icon: Bell, path: "/workflow" },
      { title: "Security & Admin", icon: Shield, path: "/security" }*/
    ]
  }
];

export default function Sidebar({ isOpen, toggleSidebar }: { isOpen: boolean, toggleSidebar: () => void }) {
  const location = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  const toggleDropdown = (title: string) => {
    setOpenDropdowns(prev => ({ ...prev, [title]: !prev[title] }));
    if (!isOpen) toggleSidebar();
  };

  return (
    <aside className={`bg-white text-gray-700 flex flex-col transition-all duration-300 shadow-2xl z-20 ${isOpen ? 'w-72' : 'w-20'} border-r border-gray-200`}>
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 shrink-0">
        <div className={`flex items-center gap-3 font-bold text-gray-900 text-xl overflow-hidden whitespace-nowrap transition-all duration-300 ${isOpen ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
            <Sun size={18} className="text-white" />
          </div>
          SUN PLANNER
        </div>
        <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors mx-auto">
          <Menu size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {menuGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            <div className={`px-3 mb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
              {group.label}
            </div>
            {group.items.map((item, idx) => {
              const Icon = item.icon;
              const hasSubItems = !!item.subItems;
              const isDropdownOpen = openDropdowns[item.title];

              // Check if active (either the item itself or one of its subitems)
              const isActive = item.path
                ? location.pathname.startsWith(item.path)
                : hasSubItems && item.subItems!.some(sub => location.pathname.startsWith(sub.path));

              return (
                <div key={idx}>
                  {hasSubItems ? (
                    <div onClick={() => toggleDropdown(item.title)} title={!isOpen ? item.title : ''} className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group
                      ${isActive
                        ? 'bg-orange-50 text-orange-600 border-l-2 border-orange-500 font-semibold'
                        : 'hover:bg-gray-50 hover:text-gray-900 text-gray-600 border-l-2 border-transparent'}`}>
                      <div className="flex items-center">
                        <div className="shrink-0 flex items-center justify-center w-6 h-6">
                          <Icon size={20} className={`${isActive ? 'text-orange-600' : 'text-gray-500 group-hover:text-gray-900'}`} />
                        </div>
                        <span className={`ml-3 text-sm whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
                          {item.title}
                        </span>
                      </div>
                      <div className={`transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                        {isDropdownOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                  ) : (
                    <Link to={item.path!} title={!isOpen ? item.title : ''} className={`flex items-center px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group
                      ${isActive
                        ? 'bg-orange-50 text-orange-600 border-l-2 border-orange-500 font-semibold'
                        : 'hover:bg-gray-50 hover:text-gray-900 text-gray-600 border-l-2 border-transparent'}`}>
                      <div className="shrink-0 flex items-center justify-center w-6 h-6">
                        <Icon size={20} className={`${isActive ? 'text-orange-600' : 'text-gray-500 group-hover:text-gray-900'}`} />
                      </div>
                      <span className={`ml-3 text-sm whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
                        {item.title}
                      </span>
                    </Link>
                  )}

                  {hasSubItems && isDropdownOpen && isOpen && (
                    <div className="mt-1 ml-9 space-y-1 border-l-2 border-gray-100 pl-2 transition-all duration-300">
                      {item.subItems!.map((subItem, subIdx) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = location.pathname.startsWith(subItem.path);
                        return (
                          <Link to={subItem.path} key={subIdx} className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors
                            ${isSubActive ? 'bg-orange-50/50 text-orange-600 font-semibold' : 'hover:bg-gray-50 text-gray-500 hover:text-gray-900'}`}>
                            <div className="shrink-0 flex items-center justify-center w-4 h-4 mr-2">
                              {SubIcon && <SubIcon size={16} className={`${isSubActive ? 'text-orange-600' : 'text-gray-400'}`} />}
                            </div>
                            <span className="text-[13px] whitespace-nowrap">{subItem.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 shrink-0 bg-gray-50/50">
        <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'} cursor-pointer hover:bg-gray-100 p-2 rounded-xl transition-colors`}>
          <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white">
            AK
          </div>
          <div className={`flex-1 overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
            <div className="text-sm font-bold text-gray-900 truncate">Akashi Planner</div>
            <div className="text-xs text-gray-500 truncate">Production Executive</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
