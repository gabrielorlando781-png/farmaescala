import React, { useState } from 'react';
import { 
  Employee, 
  ShiftType, 
  MonthSchedule, 
  DayCoverageSummary,
  PharmacySettings
} from '../types';
import { 
  Search, 
  CalendarDays,
  CalendarRange,
  Clock3,
  PencilLine
} from 'lucide-react';
import { getShortDayName } from '../utils/scheduleRules';
import { CellShiftPopover } from './CellShiftPopover';
import { SchedulePeriodViews } from './SchedulePeriodViews';

interface ScheduleGridProps {
  currentYear: number;
  currentMonth: number;
  employees: Employee[];
  shifts: ShiftType[];
  schedule: MonthSchedule;
  settings: PharmacySettings;
  dayCoverage: Record<string, DayCoverageSummary>;
  employeeHours: Record<string, { totalHours: number; daysWorked: number; daysOff: number; weeklyHours: number[] }>;
  onUpdateAssignment: (employeeId: string, dateStr: string, shiftId: string, note?: string) => void;
  onOpenEmployeeModal: () => void;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  currentYear,
  currentMonth,
  employees,
  shifts,
  schedule,
  settings,
  dayCoverage,
  employeeHours,
  onUpdateAssignment,
  onOpenEmployeeModal,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [isManualMode, setIsManualMode] = useState(false);
  const today = new Date();
  const initialDay = today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth
    ? today.getDate()
    : 1;
  const [selectedDay, setSelectedDay] = useState(initialDay);

