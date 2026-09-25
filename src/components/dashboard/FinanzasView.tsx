import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles, Expense, ExpenseCategory } from '../../types';
import {
  TrendingDown,
  Plus,
  FileText,
  Pencil,
  Trash2,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { DashboardSkeleton } from './DashboardSkeleton';
import { getTodayDateString, getLimaDateFromTimestamp } from '../../data/initialData';
import { isExpenseActive, useFinancialSSOT } from '../../services/financialSSOT';

export const FinanzasView: React.FC = () => {
  const {
    expenses,
    addExpense,
    updateExpense,
    anularExpense,
    isDataLoading,
    currentRole,
    currentUser,
  } = useApp();

  const isAdmin = currentRole === 'admin' || currentUser?.role === 'admin';

  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Estados de Modal: Registrar o Editar Egreso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Estados de Modal Estricto de Anulación
  const [anulandoExpense, setAnulandoExpense] = useState<Expense | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [isAnulando, setIsAnulando] = useState(false);

  // Campos del Formulario de Registro / Edición
  const [concept, setConcept] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('insumos_barberia');
  const [responsible, setResponsible] = useState('Recepción');
  const [expenseDate, setExpenseDate] = useState<string>(todayStr);
  const [isSaving, setIsSaving] = useState(false);

  const isToday = selectedDate === todayStr;
  const dateDisplayLabel = isToday ? 'Hoy' : selectedDate;

  // Verificación unificada vía SSOT de egresos anulados / inactivos
  const isAnulado = (exp: Expense): boolean => !isExpenseActive(exp);

  // Egresos del Día seleccionado (Zona Horaria America/Lima UTC-5)
  const dayExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const itemDate = getLimaDateFromTimestamp(e.date || e.created_at);
      return itemDate === selectedDate;
    });
  }, [expenses, selectedDate]);

  // Egresos ACTIVOS del Día (excluye estrictamente los anulados vía SSOT)
  const activeExpenses = useMemo(() => {
    return dayExpenses.filter((e) => isExpenseActive(e));
  }, [dayExpenses]);

  // TOTAL EGRESOS OPERATIVOS centralizado vía SSOT
  const financialMetrics = useFinancialSSOT(selectedDate);
  const totalEgresosCents = financialMetrics.totalEgresosCents;

  // Apertura de Modal para Crear
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setConcept('');
    setAmountInput('');
    setCategory('insumos_barberia');
    setResponsible('Recepción');
    setExpenseDate(selectedDate || todayStr);
    setIsModalOpen(true);
  };

  // Apertura de Modal para Editar (Solo Admin)
  const handleOpenEditModal = (exp: Expense) => {
    if (!isAdmin) return;
    setEditingExpense(exp);
    setConcept(exp.concept || exp.description || '');
    setAmountInput((exp.amount_cents / 100).toFixed(2));
    setCategory(exp.category);
    setResponsible(exp.responsible || exp.beneficiary || 'Recepción');
    setExpenseDate(getLimaDateFromTimestamp(exp.date || exp.created_at) || selectedDate);
    setIsModalOpen(true);
  };

  // Apertura de Modal Estricto de Anulación (Solo Admin)
  const handleOpenAnularModal = (exp: Expense) => {
    if (!isAdmin) return;
    setAnulandoExpense(exp);
    setMotivoAnulacion('');
  };

  // Cierre de Modal de Anulación
  const handleCloseAnularModal = () => {
    if (isAnulando) return;
    setAnulandoExpense(null);
    setMotivoAnulacion('');
  };

  // Confirmación de Anulación (Soft-Delete con motivo obligatorio)
  const handleConfirmAnulacion = async () => {
    if (!anulandoExpense || !motivoAnulacion.trim() || !isAdmin) return;

    setIsAnulando(true);
    try {
      await anularExpense(anulandoExpense.id, motivoAnulacion.trim());
      handleCloseAnularModal();
    } catch (err) {
      console.error('Error al anular egreso:', err);
    } finally {
      setIsAnulando(false);
    }
  };

  // Guardado de Egreso (Nuevo o Edición)
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amountInput || '0') * 100);
    if (!concept.trim() || amountCents <= 0) return;

    setIsSaving(true);
    try {
      if (editingExpense) {
        if (!isAdmin) return;
        await updateExpense(editingExpense.id, {
          description: concept.trim(),
          concept: concept.trim(),
          amount_cents: amountCents,
          category,
          beneficiary: responsible.trim() || 'Recepción',
          responsible: responsible.trim() || 'Recepción',
          date: expenseDate || selectedDate,
        });
      } else {
        addExpense({
          description: concept.trim(),
          concept: concept.trim(),
          amount_cents: amountCents,
          category,
          payment_method: 'efectivo',
          beneficiary: responsible.trim() || 'Recepción',
          responsible: responsible.trim() || 'Recepción',
          date: expenseDate || selectedDate,
        });
      }

      setIsModalOpen(false);
      setEditingExpense(null);
      setConcept('');
      setAmountInput('');
    } finally {
      setIsSaving(false);
    }
  };

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Control de Egresos & Caja Chica
          </h1>
          <p className="text-xs text-neutral-400">
            Registro y control de gastos operativos, insumos y caja chica diaria (Jornada: {dateDisplayLabel}).
          </p>
        </div>

        {/* Botón Registrar Nuevo Egreso: Disponible para Admin y Recepcionista */}
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg transition flex items-center gap-2 self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Egreso</span>
        </button>
      </div>

      {/* Financial KPIs Banner: Dinámico según la fecha seleccionada */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#141414] border border-red-900/40 rounded-2xl p-5 space-y-2 shadow-xl">
          <div className="flex justify-between items-center text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">
              Total Egresos Operativos ({dateDisplayLabel})
            </span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-red-400 block">
            {formatSoles(totalEgresosCents)}
          </span>
          <span className="text-[11px] text-neutral-500">
            {activeExpenses.length} gasto(s) activo(s) en la jornada {isToday ? 'actual' : `del ${selectedDate}`}
          </span>
        </div>
      </div>

      {/* Expenses Table Container */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <h3 className="font-serif-luxury text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C8A45C]" />
            <span>Libro Diario de Egresos Operativos ({dateDisplayLabel})</span>
          </h3>

          {/* Filtro de Fecha Dinámico (Date Picker) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 bg-[#181818] border border-neutral-800 rounded-xl px-3 py-1.5 focus-within:border-[#C8A45C] transition shadow-inner">
              <Calendar className="w-4 h-4 text-[#C8A45C] shrink-0" />
              <span className="text-neutral-400 text-[11px] font-medium hidden sm:inline">Fecha:</span>
              <input
                id="egresos-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || todayStr)}
                className="bg-transparent text-white text-xs outline-none cursor-pointer [color-scheme:dark]"
                title="Filtrar egresos por fecha"
              />
            </div>

            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#C8A45C] hover:text-white bg-[#C8A45C]/15 hover:bg-[#C8A45C]/25 border border-[#C8A45C]/35 transition cursor-pointer active:scale-95"
                title="Restablecer a la fecha de hoy"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Hoy</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181818] text-neutral-400 font-semibold border-b border-neutral-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Concepto / Detalle</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4 text-center">Estado</th>
                {/* Columna ACCIONES: Exclusiva para ADMIN, Oculta para RECEPCIONISTA */}
                {isAdmin && <th className="py-3 px-4 text-center">ACCIONES</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {dayExpenses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-neutral-500">
                    No se han registrado egresos en la jornada seleccionada ({selectedDate}).
                  </td>
                </tr>
              ) : (
                dayExpenses.map((exp) => {
                  const voided = isAnulado(exp);
                  return (
                    <tr
                      key={exp.id}
                      className={`transition ${
                        voided
                          ? 'bg-[#121212]/50 hover:bg-[#161616]/60 opacity-80'
                          : 'hover:bg-[#181818]'
                      }`}
                    >
                      <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                        {exp.created_at ? exp.created_at.replace('T', ' ').substring(0, 16) : exp.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-semibold ${voided ? 'text-neutral-400' : 'text-white'}`}>
                          {exp.concept || exp.description}
                        </div>
                        {voided && (
                          <div className="text-[10px] text-red-400/90 font-normal mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              Motivo anulación: {exp.motivo_anulacion || exp.voided_reason || 'Sin motivo registrado'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 capitalize text-neutral-300">
                        {exp.category ? exp.category.replace(/_/g, ' ') : 'General'}
                      </td>
                      <td className="py-3 px-4 text-neutral-300">
                        {exp.responsible || exp.beneficiary || 'Recepción'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {voided ? (
                          <span className="line-through text-neutral-500 font-medium">
                            - {formatSoles(exp.amount_cents)}
                          </span>
                        ) : (
                          <span className="font-bold text-red-400">
                            - {formatSoles(exp.amount_cents)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {voided ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-950/60 border border-red-800/60 text-red-400 uppercase tracking-wider">
                            ANULADO
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 uppercase tracking-wider">
                            ACTIVO
                          </span>
                        )}
                      </td>
                      {/* Celda de Acciones Protegida por Rol: Solo para ADMIN */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {!voided ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(exp)}
                                className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-[#E6C875] hover:border-[#C8A45C]/50 hover:bg-[#C8A45C]/10 transition cursor-pointer"
                                title="Editar Egreso"
                                aria-label={`Editar egreso ${exp.concept || exp.description}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAnularModal(exp)}
                                className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 transition cursor-pointer"
                                title="Anular Egreso"
                                aria-label={`Anular egreso ${exp.concept || exp.description}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-500 italic">
                              Anulado
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar o Editar Egreso */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-red-900/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-serif-luxury text-base font-bold text-white">
                {editingExpense ? 'Editar Egreso de Caja Chica' : 'Registrar Egreso de Caja Chica'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingExpense(null);
                }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Concepto del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Compra de toallas descartables, recarga de café..."
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl p-2.5 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Monto del Egreso (S/) *</label>
                  <input
                    type="number"
                    step="0.10"
                    min="0.10"
                    required
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-red-400 font-bold text-base rounded-xl p-2.5 outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Fecha del Gasto *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl p-2.5 outline-none transition [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Categoría Operativa</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl p-2.5 outline-none transition"
                >
                  <option value="insumos_barberia">Insumos Barbería (Navajas, apósitos, geles)</option>
                  <option value="insumos_spa">Insumos Spa (Aceites, mascarillas, toallas)</option>
                  <option value="mantenimiento">Mantenimiento de Local / Equipos</option>
                  <option value="servicios">Servicios Básicos / Internet</option>
                  <option value="refrigerios">Refrigerios & Atención al Cliente</option>
                  <option value="otros">Otros Gastos Varios</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Responsable / Autorizado por</label>
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl p-2.5 outline-none transition"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingExpense(null);
                  }}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition cursor-pointer"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingExpense ? 'Guardar Cambios' : 'Confirmar Egreso'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Anulación Estricta de Egreso (Con Motivo Obligatorio) */}
      {anulandoExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-red-900/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-serif-luxury text-base font-bold text-red-400 flex items-center gap-2">
                <span>⚠️ ANULAR EGRESO SELECCIONADO</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseAnularModal}
                disabled={isAnulando}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-300">
              ¿Estás seguro de anular este gasto de la caja chica?
            </p>

            {/* Datos del gasto seleccionado en formato de lista */}
            <div className="p-3.5 bg-[#181818] border border-neutral-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-neutral-400 font-medium">Concepto:</span>
                <span className="text-white font-semibold text-right break-words max-w-[220px]">
                  {anulandoExpense.concept || anulandoExpense.description}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Monto a extornar:</span>
                <span className="text-red-400 font-bold text-sm">
                  {formatSoles(anulandoExpense.amount_cents)}
                </span>
              </div>
            </div>

            {/* Textarea Motivo Obligatorio */}
            <div className="space-y-1.5 text-xs">
              <label className="text-neutral-300 font-semibold block">
                MOTIVO DE LA ANULACIÓN (Obligatorio):
              </label>
              <textarea
                required
                rows={3}
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Error de tipeo, el gasto no se concretó..."
                disabled={isAnulando}
                className="w-full bg-[#181818] border border-neutral-800 focus:border-red-500/70 text-white rounded-xl p-3 outline-none resize-none transition [color-scheme:dark]"
              />
            </div>

            {/* Botones [ CANCELAR ] y [ CONFIRMAR ANULACIÓN ] */}
            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseAnularModal}
                disabled={isAnulando}
                className="px-4 py-2.5 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold transition cursor-pointer"
              >
                [ CANCELAR ]
              </button>
              <button
                type="button"
                onClick={handleConfirmAnulacion}
                disabled={!motivoAnulacion.trim() || isAnulando}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAnulando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>[ CONFIRMAR ANULACIÓN ]</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
