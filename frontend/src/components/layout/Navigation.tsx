import React from 'react';
import {
  Network,
  Terminal,
  GitCompare,
  Sliders,
  LayoutDashboard,
} from 'lucide-react';

export type ActiveTab = 'overview' | 'graph' | 'terminal' | 'comparison' | 'steering';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  activeAgentsCount: number;
  logsCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  activeAgentsCount,
  logsCount,
}) => {
  const tabs = [
    {
      id: 'overview' as ActiveTab,
      label: 'Cockpit View',
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: 'All-in-one split panel',
    },
    {
      id: 'graph' as ActiveTab,
      label: 'Live Agent Graph',
      icon: <Network className="w-4 h-4" />,
      badge: `${activeAgentsCount} Active`,
      badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    },
    {
      id: 'terminal' as ActiveTab,
      label: 'Terminal & Reasoning',
      icon: <Terminal className="w-4 h-4" />,
      badge: `${logsCount}`,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    },
    {
      id: 'comparison' as ActiveTab,
      label: 'Metrics & Loss Curves',
      icon: <GitCompare className="w-4 h-4" />,
      badge: 'Recharts',
      badgeColor: 'bg-indigo-950 text-indigo-400 border-indigo-800',
    },
    {
      id: 'steering' as ActiveTab,
      label: 'Human Steering & What-If',
      icon: <Sliders className="w-4 h-4" />,
      badge: 'Interactive',
      badgeColor: 'bg-amber-950 text-amber-400 border-amber-800',
    },
  ];

  return (
    <nav className="w-full border-b border-slate-800/80 bg-[#0b0e14] px-4 sm:px-6">
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 max-w-7xl mx-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <span className={isActive ? 'text-indigo-400' : 'text-slate-500'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${tab.badgeColor}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
