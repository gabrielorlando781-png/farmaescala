import { Employee, PharmacySettings, ShiftType } from '../types';

export type ScheduleViewMode = NonNullable<PharmacySettings['scheduleViewMode']>;

export const getScheduleViewMode = (settings: PharmacySettings): ScheduleViewMode =>
  settings.scheduleViewMode ?? (settings.simplifiedScheduleMode ? 'simplified' : 'complete');

export const isCompactScheduleMode = (settings: PharmacySettings) =>
  getScheduleViewMode(settings) !== 'complete';

export const getDefaultWorkingShiftId = (employee: Employee, shifts: ShiftType[]) => {
  const preferredShift = shifts.find(
    (shift) => shift.id === employee.preferredShiftId && !shift.isDayOff
  );
  return preferredShift?.id ?? shifts.find((shift) => !shift.isDayOff)?.id;
};

export const getEffectiveAssignmentShiftId = (
  assignedShiftId: string | undefined,
  employee: Employee,
  shifts: ShiftType[],
  settings: PharmacySettings
) => {
  if (assignedShiftId) return assignedShiftId;
  if (getScheduleViewMode(settings) === 'days_off') {
    return getDefaultWorkingShiftId(employee, shifts) ?? 'shift_folga';
  }
  return 'shift_folga';
};
