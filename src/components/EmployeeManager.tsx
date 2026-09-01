import React, { useState } from 'react';
import { Employee, EmployeeRole, ContractType, ShiftType } from '../types';
import { 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  Clock, 
  Check, 
  X, 
  Briefcase,
  AlertTriangle,
  CalendarDays,
  ChevronDown
} from 'lucide-react';

interface EmployeeManagerProps {
  employees: Employee[];
  shifts: ShiftType[];
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onToggleActive: (id: string) => void;
}

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: 'farmaceutico', label: 'Farmacêutico' },
  { value: 'balconista', label: 'Balconista de Farmácia' },
  { value: 'caixa', label: 'Operador(a) de Caixa' },
  { value: 'dermoconsultor', label: 'Dermoconsultor(a)' },
  { value: 'estoquista', label: 'Auxiliar de Farmácia & Estoque' },
  { value: 'gerente', label: 'Gerente de Loja' },
];

const CONTRACT_OPTIONS: { value: ContractType; label: string; defaultHours: number }[] = [
  { value: 'clt_44h', label: 'CLT Padrão 44h', defaultHours: 44 },
  { value: 'escala_6x1', label: 'Escala 6x1 (44h)', defaultHours: 44 },
  { value: 'escala_12x36', label: 'Plantão 12x36 (36h)', defaultHours: 36 },
  { value: 'escala_5x2', label: 'Escala 5x2 (44h)', defaultHours: 44 },
  { value: 'clt_40h', label: 'CLT 40h', defaultHours: 40 },
  { value: 'estagio_30h', label: 'Estágio Farmacêutico (30h)', defaultHours: 30 },
];

