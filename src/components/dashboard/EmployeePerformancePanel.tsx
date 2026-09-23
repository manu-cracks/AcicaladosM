import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import { EmployeePerformanceItem } from '../../types';
import { getRoleMeta } from './ColaboradoresView';
import {
  Trophy,
  Medal,
  Award,
  Crown,
  TrendingUp,
  Calendar,
  Users,
  Store,
  Globe,
  RefreshCw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  BarChart3,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

export type DatePreset = 'hoy' | 'semana' | 'quincenal' | 'mes' | 'personalizado';
export type QuincenaChoice = 'actual' | 'primera' | 'segunda';
export type SortColumn = 'rank' | 'name' | 'jobs' | 'revenue';
export type SortDirection = 'asc' | 'desc';

/**
 * Calcula fechas exactas en base al preset y zona horaria de Lima (UTC-5)
 */
export function calculateDateRange(
  preset: DatePreset,
  quincenaChoice: QuincenaChoice = 'actual',
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const [yearStr, monthStr, dayStr] = todayStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  if (preset === 'hoy') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === 'semana') {
    const todayDate = new Date(`${todayStr}T12:00:00-05:00`);
    const dayOfWeek = todayDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startDate: monday.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
      endDate: sunday.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
    };
  }

  if (preset === 'quincenal') {
    const isFirstHalf =
      quincenaChoice === 'primera'
        ? true
        : quincenaChoice === 'segunda'
        ? false
        : day <= 15;

    if (isFirstHalf) {
      return {
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-15`,
      };
    } else {
      return {
        startDate: `${year}-${pad(month)}-16`,
        endDate: `${year}-${pad(month)}-${pad(lastDayOfMonth)}`,
      };
    }
  }

  if (preset === 'mes') {
    return {
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-${pad(lastDayOfMonth)}`,
    };
  }

  if (preset === 'personalizado') {
    return {
      startDate: customStart || todayStr,
      endDate: customEnd || todayStr,
    };
  }

  return { startDate: todayStr, endDate: todayStr };
}

