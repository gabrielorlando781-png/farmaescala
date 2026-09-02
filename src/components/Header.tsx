import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Printer, 
  CheckCircle2, 
  Building2,
  CalendarDays,
  Trash2
} from 'lucide-react';
import { PharmacySettings, MonthSchedule } from '../types';
import { getMonthName } from '../utils/scheduleRules';

interface HeaderProps {
  currentYear: number;
  currentMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  settings: PharmacySettings;
  schedule: MonthSchedule;
  onOpenAutoSchedule: () => void;
  onPrint: () => void;
  onOpenSettingsModal: () => void;
  onTogglePublish: () => void;
  onDeleteSchedule: () => void;
  totalWorkingHours: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentYear,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  settings,
  schedule,
  onOpenAutoSchedule,
  onPrint,
  onOpenSettingsModal,
  onTogglePublish,
  onDeleteSchedule,
  totalWorkingHours,
}) => {
  return (
    <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Pharmacy Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-sm shadow-sky-600/30">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white leading-tight">
                {settings.fantasyName || 'FarmaEscala'}
              </h1>
              {settings.rtCrf && (
                <span className="text-xs text-sky-400 font-medium hidden sm:inline">
                  • {settings.rtCrf}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {settings.technicalResponsible
                ? `Gerente: ${settings.technicalResponsible}`
                : 'Configure os dados da farmácia'}
            </p>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={onPrevMonth}
            aria-label="Mês anterior"
            className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-3 py-0.5 text-center min-w-[130px]">
            <span className="text-xs font-bold text-white tracking-wide uppercase">
              {getMonthName(currentMonth)}
            </span>
            <span className="text-xs text-sky-400 font-semibold ml-1.5">
              {currentYear}
            </span>
          </div>
          <button
            onClick={onNextMonth}
            aria-label="Próximo mês"
            className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Total hours */}
          <div className="hidden md:flex items-center px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 border border-slate-700">
            <span className="text-slate-400 mr-1">Total:</span>
            <span className="font-bold text-sky-300">{totalWorkingHours.toFixed(0)}h</span>
          </div>

          {/* Auto-Schedule */}
          <button
            onClick={onOpenAutoSchedule}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm shadow-sky-600/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-200" />
            <span>Criar escala 5x2</span>
          </button>

          {/* Print */}
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="Imprimir Escala do Mês"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          {/* Publish status toggle */}
          <button
            onClick={onTogglePublish}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              schedule.status === 'publicado'
                ? 'bg-sky-950/80 text-sky-300 border-sky-600/50 hover:bg-sky-900/60'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {schedule.status === 'publicado' ? 'Publicada' : 'Rascunho'}
            </span>
          </button>

          <button
            type="button"
            onClick={onDeleteSchedule}
            disabled={Object.keys(schedule.assignments).length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-rose-900/50 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-all hover:bg-rose-950/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
            title="Excluir a escala deste mês"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Excluir escala</span>
          </button>

          {/* Pharmacy settings */}
          <button
            onClick={onOpenSettingsModal}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
            title="Configurações da Farmácia"
          >
            <Building2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
