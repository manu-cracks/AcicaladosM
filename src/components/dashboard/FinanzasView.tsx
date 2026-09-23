import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles } from '../../types';
import { TrendingDown, Plus, FileText } from 'lucide-react';
import { DashboardSkeleton } from './DashboardSkeleton';
import { getTodayDateString, getLimaDateFromTimestamp } from '../../data/initialData';

export const FinanzasView: React.FC = () => {
  const { expenses, addExpense, currentRole, isDataLoading } = useApp();

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  const todayStr = getTodayDateString();

  // Filtrado Estricto por Día ("Hoy" America/Lima UTC-5)
  const todayExpenses = useMemo(() => {
    return expenses.filter(
      (e) => !e.voided && getLimaDateFromTimestamp(e.date || e.created_at) === todayStr
    );
  }, [expenses, todayStr]);

  const totalEgresosHoyCents = useMemo(() => {
    return todayExpenses.reduce((acc, e) => acc + (e.amount_cents || 0), 0);
  }, [todayExpenses]);

  const [concept, setConcept] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<
    'insumos_barberia' | 'insumos_spa' | 'mantenimiento' | 'servicios' | 'refrigerios' | 'otros'
  >('insumos_barberia');
  const [responsible, setResponsible] = useState('Recepción');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amountInput || '0') * 100);
    if (!concept.trim() || amountCents <= 0) return;

    addExpense({
      description: concept.trim(),
      concept: concept.trim(),
      amount_cents: amountCents,
      category,
      payment_method: 'efectivo',
      beneficiary: responsible,
      responsible,
      date: todayStr,
    });

    setConcept('');
    setAmountInput('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Control de Egresos & Caja Chica
          </h1>
          <p className="text-xs text-neutral-400">
            Registro y control de gastos operativos, insumos y caja chica diaria (Jornada: {todayStr}).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Egreso</span>
        </button>
      </div>

      {/* Financial KPIs Banner: Exclusivo Gastos Diarios (Limpieza visual según RBAC) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#141414] border border-red-900/40 rounded-2xl p-5 space-y-2 shadow-xl">
          <div className="flex justify-between items-center text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Total Egresos Operativos (Hoy)</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-red-400 block">
            {formatSoles(totalEgresosHoyCents)}
          </span>
          <span className="text-[11px] text-neutral-500">
            {todayExpenses.length} gasto(s) registrado(s) en la jornada actual
          </span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="font-serif-luxury text-base font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#C8A45C]" />
          <span>Libro Diario de Egresos Operativos (Hoy)</span>
        </h3>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {todayExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    No se han registrado egresos en la jornada de hoy.
                  </td>
                </tr>
              ) : (
                todayExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#181818] transition">
                    <td className="py-3 px-4 text-neutral-400">
                      {exp.created_at.replace('T', ' ').substring(0, 16)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{exp.concept || exp.description}</td>
                    <td className="py-3 px-4 capitalize text-neutral-300">
                      {exp.category.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">{exp.responsible || exp.beneficiary}</td>
                    <td className="py-3 px-4 text-right font-bold text-red-400">
                      - {formatSoles(exp.amount_cents)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded badge-error uppercase">
                        {exp.status || 'Activo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Egreso */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-red-900/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-serif-luxury text-base font-bold text-white border-b border-neutral-800 pb-3">
              Registrar Egreso de Caja Chica
            </h3>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-300">Concepto del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Compra de toallas descartables, recarga de café..."
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300">Monto del Egreso (S/) *</label>
                <input
                  type="number"
                  step="0.10"
                  required
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 text-red-400 font-bold text-base rounded-xl p-2.5 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300">Categoría Operativa</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none"
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
                <label className="text-neutral-300">Responsable / Autorizado por</label>
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white shadow"
                >
                  Confirmar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