  // Popover state for interactive cell click
  const [activePopover, setActivePopover] = useState<{
    employeeId: string;
    dateStr: string;
    top: number;
    left: number;
  } | null>(null);

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const safeSelectedDay = Math.min(daysInMonth, Math.max(1, selectedDay));
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const shiftMap = new Map<string, ShiftType>(shifts.map((s) => [s.id, s]));

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    if (!emp.active) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(q);
      const matchRole = emp.roleTitle.toLowerCase().includes(q);
      if (!matchName && !matchRole) return false;
    }
    if (roleFilter === 'farmaceuticos') {
      return emp.role === 'farmaceutico';
    }
    if (roleFilter === 'balconistas') {
      return emp.role === 'balconista' || emp.role === 'dermoconsultor';
    }
    if (roleFilter === 'caixa') {
      return emp.role === 'caixa';
    }
    return true;
  });

  const activeEmployee = activePopover
    ? employees.find((e) => e.id === activePopover.employeeId)
    : null;

  const currentShiftId = activePopover
    ? schedule.assignments[`${activePopover.employeeId}_${activePopover.dateStr}`] || 'shift_folga'
    : 'shift_folga';

  const currentNote = activePopover
    ? schedule.customNotes?.[`${activePopover.employeeId}_${activePopover.dateStr}`] || ''
    : '';

  const handleCellClick = (employeeId: string, dateStr: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActivePopover({
      employeeId,
      dateStr,
      top: rect.bottom + 4,
      left: rect.left,
    });
  };

  return (
    <div className="space-y-4">
      {/* Clean Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-sky-500 focus:bg-white transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setRoleFilter('todos')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'todos' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({employees.filter((e) => e.active).length})
            </button>
            <button
              onClick={() => setRoleFilter('farmaceuticos')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'farmaceuticos' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Farmacêuticos
            </button>
            <button
              onClick={() => setRoleFilter('balconistas')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'balconistas' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Balcão
            </button>
            <button
              onClick={() => setRoleFilter('caixa')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'caixa' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Caixa
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsManualMode((enabled) => !enabled)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              isManualMode
                ? 'border-sky-300 bg-sky-600 text-white shadow-sm shadow-sky-600/20 hover:bg-sky-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-800'
            }`}
            title="Permite editar turnos e folgas em qualquer visualização"
          >
            <PencilLine className="h-3.5 w-3.5" />
            {isManualMode ? 'Edição manual ativa' : 'Gerenciar manualmente'}
          </button>

          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs">
            {([
              { id: 'daily', label: 'Diário', icon: Clock3 },
              { id: 'weekly', label: 'Semanal', icon: CalendarRange },
              { id: 'monthly', label: 'Mensal', icon: CalendarDays },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                  viewMode === id ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Turnos:</span>
          {shifts.slice(0, 5).map((s) => (
            <span
              key={s.id}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${s.bgColor} ${s.textColor} ${s.borderColor}`}
              title={`${s.name} (${s.startTime} - ${s.endTime})`}
            >
              {s.code}
            </span>
          ))}
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            FOLGA
          </span>
          </div>
        </div>
      </div>

      {/* Main Schedule Grid Table */}
      {viewMode === 'monthly' && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-3 text-left font-bold text-slate-700 min-w-[180px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Colaborador
                </th>
                {daysArray.map((day) => {
                  const dayDate = new Date(currentYear, currentMonth - 1, day);
                  const isSunday = dayDate.getDay() === 0;
                  const isSaturday = dayDate.getDay() === 6;
                  const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const coverage = dayCoverage[dateStr];
                  const hasRT = coverage?.totalPharmacists > 0;

                  return (
                    <th
                      key={day}
                      className={`p-1.5 text-center font-bold min-w-[36px] border-r border-slate-200 ${
                        isSunday ? 'bg-sky-50/80 text-sky-900' : isSaturday ? 'bg-slate-50/80 text-slate-700' : 'text-slate-700'
                      }`}
                    >
                      <div className="text-[10px] font-medium text-slate-400">
                        {getShortDayName(dayDate.getDay())}
                      </div>
                      <div className="text-xs font-bold">{day}</div>
                      {/* Discrete RT indicator */}
                      <div className="mt-0.5 flex justify-center">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            hasRT ? 'bg-sky-500' : 'bg-rose-400'
                          }`}
                          title={hasRT ? 'Farmacêutico presente' : 'Sem farmacêutico'}
                        />
                      </div>
                    </th>
                  );
                })}
                <th className="p-2 text-center font-bold text-slate-700 min-w-[70px] bg-slate-50">
                  Horas
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const hours = employeeHours[emp.id]?.totalHours || 0;
                return (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    {/* Employee info cell */}
                    <td className="p-3 sticky left-0 bg-white z-10 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: emp.color || '#0284c7' }}
                        />
                        <div className="overflow-hidden">
                          <div className="font-bold text-slate-800 text-xs truncate">
                            {emp.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                            <span>{emp.roleTitle}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Days cells */}
                    {daysArray.map((day) => {
                      const dayDate = new Date(currentYear, currentMonth - 1, day);
                      const isSunday = dayDate.getDay() === 0;
                      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const shiftId = schedule.assignments[`${emp.id}_${dateStr}`] || 'shift_folga';
                      const shift = shiftMap.get(shiftId) || shiftMap.get('shift_folga')!;
                      const hasNote = Boolean(schedule.customNotes?.[`${emp.id}_${dateStr}`]);

                      return (
                        <td
                          key={day}
                          onClick={(event) => isManualMode && handleCellClick(emp.id, dateStr, event)}
                          className={`p-1 text-center border-r border-slate-100 transition-all ${
                            isManualMode ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                          } ${
                            isSunday ? 'bg-sky-50/30' : ''
                          }`}
                        >
                          <div
                            className={`w-full py-1 rounded-md text-[10px] font-bold border transition-transform hover:scale-105 select-none relative ${
                              shift.isDayOff
                                ? 'bg-slate-100 text-slate-500 border-slate-200'
                                : `${shift.bgColor} ${shift.textColor} ${shift.borderColor}`
                            }`}
                            title={`${shift.name}${hasNote ? ' (Com observação)' : ''}`}
                          >
                            {shift.code}
                            {hasNote && (
                              <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-500" />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Hours */}
                    <td className="p-2 text-center border-l border-slate-200 font-bold text-slate-800 text-xs">
                      {hours.toFixed(0)}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {viewMode !== 'monthly' && (
        <SchedulePeriodViews
          mode={viewMode}
          currentYear={currentYear}
          currentMonth={currentMonth}
          selectedDay={safeSelectedDay}
          onSelectedDayChange={setSelectedDay}
          employees={filteredEmployees}
          shifts={shifts}
          schedule={schedule}
          settings={settings}
          isManualMode={isManualMode}
          onEditAssignment={handleCellClick}
        />
      )}

      {/* Interactive Popover for editing cell */}
      {activePopover && activeEmployee && (
        <CellShiftPopover
          isOpen={Boolean(activePopover)}
          onClose={() => setActivePopover(null)}
          position={{ top: activePopover.top, left: activePopover.left }}
          employee={activeEmployee}
          dateStr={activePopover.dateStr}
          currentShiftId={currentShiftId}
          currentNote={currentNote}
          shifts={shifts}
          onSelectShift={(shiftId, note) => {
            onUpdateAssignment(activePopover.employeeId, activePopover.dateStr, shiftId, note);
          }}
        />
      )}
    </div>
  );
};
