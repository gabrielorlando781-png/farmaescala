import { Employee, ShiftType, MonthSchedule, ScheduleAlert, DayCoverageSummary, PharmacySettings, AutoScheduleOptions } from '../types';

/**
 * Validates a month schedule against Brazilian Labor Laws (CLT) and Federal Pharmacy Council (CRF) rules.
 */
export function validateSchedule(
  schedule: MonthSchedule,
  employees: Employee[],
  shifts: ShiftType[],
  settings: PharmacySettings
): {
  alerts: ScheduleAlert[];
  dayCoverage: Record<string, DayCoverageSummary>;
  employeeHours: Record<string, { totalHours: number; daysWorked: number; daysOff: number; weeklyHours: number[] }>;
} {
  const alerts: ScheduleAlert[] = [];
  const shiftMap = new Map<string, ShiftType>(shifts.map((s) => [s.id, s]));
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
  const dayCoverage: Record<string, DayCoverageSummary> = {};
  const employeeHours: Record<string, { totalHours: number; daysWorked: number; daysOff: number; weeklyHours: number[] }> = {};

  // Initialize employee hours tracker
  employees.forEach((emp) => {
    employeeHours[emp.id] = {
      totalHours: 0,
      daysWorked: 0,
      daysOff: 0,
      weeklyHours: [0, 0, 0, 0, 0, 0], // Weeks in month
    };
  });

  // Track consecutive working days & previous day shift end for interjornada check
  const consecutiveDaysMap: Record<string, number> = {};
  const lastShiftMap: Record<string, { shift: ShiftType; date: string }> = {};

  employees.forEach((emp) => {
    consecutiveDaysMap[emp.id] = 0;
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${schedule.year}-${String(schedule.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayDate = new Date(schedule.year, schedule.month - 1, day);
    const dayOfWeek = dayDate.getDay();
    const weekIndex = Math.min(5, Math.floor((day + (new Date(schedule.year, schedule.month - 1, 1).getDay() - 1)) / 7));

    let pharmacistsMorning = 0;
    let pharmacistsAfternoon = 0;
    let pharmacistsNight = 0;
    let totalPharmacists = 0;
    let totalBalconistas = 0;
    let totalCaixas = 0;
    let totalWorking = 0;
    let totalOff = 0;

    employees.forEach((emp) => {
      if (!emp.active) return;

      const key = `${emp.id}_${dateStr}`;
      const shiftId = schedule.assignments[key];
      const shift = shiftMap.get(shiftId) || shiftMap.get('shift_folga')!;

      // Interjornada check (11h rest between shifts)
      const prevShiftInfo = lastShiftMap[emp.id];
      if (prevShiftInfo && !prevShiftInfo.shift.isDayOff && !shift.isDayOff) {
        // If yesterday was T1 (ends 23:00) and today is M1 (starts 07:00) -> 8h rest (< 11h)
        if (prevShiftInfo.shift.endTime >= '22:00' && shift.startTime <= '08:00') {
          alerts.push({
            id: `alert_inter_${emp.id}_${dateStr}`,
            severity: 'error',
            category: 'interjornada_11h',
            title: `Violação de Interjornada (CLT Art. 66)`,
            description: `${emp.name} encerrou às ${prevShiftInfo.shift.endTime} no dia anterior e inicia às ${shift.startTime} no dia ${day}/${schedule.month} (descanso inferior a 11 horas).`,
            date: dateStr,
            employeeId: emp.id,
            employeeName: emp.name,
          });
        }
      }
      lastShiftMap[emp.id] = { shift, date: dateStr };

      if (!shift.isDayOff) {
        totalWorking++;
        consecutiveDaysMap[emp.id] = (consecutiveDaysMap[emp.id] || 0) + 1;
        employeeHours[emp.id].totalHours += shift.durationHours;
        employeeHours[emp.id].daysWorked += 1;
        if (employeeHours[emp.id].weeklyHours[weekIndex] !== undefined) {
          employeeHours[emp.id].weeklyHours[weekIndex] += shift.durationHours;
        }

        // Check for 6+ consecutive working days without rest
        if (consecutiveDaysMap[emp.id] > 6) {
          alerts.push({
            id: `alert_consec_${emp.id}_${dateStr}`,
            severity: 'warning',
            category: 'falta_equipe',
            title: 'Excesso de Dias Consecutivos',
            description: `${emp.name} está escalado(a) por ${consecutiveDaysMap[emp.id]} dias seguidos sem folga até o dia ${day}/${schedule.month}.`,
            date: dateStr,
            employeeId: emp.id,
            employeeName: emp.name,
          });
        }

        // Role counting
        if (emp.role === 'farmaceutico') {
          totalPharmacists++;
          if (shift.startTime <= '12:00') pharmacistsMorning++;
          if (shift.endTime >= '17:00' || shift.startTime >= '13:00') pharmacistsAfternoon++;
          if (shift.isNightShift) pharmacistsNight++;
        } else if (emp.role === 'balconista' || emp.role === 'dermoconsultor') {
          totalBalconistas++;
        } else if (emp.role === 'caixa') {
          totalCaixas++;
        }
      } else {
        totalOff++;
        consecutiveDaysMap[emp.id] = 0; // Reset consecutive days
        employeeHours[emp.id].daysOff += 1;
      }
    });

    // Check CRF Compliance: Pharmacist mandatory during open hours
    const isStoreOpen = settings.opensWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6);
    const hasPharmaMorning = pharmacistsMorning > 0;
    const hasPharmaAfternoon = pharmacistsAfternoon > 0;
    const isFullyCovered = hasPharmaMorning && hasPharmaAfternoon;

    if (isStoreOpen && (!hasPharmaMorning || !hasPharmaAfternoon)) {
      alerts.push({
        id: `alert_crf_${dateStr}`,
        severity: 'error',
        category: 'crf_sem_farmaceutico',
        title: `Ausência de Farmacêutico CRF (${day}/${schedule.month})`,
        description: `No dia ${day}/${schedule.month} (${getDayName(dayOfWeek)}), a farmácia está sem farmacêutico responsável no turno da ${!hasPharmaMorning ? 'Manhã' : 'Tarde/Fechamento'}. A legislação exige assistência farmacêutica contínua.`,
        date: dateStr,
      });
    }

    // Minimum staff alerts (Balconistas e Caixa)
    if (isStoreOpen && dayOfWeek !== 0 && totalBalconistas < 1) {
      alerts.push({
        id: `alert_balcao_${dateStr}`,
        severity: 'warning',
        category: 'falta_equipe',
        title: `Equipe de Balcão Insuficiente (${day}/${schedule.month})`,
        description: `Nenhum balconista escalado para atendimento e Farmácia Popular neste dia.`,
        date: dateStr,
      });
    }

    dayCoverage[dateStr] = {
      date: dateStr,
      dayOfWeek,
      hasPharmacistMorning: hasPharmaMorning,
      hasPharmacistAfternoon: hasPharmaAfternoon,
      hasPharmacistNight: pharmacistsNight > 0,
      totalPharmacists,
      totalBalconistas,
      totalCaixas,
      totalWorking,
      totalOff,
      isFullyCovered,
    };
  }

  // Weekly hours verification (Max 44h target)
  employees.forEach((emp) => {
    const hoursData = employeeHours[emp.id];
    hoursData.weeklyHours.forEach((hours, wIdx) => {
      if (hours > emp.weeklyHoursTarget + 4) {
        alerts.push({
          id: `alert_overtime_${emp.id}_w${wIdx}`,
          severity: 'warning',
          category: 'limite_horas_semanal',
          title: `Carga Horária Semanal Excedida`,
          description: `${emp.name} está com ${hours.toFixed(1)}h na semana ${wIdx + 1} (limite de contrato: ${emp.weeklyHoursTarget}h). Exige compensação ou pagamento de horas extras.`,
          employeeId: emp.id,
          employeeName: emp.name,
        });
      }
    });
  });

  return { alerts, dayCoverage, employeeHours };
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[dayOfWeek] || '';
}

export function getShortDayName(dayOfWeek: number): string {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days[dayOfWeek] || '';
}

export function getMonthName(month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || '';
}

/**
 * Continuous 5x2 auto-schedule generator.
 * Uses absolute calendar days so the five-work/two-rest cycle continues across months.
 */
export function generateSmartSchedule(
  year: number,
  month: number,
  employees: Employee[],
  shifts: ShiftType[],
  settings: PharmacySettings,
  options: AutoScheduleOptions
): MonthSchedule {
  const daysInMonth = new Date(year, month, 0).getDate();
  const assignments: Record<string, string> = {};

  const activeEmployees = employees.filter((employee) => employee.active);
  const dayOffShift = shifts.find((shift) => shift.isDayOff && !shift.isSpecialLeave);
  const workingShifts = shifts.filter((shift) => !shift.isDayOff);

  if (!dayOffShift) {
    throw new Error('Cadastre um turno de folga antes de criar a escala 5x2.');
  }
  if (workingShifts.length === 0) {
    throw new Error('Cadastre ao menos um turno de trabalho antes de criar a escala 5x2.');
  }

  const workingShiftIds = new Set(workingShifts.map((shift) => shift.id));
  const shiftsByStart = [...workingShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const morningShift = shiftsByStart[0];
  const afternoonShift = [...workingShifts].sort((a, b) => b.endTime.localeCompare(a.endTime))[0];
  const middleShift = shiftsByStart[Math.floor(shiftsByStart.length / 2)];

  const employeeGroups: Employee[][] = [
    activeEmployees.filter((employee) => employee.role === 'farmaceutico'),
    activeEmployees.filter((employee) => employee.role === 'balconista' || employee.role === 'dermoconsultor'),
    activeEmployees.filter((employee) => employee.role === 'caixa'),
    activeEmployees.filter((employee) => ![
      'farmaceutico',
      'balconista',
      'dermoconsultor',
      'caixa',
    ].includes(employee.role)),
  ];

  // Each employee receives a stable phase inside a seven-day cycle. Distributing
  // phases inside each role group prevents an entire team from resting together.
  const cyclePhase = new Map<string, number>();
  if (options.limitDailyDaysOff) {
    const maximumDailyDaysOff = Math.max(1, options.maxEmployeesOffPerDay ?? 1);
    const minimumFeasible = Math.max(1, Math.ceil((activeEmployees.length * 2) / 7));
    if (maximumDailyDaysOff < minimumFeasible) {
      throw new Error(`O limite mínimo viável é ${minimumFeasible} folgas por dia.`);
    }

    const offCounts = Array<number>(7).fill(0);
    const offResidues = (phase: number) => (options.spreadDaysOff ? [
      ((2 - phase) % 7 + 7) % 7,
      ((6 - phase) % 7 + 7) % 7,
    ] : [
      ((5 - phase) % 7 + 7) % 7,
      ((6 - phase) % 7 + 7) % 7,
    ]);
    const commitPhase = (employee: Employee, phase: number) => {
      cyclePhase.set(employee.id, phase);
      offResidues(phase).forEach((residue) => { offCounts[residue] += 1; });
    };

    const pharmacists = employeeGroups[0];
    if (options.ensureCrfCoverage && pharmacists.length >= 2) {
      pharmacists.forEach((employee, index) => {
        commitPhase(employee, Math.floor((index * 7) / pharmacists.length));
      });
    }

    const remainingEmployees = employeeGroups
      .flat()
      .filter((employee) => !cyclePhase.has(employee.id));

    remainingEmployees.forEach((employee, employeeIndex) => {
      const candidates = Array.from({ length: 7 }, (_, offset) => (employeeIndex + offset) % 7)
        .map((phase) => {
          const residues = offResidues(phase);
          const projected = offCounts.map((count, residue) =>
            count + (residues.includes(residue) ? 1 : 0)
          );
          return {
            phase,
            isValid: Math.max(...projected) <= maximumDailyDaysOff,
            score: Math.max(...projected) * 100 + projected.reduce((sum, count) => sum + count * count, 0),
          };
        })
        .filter((candidate) => candidate.isValid)
        .sort((a, b) => a.score - b.score);

      if (candidates.length === 0) {
        throw new Error(`Não foi possível distribuir as folgas com o limite de ${maximumDailyDaysOff} por dia.`);
      }
      commitPhase(employee, candidates[0].phase);
    });
  } else {
    employeeGroups.forEach((group, groupIndex) => {
      group.forEach((employee, index) => {
        const shouldStagger = groupIndex !== 0 || options.ensureCrfCoverage;
        cyclePhase.set(
          employee.id,
          shouldStagger ? Math.floor((index * 7) / Math.max(group.length, 1)) : 0
        );
      });
    });
  }

  const isPharmacist = (employee: Employee) =>
    employee.role === 'farmaceutico';
  const isCashier = (employee: Employee) => employee.role === 'caixa';

  // A fixed unavailable weekday replaces a normal rest day in the 5x2 cycle.
  // Therefore, "não trabalha aos domingos" means Sunday is always off without
  // accidentally creating a third day off in the same weekly cycle.
  const restCycleDaysByEmployee = new Map<string, Set<number>>();
  activeEmployees.forEach((employee) => {
    const phase = cyclePhase.get(employee.id) ?? 0;
    const standardRestDays = options.spreadDaysOff ? [2, 6] : [5, 6];
    const unavailableCycleDays = [...new Set((employee.unavailableDays ?? []).map((dayOfWeek) => {
      // 2024-01-07 is a Sunday; the absolute-day residue is stable for each weekday.
      const absoluteDay = Math.floor(Date.UTC(2024, 0, 7 + dayOfWeek) / 86_400_000);
      return ((absoluteDay + phase) % 7 + 7) % 7;
    }))];
    const restDays = [...unavailableCycleDays];
    standardRestDays.forEach((restDay) => {
      if (restDays.length < 2 && !restDays.includes(restDay)) restDays.push(restDay);
    });
    restCycleDaysByEmployee.set(employee.id, new Set(restDays));
  });

  const preferredOrFallback = (employee: Employee, fallback: ShiftType) => {
    if (options.respectPreferences && employee.preferredShiftId && workingShiftIds.has(employee.preferredShiftId)) {
      return employee.preferredShiftId;
    }
    return fallback.id;
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const absoluteDay = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
    const workingToday: Employee[] = [];

    activeEmployees.forEach((employee) => {
      const phase = cyclePhase.get(employee.id) ?? 0;
      const cycleDay = ((absoluteDay + phase) % 7 + 7) % 7;
      const key = `${employee.id}_${dateStr}`;

      // The manager can opt into two separated days off while retaining the
      // same five-work/two-rest weekly ratio.
      const isRestDay = restCycleDaysByEmployee.get(employee.id)?.has(cycleDay) ?? false;
      if (isRestDay) {
        assignments[key] = dayOffShift.id;
        return;
      }

      workingToday.push(employee);
      const fallback = isPharmacist(employee)
        ? (workingToday.filter(isPharmacist).length % 2 === 1 ? morningShift : afternoonShift)
        : isCashier(employee)
          ? (workingToday.filter(isCashier).length % 2 === 1 ? morningShift : afternoonShift)
          : middleShift;
      assignments[key] = preferredOrFallback(employee, fallback);
    });

    // When at least two pharmacists work, explicitly cover opening and closing.
    // This never changes anyone's 5x2 rest cycle, only their shift for the day.
    if (options.ensureCrfCoverage) {
      const pharmacistsToday = workingToday.filter(isPharmacist);
      if (pharmacistsToday.length >= 2) {
        assignments[`${pharmacistsToday[0].id}_${dateStr}`] = morningShift.id;
        assignments[`${pharmacistsToday[1].id}_${dateStr}`] = afternoonShift.id;
      }
    }

    // Balance working employees between shifts to honour the minimum coverage
    // configured by the manager. This never moves an employee's 5x2 rest day.
    const assignedCount = (shiftId: string) => workingToday.filter(
      (employee) => assignments[`${employee.id}_${dateStr}`] === shiftId
    ).length;
    const requiredShifts = workingShifts
      .filter((shift) => (shift.minEmployeesPerShift ?? 0) > 0)
      .sort((a, b) => Number(b.requiresPharmacist) - Number(a.requiresPharmacist));

    for (const targetShift of requiredShifts) {
      const required = Math.max(0, Math.floor(targetShift.minEmployeesPerShift ?? 0));
      while (assignedCount(targetShift.id) < required) {
        const candidate = workingToday.find((employee) => {
          const currentShiftId = assignments[`${employee.id}_${dateStr}`];
          if (currentShiftId === targetShift.id) return false;
          const currentShift = workingShifts.find((shift) => shift.id === currentShiftId);
          const currentMinimum = currentShift?.minEmployeesPerShift ?? 0;
          if (assignedCount(currentShiftId) <= currentMinimum) return false;
          // Do not remove the pharmacist specifically placed to meet a CRF shift.
          if (options.ensureCrfCoverage && employee.role === 'farmaceutico' && currentShift?.requiresPharmacist) return false;
          return true;
        });

        if (!candidate) {
          throw new Error(`Não há pessoas suficientes trabalhando em ${dateStr} para cumprir o mínimo de ${required} no turno ${targetShift.name}.`);
        }
        assignments[`${candidate.id}_${dateStr}`] = targetShift.id;
      }
    }
  }

  // Final invariant check: never return a schedule that violates the maximum.
  // This protects the UI even if other generation rules are changed later.
  if (options.limitDailyDaysOff) {
    const maximumDailyDaysOff = Math.max(1, Math.floor(options.maxEmployeesOffPerDay ?? 1));
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const employeesOff = activeEmployees.filter(
        (employee) => assignments[`${employee.id}_${dateStr}`] === dayOffShift.id
      ).length;
      if (employeesOff > maximumDailyDaysOff) {
        throw new Error(
          `A escala excederia o limite de ${maximumDailyDaysOff} folgas no dia ${day}/${month}. Tente aumentar o limite.`
        );
      }
    }
  }

  return {
    id: `schedule_${year}_${month}`,
    year,
    month,
    status: 'rascunho',
    publishedAt: undefined,
    assignments,
    customNotes: {},
  };
}
