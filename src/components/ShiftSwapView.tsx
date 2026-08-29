import React, { useState } from 'react';
import { Employee, ShiftType, MonthSchedule, ShiftSwapRequest } from '../types';
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  User, 
  Send, 
  Clock, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { getDayName } from '../utils/scheduleRules';

interface ShiftSwapViewProps {
  currentYear: number;
  currentMonth: number;
  employees: Employee[];
  shifts: ShiftType[];
  schedule: MonthSchedule;
  onApplySwap: (
    empAId: string,
    dateA: string,
    shiftAId: string,
    empBId: string,
    dateB: string,
    shiftBId: string,
    reason: string
  ) => void;
}

export const ShiftSwapView: React.FC<ShiftSwapViewProps> = ({
  currentYear,
  currentMonth,
  employees,
  shifts,
  schedule,
  onApplySwap,
}) => {
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const shiftMap = new Map<string, ShiftType>(shifts.map((s) => [s.id, s]));

  // Swap Form State
  const [empAId, setEmpAId] = useState<string>(employees[0]?.id || '');
  const [dayA, setDayA] = useState<number>(1);

  const [empBId, setEmpBId] = useState<string>(employees[1]?.id || '');
  const [dayB, setDayB] = useState<number>(2);

  const [reason, setReason] = useState<string>('Compromisso pessoal / Permuta de folga');
  const [swapSuccess, setSwapSuccess] = useState<boolean>(false);

  const dateA = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayA).padStart(2, '0')}`;
  const dateB = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayB).padStart(2, '0')}`;

  const shiftAId = schedule.assignments[`${empAId}_${dateA}`] || 'shift_folga';
  const shiftBId = schedule.assignments[`${empBId}_${dateB}`] || 'shift_folga';

  const shiftA = shiftMap.get(shiftAId) || shiftMap.get('shift_folga')!;
  const shiftB = shiftMap.get(shiftBId) || shiftMap.get('shift_folga')!;

  const empA = employees.find((e) => e.id === empAId);
  const empB = employees.find((e) => e.id === empBId);

  // Validation Simulation
  const isSameEmployee = empAId === empBId;
  const isBothPharmacists =
    empA?.role === 'farmaceutico' && empB?.role === 'farmaceutico';
  
  const isCrossRoleSwap =
    (empA?.role === 'farmaceutico') !== (empB?.role === 'farmaceutico');

  const handleSubmitSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSameEmployee) return;

    // Swap shiftA into empB on dateA OR swap assignments
    onApplySwap(empAId, dateA, shiftBId, empBId, dateB, shiftAId, reason);
    setSwapSuccess(true);
    setTimeout(() => setSwapSuccess(false), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-700/20">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Troca de Plantão & Folgas</h2>
            <p className="text-xs text-slate-500">
              Permuta direta de turnos entre colaboradores com validação instantânea de regras CRF
            </p>
          </div>
        </div>
      </div>

      {swapSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Troca de plantão realizada com sucesso e aplicada ao quadro de escalas!</span>
        </div>
      )}

      {/* Main Swap Form Container */}
      <form onSubmit={handleSubmitSwap} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* Employee A Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Colaborador 1 (Solicitante)
              </span>
              <span className="text-[10px] text-slate-400">Origem da Troca</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selecione o Colaborador
              </label>
              <select
                value={empAId}
                onChange={(e) => setEmpAId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-emerald-500 font-medium cursor-pointer"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roleTitle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data do Plantão / Folga
              </label>
              <select
                value={dayA}
                onChange={(e) => setDayA(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-emerald-500 font-medium cursor-pointer"
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const dObj = new Date(currentYear, currentMonth - 1, d);
                  return (
                    <option key={d} value={d}>
                      Dia {d} ({getDayName(dObj.getDay())})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Current Turno Badge */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Turno Atual neste Dia:
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${shiftA.bgColor} ${shiftA.textColor} ${shiftA.borderColor}`}>
                  {shiftA.code}
                </span>
                <span className="font-semibold text-slate-800">{shiftA.name}</span>
                {!shiftA.isDayOff && (
                  <span className="text-[11px] text-slate-500">
                    ({shiftA.startTime} - {shiftA.endTime})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Employee B Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                Colaborador 2 (Substituto / Permuta)
              </span>
              <span className="text-[10px] text-slate-400">Destino da Troca</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selecione o Colaborador
              </label>
              <select
                value={empBId}
                onChange={(e) => setEmpBId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-emerald-500 font-medium cursor-pointer"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roleTitle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data do Plantão / Folga
              </label>
              <select
                value={dayB}
                onChange={(e) => setDayB(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-emerald-500 font-medium cursor-pointer"
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const dObj = new Date(currentYear, currentMonth - 1, d);
                  return (
                    <option key={d} value={d}>
                      Dia {d} ({getDayName(dObj.getDay())})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Current Turno Badge */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Turno Atual neste Dia:
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${shiftB.bgColor} ${shiftB.textColor} ${shiftB.borderColor}`}>
                  {shiftB.code}
                </span>
                <span className="font-semibold text-slate-800">{shiftB.name}</span>
                {!shiftB.isDayOff && (
                  <span className="text-[11px] text-slate-500">
                    ({shiftB.startTime} - {shiftB.endTime})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Regulatory & Safety Check Box */}
        <div className="p-3.5 rounded-xl border text-xs bg-slate-50 border-slate-200">
          <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Validação de Compatibilidade da Troca:</span>
          </div>

          {isSameEmployee ? (
            <p className="text-rose-600 font-medium">
              ⚠️ Selecione dois colaboradores distintos para realizar a permuta.
            </p>
          ) : isCrossRoleSwap ? (
            <p className="text-amber-700 font-medium">
              ⚠️ Atenção: Troca entre cargo Farmacêutico e Não-Farmacêutico. Certifique-se de que a farmácia não ficará sem assistência de CRF no horário.
            </p>
          ) : (
            <p className="text-emerald-700 font-medium">
              ✓ Cargos compatíveis ({empA?.roleTitle} ↔ {empB?.roleTitle}).
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Motivo da Troca / Justificativa
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Consulta médica, permuta de fim de semana acordada..."
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-emerald-500"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSameEmployee}
            className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
              isSameEmployee
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Confirmar e Aplicar Troca na Escala</span>
          </button>
        </div>
      </form>
    </div>
  );
};
