import React, { useState, useEffect } from 'react';
import { ShiftType, Employee } from '../types';
import { X, Check, Clock, StickyNote, Trash2 } from 'lucide-react';
import { getDayName } from '../utils/scheduleRules';

interface CellShiftPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  employee: Employee;
  dateStr: string;
  currentShiftId: string;
  currentNote?: string;
  shifts: ShiftType[];
  onSelectShift: (shiftId: string, note?: string) => void;
}

export const CellShiftPopover: React.FC<CellShiftPopoverProps> = ({
  isOpen,
  onClose,
  position,
  employee,
  dateStr,
  currentShiftId,
  currentNote = '',
  shifts,
  onSelectShift,
}) => {
  const [note, setNote] = useState(currentNote);
  const [showNoteInput, setShowNoteInput] = useState(Boolean(currentNote));

  useEffect(() => {
    setNote(currentNote);
    setShowNoteInput(Boolean(currentNote));
  }, [currentNote, dateStr, employee.id]);

  if (!isOpen) return null;

  const dateObj = new Date(`${dateStr}T12:00:00`);
  const dayNum = dateObj.getDate();
  const dayName = getDayName(dateObj.getDay());

  return (
    <>
      {/* Backdrop overlay for outside clicks */}
      <div 
        className="fixed inset-0 z-40 bg-black/10" 
        onClick={onClose} 
      />

      {/* Popover container */}
      <div
        className="fixed z-50 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 animate-in fade-in zoom-in-95 duration-100"
        style={{
          top: Math.min(window.innerHeight - 380, Math.max(10, position.top)),
          left: Math.min(window.innerWidth - 300, Math.max(10, position.left)),
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-2.5 border-b border-slate-100 mb-2.5">
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>{employee.name}</span>
            </div>
            <div className="text-[11px] text-sky-700 font-medium">
              Dia {dayNum} ({dayName}) • {employee.roleTitle}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shift Options */}
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
            Selecione o Turno
          </div>
          {shifts.map((shift) => {
            const isSelected = currentShiftId === shift.id;
            return (
              <button
                key={shift.id}
                onClick={() => {
                  onSelectShift(shift.id, note);
                  onClose();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-50 text-sky-950 border border-sky-300 font-semibold shadow-2xs'
                    : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-5 rounded-md text-[10px] font-bold flex items-center justify-center border ${shift.bgColor} ${shift.textColor} ${shift.borderColor}`}
                  >
                    {shift.code}
                  </span>
                  <div>
                    <div className="font-medium text-[11px] leading-tight">{shift.name}</div>
                    {!shift.isDayOff && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {shift.startTime} - {shift.endTime} ({shift.durationHours}h)
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Note / Observação Section */}
        <div className="mt-2.5 pt-2 border-t border-slate-100">
          {!showNoteInput ? (
            <button
              onClick={() => setShowNoteInput(true)}
              className="text-[11px] text-slate-500 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
            >
              <StickyNote className="w-3 h-3" />
              <span>Adicionar observação</span>
            </button>
          ) : (
            <div className="space-y-1">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Troca de plantão com colega..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-sky-500 bg-slate-50"
              />
            </div>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => {
              onSelectShift('shift_folga', '');
              onClose();
            }}
            className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Definir Folga</span>
          </button>
          
          <button
            onClick={() => {
              onSelectShift(currentShiftId, note);
              onClose();
            }}
            className="text-[11px] font-semibold bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
          >
            Salvar
          </button>
        </div>
      </div>
    </>
  );
};