const COLOR_PALETTE = [
  '#0284c7', // Sky 600
  '#0369a1', // Sky 700
  '#0891b2', // Cyan 600
  '#0e7490', // Cyan 700
  '#0f766e', // Teal 700
  '#2563eb', // Blue 600
  '#4f46e5', // Indigo 600
  '#d97706', // Amber 600
  '#e11d48', // Rose 600
  '#475569', // Slate 600
];

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  shifts,
  onSaveEmployee,
  onDeleteEmployee,
  onToggleActive,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [expandedHistoryEmployeeId, setExpandedHistoryEmployeeId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    cpf: '',
    role: 'balconista',
    roleTitle: 'Balconista de Farmácia',
    contractType: 'escala_6x1',
    weeklyHoursTarget: 44,
    email: '',
    phone: '',
    color: '#0284c7',
    active: true,
    hireDate: new Date().toISOString().split('T')[0],
    preferredShiftId: 'shift_manha',
    notes: '',
  });

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      cpf: '',
      role: 'balconista',
      roleTitle: 'Balconista de Farmácia',
      contractType: 'escala_6x1',
      weeklyHoursTarget: 44,
      email: '',
      phone: '',
      color: '#0284c7',
      active: true,
      hireDate: new Date().toISOString().split('T')[0],
      preferredShiftId: 'shift_manha',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setIsModalOpen(true);
  };

  const handleRoleChange = (newRole: EmployeeRole) => {
    const roleObj = ROLE_OPTIONS.find((r) => r.value === newRole);
    setFormData({
      ...formData,
      role: newRole,
      roleTitle: roleObj?.label || '',
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const employeeToSave: Employee = {
      id: editingEmployee ? editingEmployee.id : `emp_${Date.now()}`,
      name: formData.name.trim(),
      cpf: formData.cpf?.trim() || '',
      role: (formData.role as EmployeeRole) || 'balconista',
      roleTitle: formData.roleTitle || 'Balconista',
      contractType: (formData.contractType as ContractType) || 'escala_6x1',
      weeklyHoursTarget: Number(formData.weeklyHoursTarget) || 44,
      email: formData.email?.trim() || '',
      phone: formData.phone?.trim() || '',
      color: formData.color || '#0284c7',
      active: formData.active ?? true,
      hireDate: formData.hireDate || new Date().toISOString().split('T')[0],
      preferredShiftId: formData.preferredShiftId || 'shift_manha',
      notes: formData.notes?.trim() || '',
    };

    onSaveEmployee(employeeToSave);
    setIsModalOpen(false);
  };

  const filteredEmployees = employees.filter((emp) => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(q);
      const matchRole = emp.roleTitle.toLowerCase().includes(q);
      if (!matchName && !matchRole) return false;
    }
    if (roleFilter === 'farmaceuticos') {
      return emp.role === 'farmaceutico';
    }
    if (roleFilter === 'balconistas') {
      return emp.role === 'balconista' || emp.role === 'dermoconsultor';
    }
    if (roleFilter === 'caixa') {
      return emp.role === 'caixa';
    }
    if (roleFilter === 'inativos') {
      return !emp.active;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome ou cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-sky-500 focus:bg-white transition-all"
            />
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setRoleFilter('todos')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'todos' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({employees.length})
            </button>
            <button
              onClick={() => setRoleFilter('farmaceuticos')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'farmaceuticos' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Farmacêuticos
            </button>
            <button
              onClick={() => setRoleFilter('balconistas')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'balconistas' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Balconistas
            </button>
            <button
              onClick={() => setRoleFilter('caixa')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                roleFilter === 'caixa' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Caixa
            </button>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs shadow-sky-600/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Funcionário</span>
        </button>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredEmployees.map((emp) => {
          const history = [...(emp.occurrenceHistory ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
          const isHistoryExpanded = expandedHistoryEmployeeId === emp.id;
          const visibleHistory = isHistoryExpanded ? history : history.slice(0, 2);
          return (
            <div
              key={emp.id}
              className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
                emp.active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 bg-slate-50/60 opacity-70'
              }`}
            >
              <div>
                {/* Header card */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
                      style={{ backgroundColor: emp.color || '#0284c7' }}
                    >
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <span>{emp.name}</span>
                        {!emp.active && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-normal">
                            Inativo
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <span>{emp.roleTitle}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="p-1 text-slate-400 hover:text-sky-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteEmployee(emp.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1 text-xs text-slate-600 bg-slate-50/80 p-2 rounded-xl border border-slate-100 mb-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Jornada:</span>
                    <span className="font-medium text-slate-700">
                      {emp.weeklyHoursTarget}h semanais
                    </span>
                  </div>

                  {emp.phone && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Contato:</span>
                      <span className="text-slate-700">{emp.phone}</span>
                    </div>
                  )}
                </div>

                {emp.notes && (
                  <p className="text-[10px] text-slate-400 italic line-clamp-1">
                    {emp.notes}
                  </p>
                )}

                {history.length > 0 && (
                  <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/70 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-900"><AlertTriangle className="h-3 w-3" /> Histórico de ocorrências</span>
                      <span className="text-[10px] text-amber-700">{history.length}</span>
                    </div>
                    <div className="space-y-1">
                      {visibleHistory.map((occurrence) => {
                        const isVacation = occurrence.type === 'ferias';
                        const label = occurrence.type === 'ferias' ? 'Férias' : occurrence.type === 'atestado' ? 'Atestado' : 'Falta';
                        const period = occurrence.startDate === occurrence.endDate ? new Date(`${occurrence.startDate}T12:00:00`).toLocaleDateString('pt-BR') : `${new Date(`${occurrence.startDate}T12:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${occurrence.endDate}T12:00:00`).toLocaleDateString('pt-BR')}`;
                        return <div key={occurrence.id} className={`rounded-lg border px-1.5 py-1 text-[10px] ${isVacation ? 'border-amber-300 bg-amber-100 text-amber-950' : 'border-rose-300 bg-rose-100 text-rose-950'}`}>
                          <div className="flex items-center justify-between gap-1"><span className="font-bold">{label}</span><span className="flex shrink-0 items-center gap-0.5"><CalendarDays className="h-2.5 w-2.5" />{period}</span></div>
                          {occurrence.note && <div className="mt-0.5 truncate opacity-80">{occurrence.note}</div>}
                        </div>;
                      })}
                    </div>
                    {history.length > 2 && <button type="button" onClick={() => setExpandedHistoryEmployeeId(isHistoryExpanded ? null : emp.id)} className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-800 hover:text-amber-950 cursor-pointer">{isHistoryExpanded ? 'Mostrar menos' : `Ver mais ${history.length - 2}`}<ChevronDown className={`h-3 w-3 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`} /></button>}
                  </div>
                )}
              </div>

              {/* Status toggle */}
              <div className="pt-2.5 border-t border-slate-100 mt-2 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">Status na escala</span>
                <button
                  onClick={() => onToggleActive(emp.id)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    emp.active
                      ? 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {emp.active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
                </h3>
                <p className="text-xs text-sky-400">
                  Preencha os dados do colaborador para a escala
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
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                />
              </div>

              {/* Role */}
              <div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cargo / Função *
                  </label>
                  <select
                    value={formData.role || 'balconista'}
                    onChange={(e) => handleRoleChange(e.target.value as EmployeeRole)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500 bg-white"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Contract & Target Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Escala / Contrato
                  </label>
                  <select
                    value={formData.contractType || 'escala_6x1'}
                    onChange={(e) => {
                      const cType = e.target.value as ContractType;
                      const opt = CONTRACT_OPTIONS.find((c) => c.value === cType);
                      setFormData({
                        ...formData,
                        contractType: cType,
                        weeklyHoursTarget: opt?.defaultHours || 44,
                      });
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500 bg-white"
                  >
                    {CONTRACT_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Carga Semanal Alvo (Horas)
                  </label>
                  <input
                    type="number"
                    value={formData.weeklyHoursTarget || 44}
                    onChange={(e) => setFormData({ ...formData, weeklyHoursTarget: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / Celular
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-0000"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="colaborador@empresa.com"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                  />
                </div>
              </div>

              {/* Color Tag */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cor de Identificação
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c })}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        formData.color === c ? 'scale-125 ring-2 ring-slate-800' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Não trabalha aos domingos de manhã..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-sky-500"
                />
              </div>

              {/* Actions */}
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
