import React from 'react';
import { Calendar, Users, Clock } from 'lucide-react';
import { ActiveTab } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  employeesCount: number;
  shiftsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  employeesCount,
  shiftsCount,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'escala',
      label: 'Escala do Mês',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'funcionarios',
      label: 'Funcionários',
      icon: <Users className="w-4 h-4" />,
      badge: employeesCount,
    },
    {
      id: 'turnos',
      label: 'Turnos & Horários',
      icon: <Clock className="w-4 h-4" />,
      badge: shiftsCount,
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-[57px] z-20 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="flex space-x-2 py-2" aria-label="Abas">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-700 text-white shadow-xs shadow-sky-800/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className={isActive ? 'text-sky-200' : 'text-slate-400'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-sky-900/60 text-sky-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
