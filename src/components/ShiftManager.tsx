import React, { useState } from 'react';
import { ShiftType } from '../types';
import { 
  Plus, 
  Clock, 
  Edit2, 
  Trash2, 
  ShieldCheck, 
  Moon, 
  CalendarOff, 
  X
} from 'lucide-react';

interface ShiftManagerProps {
  shifts: ShiftType[];
  onSaveShift: (shift: ShiftType) => void;
  onDeleteShift: (id: string) => void;
}

export const ShiftManager: React.FC<ShiftManagerProps> = ({
  shifts,
  onSaveShift,
  onDeleteShift,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);

  const [formData, setFormData] = useState<Partial<ShiftType>>({
    name: '',
    code: '',
    startTime: '08:00',
    endTime: '16:20',
    breakMinutes: 60,
    durationHours: 7.33,
    color: '#0284c7',
    bgColor: 'bg-sky-100',
    textColor: 'text-sky-900',
    borderColor: 'border-sky-300',
    isDayOff: false,
    requiresPharmacist: false,
    minEmployeesPerShift: 0,
    isNightShift: false,
    description: '',
  });

  const handleOpenAdd = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      code: '',
      startTime: '08:00',
      endTime: '16:20',
      breakMinutes: 60,
      durationHours: 7.33,
      color: '#0284c7',
      bgColor: 'bg-sky-100',
      textColor: 'text-sky-900',
      borderColor: 'border-sky-300',
      isDayOff: false,
      requiresPharmacist: false,
      minEmployeesPerShift: 0,
      isNightShift: false,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shift: ShiftType) => {
    setEditingShift(shift);
    setFormData(shift);
    setIsModalOpen(true);
  };

  const calculateDuration = (start: string, end: string, breakMins: number) => {
    if (!start || !end || start === '-' || end === '-') return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Overnight
    const netMinutes = Math.max(0, totalMinutes - breakMins);
    return Number((netMinutes / 60).toFixed(2));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.code?.trim()) return;

    const duration = formData.isDayOff
      ? 0
      : calculateDuration(formData.startTime || '08:00', formData.endTime || '16:20', formData.breakMinutes || 60);

    const shiftToSave: ShiftType = {
      id: editingShift ? editingShift.id : `shift_${Date.now()}`,
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      startTime: formData.isDayOff ? '-' : formData.startTime || '08:00',
      endTime: formData.isDayOff ? '-' : formData.endTime || '16:20',
      breakMinutes: formData.isDayOff ? 0 : Number(formData.breakMinutes) || 0,
      durationHours: duration,
      color: formData.color || '#0284c7',
      bgColor: formData.bgColor || 'bg-sky-100',
      textColor: formData.textColor || 'text-sky-900',
      borderColor: formData.borderColor || 'border-sky-300',
      isDayOff: Boolean(formData.isDayOff),
      requiresPharmacist: Boolean(formData.requiresPharmacist),
      minEmployeesPerShift: formData.isDayOff ? 0 : Math.max(0, Math.floor(Number(formData.minEmployeesPerShift) || 0)),
      isNightShift: Boolean(formData.isNightShift),
      description: formData.description || '',
    };

    onSaveShift(shiftToSave);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-xs">Turnos & Horários da Farmácia</h3>
          <p className="text-[11px] text-slate-500">
            Cadastre os horários de entrada, saída e intervalos utilizados na escala
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs shadow-sky-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Turno</span>
        </button>
      </div>

      {/* Shifts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-9 h-8 rounded-lg text-xs font-bold flex items-center justify-center border ${shift.bgColor} ${shift.textColor} ${shift.borderColor}`}
                  >
                    {shift.code}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">{shift.name}</h4>
                    <span className="text-[10px] text-slate-400">
                      {shift.isDayOff ? 'Folga / Sem horas' : `${shift.durationHours}h úteis`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(shift)}
                    className="p-1 text-slate-400 hover:text-sky-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {shift.id !== 'shift_folga' && (
                    <button
                      onClick={() => onDeleteShift(shift.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Time info */}
              {!shift.isDayOff ? (
                <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 mb-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Horário:
                    </span>
                    <span className="font-bold text-slate-800">
                      {shift.startTime} às {shift.endTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Intervalo:</span>
                    <span className="font-medium text-slate-700">
                      {shift.breakMinutes} min
                    </span>
                  </div>
                  {shift.minEmployeesPerShift ? <div className="flex items-center justify-between text-[11px]"><span className="text-slate-400">Mínimo na escala:</span><span className="font-bold text-slate-800">{shift.minEmployeesPerShift} pessoa(s)</span></div> : null}
                </div>
              ) : (
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 mb-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CalendarOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sem cômputo de horas de trabalho</span>
                </div>
              )}

              {shift.description && (
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  {shift.description}
                </p>
              )}
            </div>

            {/* Badges */}
            <div className="pt-2.5 border-t border-slate-100 mt-2 flex flex-wrap items-center gap-1.5">
              {shift.requiresPharmacist && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-sky-600" />
                  Farmacêutico CRF
                </span>
              )}
              {shift.isNightShift && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                  <Moon className="w-3 h-3 text-slate-600" />
                  Noturno
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add / Edit Shift */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {editingShift ? 'Editar Turno' : 'Novo Turno da Farmácia'}
                </h3>
                <p className="text-xs text-sky-400">
                  Configure horário de entrada, saída e intervalo
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Turno *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Manhã Abertura"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sigla *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="M1"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500 font-bold uppercase"
                  />
                </div>
              </div>

              {/* Day off toggle */}
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="isDayOff"
                  checked={formData.isDayOff}
                  onChange={(e) => setFormData({ ...formData, isDayOff: e.target.checked })}
                  className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                />
                <label htmlFor="isDayOff" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Este turno representa Folga, Férias ou Afastamento
                </label>
              </div>

              {!formData.isDayOff && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Entrada
                      </label>
                      <input
                        type="time"
                        value={formData.startTime || '07:00'}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Saída
                      </label>
                      <input
                        type="time"
                        value={formData.endTime || '15:20'}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Intervalo (minutos)
                    </label>
                    <input
                      type="number"
                      value={formData.breakMinutes || 60}
                      onChange={(e) => setFormData({ ...formData, breakMinutes: Number(e.target.value) })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="requiresPharma"
                      checked={formData.requiresPharmacist}
                      onChange={(e) => setFormData({ ...formData, requiresPharmacist: e.target.checked })}
                      className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                    />
                    <label htmlFor="requiresPharma" className="text-xs text-slate-700 cursor-pointer">
                      Exige presença de Farmacêutico (CRF)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mínimo de pessoas neste turno</label>
                    <input type="number" min="0" step="1" value={formData.minEmployeesPerShift ?? 0} onChange={(e) => setFormData({ ...formData, minEmployeesPerShift: Math.max(0, Number(e.target.value)) })} className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500" />
                    <p className="mt-1 text-[10px] text-slate-400">Use 0 quando não quiser uma exigência mínima para este turno.</p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Atendimento de balcão e dispensação..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/20 cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
