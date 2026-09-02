import React from 'react';
import { MonthSchedule, Employee, ShiftType, PharmacySettings } from '../types';
import { X, Printer, Download, Calendar } from 'lucide-react';
import { getMonthName, getShortDayName } from '../utils/scheduleRules';

interface PrintScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number;
  employees: Employee[];
  shifts: ShiftType[];
  schedule: MonthSchedule;
  settings: PharmacySettings;
}

export const PrintScheduleModal: React.FC<PrintScheduleModalProps> = ({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  employees,
  shifts,
  schedule,
  settings,
}) => {
  if (!isOpen) return null;

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const shiftMap = new Map<string, ShiftType>(shifts.map((s) => [s.id, s]));

  const activeEmployees = employees.filter((e) => e.active);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csv = `Colaborador,Cargo,${daysArray.map((d) => `Dia ${d}`).join(',')}\n`;
    activeEmployees.forEach((emp) => {
      const row = [
        `"${emp.name}"`,
        `"${emp.roleTitle}"`,
      ];
      daysArray.forEach((d) => {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const sId = schedule.assignments[`${emp.id}_${dateStr}`] || 'shift_folga';
        const s = shiftMap.get(sId);
        row.push(`"${s?.code || 'FOLGA'}"`);
      });
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `escala_${currentYear}_${currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-sm">Escala de Trabalho Mensal - Impressão</h3>
              <p className="text-xs text-sky-400">
                {getMonthName(currentMonth)} de {currentYear} • {settings.fantasyName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-sm shadow-sky-600/20 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Preview */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-slate-900 space-y-4">
            {/* Pharmacy details header */}
            <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{settings.fantasyName}</h2>
                <p className="text-xs text-slate-500">{settings.address}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-sky-900 uppercase">
                  Escala de Trabalho Mensal
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  {getMonthName(currentMonth)} / {currentYear}
                </div>
                <div className="text-[11px] text-slate-500">
                  Gerente responsável: {settings.technicalResponsible}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-1.5 text-left font-bold min-w-[140px]">
                      Colaborador
                    </th>
                    <th className="border border-slate-300 p-1.5 text-left font-bold min-w-[100px]">
                      Cargo
                    </th>
                    {daysArray.map((d) => {
                      const dayDate = new Date(currentYear, currentMonth - 1, d);
                      const isSun = dayDate.getDay() === 0;
                      return (
                        <th
                          key={d}
                          className={`border border-slate-300 p-1 text-center font-bold min-w-[24px] ${
                            isSun ? 'bg-sky-100/60 font-extrabold text-sky-900' : ''
                          }`}
                        >
                          <div>{getShortDayName(dayDate.getDay())}</div>
                          <div>{d}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-1.5 font-bold text-slate-800 whitespace-nowrap">
                        {emp.name}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-slate-600 whitespace-nowrap">
                        {emp.roleTitle}
                      </td>
                      {daysArray.map((d) => {
                        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const sId = schedule.assignments[`${emp.id}_${dateStr}`] || 'shift_folga';
                        const s = shiftMap.get(sId);
                        const isFolga = s?.isDayOff;
                        const isVacation = s?.id === 'shift_ferias' || s?.code === 'FÉR';
                        const isAbsence = s?.id === 'shift_atestado' || s?.id === 'shift_falta' || s?.code === 'ATEST' || s?.code === 'FALTA';
                        return (
                          <td
                            key={d}
                            className={`border border-slate-300 p-0.5 text-center font-bold ${
                              isVacation ? 'text-amber-950 bg-amber-100' : isAbsence ? 'text-rose-950 bg-rose-100' : isFolga ? 'text-slate-400 bg-slate-50' : 'text-sky-900 bg-sky-50/50'
                            }`}
                          >
                            {s?.code || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend footer */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-600 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold">Legenda:</span>
                {shifts.map((s) => (
                  <span key={s.id} className="font-medium">
                    <strong className="text-slate-900">{s.code}</strong>: {s.name} {!s.isDayOff && `(${s.startTime}-${s.endTime})`}
                  </span>
                ))}
              </div>
              <div className="text-slate-400">
                Gerado em {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
