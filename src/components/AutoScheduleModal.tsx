import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { getMonthName } from '../utils/scheduleRules';
import { AutoScheduleOptions } from '../types';

interface AutoScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number;
  activePharmacistsCount: number;
  activeEmployeesCount: number;
  onRunAutoSchedule: (options: AutoScheduleOptions) => boolean;
}

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  activePharmacistsCount,
  activeEmployeesCount,
  onRunAutoSchedule,
}) => {
  const [ensureCrfCoverage, setEnsureCrfCoverage] = useState(true);
  const [respectPreferences, setRespectPreferences] = useState(true);
  const [limitDailyDaysOff, setLimitDailyDaysOff] = useState(false);
  const minimumFeasibleDaysOff = Math.max(1, Math.ceil((activeEmployeesCount * 2) / 7));
  const [maxEmployeesOffPerDay, setMaxEmployeesOffPerDay] = useState(minimumFeasibleDaysOff);

  useEffect(() => {
    setMaxEmployeesOffPerDay((current) => {
      const normalized = Number.isFinite(current) ? Math.floor(current) : minimumFeasibleDaysOff;
      return Math.min(
        Math.max(activeEmployeesCount, minimumFeasibleDaysOff),
        Math.max(minimumFeasibleDaysOff, normalized)
      );
    });
  }, [activeEmployeesCount, minimumFeasibleDaysOff]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const normalizedMaximum = Number.isFinite(maxEmployeesOffPerDay)
      ? Math.floor(maxEmployeesOffPerDay)
      : minimumFeasibleDaysOff;
    const wasGenerated = onRunAutoSchedule({
      ensureCrfCoverage: ensureCrfCoverage && activePharmacistsCount >= 2,
      respectPreferences,
      limitDailyDaysOff,
      maxEmployeesOffPerDay: Math.min(
        Math.max(activeEmployeesCount, minimumFeasibleDaysOff),
        Math.max(minimumFeasibleDaysOff, normalizedMaximum)
      ),
    });
    if (wasGenerated) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Criar Escala 5x2</h3>
              <p className="text-xs text-sky-400">
                {getMonthName(currentMonth)} de {currentYear}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            O sistema criará automaticamente um ciclo contínuo de 5 dias de trabalho e 2 dias de folga para cada colaborador ativo. As folgas são desencontradas para manter a equipe distribuída.
          </p>

          <div className="space-y-2.5">
            {/* CRF */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={ensureCrfCoverage && activePharmacistsCount >= 2}
                onChange={(e) => setEnsureCrfCoverage(e.target.checked)}
                disabled={activePharmacistsCount < 2}
                className="w-4 h-4 text-sky-600 rounded mt-0.5 disabled:opacity-40"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Garantir farmacêutico em pelo menos um turno por dia
                </div>
                <div className="text-[11px] text-slate-500">
                  Desencontra as folgas para manter presença farmacêutica diária.
                </div>
                {activePharmacistsCount < 2 && (
                  <div className="mt-1 text-[10px] font-semibold text-amber-700">
                    Requer pelo menos 2 farmacêuticos ativos para preservar o ciclo 5x2.
                  </div>
                )}
              </div>
            </label>

            {/* Shift preferences */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={respectPreferences}
                onChange={(e) => setRespectPreferences(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded mt-0.5"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Respeitar turnos preferidos
                </div>
                <div className="text-[11px] text-slate-500">
                  Mantém a preferência cadastrada quando o turno ainda existe.
                </div>
              </div>
            </label>

            <div className="rounded-xl border border-slate-200 p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={limitDailyDaysOff}
                  onChange={(event) => {
                    setLimitDailyDaysOff(event.target.checked);
                    setMaxEmployeesOffPerDay((current) => Math.max(current, minimumFeasibleDaysOff));
                  }}
                  className="w-4 h-4 text-sky-600 rounded mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-800">
                    Limitar folgas no mesmo dia
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Impede que colaboradores demais folguem simultaneamente.
                  </div>
                </div>
              </label>

              {limitDailyDaysOff && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <label htmlFor="max-daily-days-off" className="text-[11px] font-semibold text-slate-700">
                    Máximo por dia
                  </label>
                  <input
                    id="max-daily-days-off"
                    type="number"
                    min={minimumFeasibleDaysOff}
                    max={Math.max(activeEmployeesCount, minimumFeasibleDaysOff)}
                    value={maxEmployeesOffPerDay}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      setMaxEmployeesOffPerDay(Number.isFinite(value) ? value : minimumFeasibleDaysOff);
                    }}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold text-slate-800"
                  />
                </div>
              )}
              {limitDailyDaysOff && (
                <p className="mt-1.5 text-[10px] text-slate-500">
                  Para {activeEmployeesCount} colaboradores em 5x2, o menor limite possível é {minimumFeasibleDaysOff}.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-sky-200 bg-sky-50/60">
              <div className="w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0">✓</div>
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Ciclo 5x2 garantido
                </div>
                <div className="text-[11px] text-slate-500">
                  Limita a sequência a 5 dias trabalhados e garante 2 folgas consecutivas.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-sky-200" />
              <span>Criar escala 5x2</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
