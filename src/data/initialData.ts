import { Employee, ShiftType, PharmacySettings, MonthSchedule } from '../types';

// Somente ocorrências fixas são fornecidas. Cada gestor define os horários
// de trabalho reais da sua filial antes de montar a escala.
export const INITIAL_SHIFTS: ShiftType[] = [
  {
    id: 'shift_folga', name: 'Folga / DSR', code: 'FOLGA',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#64748b', bgColor: 'bg-slate-100', textColor: 'text-slate-600', borderColor: 'border-slate-200',
    isDayOff: true, description: 'Dia de descanso: o funcionário não trabalha e não soma horas. Use para folga ou DSR.',
  },
  {
    id: 'shift_ferias', name: 'Férias', code: 'FÉR',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#d97706', bgColor: 'bg-amber-100', textColor: 'text-amber-900', borderColor: 'border-amber-300',
    isDayOff: true, isSpecialLeave: true, description: 'Período de férias do funcionário. Não é turno de trabalho e não soma horas.',
  },
  {
    id: 'shift_atestado', name: 'Atestado / Licença', code: 'ATEST',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#e11d48', bgColor: 'bg-rose-100', textColor: 'text-rose-900', borderColor: 'border-rose-300',
    isDayOff: true, isSpecialLeave: true, description: 'Ausência justificada por atestado médico. Não é turno de trabalho e não soma horas.',
  },
  {
    id: 'shift_falta', name: 'Falta', code: 'FALTA',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#be123c', bgColor: 'bg-rose-100', textColor: 'text-rose-900', borderColor: 'border-rose-300',
    isDayOff: true, isSpecialLeave: true, description: 'Ausência sem justificativa registrada. Não é turno de trabalho e não soma horas.',
  },
];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_PHARMACY_SETTINGS: PharmacySettings = {
  pharmacyName: '', fantasyName: '', cnpj: '', crfPharmacyNumber: '', address: '',
  technicalResponsible: '', rtCrf: '', openTime: '07:00', closeTime: '23:00',
  isOpen24h: false, opensWeekends: true, minPharmacistsPerShift: 1,
  minAttendantsMorning: 1, minAttendantsAfternoon: 1, minCashiers: 1,
  scheduleViewMode: 'complete', simplifiedScheduleMode: false,
};

export function generateInitialSchedule(year: number, month: number): MonthSchedule {
  return {
    id: `schedule_${year}_${month}`,
    year,
    month,
    assignments: {},
    customNotes: {},
  };
}
