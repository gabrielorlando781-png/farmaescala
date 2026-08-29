import React from 'react';
import { 
  ScheduleAlert, 
  Employee, 
  DayCoverageSummary, 
  PharmacySettings 
} from '../types';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  UserCheck, 
  Scale, 
  Info,
  CalendarCheck
} from 'lucide-react';
import { getDayName } from '../utils/scheduleRules';

interface ComplianceViewProps {
  alerts: ScheduleAlert[];
  employees: Employee[];
  dayCoverage: Record<string, DayCoverageSummary>;
  employeeHours: Record<string, { totalHours: number; daysWorked: number; daysOff: number; weeklyHours: number[] }>;
  settings: PharmacySettings;
  onNavigateToScheduleDay: (dateStr: string) => void;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  alerts,
  employees,
  dayCoverage,
  employeeHours,
  settings,
  onNavigateToScheduleDay,
}) => {
  const errorAlerts = alerts.filter((a) => a.severity === 'error');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  // Calculate compliance scores
  const daysList = Object.values(dayCoverage) as DayCoverageSummary[];
  const totalDays = Object.keys(dayCoverage).length || 30;
  const coveredDays = daysList.filter((d) => d.isFullyCovered).length;
  const crfPercent = totalDays > 0 ? Math.round((coveredDays / totalDays) * 100) : 100;

  const interjornadaErrors = alerts.filter((a) => a.category === 'interjornada_11h');
  const overtimeWarnings = alerts.filter((a) => a.category === 'limite_horas_semanal');

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CRF Coverage Score */}
        <div className={`p-5 rounded-2xl border ${crfPercent === 100 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'} shadow-xs`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Conformidade CRF / Anvisa
            </span>
            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${crfPercent === 100 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
              {crfPercent}%
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">
            {crfPercent === 100 ? '100% Regular perante o CRF' : `${coveredDays} de ${totalDays} dias cobertos`}
          </div>
          <p className="text-xs text-slate-500">
            {crfPercent === 100
              ? 'Todos os turnos de funcionamento possuem assistência farmacêutica obrigatória.'
              : 'Atenção: Existem turnos sem farmacêutico responsável escalado.'}
          </p>
        </div>

        {/* CLT Rest Rules (11h Interjornada) */}
        <div className={`p-5 rounded-2xl border ${interjornadaErrors.length === 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'} shadow-xs`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-700" />
              Interjornada 11h (CLT Art. 66)
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${interjornadaErrors.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {interjornadaErrors.length} ocorrências
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">
            {interjornadaErrors.length === 0 ? 'Descanso 100% Respeitado' : `${interjornadaErrors.length} Violações`}
          </div>
          <p className="text-xs text-slate-500">
            Garante o intervalo mínimo obrigatório de 11 horas consecutivas para descanso entre jornadas de trabalho.
          </p>
        </div>

        {/* Overtime & Weekly Target */}
        <div className={`p-5 rounded-2xl border ${overtimeWarnings.length === 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'} shadow-xs`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-700" />
              Jornada Semanal (44h CLT)
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${overtimeWarnings.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {overtimeWarnings.length} alertas
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-800 mb-1">
            {overtimeWarnings.length === 0 ? 'Cargas Balanceadas' : `${overtimeWarnings.length} Sobrecargas`}
          </div>
          <p className="text-xs text-slate-500">
            Monitoramento de horas extras acumuladas e conformidade com limites de contrato.
          </p>
        </div>
      </div>

      {/* Active Alerts List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-700" />
              <span>Painel de Auditoria & Recomendações ({alerts.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Verificações automáticas de conformidade legal e operacional da farmácia
            </p>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-8 bg-emerald-50/50 rounded-2xl border border-emerald-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">Escala 100% Conforme</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Nenhuma inconformidade regulatória ou trabalhista encontrada. A escala está apta para publicação e afixação no mural.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                  alert.severity === 'error'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {alert.severity === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-2">
                      <span>{alert.title}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md uppercase font-extrabold ${
                          alert.severity === 'error'
                            ? 'bg-rose-200/80 text-rose-800'
                            : 'bg-amber-200/80 text-amber-800'
                        }`}
                      >
                        {alert.severity === 'error' ? 'Impeditivo' : 'Aviso'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {alert.description}
                    </p>
                  </div>
                </div>

                {alert.date && (
                  <button
                    onClick={() => onNavigateToScheduleDay(alert.date!)}
                    className="shrink-0 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    Ver no Quadro
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employees Hours Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-800 mb-1">
          Extrato de Horas por Colaborador no Mês
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Acompanhe o total de horas mensais planejadas versus a carga contratual
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 font-bold text-slate-700">Colaborador</th>
                <th className="p-3 font-bold text-slate-700">Cargo</th>
                <th className="p-3 font-bold text-slate-700 text-center">Meta Semanal</th>
                <th className="p-3 font-bold text-slate-700 text-center">Dias Trabalhados</th>
                <th className="p-3 font-bold text-slate-700 text-center">Folgas (DSR)</th>
                <th className="p-3 font-bold text-slate-700 text-center">Total Horas Mês</th>
                <th className="p-3 font-bold text-slate-700 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const hoursData = employeeHours[emp.id] || { totalHours: 0, daysWorked: 0, daysOff: 0 };
                const expectedMonthlyHours = emp.weeklyHoursTarget * 4.33; // Average weeks per month
                const diff = hoursData.totalHours - expectedMonthlyHours;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: emp.color }} />
                        <span>{emp.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">{emp.roleTitle}</td>
                    <td className="p-3 text-center text-slate-700 font-medium">{emp.weeklyHoursTarget}h</td>
                    <td className="p-3 text-center text-slate-700">{hoursData.daysWorked} dias</td>
                    <td className="p-3 text-center text-slate-700">{hoursData.daysOff} dias</td>
                    <td className="p-3 text-center font-bold text-slate-800">
                      {hoursData.totalHours.toFixed(1)}h
                    </td>
                    <td className="p-3 text-center">
                      {diff > 12 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                          +{diff.toFixed(0)}h extras
                        </span>
                      ) : diff < -12 ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                          {diff.toFixed(0)}h saldo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          Equilibrada
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
