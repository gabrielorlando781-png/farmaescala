import { Employee, ShiftType, PharmacySettings, MonthSchedule } from '../types';

// Apenas turnos operacionais são fornecidos. Dados da empresa e da equipe
// começam vazios para que informações fictícias nunca apareçam como reais.
export const INITIAL_SHIFTS: ShiftType[] = [
  {
    id: 'shift_manha', name: 'Manhã (Abertura)', code: 'M1',
    startTime: '07:00', endTime: '15:20', breakMinutes: 60, durationHours: 7.33,
    color: '#0284c7', bgColor: 'bg-sky-100', textColor: 'text-sky-900', borderColor: 'border-sky-300',
    isDayOff: false, requiresPharmacist: true, description: 'Turno de abertura.',
  },
  {
    id: 'shift_inter', name: 'Intermediário', code: 'I1',
    startTime: '10:00', endTime: '18:20', breakMinutes: 60, durationHours: 7.33,
    color: '#0891b2', bgColor: 'bg-cyan-100', textColor: 'text-cyan-900', borderColor: 'border-cyan-300',
    isDayOff: false, description: 'Turno intermediário.',
  },
  {
    id: 'shift_tarde', name: 'Tarde (Fechamento)', code: 'T1',
    startTime: '14:40', endTime: '23:00', breakMinutes: 60, durationHours: 7.33,
    color: '#0369a1', bgColor: 'bg-blue-100', textColor: 'text-blue-900', borderColor: 'border-blue-300',
    isDayOff: false, requiresPharmacist: true, description: 'Turno de fechamento.',
  },
  {
    id: 'shift_plantao_12x36_d', name: 'Plantão Diurno (12x36)', code: 'D12',
    startTime: '07:00', endTime: '19:00', breakMinutes: 60, durationHours: 11,
    color: '#0e7490', bgColor: 'bg-teal-50', textColor: 'text-teal-900', borderColor: 'border-teal-300',
    isDayOff: false, description: 'Plantão diurno de 12 horas.',
  },
  {
    id: 'shift_plantao_12x36_n', name: 'Plantão Noturno (12x36)', code: 'N12',
    startTime: '19:00', endTime: '07:00', breakMinutes: 60, durationHours: 11,
    color: '#0c4a6e', bgColor: 'bg-sky-900', textColor: 'text-sky-100', borderColor: 'border-sky-700',
    isDayOff: false, isNightShift: true, description: 'Plantão noturno de 12 horas.',
  },
  {
    id: 'shift_folga', name: 'Folga / DSR', code: 'FOLGA',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#64748b', bgColor: 'bg-slate-100', textColor: 'text-slate-600', borderColor: 'border-slate-200',
    isDayOff: true, description: 'Folga ou descanso semanal remunerado.',
  },
  {
    id: 'shift_ferias', name: 'Férias', code: 'FÉR',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#d97706', bgColor: 'bg-amber-100', textColor: 'text-amber-900', borderColor: 'border-amber-300',
    isDayOff: true, isSpecialLeave: true, description: 'Férias regulamentares.',
  },
  {
    id: 'shift_atestado', name: 'Atestado / Licença', code: 'ATEST',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#e11d48', bgColor: 'bg-rose-100', textColor: 'text-rose-900', borderColor: 'border-rose-300',
    isDayOff: true, isSpecialLeave: true, description: 'Atestado ou licença.',
  },
  {
    id: 'shift_falta', name: 'Falta', code: 'FALTA',
    startTime: '-', endTime: '-', breakMinutes: 0, durationHours: 0,
    color: '#be123c', bgColor: 'bg-rose-100', textColor: 'text-rose-900', borderColor: 'border-rose-300',
    isDayOff: true, isSpecialLeave: true, description: 'Ausência não justificada.',
  },
];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_PHARMACY_SETTINGS: PharmacySettings = {
  pharmacyName: '', fantasyName: '', cnpj: '', crfPharmacyNumber: '', address: '',
  technicalResponsible: '', rtCrf: '', openTime: '07:00', closeTime: '23:00',
  isOpen24h: false, opensWeekends: true, minPharmacistsPerShift: 1,
  minAttendantsMorning: 1, minAttendantsAfternoon: 1, minCashiers: 1,
};

export function generateInitialSchedule(year: number, month: number): MonthSchedule {
  return {
    id: `schedule_${year}_${month}`,
    year,
    month,
    status: 'rascunho',
    assignments: {},
    customNotes: {},
  };
}
