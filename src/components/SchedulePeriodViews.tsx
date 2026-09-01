import React from 'react';
import { ChevronLeft, ChevronRight, Clock3, PencilLine, Users } from 'lucide-react';
import { Employee, MonthSchedule, PharmacySettings, ShiftType } from '../types';
import { getShortDayName } from '../utils/scheduleRules';

interface SchedulePeriodViewsProps {
  mode: 'daily' | 'weekly';
  currentYear: number;
  currentMonth: number;
  selectedDay: number;
  onSelectedDayChange: (day: number) => void;
  employees: Employee[];
  shifts: ShiftType[];
  schedule: MonthSchedule;
  settings: PharmacySettings;
  isManualMode: boolean;
  onEditAssignment: (employeeId: string, dateStr: string, event: React.MouseEvent<HTMLElement>) => void;
}

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export const SchedulePeriodViews: React.FC<SchedulePeriodViewsProps> = ({
  mode,
  currentYear,
  currentMonth,
  selectedDay,
  onSelectedDayChange,
  employees,
  shifts,
  schedule,
  settings,
  isManualMode,
  onEditAssignment,
}) => {
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const selectedDate = new Date(currentYear, currentMonth - 1, selectedDay);
  const shiftMap = new Map<string, ShiftType>(shifts.map((shift) => [shift.id, shift]));
  const dayOffShift = shifts.find((shift) => shift.isDayOff && !shift.isSpecialLeave);
  const getShiftBadgeClass = (shift: ShiftType) => {
    if (shift.id === 'shift_ferias' || shift.code === 'FÉR') return 'border-amber-400 bg-amber-100 text-amber-950 ring-1 ring-amber-300';
    if (shift.id === 'shift_atestado' || shift.id === 'shift_falta' || shift.code === 'ATEST' || shift.code === 'FALTA') return 'border-rose-400 bg-rose-100 text-rose-950 ring-1 ring-rose-300';
    return shift.isDayOff ? 'border-slate-200 bg-slate-100 text-slate-500' : `${shift.bgColor} ${shift.textColor} ${shift.borderColor}`;
  };

  const getShift = (employeeId: string, date: Date) => {
    if (date.getMonth() !== currentMonth - 1 || date.getFullYear() !== currentYear) return undefined;
    const shiftId = schedule.assignments[`${employeeId}_${formatDateKey(date)}`] || dayOffShift?.id;
    return shiftMap.get(shiftId || '');
  };

  const moveDay = (amount: number) => {
    onSelectedDayChange(Math.min(daysInMonth, Math.max(1, selectedDay + amount)));
  };

  const mondayOffset = (selectedDate.getDay() + 6) % 7;
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    new Date(currentYear, currentMonth - 1, selectedDay - mondayOffset + index)
  );

  const openMinutes = settings.isOpen24h ? 0 : timeToMinutes(settings.openTime || '07:00');
  const closeMinutesRaw = settings.isOpen24h ? 24 * 60 : timeToMinutes(settings.closeTime || '23:00');
  const closeMinutes = closeMinutesRaw <= openMinutes ? 24 * 60 : closeMinutesRaw;
  const firstHour = Math.floor(openMinutes / 60);
  const lastHour = Math.ceil(closeMinutes / 60);
  const hourSlots = Array.from({ length: Math.max(1, lastHour - firstHour) }, (_, index) => firstHour + index);

  const getShiftAtHour = (employeeId: string, hour: number) => {
    const currentShift = getShift(employeeId, selectedDate);
    if (currentShift && !currentShift.isDayOff) {
      const start = timeToMinutes(currentShift.startTime);
      const end = timeToMinutes(currentShift.endTime);
      const minute = hour * 60;
      const isOvernight = end <= start;
      if ((!isOvernight && minute >= start && minute < end) || (isOvernight && minute >= start)) {
        return currentShift;
      }
    }

    const previousDate = new Date(currentYear, currentMonth - 1, selectedDay - 1);
    const previousShift = getShift(employeeId, previousDate);
    if (previousShift && !previousShift.isDayOff) {
      const start = timeToMinutes(previousShift.startTime);
      const end = timeToMinutes(previousShift.endTime);
      if (end <= start && hour * 60 < end) return previousShift;
    }
    return undefined;
  };

  const selectedDateKey = formatDateKey(selectedDate);
  const workingToday = employees.filter((employee) => {
    const shiftId = schedule.assignments[`${employee.id}_${selectedDateKey}`] || dayOffShift?.id;
    return !shiftMap.get(shiftId || '')?.isDayOff;
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <button
          type="button"
          onClick={() => moveDay(mode === 'weekly' ? -7 : -1)}
          disabled={selectedDay === 1}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-xs font-bold capitalize text-slate-800">
            {mode === 'daily'
              ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
              : `${weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} a ${weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
          </div>
          <div className="text-[10px] text-slate-500">{currentYear}</div>
        </div>
        <button
          type="button"
          onClick={() => moveDay(mode === 'weekly' ? 7 : 1)}
          disabled={selectedDay === daysInMonth}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isManualMode && (
        <div className="flex items-center gap-1.5 border-b border-sky-100 bg-sky-50 px-4 py-2 text-[11px] font-medium text-sky-800">
          <PencilLine className="h-3.5 w-3.5" />
          Clique em um turno, folga ou no botão Editar para alterar a escala manualmente.
        </div>
      )}

      {mode === 'weekly' ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="sticky left-0 z-10 min-w-[180px] border-r border-slate-200 bg-white p-3 text-left font-bold text-slate-700">Colaborador</th>
                {weekDates.map((date) => {
                  const isCurrentMonth = date.getMonth() === currentMonth - 1;
                  return (
                    <th key={date.toISOString()} className={`min-w-[110px] border-r border-slate-100 p-2 text-center ${isCurrentMonth ? 'text-slate-700' : 'bg-slate-50 text-slate-300'}`}>
                      <div className="text-[10px] font-medium uppercase">{getShortDayName(date.getDay())}</div>
                      <div className="font-bold">{date.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-100">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3">
                    <div className="font-bold text-slate-800">{employee.name}</div>
                    <div className="text-[10px] text-slate-500">{employee.roleTitle}</div>
                  </td>
                  {weekDates.map((date) => {
                    const shift = getShift(employee.id, date);
                    const isCurrentMonth = date.getMonth() === currentMonth - 1 && date.getFullYear() === currentYear;
                    return (
                      <td key={date.toISOString()} className="border-r border-slate-100 p-2 text-center">
                        {shift ? (
                          <button
                            type="button"
                            disabled={!isManualMode || !isCurrentMonth}
                            onClick={(event) => onEditAssignment(employee.id, formatDateKey(date), event)}
                            className={`w-full rounded-lg border px-2 py-1.5 text-[10px] font-bold transition ${
                              getShiftBadgeClass(shift)
                            } ${isManualMode && isCurrentMonth ? 'cursor-pointer hover:brightness-95 hover:ring-2 hover:ring-sky-300' : 'cursor-default'}`}
                            title={isManualMode && isCurrentMonth ? 'Editar escala deste dia' : undefined}
                          >
                            <div>{shift.code}</div>
                            {!shift.isDayOff && <div className="mt-0.5 font-normal opacity-70">{shift.startTime}–{shift.endTime}</div>}
                          </button>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && <div className="p-8 text-center text-xs text-slate-500">Cadastre funcionários para visualizar a semana.</div>}
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-2.5 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-sky-600" />{String(firstHour).padStart(2, '0')}:00–{String(lastHour).padStart(2, '0')}:00</span>
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-sky-600" />{workingToday.length} trabalhando</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="sticky left-0 z-10 w-20 min-w-[80px] border-r border-slate-200 bg-white p-2 text-left font-bold text-slate-600">Hora</th>
                  {employees.map((employee) => {
                    const absenceShift = getShift(employee.id, selectedDate);
                    return <th key={employee.id} className="min-w-[140px] border-r border-slate-100 p-2 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-slate-800">{employee.name}</div>
                          <div className="truncate text-[10px] font-normal text-slate-500">{employee.roleTitle}</div>
                          {absenceShift?.isSpecialLeave && <div className={`mt-1 inline-flex rounded border px-1 py-0.5 text-[9px] font-bold ${getShiftBadgeClass(absenceShift)}`}>{absenceShift.code}</div>}
                        </div>
                        {isManualMode && (
                          <button
                            type="button"
                            onClick={(event) => onEditAssignment(employee.id, selectedDateKey, event)}
                            className="shrink-0 rounded-md border border-sky-200 bg-sky-50 p-1 text-sky-700 hover:bg-sky-100 cursor-pointer"
                            title={`Editar escala de ${employee.name}`}
                            aria-label={`Editar escala de ${employee.name}`}
                          >
                            <PencilLine className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {hourSlots.map((hour) => (
                  <tr key={hour} className="h-11 border-b border-slate-100">
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-2 font-mono text-[11px] font-bold text-slate-500">
                      {String(hour).padStart(2, '0')}:00
                    </td>
                    {employees.map((employee) => {
                      const shift = getShiftAtHour(employee.id, hour);
                      return (
                        <td key={employee.id} className="border-r border-slate-100 p-1">
                          {shift && (
                            <button
                              type="button"
                              disabled={!isManualMode}
                              onClick={(event) => onEditAssignment(employee.id, selectedDateKey, event)}
                              className={`h-8 w-full rounded-md border px-2 py-1 text-left text-[10px] font-bold transition ${shift.bgColor} ${shift.textColor} ${shift.borderColor} ${
                                isManualMode ? 'cursor-pointer hover:brightness-95 hover:ring-2 hover:ring-sky-300' : 'cursor-default'
                              }`}
                              title={isManualMode ? `Editar escala de ${employee.name}` : `${shift.name}: ${shift.startTime} - ${shift.endTime}`}
                            >
                              {shift.code} <span className="font-normal opacity-70">{shift.startTime}–{shift.endTime}</span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 && <div className="p-8 text-center text-xs text-slate-500">Cadastre funcionários para visualizar o dia.</div>}
          </div>
        </div>
      )}
    </div>
  );
};
