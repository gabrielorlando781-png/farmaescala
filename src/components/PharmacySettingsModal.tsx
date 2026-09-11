import React, { useEffect, useState } from 'react';
import { PharmacySettings } from '../types';
import { CalendarDays, Check, Settings, X } from 'lucide-react';
import { getScheduleViewMode, ScheduleViewMode } from '../utils/scheduleViewMode';

interface PharmacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PharmacySettings;
  onSaveSettings: (newSettings: PharmacySettings) => void;
}

export const PharmacySettingsModal: React.FC<PharmacySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<PharmacySettings>({ ...settings });

  useEffect(() => {
    if (isOpen) setFormData({ ...settings });
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-sm">Configurações da Farmácia</h3>
              <p className="text-xs text-sky-400">Dados da unidade e do gerente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome da Farmácia *
            </label>
            <input
              type="text"
              required
              value={formData.fantasyName}
              onChange={(e) => setFormData({ ...formData, fantasyName: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500 font-medium"
            />
          </div>

          <fieldset>
            <legend className="mb-2 block text-xs font-bold text-slate-700">Modo da escala</legend>
            <div className="grid gap-2">
              {([
                { value: 'complete', title: 'Completa', description: 'Exibe os turnos, horários, folgas e ausências.' },
                { value: 'simplified', title: 'Simplificada', description: 'Mostra apenas Trabalho, Folga e ausências.' },
                { value: 'days_off', title: 'Somente folgas', description: 'Dias trabalhados ficam em branco; clique nos dias de folga para marcá-los com X.' },
              ] as Array<{ value: ScheduleViewMode; title: string; description: string }>).map((option) => {
                const selected = getScheduleViewMode(formData) === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      selected ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduleViewMode"
                      value={option.value}
                      checked={selected}
                      onChange={() => setFormData({
                        ...formData,
                        scheduleViewMode: option.value,
                        simplifiedScheduleMode: option.value === 'simplified',
                      })}
                      className="sr-only"
                    />
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 text-transparent'}`}>
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        {option.value === 'days_off' && <CalendarDays className="h-3.5 w-3.5 text-sky-700" />}
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Gerente responsável</label>
            <input type="text" value={formData.technicalResponsible} onChange={(e) => setFormData({ ...formData, technicalResponsible: e.target.value })} placeholder="Nome do gerente responsável" className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/20 cursor-pointer"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
