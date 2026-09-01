import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Employee, 
  ShiftType, 
  MonthSchedule, 
  PharmacySettings,
  DayCoverageSummary,
  AutoScheduleOptions,
  ActiveTab,
  AiAction,
  EmployeeOccurrenceType,
} from './types';
import { 
  INITIAL_EMPLOYEES, 
  INITIAL_SHIFTS, 
  INITIAL_PHARMACY_SETTINGS, 
  generateInitialSchedule 
} from './data/initialData';
import { 
  validateSchedule, 
  generateSmartSchedule 
} from './utils/scheduleRules';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { ScheduleGrid } from './components/ScheduleGrid';
import { EmployeeManager } from './components/EmployeeManager';
import { ShiftManager } from './components/ShiftManager';
import { ComplianceView } from './components/ComplianceView';
import { ShiftSwapView } from './components/ShiftSwapView';
import { ReportsView } from './components/ReportsView';
import { AutoScheduleModal } from './components/AutoScheduleModal';
import { PharmacySettingsModal } from './components/PharmacySettingsModal';
import { AiManagerChat } from './components/AiManagerChat';

type PersistedEmployee = Omit<Employee, 'role'> & { role: string; crf?: string };

const normalizeEmployee = ({ crf: _crf, ...employee }: PersistedEmployee): Employee => {
  const isLegacyPharmacist =
    employee.role === 'farmaceutico_rt' || employee.role === 'farmaceutico_assistente';
  return {
    ...employee,
    role: (isLegacyPharmacist ? 'farmaceutico' : employee.role) as Employee['role'],
    roleTitle: isLegacyPharmacist ? 'Farmacêutico' : employee.roleTitle,
  };
};

const getOccurrenceType = (shift?: ShiftType): EmployeeOccurrenceType | undefined => {
  if (!shift) return undefined;
  if (shift.id === 'shift_ferias' || shift.code === 'FÉR') return 'ferias';
  if (shift.id === 'shift_atestado' || shift.code === 'ATEST') return 'atestado';
  if (shift.id === 'shift_falta' || shift.code === 'FALTA') return 'falta';
  return undefined;
};