/** Formateador a Soles */
function formatSoles(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const EmployeePerformancePanel: React.FC = () => {
  // --- Estados de Filtro de Fechas ---
  const [preset, setPreset] = useState<DatePreset>('mes');
  const [quincenaChoice, setQuincenaChoice] = useState<QuincenaChoice>('actual');
  const todayLima = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }), []);
  const [customStart, setCustomStart] = useState<string>(todayLima);
  const [customEnd, setCustomEnd] = useState<string>(todayLima);

  // --- Datos y Estado de Carga ---
  const [rankingData, setRankingData] = useState<EmployeePerformanceItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Ordenamiento de Tabla ---
  const [sortColumn, setSortColumn] = useState<SortColumn>('jobs');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // --- Modalidad de Gráfico ---
  const [chartMetric, setChartMetric] = useState<'jobs' | 'revenue'>('jobs');

  // Calcular el rango activo
  const activeRange = useMemo(() => {
    return calculateDateRange(preset, quincenaChoice, customStart, customEnd);
  }, [preset, quincenaChoice, customStart, customEnd]);

  // Carga de datos vía RPC en Supabase
  const fetchRanking = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_employee_performance_ranking', {
        p_start_date: activeRange.startDate,
        p_end_date: activeRange.endDate,
      });

      if (error) {
        console.error('Error al obtener ranking de empleados:', error);
        setRankingData([]);
      } else {
        setRankingData((data as EmployeePerformanceItem[]) || []);
      }
    } catch (err) {
      console.error('Error en fetchRanking:', err);
      setRankingData([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeRange.startDate, activeRange.endDate]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  // Cálculos de Totales KPI
  const stats = useMemo(() => {
    if (!rankingData) return { totalJobs: 0, totalRevenueCents: 0, presencialTotal: 0, onlineTotal: 0, topEmployee: null, avgJobs: 0 };
    const totalJobs = rankingData.reduce((acc, emp) => acc + (emp.total_jobs || 0), 0);
    const totalRevenueCents = rankingData.reduce((acc, emp) => acc + (Number(emp.total_revenue_cents) || 0), 0);
    const presencialTotal = rankingData.reduce((acc, emp) => acc + (emp.presencial_jobs || 0), 0);
    const onlineTotal = rankingData.reduce((acc, emp) => acc + (emp.online_jobs || 0), 0);
    const activeStaff = rankingData.filter((e) => e.is_active);
    const avgJobs = activeStaff.length > 0 ? (totalJobs / activeStaff.length).toFixed(1) : '0';
    const topEmployee = rankingData.length > 0 && rankingData[0].total_jobs > 0 ? rankingData[0] : null;

    return {
      totalJobs,
      totalRevenueCents,
      presencialTotal,
      onlineTotal,
      topEmployee,
      avgJobs,
    };
  }, [rankingData]);

  // Podio Top 3 (primeros 3 con trabajos o los 3 mejores)
  const top3 = useMemo(() => {
    if (!rankingData) return [];
    return rankingData.slice(0, 3);
  }, [rankingData]);

  // Filtrado y ordenamiento de la tabla
  const sortedAndFilteredEmployees = useMemo(() => {
    if (!rankingData) return [];
    let list = [...rankingData];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((emp) => emp.employee_name.toLowerCase().includes(q) || emp.employee_type.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortColumn === 'name') {
        const nameA = a.employee_name || '';
        const nameB = b.employee_name || '';
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      let valA = 0;
      let valB = 0;
      if (sortColumn === 'rank' || sortColumn === 'jobs') {
        valA = a.total_jobs;
        valB = b.total_jobs;
      } else if (sortColumn === 'revenue') {
        valA = Number(a.total_revenue_cents) || 0;
        valB = Number(b.total_revenue_cents) || 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [rankingData, searchTerm, sortColumn, sortDirection]);

  // Manejo de clic en cabecera ordenable
  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  // Máximo para escala del gráfico de barras
  const maxChartValue = useMemo(() => {
    if (!rankingData || rankingData.length === 0) return 1;
    if (chartMetric === 'jobs') {
      const maxJ = Math.max(...rankingData.map((e) => e.total_jobs));
      return maxJ > 0 ? maxJ : 1;
    } else {
      const maxR = Math.max(...rankingData.map((e) => Number(e.total_revenue_cents)));
      return maxR > 0 ? maxR : 10000;
    }
  }, [rankingData, chartMetric]);

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR: FILTRO DE FECHAS & RANGOS RÁPIDOS */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="font-serif-luxury text-xl sm:text-2xl font-bold text-white tracking-wide">
                Panel de Rendimiento & Top de Especialistas
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Evaluación estricta de citas completadas y pagadas, desglose por modalidad e ingresos generados.
            </p>
          </div>

          {/* Botón Refrescar */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => fetchRanking()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] border border-neutral-700 hover:border-[#C8A45C]/50 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              title="Recargar métricas"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#C8A45C] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Botones de Presets de Rango */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-800/80">
          <span className="text-xs text-neutral-400 font-medium mr-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
            Período:
          </span>

          {(['hoy', 'semana', 'quincenal', 'mes', 'personalizado'] as DatePreset[]).map((p) => {
            const labels: Record<DatePreset, string> = {
              hoy: 'Hoy',
              semana: 'Esta Semana',
              quincenal: 'Quincenal',
              mes: 'Este Mes',
              personalizado: 'Personalizado',
            };
            const isActive = preset === p;

            return (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  isActive
                    ? 'bg-[#C8A45C] text-black border-[#C8A45C] shadow-md shadow-[#C8A45C]/20 font-bold'
                    : 'bg-[#181818] text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}

          {/* Sub-selector de Quincena (1ra vs 2da) cuando está activo 'quincenal' */}
          {preset === 'quincenal' && (
            <div className="flex items-center gap-1 bg-[#1c1c1c] border border-neutral-700/80 rounded-xl p-1 ml-0 sm:ml-2">
              <button
                onClick={() => setQuincenaChoice('primera')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  quincenaChoice === 'primera'
                    ? 'bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/50'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                1ra Quincena (1 - 15)
              </button>
              <button
                onClick={() => setQuincenaChoice('segunda')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  quincenaChoice === 'segunda'
                    ? 'bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/50'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                2da Quincena (16 - Fin)
              </button>
            </div>
          )}

          {/* Inputs de fecha para Personalizado */}
          {preset === 'personalizado' && (
            <div className="flex flex-wrap items-center gap-2 bg-[#1a1a1a] border border-neutral-700/80 rounded-xl p-1.5 ml-0 sm:ml-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>Desde:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-[#141414] border border-neutral-700 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#C8A45C]/60"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>Hasta:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-[#141414] border border-neutral-700 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#C8A45C]/60"
                />
              </div>
            </div>
          )}
        </div>

        {/* Resumen del Rango de Fechas Activo */}
        <div className="text-[11px] text-neutral-400 flex items-center gap-2 pt-1 font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-[#C8A45C]" />
          <span>
            Rango evaluado: <strong className="text-white">{activeRange.startDate}</strong> al{' '}
            <strong className="text-white">{activeRange.endDate}</strong>
          </span>
        </div>
      </div>

      {/* 2. KPIS RESUMEN SUPERIORES */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[#141414] border border-neutral-800 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Trabajos */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-4 space-y-1 transition shadow-lg">
            <span className="text-[11px] text-neutral-400 block">Total Atenciones</span>
            <div className="text-2xl font-bold font-serif-luxury text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#C8A45C]" />
              <span>{stats.totalJobs}</span>
            </div>
            <div className="text-[10px] text-neutral-400 flex items-center gap-2 pt-0.5">
              <span className="text-blue-400">{stats.presencialTotal} Presenciales</span>
              <span>•</span>
              <span className="text-purple-400">{stats.onlineTotal} En Línea</span>
            </div>
          </div>

          {/* Card 2: Ingresos Totales Generados */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-4 space-y-1 transition shadow-lg">
            <span className="text-[11px] text-neutral-400 block">Ingresos por Servicios</span>
            <div className="text-2xl font-bold font-serif-luxury text-[#E6C875] flex items-center gap-1.5">
              <span>{formatSoles(stats.totalRevenueCents)}</span>
            </div>
            <span className="text-[10px] text-neutral-500 block">Efectivamente recaudado</span>
          </div>

          {/* Card 3: Top Performer */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-4 space-y-1 transition shadow-lg">
            <span className="text-[11px] text-neutral-400 block">Líder del Período</span>
            <div className="text-base sm:text-lg font-bold font-serif-luxury text-white truncate flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#C8A45C] shrink-0" />
              <span className="truncate">{stats.topEmployee?.employee_name || 'Sin registros'}</span>
            </div>
            <span className="text-[10px] text-[#C8A45C] block">
              {stats.topEmployee ? `${stats.topEmployee.total_jobs} atenciones realizadas` : 'Esperando datos'}
            </span>
          </div>

          {/* Card 4: Promedio por Especialista */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-4 space-y-1 transition shadow-lg">
            <span className="text-[11px] text-neutral-400 block">Promedio Atenciones / Staff</span>
            <div className="text-2xl font-bold font-serif-luxury text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-neutral-400" />
              <span>{stats.avgJobs}</span>
            </div>
            <span className="text-[10px] text-neutral-500 block">Por colaborador activo</span>
          </div>
        </div>
      )}

      {/* 3. PODIO DE DESTACADOS (TOP 3) */}
      <div className="bg-[#141414] border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#C8A45C]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="font-serif-luxury text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#C8A45C]" />
              <span>Podio de Destacados (Top 3)</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Colaboradores con mayor volumen de trabajos completados en el período.
            </p>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#C8A45C] bg-[#C8A45C]/10 border border-[#C8A45C]/30 px-2.5 py-1 rounded-full">
            VIP Performance
          </span>
        </div>

        {/* Skeleton o Render del Podio */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-[#181818] border border-neutral-800 rounded-2xl" />
            ))}
          </div>
        ) : top3.length === 0 || top3.every((e) => e.total_jobs === 0) ? (
          <div className="py-12 text-center space-y-3">
            <Trophy className="w-12 h-12 text-neutral-600 mx-auto" />
            <h4 className="font-serif-luxury text-base font-bold text-neutral-300">
              No hay citas completadas en el período seleccionado
            </h4>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              Prueba cambiando el filtro de fecha a "Este Mes" o "Quincenal" para ver la actividad histórica de los colaboradores.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 items-end">
            {/* 2do Lugar (Plata) */}
            <div className="order-2 md:order-1 bg-gradient-to-b from-[#181818] to-[#121212] border border-slate-500/40 rounded-2xl p-5 text-center space-y-3 relative shadow-xl hover:border-slate-400 transition">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-400 text-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Medal className="w-3.5 h-3.5 text-slate-300" />
                <span>2° PUESTO</span>
              </div>

              {top3[1] ? (
                <>
                  <div className="pt-2 flex justify-center">
                    {top3[1].foto_url || top3[1].avatar_url ? (
                      <img
                        src={top3[1].foto_url || top3[1].avatar_url || ''}
                        alt={top3[1].employee_name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-slate-400 shadow-md ring-4 ring-slate-400/20"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-slate-400 flex items-center justify-center text-slate-200 font-bold text-xl font-serif-luxury shadow-md ring-4 ring-slate-400/20">
                        {top3[1].employee_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-serif-luxury text-base font-bold text-white leading-tight">
                      {top3[1].employee_name}
                    </h4>
                    <span className="text-[10px] uppercase font-semibold text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700/60 inline-block">
                      {top3[1].employee_type}
                    </span>
                  </div>

                  <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] text-neutral-400 block">Total Atenciones</span>
                    <span className="text-2xl font-bold font-serif-luxury text-slate-200">
                      {top3[1].total_jobs}
                    </span>
                    <div className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-800">
                      Ingresos: <strong className="text-white">{formatSoles(Number(top3[1].total_revenue_cents))}</strong>
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-3 text-[10px] text-neutral-400 font-mono">
                    <span className="flex items-center gap-1 text-blue-300">
                      <Store className="w-3 h-3" /> {top3[1].presencial_jobs}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-purple-300">
                      <Globe className="w-3 h-3" /> {top3[1].online_jobs}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-neutral-600 text-xs italic">Sin clasificar</div>
              )}
            </div>

            {/* 1er Lugar (Oro / Centro más alto) */}
            <div className="order-1 md:order-2 bg-gradient-to-b from-[#221c12] via-[#1a1710] to-[#12110c] border-2 border-[#C8A45C] rounded-2xl p-6 text-center space-y-4 relative shadow-2xl shadow-[#C8A45C]/15 -mt-2">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                <Crown className="w-4 h-4 text-black fill-current" />
                <span>1° LUGAR - CAMPEÓN</span>
              </div>

              {top3[0] && top3[0].total_jobs > 0 ? (
                <>
                  <div className="pt-3 flex justify-center">
                    {top3[0].foto_url || top3[0].avatar_url ? (
                      <img
                        src={top3[0].foto_url || top3[0].avatar_url || ''}
                        alt={top3[0].employee_name}
                        className="w-24 h-24 rounded-full object-cover border-2 border-[#C8A45C] shadow-xl ring-4 ring-[#C8A45C]/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2a2215] to-[#16120b] border-2 border-[#C8A45C] flex items-center justify-center text-[#E6C875] font-bold text-2xl font-serif-luxury shadow-xl ring-4 ring-[#C8A45C]/30">
                        {top3[0].employee_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-serif-luxury text-lg sm:text-xl font-bold text-white leading-tight flex items-center justify-center gap-1.5">
                      <span>{top3[0].employee_name}</span>
                      <Sparkles className="w-4 h-4 text-[#C8A45C]" />
                    </h4>
                    <span className="text-[10px] uppercase font-bold text-[#E6C875] bg-[#C8A45C]/20 px-2.5 py-0.5 rounded-md border border-[#C8A45C]/40 inline-block">
                      {top3[0].employee_type}
                    </span>
                  </div>

                  <div className="bg-[#181611] border border-[#C8A45C]/40 rounded-xl p-3.5 space-y-1 shadow-inner">
                    <span className="text-[11px] text-[#C8A45C] font-semibold block uppercase tracking-wider">
                      Atenciones Realizadas
                    </span>
                    <span className="text-3xl sm:text-4xl font-bold font-serif-luxury text-[#E6C875]">
                      {top3[0].total_jobs}
                    </span>
                    <div className="text-xs text-neutral-300 pt-1.5 border-t border-[#C8A45C]/20 flex items-center justify-center gap-1">
                      <span>Ingresos:</span>
                      <strong className="text-white text-sm font-mono">
                        {formatSoles(Number(top3[0].total_revenue_cents))}
                      </strong>
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-3 text-xs text-neutral-300 font-mono">
                    <span className="flex items-center gap-1 text-blue-300 font-semibold">
                      <Store className="w-3.5 h-3.5" /> Presencial: {top3[0].presencial_jobs}
                    </span>
                    <span className="text-neutral-600">•</span>
                    <span className="flex items-center gap-1 text-purple-300 font-semibold">
                      <Globe className="w-3.5 h-3.5" /> Online: {top3[0].online_jobs}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-neutral-600 text-xs italic">Sin clasificar</div>
              )}
            </div>

            {/* 3er Lugar (Bronce) */}
            <div className="order-3 bg-gradient-to-b from-[#181818] to-[#121212] border border-amber-700/40 rounded-2xl p-5 text-center space-y-3 relative shadow-xl hover:border-amber-600/60 transition">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-950 border border-amber-600 text-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>3° PUESTO</span>
              </div>

              {top3[2] ? (
                <>
                  <div className="pt-2 flex justify-center">
                    {top3[2].foto_url || top3[2].avatar_url ? (
                      <img
                        src={top3[2].foto_url || top3[2].avatar_url || ''}
                        alt={top3[2].employee_name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-amber-700 shadow-md ring-4 ring-amber-700/20"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-amber-950/40 border-2 border-amber-700 flex items-center justify-center text-amber-200 font-bold text-xl font-serif-luxury shadow-md ring-4 ring-amber-700/20">
                        {top3[2].employee_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-serif-luxury text-base font-bold text-white leading-tight">
                      {top3[2].employee_name}
                    </h4>
                    <span className="text-[10px] uppercase font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/60 inline-block">
                      {top3[2].employee_type}
                    </span>
                  </div>

                  <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] text-neutral-400 block">Total Atenciones</span>
                    <span className="text-2xl font-bold font-serif-luxury text-amber-200">
                      {top3[2].total_jobs}
                    </span>
                    <div className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-800">
                      Ingresos: <strong className="text-white">{formatSoles(Number(top3[2].total_revenue_cents))}</strong>
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-3 text-[10px] text-neutral-400 font-mono">
                    <span className="flex items-center gap-1 text-blue-300">
                      <Store className="w-3 h-3" /> {top3[2].presencial_jobs}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-purple-300">
                      <Globe className="w-3 h-3" /> {top3[2].online_jobs}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-neutral-600 text-xs italic">Sin clasificar</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. GRÁFICO COMPARATIVO DE BARRAS HORIZONTALES */}
      <div className="bg-[#141414] border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#C8A45C]" />
              <span>Gráfico Comparativo de Producción</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Eje Y: Especialistas ordenados de mayor a menor • Eje X: Cantidad de atenciones completadas
            </p>
          </div>

          {/* Toggle de Métrica en Gráfico */}
          <div className="flex items-center gap-1 bg-[#181818] border border-neutral-800 rounded-xl p-1 self-start sm:self-auto">
            <button
              onClick={() => setChartMetric('jobs')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                chartMetric === 'jobs'
                  ? 'bg-[#C8A45C] text-black font-bold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Por Trabajos
            </button>
            <button
              onClick={() => setChartMetric('revenue')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                chartMetric === 'revenue'
                  ? 'bg-[#C8A45C] text-black font-bold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Por Ingresos (S/)
            </button>
          </div>
        </div>

        {/* Renderizado del Gráfico de Barras Horizontales */}
        {isLoading ? (
          <div className="space-y-4 py-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 bg-neutral-800 rounded w-1/4" />
                <div className="h-8 bg-neutral-900 border border-neutral-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : rankingData?.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500 italic">
            No hay colaboradores registrados.
          </div>
        ) : (
          <div className="space-y-3.5 pt-2">
            {rankingData?.map((emp, index) => {
              const currentValue = chartMetric === 'jobs' ? emp.total_jobs : Number(emp.total_revenue_cents);
              const percentage = maxChartValue > 0 ? Math.min(100, Math.max(0, (currentValue / maxChartValue) * 100)) : 0;
              const roleMeta = getRoleMeta(emp.employee_type);

              return (
                <div key={emp.employee_id} className="space-y-1.5 group">
                  {/* Etiqueta Superior de la Barra (Eje Y: Nombre & Rol) */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center font-mono font-bold text-neutral-500 group-hover:text-[#C8A45C] transition">
                        #{index + 1}
                      </span>
                      {emp.foto_url || emp.avatar_url ? (
                        <img
                          src={emp.foto_url || emp.avatar_url || ''}
                          alt={emp.employee_name}
                          className="w-5 h-5 rounded-full object-cover border border-[#C8A45C]/40"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-neutral-800 text-[9px] text-[#C8A45C] flex items-center justify-center font-bold">
                          {emp.employee_name.charAt(0)}
                        </div>
                      )}
                      <span className="font-semibold text-neutral-200 group-hover:text-white transition">
                        {emp.employee_name}
                      </span>
                      <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded border ${roleMeta.colorClasses.badge}`}>
                        {roleMeta.badgeLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {emp.presencial_jobs} P / {emp.online_jobs} L
                      </span>
                      <span className="font-mono font-bold text-white text-xs">
                        {chartMetric === 'jobs' ? `${emp.total_jobs} trabajos` : formatSoles(Number(emp.total_revenue_cents))}
                      </span>
                    </div>
                  </div>

                  {/* Barra Horizontal Interactiva */}
                  <div className="w-full h-7 bg-[#1a1a1a] border border-neutral-800/80 rounded-xl overflow-hidden p-0.5 relative flex items-center">
                    {/* Grilla discontinua de fondo */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none px-2 opacity-15">
                      <div className="border-r border-neutral-500 h-full" />
                      <div className="border-r border-neutral-500 h-full" />
                      <div className="border-r border-neutral-500 h-full" />
                      <div className="border-r border-neutral-500 h-full" />
                    </div>

                    {/* Barra Animada */}
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-[#C8A45C] via-[#E6C875] to-[#D4AF37] transition-all duration-700 flex items-center justify-end pr-2 text-black text-[10px] font-bold shadow-md shadow-[#C8A45C]/10 min-w-0"
                      style={{ width: `${Math.max(percentage, currentValue > 0 ? 4 : 0)}%` }}
                    >
                      {percentage > 15 && (
                        <span className="truncate drop-shadow-sm">
                          {chartMetric === 'jobs' ? `${emp.total_jobs} trab.` : formatSoles(Number(emp.total_revenue_cents))}
                        </span>
                      )}
                    </div>

                    {currentValue === 0 && (
                      <span className="text-[10px] text-neutral-600 pl-2 italic">Sin actividad</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Escala Inferior del Eje X */}
            <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono pt-2 border-t border-neutral-800/60 px-1">
              <span>0</span>
              <span>{chartMetric === 'jobs' ? Math.round(maxChartValue * 0.25) : formatSoles(Math.round(maxChartValue * 0.25))}</span>
              <span>{chartMetric === 'jobs' ? Math.round(maxChartValue * 0.5) : formatSoles(Math.round(maxChartValue * 0.5))}</span>
              <span>{chartMetric === 'jobs' ? Math.round(maxChartValue * 0.75) : formatSoles(Math.round(maxChartValue * 0.75))}</span>
              <span className="text-[#C8A45C] font-bold">
                {chartMetric === 'jobs' ? `${maxChartValue} (Máx)` : formatSoles(maxChartValue)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. TABLA DINÁMICA DE DETALLE CON CABECERAS ORDENABLES */}
      <div className="bg-[#141414] border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-[#C8A45C]" />
              <span>Detalle de Rendimiento por Especialista</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Haz clic en las cabeceras para ordenar por posición, nombre, trabajos o ingresos.
            </p>
          </div>

          {/* Buscador dentro de la tabla */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar especialista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:border-[#C8A45C]/50 transition"
            />
          </div>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="space-y-2 py-2 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-neutral-900 border border-neutral-800 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 text-[11px] uppercase tracking-wider select-none">
                  <th
                    onClick={() => handleSort('rank')}
                    className="py-3 px-3 cursor-pointer hover:text-white transition font-medium w-16"
                  >
                    <div className="flex items-center gap-1">
                      <span># Pos.</span>
                      {sortColumn === 'rank' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C8A45C]" /> : <ArrowDown className="w-3 h-3 text-[#C8A45C]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('name')}
                    className="py-3 px-3 cursor-pointer hover:text-white transition font-medium"
                  >
                    <div className="flex items-center gap-1">
                      <span>Especialista</span>
                      {sortColumn === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C8A45C]" /> : <ArrowDown className="w-3 h-3 text-[#C8A45C]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-3 font-medium">Área / Rol</th>

                  <th
                    onClick={() => handleSort('jobs')}
                    className="py-3 px-3 cursor-pointer hover:text-white transition font-medium text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Trabajos</span>
                      {sortColumn === 'jobs' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C8A45C]" /> : <ArrowDown className="w-3 h-3 text-[#C8A45C]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-3 font-medium text-center">Modalidad (Presencial / En Línea)</th>

                  <th
                    onClick={() => handleSort('revenue')}
                    className="py-3 px-3 cursor-pointer hover:text-white transition font-medium text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Ingresos (S/)</span>
                      {sortColumn === 'revenue' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C8A45C]" /> : <ArrowDown className="w-3 h-3 text-[#C8A45C]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-3 font-medium text-right">% Cuota</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-800/60">
                {sortedAndFilteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500 italic">
                      No se encontraron resultados para la búsqueda.
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredEmployees.map((emp, index) => {
                    const roleMeta = getRoleMeta(emp.employee_type);
                    const RoleIcon = roleMeta.icon;
                    const pctOfTotal = stats.totalJobs > 0 ? ((emp.total_jobs / stats.totalJobs) * 100).toFixed(1) : '0';

                    return (
                      <tr
                        key={emp.employee_id}
                        className="hover:bg-neutral-900/60 transition group"
                      >
                        {/* Posición */}
                        <td className="py-3.5 px-3 font-mono font-bold">
                          {index === 0 ? (
                            <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black flex items-center justify-center text-xs shadow">
                              1
                            </span>
                          ) : index === 1 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-400 text-black flex items-center justify-center text-xs shadow">
                              2
                            </span>
                          ) : index === 2 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs shadow">
                              3
                            </span>
                          ) : (
                            <span className="text-neutral-500 pl-1.5">#{index + 1}</span>
                          )}
                        </td>

                        {/* Especialista con Foto */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
                            {emp.foto_url || emp.avatar_url ? (
                              <img
                                src={emp.foto_url || emp.avatar_url || ''}
                                alt={emp.employee_name}
                                className="w-9 h-9 rounded-xl object-cover border border-[#C8A45C]/40 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-[#C8A45C]/30 flex items-center justify-center text-[#E6C875] font-bold text-xs shrink-0">
                                {emp.employee_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                            )}

                            <div>
                              <span className="font-semibold text-white block group-hover:text-[#E6C875] transition">
                                {emp.employee_name}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                ID: {emp.employee_id.substring(0, 8).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Área / Rol */}
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${roleMeta.colorClasses.badge}`}>
                            <RoleIcon className="w-3 h-3" />
                            <span>{roleMeta.badgeLabel}</span>
                          </span>
                        </td>

                        {/* Total Trabajos */}
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-sm text-white">
                          {emp.total_jobs}
                        </td>

                        {/* Modalidad: Presencial vs En Línea */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded-lg bg-blue-950/40 border border-blue-800/50 text-blue-300 text-[10px] font-semibold flex items-center gap-1"
                              title="Citas registradas presencialmente en recepción"
                            >
                              <Store className="w-3 h-3 text-blue-400" />
                              <span>{emp.presencial_jobs} Presencial</span>
                            </span>

                            <span
                              className="px-2 py-0.5 rounded-lg bg-purple-950/40 border border-purple-800/50 text-purple-300 text-[10px] font-semibold flex items-center gap-1"
                              title="Citas agendadas por la web pública"
                            >
                              <Globe className="w-3 h-3 text-purple-400" />
                              <span>{emp.online_jobs} En Línea</span>
                            </span>
                          </div>
                        </td>

                        {/* Ingresos Generados (S/) */}
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-sm text-[#E6C875]">
                          {formatSoles(Number(emp.total_revenue_cents))}
                        </td>

                        {/* % Cuota */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-mono text-[11px] text-neutral-400">
                            <span>{pctOfTotal}%</span>
                            <div className="w-12 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#C8A45C] rounded-full"
                                style={{ width: `${pctOfTotal}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
