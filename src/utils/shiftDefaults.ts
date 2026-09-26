import { INITIAL_SHIFTS } from '../data/initialData';
import { Employee, MonthSchedule, ShiftType } from '../types';

export const SYSTEM_SHIFT_IDS = new Set(INITIAL_SHIFTS.map((shift) => shift.id));

const OLD_PRESET_IDS = new Set([
  'shift_manha', 'shift_inter', 'shift_tarde',
  'shift_plantao_12x36_d', 'shift_plantao_12x36_n',
]);

// Remove apenas os antigos exemplos sem uso. Se algum mês tiver atribuições
// com esses IDs, os turnos ficam como legado para preservar a escala existente.
export const normalizeStoreShifts = (
  shifts: ShiftType[],
  employees: Employee[],
  schedules: Record<string, MonthSchedule>,
) => {
  const assignedIds = new Set(Object.values(schedules).flatMap((schedule) => Object.values(schedule.assignments)));
  const retained = shifts.filter((shift) => !SYSTEM_SHIFT_IDS.has(shift.id) && (!OLD_PRESET_IDS.has(shift.id) || assignedIds.has(shift.id)));
  const normalizedShifts = [...INITIAL_SHIFTS, ...retained];
  const validIds = new Set(normalizedShifts.map((shift) => shift.id));
  const normalizedEmployees = employees.map((employee) =>
    employee.preferredShiftId && !validIds.has(employee.preferredShiftId)
      ? { ...employee, preferredShiftId: undefined }
      : employee,
  );
  return { shifts: normalizedShifts, employees: normalizedEmployees };
};
