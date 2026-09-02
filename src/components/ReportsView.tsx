import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  PharmacySettings, 
  MonthSchedule, 
  Employee, 
  ShiftType, 
  DayCoverageSummary 
} from '../types';
import { 
  Printer, 
  Download, 
  Share2, 
  Check, 
  FileSpreadsheet, 
  ShieldCheck, 
  Building2, 
  Clock, 
  Copy,
  Calendar
} from 'lucide-react';
import { getMonthName, getShortDayName } from '../utils/scheduleRules';

interface ReportsViewProps {
  currentYear: number;
  currentMonth: number;
  settings: PharmacySettings;
  schedule: MonthSchedule;
  employees: Employee[];
  shifts: ShiftType[];
  dayCoverage: Record<string, DayCoverageSummary>;
  employeeHours: Record<string, { totalHours: number; daysWorked: number; daysOff: number; weeklyHours: number[] }>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  currentYear,
  currentMonth,
  settings,
  schedule,
  employees,
  shifts,
  dayCoverage,
  employeeHours,
}) => {
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const shiftMap = new Map<string, ShiftType>(shifts.map((s) => [s.id, s]));

  const handlePrint = () => {
    const previousTitle = document.title;
    const printTitle = `Escala_${settings.fantasyName}_${getMonthName(currentMonth)}_${currentYear}`;
    let restored = false;
    const restorePage = () => {
      if (restored) return;
      restored = true;
      document.body.classList.remove('printing-official-board');
      document.title = previousTitle;
    };

    document.body.classList.add('printing-official-board');
    document.title = printTitle;
    window.addEventListener('afterprint', restorePage, { once: true });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        window.setTimeout(restorePage, 3000);
      });
    });
  };

  // Generate WhatsApp text summary
  const generateWhatsappText = () => {
    let text = `📋 *ESCALA MENSAL - ${settings.fantasyName.toUpperCase()}*\n`;
    text += `📅 *Mês:* ${getMonthName(currentMonth)} / ${currentYear}\n`;
    text += `🏥 *Gerente responsável:* ${settings.technicalResponsible}\n`;
    text += `──────────────────────\n\n`;

    employees.filter((e) => e.active).forEach((emp) => {
      text += `👤 *${emp.name}* (${emp.roleTitle})\n`;
      const workedDays: string[] = [];
      const offDays: string[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const shiftId = schedule.assignments[`${emp.id}_${dateStr}`] || 'shift_folga';
        const shift = shiftMap.get(shiftId);
        if (shift && !shift.isDayOff) {
          workedDays.push(`${day}(${shift.code})`);
        } else {
          offDays.push(`${day}`);
        }
      }

      text += `• Folgas no mês: Dias ${offDays.join(', ')}\n`;
      text += `• Total Horas: ${employeeHours[emp.id]?.totalHours.toFixed(0)}h\n\n`;
    });

    text += `_Gerado via FarmaEscala em ${new Date().toLocaleDateString('pt-BR')}_`;
    return text;
  };

  const handleCopyWhatsapp = () => {
    const text = generateWhatsappText();
    navigator.clipboard.writeText(text);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 3000);
  };

  const handleExportExcel = () => {
    const activeEmployees = employees.filter((employee) => employee.active);
    const totalColumns = daysInMonth + 3;
    const lastColumn = XLSX.utils.encode_col(totalColumns - 1);
    const generatedAt = new Date().toLocaleString('pt-BR');
    const headers = [
      'Colaborador',
      'Cargo',
      ...daysArray.map((day) => {
        const date = new Date(currentYear, currentMonth - 1, day);
        return `${String(day).padStart(2, '0')} ${getShortDayName(date.getDay())}`;
      }),
      'Total de horas',
    ];

    const rows: Array<Array<string | number>> = [
      [settings.fantasyName || 'FarmaEscala'],
      [`Escala de trabalho — ${getMonthName(currentMonth)} de ${currentYear}`],
      [`Gerado em ${generatedAt}`],
      [],
      headers,
    ];

    activeEmployees.forEach((emp) => {
      const daysData = daysArray.map((day) => {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const shiftId = schedule.assignments[`${emp.id}_${dateStr}`] || 'shift_folga';
        const shift = shiftMap.get(shiftId);
        return shift ? shift.code : 'F';
      });

      rows.push([
        emp.name,
        emp.roleTitle,
        ...daysData,
        Number((employeeHours[emp.id]?.totalHours || 0).toFixed(1)),
      ]);
    });

    const scheduleSheet = XLSX.utils.aoa_to_sheet(rows);
    scheduleSheet['!merges'] = [0, 1, 2].map((row) => ({
      s: { r: row, c: 0 },
      e: { r: row, c: totalColumns - 1 },
    }));
    scheduleSheet['!cols'] = [
      { wch: 28 },
      { wch: 22 },
      ...daysArray.map(() => ({ wch: 7 })),
      { wch: 14 },
    ];
    scheduleSheet['!rows'] = [
      { hpt: 24 },
      { hpt: 20 },
      { hpt: 18 },
      { hpt: 8 },
      { hpt: 30 },
    ];
    scheduleSheet['!autofilter'] = { ref: `A5:${lastColumn}${rows.length}` };
    scheduleSheet['!margins'] = {
      left: 0.2,
      right: 0.2,
      top: 0.35,
      bottom: 0.35,
      header: 0.1,
      footer: 0.1,
    };

    const legendRows: Array<Array<string>> = [
      ['Código', 'Turno', 'Horário'],
      ...shifts.map((shift) => [
        shift.code,
        shift.name,
        shift.isDayOff ? 'Folga' : `${shift.startTime} às ${shift.endTime}`,
      ]),
    ];
    const legendSheet = XLSX.utils.aoa_to_sheet(legendRows);
    legendSheet['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }];
    legendSheet['!autofilter'] = { ref: `A1:C${legendRows.length}` };

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: `Escala de ${getMonthName(currentMonth)} de ${currentYear}`,
      Subject: 'Escala mensal de trabalho',
      Author: settings.fantasyName || 'FarmaEscala',
      CreatedDate: new Date(),
    };
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Escala mensal');
    XLSX.utils.book_append_sheet(workbook, legendSheet, 'Legenda');

    const safePharmacyName = (settings.fantasyName || 'Farmacia')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const month = String(currentMonth).padStart(2, '0');

    XLSX.writeFile(workbook, `Escala_${safePharmacyName}_${currentYear}-${month}.xlsx`, {
      compression: true,
    });

    setCopiedCsv(true);
    window.setTimeout(() => setCopiedCsv(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Mural Oficial da Farmácia & Exportação</h2>
          <p className="text-xs text-slate-500">
            Formato oficial para afixação e envio
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyWhatsapp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer"
          >
            {copiedWhatsapp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedWhatsapp ? 'Copiado para WhatsApp!' : 'Copiar Resumo p/ WhatsApp'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{copiedCsv ? 'Planilha baixada!' : 'Baixar planilha Excel'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Quadro Oficial</span>
          </button>
        </div>
      </div>

      {/* Official Pharmacy Notice Board Paper Layout (Printable) */}
      <div className="print-page bg-white p-6 sm:p-8 rounded-3xl border border-slate-300 shadow-sm max-w-5xl mx-auto">
        {/* Pharmacy Header */}
        <div className="official-board-header border-b-2 border-emerald-800 pb-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-lg">
                <ShieldCheck className="w-6 h-6 text-emerald-700" />
                <span>{settings.fantasyName}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 font-bold text-xs rounded-lg border border-emerald-300 uppercase tracking-wider">
                Quadro de Escala de Trabalho
              </span>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {getMonthName(currentMonth)} de {currentYear}
              </div>
              <div className="text-[11px] text-slate-500">
                Horário: {settings.openTime} às {settings.closeTime}
              </div>
            </div>
          </div>

          {/* RT Information */}
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700">
            <div>
              <span className="font-bold text-emerald-950">Gerente responsável:</span>{' '}
              {settings.technicalResponsible}
            </div>
            <div>
              <span className="font-bold text-emerald-950">Status:</span> Publicada e Aprovada
            </div>
          </div>
        </div>

        {/* Printable Grid Table */}
        <div className="official-board-table overflow-x-auto mb-6">
          <table className="w-full table-fixed border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="border border-slate-300 p-2 text-left font-bold text-slate-800 min-w-[150px]">
                  Colaborador / Cargo
                </th>
                {daysArray.map((day) => {
                  const dayDate = new Date(currentYear, currentMonth - 1, day);
                  const isSunday = dayDate.getDay() === 0;
                  return (
                    <th
                      key={day}
                      className={`border border-slate-300 p-0.5 text-center font-bold min-w-[24px] ${
                        isSunday ? 'bg-rose-50 text-rose-800' : 'text-slate-800'
                      }`}
                    >
                      <div className="text-[9px] text-slate-400 font-normal">
                        {getShortDayName(dayDate.getDay()).slice(0, 1)}
                      </div>
                      <div>{day}</div>
                    </th>
                  );
                })}
                <th className="border border-slate-300 p-1 text-center font-bold text-slate-800 w-12">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.filter((e) => e.active).map((emp) => {
                const hours = employeeHours[emp.id]?.totalHours || 0;
                return (
                  <tr key={emp.id} className="border-b border-slate-300 hover:bg-slate-50">
                    <td className="border border-slate-300 p-1.5 font-medium text-slate-800">
                      <div>{emp.name}</div>
                      <div className="text-[10px] text-slate-500">{emp.roleTitle}</div>
                    </td>
                    {daysArray.map((day) => {
                      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const shiftId = schedule.assignments[`${emp.id}_${dateStr}`] || 'shift_folga';
                      const shift = shiftMap.get(shiftId) || shiftMap.get('shift_folga')!;

                      return (
                        <td
                          key={day}
                          className={`border border-slate-300 p-0.5 text-center text-[10px] font-bold ${
                            shift.id === 'shift_ferias' || shift.code === 'FÉR'
                              ? 'bg-amber-100 text-amber-950'
                              : shift.id === 'shift_atestado' || shift.id === 'shift_falta' || shift.code === 'ATEST' || shift.code === 'FALTA'
                                ? 'bg-rose-100 text-rose-950'
                                : shift.isDayOff ? 'bg-slate-100 text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {shift.code}
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 p-1 text-center font-bold text-slate-800 text-[11px]">
                      {hours.toFixed(0)}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend of Shifts */}
        <div className="official-board-legend bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] mb-6">
          <span className="font-bold text-slate-700 mr-2">Legenda dos Turnos:</span>
          {shifts.map((s) => (
            <span key={s.id} className="inline-block mr-3 text-slate-600">
              <strong className="text-slate-900">{s.code}</strong> = {s.name}{' '}
              {!s.isDayOff ? `(${s.startTime} às ${s.endTime})` : ''}
            </span>
          ))}
        </div>

        {/* Signatures & Certification for Pharmacy Regulatory Board */}
        <div className="official-board-signatures pt-6 border-t border-slate-300 grid grid-cols-2 gap-10 text-center text-xs">
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
              {settings.technicalResponsible}
            </div>
            <div className="text-slate-600 text-[11px]">
              Gerente responsável
            </div>
          </div>

          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
              Gerência / Diretoria
            </div>
            <div className="text-slate-600 text-[11px]">
              {settings.fantasyName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
