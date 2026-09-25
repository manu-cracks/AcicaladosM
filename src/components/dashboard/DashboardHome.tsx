import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles, formatLimaDate, Booking, getBookingCollectedAmountCents } from '../../types';
import { getTodayDateString } from '../../data/initialData';
import { supabase } from '../../lib/supabase/client';
import { DashboardSkeleton } from './DashboardSkeleton';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Clock,
  Radio,
  Plus,
  Printer,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShoppingBag,
  Scissors,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

/** Extrae la fecha YYYY-MM-DD en la zona horaria oficial America/Lima */
function getLimaDateFromTimestamp(val?: string | null): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val.substring(0, 10);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  } catch {
    return val.substring(0, 10);
  }
}

export const DashboardHome: React.FC = () => {
  const {
    kpis,
    bookings,
    ventasMostrador,
    expenses,
    setActiveView,
    openTicketModal,
    realtimeConnected,
    lastSyncTimestamp,
    currentRole,
    currentUser,
    isDataLoading,
  } = useApp();

  const isAdmin = currentRole === 'admin' || currentUser?.role === 'admin';
  const todayStr = getTodayDateString();

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  // Filtro de fecha: 'hoy' | 'semana' | 'mes' | 'todo' | fecha exacta 'YYYY-MM-DD'
  const [dateFilter, setDateFilter] = useState<string>('hoy');
  const [activeTab, setActiveTab] = useState<'todos' | 'reservas' | 'ventas' | 'egresos'>('todos');

  const isExactDate = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(dateFilter), [dateFilter]);

  // Consulta y sincronización con la función RPC get_financial_balances de Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchRpcBalances = async () => {
      try {
        let params: { p_date?: string | null; p_start_date?: string | null; p_end_date?: string | null } = {};
        if (isExactDate) {
          params.p_date = dateFilter;
        } else if (dateFilter === 'hoy') {
          params.p_date = todayStr;
        } else if (dateFilter === 'semana') {
          const d = new Date(todayStr + 'T12:00:00');
          d.setDate(d.getDate() - 7);
          params.p_start_date = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
          params.p_end_date = todayStr;
        } else if (dateFilter === 'mes') {
          const d = new Date(todayStr + 'T12:00:00');
          d.setDate(d.getDate() - 30);
          params.p_start_date = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
          params.p_end_date = todayStr;
        }

        await supabase.rpc('get_financial_balances', params);
      } catch (err) {
        console.warn('RPC financial balances check:', err);
      }
    };

    fetchRpcBalances();

    return () => {
      isMounted = false;
    };
  }, [dateFilter, isExactDate, todayStr, lastSyncTimestamp]);

  // 1. Filtrado riguroso de citas por rango / fecha exacta (00:00:00 a 23:59:59 America/Lima)
  const rangeBookings = useMemo(() => {
    const validBookings = bookings.filter((b) => {
      return (
        b.status !== 'cancelada' &&
        b.status !== 'cancelled' &&
        b.status !== 'expirada' &&
        !b.cancelled_at &&
        !b.expired_at
      );
    });

    if (dateFilter === 'todo') return validBookings;
    if (isExactDate) {
      return validBookings.filter((b) => getLimaDateFromTimestamp(b.date) === dateFilter);
    }
    if (dateFilter === 'hoy') {
      return validBookings.filter((b) => getLimaDateFromTimestamp(b.date) === todayStr);
    }

    let startDateStr = todayStr;
    if (dateFilter === 'semana') {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - 7);
      startDateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    } else if (dateFilter === 'mes') {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - 30);
      startDateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    }

    return validBookings.filter((b) => {
      const d = getLimaDateFromTimestamp(b.date);
      return d >= startDateStr && d <= todayStr;
    });
  }, [bookings, dateFilter, isExactDate, todayStr]);

  // 2. Filtrado riguroso de ventas de mostrador por rango / fecha exacta (00:00:00 a 23:59:59 America/Lima)
  const rangeVentas = useMemo(() => {
    const activeVentas = ventasMostrador.filter((v: any) => !v.voided);
    if (dateFilter === 'todo') return activeVentas;
    if (isExactDate) {
      return activeVentas.filter((v: any) => getLimaDateFromTimestamp(v.created_at || v.fecha) === dateFilter);
    }
    if (dateFilter === 'hoy') {
      return activeVentas.filter((v: any) => getLimaDateFromTimestamp(v.created_at || v.fecha) === todayStr);
    }

    let startDateStr = todayStr;
    if (dateFilter === 'semana') {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - 7);
      startDateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    } else if (dateFilter === 'mes') {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - 30);
      startDateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    }

    return activeVentas.filter((v: any) => {
      const d = getLimaDateFromTimestamp(v.created_at || v.fecha);
      return d >= startDateStr && d <= todayStr;
    });
  }, [ventasMostrador, dateFilter, isExactDate, todayStr]);

  // 3. Filtrado riguroso de egresos por rango / fecha exacta (00:00:00 a 23:59:59 America/Lima)
  const rangeExpenses = useMemo(() => {
    const activeExpenses = expenses.filter((e) => {
      if (e.voided) return false;
      const statusUpper = (e.status || '').toUpperCase();
      const estadoUpper = (e.estado || '').toUpperCase();
      if (
        statusUpper === 'ANULADO' ||
        statusUpper === 'ELIMINADO' ||
        statusUpper === 'INACTIVO' ||
        statusUpper === 'VOIDED' ||
        estadoUpper === 'ANULADO' ||
        estadoUpper === 'ELIMINADO' ||
        estadoUpper === 'INACTIVO'
      ) {
        return false;
      }
      return true;
    });
    if (dateFilter === 'todo') return activeExpenses;
    if (isExactDate) {
      return activeExpenses.filter((e) => getLimaDateFromTimestamp(e.date || e.created_at) === dateFilter);
    }
    if (dateFilter === 'hoy') {
      return activeExpenses.filter((e) => getLimaDateFromTimestamp(e.date || e.created_at) === todayStr);
    }

    let startDateStr = todayStr;
    if (dateFilter === 'semana') {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - 7);
      startDateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    } else if (dateFilter === 'mes') {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - 30);
      startDateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    }

    return activeExpenses.filter((e) => {
      const d = getLimaDateFromTimestamp(e.date || e.created_at);
      return d >= startDateStr && d <= todayStr;
    });
  }, [expenses, dateFilter, isExactDate, todayStr]);

  // Cálculo financiero estricto según rango o fecha seleccionada
  const rangeKpis = useMemo(() => {
    // 1. Ingresos por Servicios: Sumatoria de montos cobrados en reservas
    const ingresosServiciosCents = rangeBookings.reduce(
      (acc, b) => acc + getBookingCollectedAmountCents(b),
      0
    );

    // 2. Ingresos por Ventas: Sumatoria de montos cobrados en ventas de mostrador
    const ventasMostradorCents = rangeVentas.reduce(
      (acc, v) => acc + (v.total_price_cents || 0),
      0
    );

    // 3. Total Ingresos Cobrados = Ingresos por Servicios + Ingresos por Ventas
    const totalIngresosCents = ingresosServiciosCents + ventasMostradorCents;

    // 4. Total Egresos Operativos
    const totalEgresosCents = rangeExpenses.reduce(
      (acc, e) => acc + (e.amount_cents || 0),
      0
    );

    // 5. Balance Neto de Caja = Total Ingresos Cobrados - Total Egresos Operativos
    const balanceNetoCents = totalIngresosCents - totalEgresosCents;
    const citasCount = rangeBookings.length;
    const citasConfirmadasCount = rangeBookings.filter(
      (b) => b.payment_status === 'total' || b.payment_status === 'parcial'
    ).length;

    return {
      totalIngresosCents,
      ingresosServiciosCents,
      ventasMostradorCents,
      totalEgresosCents,
      balanceNetoCents,
      citasCount,
      citasConfirmadasCount,
    };
  }, [rangeBookings, rangeVentas, rangeExpenses]);

  // Título dinámico para la agenda según filtro
  const agendaTitle = useMemo(() => {
    if (dateFilter === 'hoy') return `Agenda de Hoy (${todayStr})`;
    if (isExactDate) return `Agenda del Día (${formatLimaDate(dateFilter)})`;
    if (dateFilter === 'semana') return 'Agenda de la Semana';
    if (dateFilter === 'mes') return 'Agenda del Último Mes';
    return 'Todas las Reservas';
  }, [dateFilter, isExactDate, todayStr]);

  // Título dinámico para ventas según filtro
  const salesTitle = useMemo(() => {
    if (dateFilter === 'hoy') return 'Ventas de Mostrador de Hoy';
    if (isExactDate) return `Ventas del Día (${formatLimaDate(dateFilter)})`;
    if (dateFilter === 'semana') return 'Ventas de la Semana';
    if (dateFilter === 'mes') return 'Ventas del Último Mes';
    return 'Ventas de Mostrador';
  }, [dateFilter, isExactDate]);

  // Título dinámico para tarjeta 6 de citas
  const citasCardTitle = useMemo(() => {
    if (dateFilter === 'hoy') return 'Citas Programadas Hoy';
    if (isExactDate) return `Citas del ${formatLimaDate(dateFilter)}`;
    return 'Citas en Periodo';
  }, [dateFilter, isExactDate]);

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
              Panel de Gestión & Recepción
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] font-semibold">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              <span>Realtime Activo</span>
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Monitoreo en tiempo real de caja, citas de la jornada y flujo operativo.
          </p>
        </div>

        {/* Quick Time Range Selector & Admin Calendar Picker */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center bg-[#141414] border border-neutral-800 rounded-xl p-1 text-xs">
            {(['hoy', 'semana', 'mes', 'todo'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateFilter(range)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition ${
                  dateFilter === range
                    ? 'bg-[#C8A45C] text-black font-semibold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Selector de Fecha Calendario (Exclusivo Administrador) */}
          {isAdmin && (
            <div
              className={`flex items-center gap-2 bg-[#141414] border rounded-xl px-3 py-1.5 text-xs transition ${
                isExactDate
                  ? 'border-[#C8A45C] bg-[#C8A45C]/10 text-white shadow-lg shadow-[#C8A45C]/10'
                  : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <Calendar className={`w-3.5 h-3.5 ${isExactDate ? 'text-[#C8A45C]' : 'text-neutral-500'}`} />
              <label htmlFor="admin-date-picker" className="sr-only">
                Seleccionar fecha específica
              </label>
              <input
                id="admin-date-picker"
                type="date"
                value={isExactDate ? dateFilter : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setDateFilter(e.target.value);
                  }
                }}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark]"
                title="Consultar fecha específica (Exclusivo Administrador)"
              />
              {isExactDate && (
                <button
                  type="button"
                  onClick={() => setDateFilter('hoy')}
                  className="text-[11px] text-neutral-400 hover:text-white transition px-1 py-0.5 rounded hover:bg-neutral-800"
                  title="Restablecer a Hoy"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid (6 métricas: 2 filas de 3 tarjetas equilibradas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 1. Total Ingresos Cobrados */}
        <div className="bg-[#141414] border border-[#C8A45C]/35 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-[#C8A45C]/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Total Ingresos Cobrados</span>
            <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/15 text-[#C8A45C] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#E6C875] tracking-tight block">
              {formatSoles(rangeKpis.totalIngresosCents)}
            </span>
            <span className="text-[11px] text-neutral-500 mt-0.5 block">
              Servicios + Ventas de mostrador
            </span>
          </div>
        </div>

        {/* 2. Ingresos por Servicios */}
        <div className="bg-[#141414] border border-[#C8A45C]/25 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-[#C8A45C]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Ingresos por Servicios</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-[#E6C875]" />
            </div>
          </div>
          <div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#E6C875] tracking-tight block">
              {formatSoles(rangeKpis.ingresosServiciosCents)}
            </span>
            <span className="text-[11px] text-neutral-500 mt-0.5 block">
              Barbería y Spa cobrados
            </span>
          </div>
        </div>

        {/* 3. Ingresos por Ventas */}
        <div className="bg-[#141414] border border-emerald-900/40 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Ingresos por Ventas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/40 text-emerald-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight block">
              {formatSoles(rangeKpis.ventasMostradorCents)}
            </span>
            <span className="text-[11px] text-neutral-500 mt-0.5 block">
              Productos físicos de mostrador
            </span>
          </div>
        </div>

        {/* 4. Total Egresos Operativos */}
        <div className="bg-[#141414] border border-red-900/40 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-red-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Total Egresos Operativos</span>
            <div className="w-8 h-8 rounded-lg bg-red-950/40 text-red-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-red-400 tracking-tight block">
              {formatSoles(rangeKpis.totalEgresosCents)}
            </span>
            <span className="text-[11px] text-neutral-500 mt-0.5 block">
              Caja chica e insumos activos
            </span>
          </div>
        </div>

        {/* 5. Balance Neto de Caja */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-neutral-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Balance Neto de Caja</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                rangeKpis.balanceNetoCents >= 0
                  ? 'bg-emerald-950/40 text-emerald-400'
                  : 'bg-red-950/40 text-red-400'
              }`}
            >
              {rangeKpis.balanceNetoCents >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
            </div>
          </div>
          <div>
            <span
              className={`font-serif-luxury text-2xl sm:text-3xl font-bold tracking-tight block ${
                rangeKpis.balanceNetoCents >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {formatSoles(rangeKpis.balanceNetoCents)}
            </span>
            <span className="text-[11px] text-neutral-500 mt-0.5 block">
              Total Ingresos menos Egresos
            </span>
          </div>
        </div>

        {/* 6. Citas Programadas Hoy / en Periodo */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-neutral-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">
              {citasCardTitle}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-tight block">
              {rangeKpis.citasCount} citas
            </span>
            <span className="text-[11px] text-neutral-500 mt-0.5 block">
              {rangeKpis.citasConfirmadasCount} confirmadas con adelanto
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Today's Agenda & Quick POS/Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Agenda de Hoy */}
        <div className="lg:col-span-8 bg-[#141414] border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#C8A45C]" />
              <h2 className="font-serif-luxury text-base font-bold text-white">
                {agendaTitle}
              </h2>
              {isExactDate && (
                <span className="text-[10px] bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/30 px-2 py-0.5 rounded-full font-medium">
                  Fecha Específica
                </span>
              )}
            </div>

            <button
              onClick={() => setActiveView('/dashboard/reservas')}
              className="text-xs text-[#C8A45C] hover:underline font-medium flex items-center gap-1"
            >
              <span>Ver todas las reservas</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {rangeBookings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-xs text-neutral-400">
                {isExactDate
                  ? `No hay citas programadas para el ${formatLimaDate(dateFilter)}.`
                  : dateFilter === 'hoy'
                  ? 'No hay citas programadas para hoy.'
                  : 'No se encontraron citas en este período.'}
              </p>
              <button
                onClick={() => setActiveView('/dashboard/reservas')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#C8A45C] text-black shadow"
              >
                Registrar Nueva Cita
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rangeBookings.map((b) => {
                const saldo = Math.max(0, b.total_price_cents - b.advance_amount_cents);
                return (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/35 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#E6C875] bg-black/40 px-2 py-0.5 rounded border border-neutral-800">
                          #{b.code}
                        </span>
                        <span className="text-xs font-bold text-white">{b.client_name}</span>
                        <span className="text-[10px] text-neutral-500">({b.client_phone})</span>
                      </div>

                      <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-2">
                        <span className="text-white font-medium">
                          🕒 {b.start_time} - {b.end_time}
                        </span>
                        <span>•</span>
                        <span>{b.services.map((s) => s.service_name).join(', ')}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                      <div className="text-right">
                        <span className="text-xs font-bold text-white block">
                          {formatSoles(b.total_price_cents)}
                        </span>
                        <span
                          className={`inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] uppercase font-bold px-2 py-0.5 rounded-md ${
                            b.payment_status === 'total'
                              ? 'badge-success'
                              : b.payment_status === 'parcial'
                              ? 'badge-warning'
                              : 'badge-error'
                          }`}
                        >
                          {b.payment_status === 'total'
                            ? 'Pagado'
                            : b.payment_status === 'parcial'
                            ? `Saldo: ${formatSoles(saldo)}`
                            : 'Sin Pago'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openTicketModal('booking', b)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                          title="Imprimir Ticket Térmico"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveView('/dashboard/reservas')}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#C8A45C]/15 hover:bg-[#C8A45C] text-[#E6C875] hover:text-black border border-[#C8A45C]/30 transition"
                        >
                          Gestionar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Quick Access POS & Movement Tabs */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions Card */}
          <div className="bg-[#141414] border border-[#C8A45C]/25 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="font-serif-luxury text-sm font-bold text-white border-b border-neutral-800 pb-2">
              Acciones Operativas Rápidas
            </h3>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveView('/dashboard/reservas')}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black flex items-center justify-between shadow transition"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>Crear Nueva Reserva Manual</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('/dashboard/ventas')}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#1A1A1A] hover:bg-[#222222] text-neutral-200 border border-neutral-800 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#C8A45C]" />
                  <span>Abrir POS Venta Mostrador</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('/dashboard/asistencia')}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#1A1A1A] hover:bg-[#222222] text-neutral-200 border border-neutral-800 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Escáner QR Reloj Control</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Sales of the shift preview */}
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-serif-luxury text-sm font-bold text-white">
                {salesTitle}
              </span>
              <button
                onClick={() => setActiveView('/dashboard/ventas')}
                className="text-[11px] text-[#C8A45C] hover:underline"
              >
                Ver POS
              </button>
            </div>

            <div className="space-y-2.5">
              {rangeVentas.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-500">
                  {isExactDate
                    ? `Sin ventas registradas en esta fecha.`
                    : 'Sin ventas en este período.'}
                </div>
              ) : (
                rangeVentas.slice(0, 4).map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-lg bg-[#181818] border border-neutral-800 text-xs flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-white truncate block">{v.product_name}</span>
                      <span className="text-[10px] text-neutral-500">
                        Cant: {v.quantity} • {v.client_name}
                      </span>
                    </div>
                    <span className="font-bold text-[#E6C875] whitespace-nowrap">
                      {formatSoles(v.total_price_cents)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
