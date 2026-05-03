import { Search, Bell, Settings, Home, ChevronRight } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-16 bg-white/75 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-10 shrink-0 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Home size={16} className="text-gray-400" />
        <ChevronRight size={14} className="text-gray-300" />
        <span>Dashboard</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-gray-800 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">Executive Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search orders, alerts..." 
            className="pl-10 pr-4 py-2 bg-gray-100/80 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all w-64 outline-none placeholder-gray-400" 
          />
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100 relative transition-colors text-gray-500">
          <Bell size={20} />
          <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
