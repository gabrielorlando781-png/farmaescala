export type ActiveTab = 'escala' | 'funcionarios' | 'turnos' | 'conformidade' | 'trocas' | 'relatorios';

export type EmployeeRole =
  | 'farmaceutico'
  | 'balconista'
  | 'caixa'
  | 'dermoconsultor'
  | 'estoquista'
  | 'gerente';

export type ContractType =
  | 'clt_44h'       // 6x1 ou 5x2 padrão (7h20/dia ou 8h48/dia)
  | 'escala_12x36'  // 12 horas trabalho x 36 horas folga
  | 'escala_6x1'    // 6 dias trabalho, 1 folga
  | 'escala_5x2'    // 5 dias trabalho, 2 folgas
  | 'clt_40h'       // 40 horas semanais (8h/dia)
  | 'estagio_30h';  // 30 horas semanais (6h/dia)

export interface Employee {
  id: string;
  name: string;
  cpf: string;
  role: EmployeeRole;
  roleTitle: string;
  contractType: ContractType;
  weeklyHoursTarget: number;
  email: string;
  phone: string;
  color: string;
  avatarUrl?: string;
  active: boolean;
  hireDate: string;
  preferredShiftId?: string; // Preferência de turno
  unavailableDays?: number[]; // 0 = Domingo, 1 = Segunda, etc.
  notes?: string;
  occurrenceHistory?: EmployeeOccurrence[];
}

export type EmployeeOccurrenceType = 'ferias' | 'atestado' | 'falta';

export interface EmployeeOccurrence {
  id: string;
  type: EmployeeOccurrenceType;
  startDate: string;
  endDate: string;
  note?: string;
  recordedAt: string;
  source: 'manual' | 'ia';
}

export interface ShiftType {
  id: string;
  name: string;
  code: string; // Ex: M1, T1, N1, I1, FOLGA, FER, AT
  startTime: string; // "07:00"
  endTime: string;   // "15:20"
  breakMinutes: number; // 60 min almoço/jantar
  durationHours: number; // Horas líquidas (ex: 7.33)
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  isDayOff: boolean; // Folga / DSR
  isSpecialLeave?: boolean; // Férias / Atestado
  isNightShift?: boolean;
  requiresPharmacist?: boolean;
  minEmployeesPerShift?: number;
  description?: string;
}

export interface ShiftAssignment {
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  isOvertime?: boolean;
  notes?: string;
}

export interface MonthSchedule {
  id: string;
  year: number;
  month: number; // 1-12
  status: 'rascunho' | 'em_revisao' | 'publicado';
  publishedAt?: string;
  publishedBy?: string;
  assignments: Record<string, string>; // Key: `${employeeId}_${date}`, Value: shiftId
  customNotes?: Record<string, string>; // Key: `${employeeId}_${date}`, Value: note
}

export interface AutoScheduleOptions {
  ensureCrfCoverage: boolean;
  respectPreferences: boolean;
  spreadDaysOff?: boolean;
  limitDailyDaysOff?: boolean;
  maxEmployeesOffPerDay?: number;
}

export type AiActionType =
  | 'set_assignment'
  | 'set_assignment_range'
  | 'register_absence'
  | 'rebalance_schedule'
  | 'swap_assignments'
  | 'add_employee'
  | 'update_employee'
  | 'toggle_employee'
  | 'delete_employee'
  | 'add_shift'
  | 'update_shift'
  | 'delete_shift'
  | 'update_settings'
  | 'generate_5x2';

export interface AiAction {
  type: AiActionType;
  employeeId?: string;
  date?: string;
  targetDate?: string;
  shiftId?: string;
  patchJson?: string;
}

export interface AiProposal {
  summary: string;
  actions: AiAction[];
}

export interface PharmacySettings {
  pharmacyName: string;
  fantasyName: string;
  cnpj: string;
  crfPharmacyNumber: string;
  address: string;
  technicalResponsible: string; // Nome do Farmacêutico RT
  rtCrf: string;
  openTime: string; // "07:00"
  closeTime: string; // "23:00"
  isOpen24h: boolean;
  opensWeekends: boolean;
  minPharmacistsPerShift: number;
  minAttendantsMorning: number;
  minAttendantsAfternoon: number;
  minCashiers: number;
  simplifiedScheduleMode?: boolean;
}

export type AlertSeverity = 'error' | 'warning' | 'info';

export interface ScheduleAlert {
  id: string;
  severity: AlertSeverity;
  category: 'crf_sem_farmaceutico' | 'interjornada_11h' | 'limite_horas_semanal' | 'domingos_consecutivos' | 'falta_equipe' | 'escala_12x36_invalida';
  title: string;
  description: string;
  date?: string;
  employeeId?: string;
  employeeName?: string;
}

export interface ShiftSwapRequest {
  id: string;
  createdAt: string;
  requesterId: string;
  targetId: string;
  requesterDate: string;
  requesterShiftId: string;
  targetDate: string;
  targetShiftId: string;
  reason: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

export interface DayCoverageSummary {
  date: string;
  dayOfWeek: number; // 0-6
  hasPharmacistMorning: boolean;
  hasPharmacistAfternoon: boolean;
  hasPharmacistNight: boolean;
  totalPharmacists: number;
  totalBalconistas: number;
  totalCaixas: number;
  totalWorking: number;
  totalOff: number;
  isFullyCovered: boolean;
}