export default function App() {
  // Current Date State
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [activeTab, setActiveTab] = useState<ActiveTab>('escala');

  // Persistence State
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('farma_employees_clean');
    if (!saved) return INITIAL_EMPLOYEES;
    return (JSON.parse(saved) as PersistedEmployee[]).map(normalizeEmployee);
  });

  const [shifts, setShifts] = useState<ShiftType[]>(() => {
    const saved = localStorage.getItem('farma_shifts_clean');
    return saved ? JSON.parse(saved) : INITIAL_SHIFTS;
  });

  const [settings, setSettings] = useState<PharmacySettings>(() => {
    const saved = localStorage.getItem('farma_settings_clean');
    return saved ? JSON.parse(saved) : INITIAL_PHARMACY_SETTINGS;
  });

  const [schedulesMap, setSchedulesMap] = useState<Record<string, MonthSchedule>>(() => {
    const saved = localStorage.getItem('farma_schedules_clean');
    if (saved) {
      return JSON.parse(saved);
    }
    const initial = generateInitialSchedule(now.getFullYear(), now.getMonth() + 1);
    return { [initial.id]: initial };
  });

  // Modals state
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Remove the legacy fictitious dataset even when Fast Refresh preserved the
  // previous React state while this version was being installed.
  useEffect(() => {
    const hasLegacyDemo =
      settings.fantasyName === 'JadeFarma Centro & Manipulação' ||
      employees.some((employee) => employee.email.endsWith('@jadefarma.com.br'));

    if (!hasLegacyDemo) return;

    const emptySchedule = generateInitialSchedule(currentYear, currentMonth);
    setEmployees(INITIAL_EMPLOYEES);
    setSettings(INITIAL_PHARMACY_SETTINGS);
    setSchedulesMap({ [emptySchedule.id]: emptySchedule });
  }, [employees, settings, currentYear, currentMonth]);

  useEffect(() => {
    const legacyEmployees = employees as PersistedEmployee[];
    if (!legacyEmployees.some((employee) =>
      employee.role === 'farmaceutico_rt' || employee.role === 'farmaceutico_assistente' || employee.crf
    )) return;

    setEmployees(legacyEmployees.map(normalizeEmployee));
  }, [employees]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('farma_employees_clean', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('farma_shifts_clean', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('farma_settings_clean', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('farma_schedules_clean', JSON.stringify(schedulesMap));
  }, [schedulesMap]);

  // Current Month Schedule Instance
  const scheduleId = `schedule_${currentYear}_${currentMonth}`;
  const currentSchedule = useMemo(() => {
    if (schedulesMap[scheduleId]) {
      return schedulesMap[scheduleId];
    }
    return generateInitialSchedule(currentYear, currentMonth);
  }, [schedulesMap, scheduleId, currentYear, currentMonth]);

  // Real-time Regulatory & CLT Validation Engine
  const { alerts, dayCoverage, employeeHours } = useMemo(() => {
    return validateSchedule(currentSchedule, employees, shifts, settings);
  }, [currentSchedule, employees, shifts, settings]);

  // Aggregated metrics
  const totalWorkingHours = useMemo(() => {
    return (Object.values(employeeHours) as { totalHours: number }[]).reduce((acc, h) => acc + (h.totalHours || 0), 0);
  }, [employeeHours]);

  const crfCompliancePercent = useMemo(() => {
    const days = Object.values(dayCoverage) as DayCoverageSummary[];
    if (days.length === 0) return 100;
    const covered = days.filter((d) => d.isFullyCovered).length;
    return Math.round((covered / days.length) * 100);
  }, [dayCoverage]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectMonthYear = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Schedule mutation handlers
  const handleUpdateAssignment = (employeeId: string, dateStr: string, shiftId: string, note?: string) => {
    const key = `${employeeId}_${dateStr}`;
    const updatedAssignments = {
      ...currentSchedule.assignments,
      [key]: shiftId,
    };
    const updatedNotes = {
      ...(currentSchedule.customNotes || {}),
    };

    if (note && note.trim() !== '') {
      updatedNotes[key] = note.trim();
    } else {
      delete updatedNotes[key];
    }

    const updatedSchedule: MonthSchedule = {
      ...currentSchedule,
      assignments: updatedAssignments,
      customNotes: updatedNotes,
    };

    setSchedulesMap((prev) => ({
      ...prev,
      [scheduleId]: updatedSchedule,
    }));

    const occurrenceType = getOccurrenceType(shifts.find((shift) => shift.id === shiftId));
    if (occurrenceType) {
      setEmployees((current) => current.map((employee) => {
        if (employee.id !== employeeId) return employee;
        const history = employee.occurrenceHistory ?? [];
        const existing = history.find((item) => item.type === occurrenceType && item.startDate === dateStr && item.endDate === dateStr);
        const occurrence = {
          id: existing?.id ?? `occ_${employeeId}_${occurrenceType}_${dateStr}`,
          type: occurrenceType,
          startDate: dateStr,
          endDate: dateStr,
          note: note?.trim() || undefined,
          recordedAt: existing?.recordedAt ?? new Date().toISOString(),
          source: 'manual' as const,
        };
        return { ...employee, occurrenceHistory: existing ? history.map((item) => item.id === existing.id ? occurrence : item) : [...history, occurrence] };
      }));
    }
  };

  // Bulk fill employee pattern
  const handleBulkFillEmployee = (
    employeeId: string,
    pattern: 'standard_week' | 'clear' | 'alternating_weekends'
  ) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const updatedAssignments = { ...currentSchedule.assignments };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();
      const key = `${employeeId}_${dateStr}`;

      if (pattern === 'clear') {
        updatedAssignments[key] = 'shift_folga';
      } else if (pattern === 'standard_week') {
        if (dayOfWeek === 0) {
          updatedAssignments[key] = 'shift_folga';
        } else {
          updatedAssignments[key] = emp.preferredShiftId || 'shift_manha';
        }
      } else if (pattern === 'alternating_weekends') {
        const sundayIndex = Math.floor((day - 1) / 7);
        if (dayOfWeek === 0) {
          updatedAssignments[key] = sundayIndex % 2 === 0 ? emp.preferredShiftId || 'shift_manha' : 'shift_folga';
        } else if (dayOfWeek === 6 && sundayIndex % 2 === 0) {
          updatedAssignments[key] = 'shift_folga';
        } else {
          updatedAssignments[key] = emp.preferredShiftId || 'shift_manha';
        }
      }
    }

    setSchedulesMap((prev) => ({
      ...prev,
      [scheduleId]: {
        ...currentSchedule,
        assignments: updatedAssignments,
      },
    }));
  };

  // Auto-schedule execution
  const handleRunAutoSchedule = (options: AutoScheduleOptions) => {
    const activeEmployeesCount = employees.filter((employee) => employee.active).length;
    const minimumFeasibleDaysOff = Math.max(1, Math.ceil((activeEmployeesCount * 2) / 7));
    if (
      options.limitDailyDaysOff &&
      (options.maxEmployeesOffPerDay ?? 0) < minimumFeasibleDaysOff
    ) {
      window.alert(`Com ${activeEmployeesCount} colaboradores em 5x2, o limite mínimo viável é ${minimumFeasibleDaysOff} folgas no mesmo dia.`);
      return false;
    }

    let smartSchedule: MonthSchedule;
    try {
      smartSchedule = generateSmartSchedule(
        currentYear,
        currentMonth,
        employees,
        shifts,
        settings,
        options
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível gerar a escala com essas restrições.');
      return false;
    }

    setSchedulesMap((prev) => ({
      ...prev,
      [smartSchedule.id]: smartSchedule,
    }));

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#059669', '#10b981', '#047857', '#0d9488'],
    });
    return true;
  };

  const handleConfirmAiActions = (actions: AiAction[]) => {
    let nextEmployees = [...employees];
    let nextShifts = [...shifts];
    let nextSettings = { ...settings };
    let appliedCount = 0;
    let nextSchedule: MonthSchedule = {
      ...currentSchedule,
      assignments: { ...currentSchedule.assignments },
      customNotes: { ...(currentSchedule.customNotes ?? {}) },
      status: 'rascunho',
      publishedAt: undefined,
      publishedBy: undefined,
    };

    const parsePatch = (patchJson?: string): Record<string, unknown> => {
      if (!patchJson) return {};
      try {
        const parsed = JSON.parse(patchJson);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    };

    const employeeFields = new Set([
      'name', 'role', 'roleTitle', 'contractType', 'weeklyHoursTarget', 'email', 'phone',
      'active', 'preferredShiftId', 'unavailableDays', 'notes',
    ]);
    const employeeRoles = new Set<Employee['role']>([
      'farmaceutico', 'balconista', 'caixa', 'dermoconsultor', 'estoquista', 'gerente',
    ]);
    const contractTypes = new Set<Employee['contractType']>([
      'clt_44h', 'escala_12x36', 'escala_6x1', 'escala_5x2', 'clt_40h', 'estagio_30h',
    ]);
    const roleTitles: Record<Employee['role'], string> = {
      farmaceutico: 'Farmacêutico',
      balconista: 'Balconista de Farmácia',
      caixa: 'Operador de Caixa',
      dermoconsultor: 'Dermoconsultor',
      estoquista: 'Estoquista',
      gerente: 'Gerente',
    };
    const settingFields = new Set(Object.keys(settings));
    const isValidScheduleDate = (value?: string) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return year === currentYear && month === currentMonth &&
        date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    };
    const getDateRange = (start?: string, end?: string) => {
      const finalDate = end || start;
      if (!isValidScheduleDate(start) || !isValidScheduleDate(finalDate) || !start || !finalDate || start > finalDate) return [];
      const dates: string[] = [];
      const cursor = new Date(`${start}T12:00:00`);
      const last = new Date(`${finalDate}T12:00:00`);
      while (cursor <= last) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
      }
      return dates;
    };
    const normalDayOffShiftId = () =>
      nextShifts.find((shift) => shift.isDayOff && !shift.isSpecialLeave)?.id || 'shift_folga';
    const ensureAbsenceShift = () => {
      const existing = nextShifts.find((shift) => shift.id === 'shift_falta' || shift.code === 'FALTA');
      if (existing) return existing.id;
      const absenceShift: ShiftType = {
        id: 'shift_falta', name: 'Falta', code: 'FALTA',
        startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
        color: '#be123c', bgColor: 'bg-rose-100', textColor: 'text-rose-900', borderColor: 'border-rose-300',
        isDayOff: true, isSpecialLeave: true, description: 'Ausência não justificada.',
      };
      nextShifts = [...nextShifts, absenceShift];
      return absenceShift.id;
    };
    const rebalancePreservingProtectedPeriods = () => {
      const protectedEntries = Object.entries(nextSchedule.assignments).filter(([key, shiftId]) => {
        const shift = nextShifts.find((candidate) => candidate.id === shiftId);
        const note = nextSchedule.customNotes?.[key] || '';
        return Boolean(shift?.isSpecialLeave) || note.startsWith('IA: período protegido');
      });
      const protectedNotes = Object.fromEntries(
        protectedEntries.map(([key]) => [key, nextSchedule.customNotes?.[key] || ''])
      );
      const rebalanced = generateSmartSchedule(
        currentYear,
        currentMonth,
        nextEmployees,
        nextShifts,
        nextSettings,
        { ensureCrfCoverage: true, respectPreferences: true }
      );
      protectedEntries.forEach(([key, shiftId]) => { rebalanced.assignments[key] = shiftId; });
      rebalanced.customNotes = protectedNotes;

      const workingShifts = nextShifts.filter((shift) => !shift.isDayOff);
      const morningShift = [...workingShifts].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
      const afternoonShift = [...workingShifts].sort((a, b) => b.endTime.localeCompare(a.endTime))[0] || morningShift;
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

      const assignCoverage = (date: string, role: Employee['role'], required: number, shiftId: string) => {
        const workingCount = nextEmployees.filter((employee) => {
          const shift = nextShifts.find((candidate) => candidate.id === rebalanced.assignments[`${employee.id}_${date}`]);
          const matchesRole = role === 'balconista'
            ? employee.role === 'balconista' || employee.role === 'dermoconsultor'
            : employee.role === role;
          return employee.active && matchesRole && shift && !shift.isDayOff;
        }).length;
        let missing = Math.max(0, required - workingCount);
        if (!missing) return;
        nextEmployees
          .filter((employee) => {
            const key = `${employee.id}_${date}`;
            const currentShift = nextShifts.find((candidate) => candidate.id === rebalanced.assignments[key]);
            const matchesRole = role === 'balconista'
              ? employee.role === 'balconista' || employee.role === 'dermoconsultor'
              : employee.role === role;
            return employee.active && matchesRole && currentShift?.isDayOff && !currentShift.isSpecialLeave;
          })
          .slice(0, missing)
          .forEach((employee) => {
            const key = `${employee.id}_${date}`;
            rebalanced.assignments[key] = shiftId;
            rebalanced.customNotes![key] = 'IA: cobertura reorganizada por ausência';
            missing -= 1;
          });
      };

      if (!morningShift) return rebalanced;
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        assignCoverage(date, 'farmaceutico', Math.max(2, nextSettings.minPharmacistsPerShift * 2), morningShift.id);
        const workingPharmacists = nextEmployees.filter((employee) => {
          const shift = nextShifts.find((candidate) => candidate.id === rebalanced.assignments[`${employee.id}_${date}`]);
          return employee.active && employee.role === 'farmaceutico' && shift && !shift.isDayOff;
        });
        if (workingPharmacists.length >= 2) {
          rebalanced.assignments[`${workingPharmacists[0].id}_${date}`] = morningShift.id;
          rebalanced.assignments[`${workingPharmacists[1].id}_${date}`] = afternoonShift.id;
        }
        assignCoverage(date, 'balconista', Math.max(1, nextSettings.minAttendantsMorning, nextSettings.minAttendantsAfternoon), morningShift.id);
        assignCoverage(date, 'caixa', Math.max(1, nextSettings.minCashiers), afternoonShift.id);
      }
      return rebalanced;
    };

    actions.forEach((action, actionIndex) => {
      if (action.type === 'set_assignment') {
        const employeeExists = nextEmployees.some((employee) => employee.id === action.employeeId);
        const shiftExists = nextShifts.some((shift) => shift.id === action.shiftId);
        const validDate = isValidScheduleDate(action.date);
        if (employeeExists && shiftExists && validDate && action.employeeId && action.date && action.shiftId) {
          nextSchedule.assignments[`${action.employeeId}_${action.date}`] = action.shiftId;
          appliedCount += 1;
        }
      }

      if (action.type === 'set_assignment_range' && action.employeeId && action.shiftId) {
        const employeeExists = nextEmployees.some((employee) => employee.id === action.employeeId);
        const shiftExists = nextShifts.some((shift) => shift.id === action.shiftId);
        const dates = getDateRange(action.date, action.targetDate);
        if (employeeExists && shiftExists && dates.length > 0) {
          dates.forEach((date) => {
            nextSchedule.assignments[`${action.employeeId}_${date}`] = action.shiftId!;
          });
          appliedCount += 1;
        }
      }

      if (action.type === 'register_absence' && action.employeeId) {
        const employeeExists = nextEmployees.some((employee) => employee.id === action.employeeId);
        const patch = parsePatch(action.patchJson);
        const kind = patch.kind;
        const dates = getDateRange(action.date, action.targetDate);
        const absenceShiftId = kind === 'atestado'
          ? nextShifts.find((shift) => shift.id === 'shift_atestado' || shift.code === 'ATEST')?.id
          : kind === 'ferias'
            ? nextShifts.find((shift) => shift.id === 'shift_ferias' || shift.code === 'FÉR')?.id
          : kind === 'falta'
            ? ensureAbsenceShift()
            : kind === 'folga'
              ? normalDayOffShiftId()
              : undefined;
        if (employeeExists && absenceShiftId && dates.length > 0) {
          const extraNote = typeof patch.note === 'string' && patch.note.trim() ? `: ${patch.note.trim()}` : '';
          dates.forEach((date) => {
            const key = `${action.employeeId}_${date}`;
            nextSchedule.assignments[key] = absenceShiftId;
            nextSchedule.customNotes![key] = `IA: período protegido — ${kind}${extraNote}`;
          });
          if (kind === 'ferias' || kind === 'atestado' || kind === 'falta') {
            const occurrenceId = `occ_${action.employeeId}_${kind}_${dates[0]}_${dates[dates.length - 1]}`;
            nextEmployees = nextEmployees.map((employee) => employee.id !== action.employeeId ? employee : {
              ...employee,
              occurrenceHistory: [
                ...(employee.occurrenceHistory ?? []).filter((item) => item.id !== occurrenceId),
                {
                  id: occurrenceId,
                  type: kind,
                  startDate: dates[0],
                  endDate: dates[dates.length - 1],
                  note: typeof patch.note === 'string' ? patch.note.trim() || undefined : undefined,
                  recordedAt: new Date().toISOString(),
                  source: 'ia',
                },
              ],
            });
          }
          appliedCount += 1;
        }
      }

      if (action.type === 'rebalance_schedule') {
        try {
          nextSchedule = rebalancePreservingProtectedPeriods();
          appliedCount += 1;
        } catch {
          // Keep the current scale unchanged when it cannot be rebalanced safely.
        }
      }

      if (action.type === 'swap_assignments' && action.employeeId && action.date && action.targetDate) {
        const employeeExists = nextEmployees.some((employee) => employee.id === action.employeeId);
        const datesAreValid = isValidScheduleDate(action.date) && isValidScheduleDate(action.targetDate);
        if (employeeExists && datesAreValid) {
          const sourceKey = `${action.employeeId}_${action.date}`;
          const targetKey = `${action.employeeId}_${action.targetDate}`;
          const dayOffShiftId = shifts.find((shift) => shift.isDayOff && !shift.isSpecialLeave)?.id || 'shift_folga';
          const sourceShift = nextSchedule.assignments[sourceKey] || dayOffShiftId;
          const targetShift = nextSchedule.assignments[targetKey] || dayOffShiftId;
          nextSchedule.assignments[sourceKey] = targetShift;
          nextSchedule.assignments[targetKey] = sourceShift;

          const sourceNote = nextSchedule.customNotes?.[sourceKey];
          const targetNote = nextSchedule.customNotes?.[targetKey];
          if (nextSchedule.customNotes) {
            if (targetNote) nextSchedule.customNotes[sourceKey] = targetNote;
            else delete nextSchedule.customNotes[sourceKey];
            if (sourceNote) nextSchedule.customNotes[targetKey] = sourceNote;
            else delete nextSchedule.customNotes[targetKey];
          }
          appliedCount += 1;
        }
      }

      if (action.type === 'update_employee' && action.employeeId) {
        const patch = parsePatch(action.patchJson);
        const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => employeeFields.has(key)));
        if (safePatch.role && !employeeRoles.has(safePatch.role as Employee['role'])) delete safePatch.role;
        if (safePatch.contractType && !contractTypes.has(safePatch.contractType as Employee['contractType'])) delete safePatch.contractType;
        if ('weeklyHoursTarget' in safePatch && (typeof safePatch.weeklyHoursTarget !== 'number' || !Number.isFinite(safePatch.weeklyHoursTarget) || safePatch.weeklyHoursTarget <= 0)) delete safePatch.weeklyHoursTarget;
        if ('active' in safePatch && typeof safePatch.active !== 'boolean') delete safePatch.active;
        if ('unavailableDays' in safePatch && (!Array.isArray(safePatch.unavailableDays) || safePatch.unavailableDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) delete safePatch.unavailableDays;
        if (safePatch.preferredShiftId && !nextShifts.some((shift) => shift.id === safePatch.preferredShiftId)) delete safePatch.preferredShiftId;
        ['name', 'roleTitle', 'email', 'phone', 'notes'].forEach((field) => {
          if (field in safePatch && typeof safePatch[field] !== 'string') delete safePatch[field];
        });
        const employeeExists = nextEmployees.some((employee) => employee.id === action.employeeId);
        nextEmployees = nextEmployees.map((employee) =>
          employee.id === action.employeeId ? { ...employee, ...safePatch } as Employee : employee
        );
        if (employeeExists && Object.keys(safePatch).length > 0) appliedCount += 1;
      }

      if (action.type === 'add_employee') {
        const patch = parsePatch(action.patchJson);
        if (
          typeof patch.name === 'string' &&
          typeof patch.role === 'string' &&
          employeeRoles.has(patch.role as Employee['role'])
        ) {
          nextEmployees.push({
            id: `emp_ai_${Date.now()}_${actionIndex}`,
            name: patch.name,
            cpf: '',
            role: patch.role as Employee['role'],
            roleTitle: typeof patch.roleTitle === 'string' ? patch.roleTitle : roleTitles[patch.role as Employee['role']],
            contractType: contractTypes.has(patch.contractType as Employee['contractType'])
              ? patch.contractType as Employee['contractType']
              : 'escala_5x2',
            weeklyHoursTarget: typeof patch.weeklyHoursTarget === 'number' ? patch.weeklyHoursTarget : 44,
            email: typeof patch.email === 'string' ? patch.email : '',
            phone: typeof patch.phone === 'string' ? patch.phone : '',
            color: '#0284c7',
            active: patch.active !== false,
            hireDate: new Date().toISOString().slice(0, 10),
            preferredShiftId: typeof patch.preferredShiftId === 'string' && nextShifts.some((shift) => shift.id === patch.preferredShiftId)
              ? patch.preferredShiftId
              : undefined,
            notes: typeof patch.notes === 'string' ? patch.notes : undefined,
          });
          appliedCount += 1;
        }
      }

      if (action.type === 'toggle_employee' && action.employeeId) {
        nextEmployees = nextEmployees.map((employee) =>
          employee.id === action.employeeId ? { ...employee, active: !employee.active } : employee
        );
        if (nextEmployees.some((employee) => employee.id === action.employeeId)) appliedCount += 1;
      }

      if (action.type === 'delete_employee' && action.employeeId) {
        const existed = nextEmployees.some((employee) => employee.id === action.employeeId);
        nextEmployees = nextEmployees.filter((employee) => employee.id !== action.employeeId);
        nextSchedule.assignments = Object.fromEntries(
          Object.entries(nextSchedule.assignments).filter(([key]) => !key.startsWith(`${action.employeeId}_`))
        );
        if (existed) appliedCount += 1;
      }

      if (action.type === 'add_shift') {
        const patch = parsePatch(action.patchJson);
        const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (
          typeof patch.name === 'string' && patch.name.trim() &&
          typeof patch.code === 'string' && patch.code.trim() &&
          typeof patch.startTime === 'string' && timePattern.test(patch.startTime) &&
          typeof patch.endTime === 'string' && timePattern.test(patch.endTime) &&
          typeof patch.breakMinutes === 'number' && patch.breakMinutes >= 0 &&
          typeof patch.durationHours === 'number' && patch.durationHours > 0
        ) {
          nextShifts.push({
            id: `shift_ai_${Date.now()}_${actionIndex}`,
            name: patch.name.trim(),
            code: patch.code.trim().toUpperCase(),
            startTime: patch.startTime,
            endTime: patch.endTime,
            breakMinutes: patch.breakMinutes,
            durationHours: patch.durationHours,
            color: '#0284c7',
            bgColor: '#e0f2fe',
            textColor: '#075985',
            borderColor: '#7dd3fc',
            isDayOff: false,
            isNightShift: patch.isNightShift === true,
            requiresPharmacist: patch.requiresPharmacist === true,
            description: typeof patch.description === 'string' ? patch.description : undefined,
          });
          appliedCount += 1;
        }
      }

      if (action.type === 'update_shift' && action.shiftId) {
        const patch = parsePatch(action.patchJson);
        const shiftFields = new Set([
          'name', 'code', 'startTime', 'endTime', 'breakMinutes', 'durationHours',
          'isNightShift', 'requiresPharmacist', 'description',
        ]);
        const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => shiftFields.has(key)));
        const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
        ['name', 'code', 'description'].forEach((field) => {
          if (field in safePatch && typeof safePatch[field] !== 'string') delete safePatch[field];
        });
        ['startTime', 'endTime'].forEach((field) => {
          if (field in safePatch && (typeof safePatch[field] !== 'string' || !timePattern.test(safePatch[field] as string))) delete safePatch[field];
        });
        if ('breakMinutes' in safePatch && (typeof safePatch.breakMinutes !== 'number' || safePatch.breakMinutes < 0)) delete safePatch.breakMinutes;
        if ('durationHours' in safePatch && (typeof safePatch.durationHours !== 'number' || safePatch.durationHours <= 0)) delete safePatch.durationHours;
        ['isNightShift', 'requiresPharmacist'].forEach((field) => {
          if (field in safePatch && typeof safePatch[field] !== 'boolean') delete safePatch[field];
        });
        const shiftExists = nextShifts.some((shift) => shift.id === action.shiftId);
        nextShifts = nextShifts.map((shift) =>
          shift.id === action.shiftId ? { ...shift, ...safePatch } as ShiftType : shift
        );
        if (shiftExists && Object.keys(safePatch).length > 0) appliedCount += 1;
      }

      if (action.type === 'delete_shift' && action.shiftId) {
        const shift = nextShifts.find((candidate) => candidate.id === action.shiftId);
        const isAssigned = Object.values(nextSchedule.assignments).includes(action.shiftId);
        if (shift && !shift.isDayOff && !isAssigned && nextShifts.length > 1) {
          nextShifts = nextShifts.filter((candidate) => candidate.id !== action.shiftId);
          appliedCount += 1;
        }
      }

      if (action.type === 'update_settings') {
        const patch = parsePatch(action.patchJson);
        const safePatch = Object.fromEntries(Object.entries(patch).filter(([key, value]) =>
          settingFields.has(key) && typeof value === typeof nextSettings[key as keyof PharmacySettings]
        ));
        nextSettings = { ...nextSettings, ...safePatch } as PharmacySettings;
        if (Object.keys(safePatch).length > 0) appliedCount += 1;
      }

      if (action.type === 'generate_5x2') {
        nextSchedule = generateSmartSchedule(
          currentYear,
          currentMonth,
          nextEmployees,
          nextShifts,
          nextSettings,
          { ensureCrfCoverage: true, respectPreferences: true }
        );
        appliedCount += 1;
      }
    });

    setEmployees(nextEmployees);
    setShifts(nextShifts);
    setSettings(nextSettings);
    setSchedulesMap((previous) => ({ ...previous, [scheduleId]: nextSchedule }));
    if (actions.some((action) => ['set_assignment', 'set_assignment_range', 'register_absence', 'rebalance_schedule', 'swap_assignments', 'generate_5x2'].includes(action.type))) {
      setActiveTab('escala');
    } else if (actions.some((action) => ['add_employee', 'update_employee', 'toggle_employee', 'delete_employee'].includes(action.type))) {
      setActiveTab('funcionarios');
    } else if (actions.some((action) => ['add_shift', 'update_shift', 'delete_shift'].includes(action.type))) {
      setActiveTab('turnos');
    }
    if (appliedCount > 0) {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 }, colors: ['#0284c7', '#0ea5e9', '#10b981'] });
    }
    return appliedCount;
  };

  // Toggle publish status
  const handleTogglePublish = () => {
    const newStatus = currentSchedule.status === 'publicado' ? 'rascunho' : 'publicado';
    const updated: MonthSchedule = {
      ...currentSchedule,
      status: newStatus,
      publishedAt: newStatus === 'publicado' ? new Date().toISOString() : undefined,
      publishedBy: newStatus === 'publicado'
        ? (settings.technicalResponsible ? `${settings.technicalResponsible} (RT)` : 'Usuário')
        : undefined,
    };

    setSchedulesMap((prev) => ({
      ...prev,
      [scheduleId]: updated,
    }));

    if (newStatus === 'publicado') {
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#059669', '#34d399', '#0d9488'],
      });
    }
  };

  const handleDeleteSchedule = () => {
    const confirmed = window.confirm(
      `Deseja excluir a escala de ${currentMonth}/${currentYear}? Funcionários, turnos e outros meses serão preservados.`
    );
    if (!confirmed) return;

    setSchedulesMap((previous) => {
      const next = { ...previous };
      delete next[scheduleId];
      return next;
    });
  };

  // Shift Swap handler
  const handleApplySwap = (
    empAId: string,
    dateA: string,
    newShiftForA: string,
    empBId: string,
    dateB: string,
    newShiftForB: string,
    reason: string
  ) => {
    const keyA = `${empAId}_${dateA}`;
    const keyB = `${empBId}_${dateB}`;

    const updatedAssignments = {
      ...currentSchedule.assignments,
      [keyA]: newShiftForA,
      [keyB]: newShiftForB,
    };

    const updatedNotes = {
      ...(currentSchedule.customNotes || {}),
      [keyA]: `Permuta com ${employees.find((e) => e.id === empBId)?.name || 'Colega'}: ${reason}`,
      [keyB]: `Permuta com ${employees.find((e) => e.id === empAId)?.name || 'Colega'}: ${reason}`,
    };

    setSchedulesMap((prev) => ({
      ...prev,
      [scheduleId]: {
        ...currentSchedule,
        assignments: updatedAssignments,
        customNotes: updatedNotes,
      },
    }));
  };

  // Employee CRUD
  const handleSaveEmployee = (employee: Employee) => {
    setEmployees((prev) => {
      const idx = prev.findIndex((e) => e.id === employee.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = employee;
        return next;
      }
      return [...prev, employee];
    });
  };

  const handleDeleteEmployee = (id: string) => {
    if (employees.length <= 1) return;
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const handleToggleActive = (id: string) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e))
    );
  };

  // Shift CRUD
  const handleSaveShift = (shift: ShiftType) => {
    setShifts((prev) => {
      const idx = prev.findIndex((s) => s.id === shift.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = shift;
        return next;
      }
      return [...prev, shift];
    });
  };

  const handleDeleteShift = (id: string) => {
    if (shifts.length <= 1) return;
    setShifts((prev) => prev.filter((s) => s.id !== id));
  };

  // Clear all user-entered data while preserving the operational shift templates.
  const handleResetData = () => {
    if (window.confirm('Deseja limpar os dados da farmácia, funcionários e escalas?')) {
      setEmployees(INITIAL_EMPLOYEES);
      setShifts(INITIAL_SHIFTS);
      setSettings(INITIAL_PHARMACY_SETTINGS);
      const initial = generateInitialSchedule(currentYear, currentMonth);
      setSchedulesMap({ [initial.id]: initial });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col antialiased">
      {/* Top Header */}
      <Header
        currentYear={currentYear}
        currentMonth={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        settings={settings}
        schedule={currentSchedule}
        onOpenAutoSchedule={() => setIsAutoScheduleOpen(true)}
        onPrint={() => setActiveTab('relatorios')}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onTogglePublish={handleTogglePublish}
        onDeleteSchedule={handleDeleteSchedule}
        totalWorkingHours={totalWorkingHours}
      />

      {/* Navigation Tabs */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        employeesCount={employees.filter((e) => e.active).length}
        shiftsCount={shifts.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'escala' && (
          <ScheduleGrid
            currentYear={currentYear}
            currentMonth={currentMonth}
            employees={employees}
            shifts={shifts}
            schedule={currentSchedule}
            settings={settings}
            dayCoverage={dayCoverage}
            employeeHours={employeeHours}
            onUpdateAssignment={handleUpdateAssignment}
            onOpenEmployeeModal={() => setActiveTab('funcionarios')}
          />
        )}

        {activeTab === 'funcionarios' && (
          <EmployeeManager
            employees={employees}
            shifts={shifts}
            onSaveEmployee={handleSaveEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onToggleActive={handleToggleActive}
          />
        )}

        {activeTab === 'turnos' && (
          <ShiftManager
            shifts={shifts}
            onSaveShift={handleSaveShift}
            onDeleteShift={handleDeleteShift}
          />
        )}

        {activeTab === 'conformidade' && (
          <ComplianceView
            alerts={alerts}
            employees={employees}
            dayCoverage={dayCoverage}
            employeeHours={employeeHours}
            settings={settings}
            onNavigateToScheduleDay={(dateStr) => {
              setActiveTab('escala');
            }}
          />
        )}

        {activeTab === 'trocas' && (
          <ShiftSwapView
            currentYear={currentYear}
            currentMonth={currentMonth}
            employees={employees}
            shifts={shifts}
            schedule={currentSchedule}
            onApplySwap={handleApplySwap}
          />
        )}

        {activeTab === 'relatorios' && (
          <ReportsView
            currentYear={currentYear}
            currentMonth={currentMonth}
            settings={settings}
            schedule={currentSchedule}
            employees={employees}
            shifts={shifts}
            dayCoverage={dayCoverage}
            employeeHours={employeeHours}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span className="font-semibold text-emerald-900">FarmaEscala</span>
            <span>• Gestão de Escalas e Assistência Farmacêutica CRF</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={handleResetData}
              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Limpar dados
            </button>
            <span className="text-slate-300">|</span>
            <span>Escalas 5x2</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AutoScheduleModal
        isOpen={isAutoScheduleOpen}
        onClose={() => setIsAutoScheduleOpen(false)}
        currentYear={currentYear}
        currentMonth={currentMonth}
        activePharmacistsCount={employees.filter(
          (employee) => employee.active &&
            employee.role === 'farmaceutico'
        ).length}
        activeEmployeesCount={employees.filter((employee) => employee.active).length}
        onRunAutoSchedule={handleRunAutoSchedule}
      />

      <PharmacySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
      />

      <AiManagerChat
        currentYear={currentYear}
        currentMonth={currentMonth}
        employees={employees}
        shifts={shifts}
        settings={settings}
        schedule={currentSchedule}
        onConfirmActions={handleConfirmAiActions}
      />
    </div>
  );
}
