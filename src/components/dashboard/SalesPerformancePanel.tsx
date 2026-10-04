import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles, VentaMostrador, Employee } from '../../types';
import { supabase } from '../../lib/supabase/client';
import {
  Trophy,
  Crown,
  Medal,
  Award,
  Calendar,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Store,
  Users,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Sparkles,
  BarChart3,
  UserCheck,
} from 'lucide-react';

export type SalesDatePreset = 'hoy' | 'semana' | 'quincenal' | 'mes' | 'todos' | 'personalizado';
export type QuincenaChoice = 'actual' | 'primera' | 'segunda';

/**
 * Calcula fechas exactas en base al preset y zona horaria de Lima (UTC-5)
 */
export function calculateSalesDateRange(
  preset: SalesDatePreset,
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

  if (preset === 'todos') {
    return {
      startDate: '2020-01-01',
      endDate: `${year + 1}-12-31`,
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

export interface SellerPerformanceStat {
  employeeId?: string;
  name: string;
  firstName: string;
  avatarUrl?: string;
  employeeType: string;
  isActive: boolean;
  totalRevenueCents: number;
  operationsCount: number;
  totalItemsCount: number;
  averageTicketCents: number;
  percentageOfTeam: number;
}

export const SalesPerformancePanel: React.FC = () => {
  const { employees, ventasMostrador, lastSyncTimestamp } = useApp();

  // Estados de Filtro de Fechas
  const [preset, setPreset] = useState<SalesDatePreset>('mes');
  const [quincenaChoice, setQuincenaChoice] = useState<QuincenaChoice>('actual');
  const todayLima = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }), []);
  const [customStart, setCustomStart] = useState<string>(todayLima);
  const [customEnd, setCustomEnd] = useState<string>(todayLima);

  // Estados de datos
  const [salesData, setSalesData] = useState<VentaMostrador[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'revenue' | 'operations' | 'name'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Calcular rango activo
  const dateRange = useMemo(() => {
    return calculateSalesDateRange(preset, quincenaChoice, customStart, customEnd);
  }, [preset, quincenaChoice, customStart, customEnd]);

  // Carga de ventas de Supabase según el rango
  const fetchSalesForRange = useCallback(async () => {
    setIsLoading(true);
    try {
      const startOfDay = `${dateRange.startDate}T00:00:00-05:00`;
      const endOfDay = `${dateRange.endDate}T23:59:59.999-05:00`;

      let query = supabase
        .from('ventas_mostrador')
        .select('*')
        .gte('fecha', startOfDay)
        .lte('fecha', endOfDay)
        .order('fecha', { ascending: false });

      const { data, error } = await query;
      if (!error && data) {
        const mapped: VentaMostrador[] = data.map((v: any) => ({
          id: v.id,
          ticket_number: v.ticket_number || `TK-${v.id.substring(0, 5).toUpperCase()}`,
          client_name: v.cliente_nombre,
          product_name: v.producto_nombre,
          quantity: v.cantidad,
          unit_price_cents: Math.round(Number(v.precio_unitario) * 100),
          total_price_cents: Math.round(Number(v.total) * 100),
          subtotal: v.subtotal != null ? Number(v.subtotal) : undefined,
          subtotal_cents: v.subtotal != null ? Math.round(Number(v.subtotal) * 100) : undefined,
          monto_descuento: v.monto_descuento != null ? Number(v.monto_descuento) : 0,
          discount_cents: v.monto_descuento != null ? Math.round(Number(v.monto_descuento) * 100) : 0,
          detalles_items: Array.isArray(v.detalles_items)
            ? v.detalles_items
            : typeof v.detalles_items === 'string'
            ? (() => {
                try {
                  return JSON.parse(v.detalles_items);
                } catch {
                  return undefined;
                }
              })()
            : undefined,
          payment_method: v.metodo_pago?.toLowerCase() === 'mixto' ? 'MIXTO' : (v.metodo_pago?.toLowerCase() || 'efectivo') as any,
          notes: v.notas || undefined,
          created_at: v.fecha || v.created_at,
          vendedor_nombre: v.vendedor_nombre || 'Recepcionista',
          vendedor_id: v.vendedor_id || undefined,
          vendedor: v.vendedor_nombre || 'Recepcionista',
        }));
        setSalesData(mapped);
      } else {
        // Fallback a memoria
        const filtered = ventasMostrador.filter((v) => {
          const dateStr = v.created_at ? v.created_at.substring(0, 10) : '';
          return dateStr >= dateRange.startDate && dateStr <= dateRange.endDate;
        });
        setSalesData(filtered);
      }
    } catch (err) {
      console.error('[SalesPerformancePanel] Error al consultar ventas:', err);
      const filtered = ventasMostrador.filter((v) => {
        const dateStr = v.created_at ? v.created_at.substring(0, 10) : '';
        return dateStr >= dateRange.startDate && dateStr <= dateRange.endDate;
      });
      setSalesData(filtered);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, ventasMostrador]);

  useEffect(() => {
    fetchSalesForRange();
  }, [fetchSalesForRange, lastSyncTimestamp]);

  /**
   * Helper para verificar si un vendedor es "Recepción" o "Recepcionista"
   */
  const isDirectStoreSale = (name?: string | null): boolean => {
    if (!name) return true;
    const clean = name.trim().toLowerCase();
    return (
      clean === 'recepcionista' ||
      clean === 'recepción' ||
      clean === 'recepcion' ||
      clean === 'tienda' ||
      clean === 'caja' ||
      clean === 'mostrador'
    );
  };

  /**
   * Agrupación y cálculo matemático estricto por monto recaudado (S/)
   */
  const {
    sellerRanking,
    directStoreStats,
    totalGeneralCents,
    totalTeamCents,
    totalOperationsGeneral,
  } = useMemo(() => {
    let generalRevenueCents = 0;
    let generalOps = salesData.length;

    // Métricas para Ventas Directas de Tienda (Recepción)
    let receptionRevenueCents = 0;
    let receptionOps = 0;
    let receptionItems = 0;

    // Mapa de colaboradores: key = employeeId (o normalizado nombre)
    const sellerMap = new Map<string, {
      employeeId?: string;
      name: string;
      firstName: string;
      avatarUrl?: string;
      employeeType: string;
      isActive: boolean;
      totalRevenueCents: number;
      operationsCount: number;
      totalItemsCount: number;
    }>();

    // Inicializar mapa con empleados activos del sistema
    (employees || []).forEach((emp) => {
      if (emp.active && !isDirectStoreSale(emp.full_name)) {
        sellerMap.set(emp.id, {
          employeeId: emp.id,
          name: emp.full_name,
          firstName: emp.first_name || emp.full_name.split(' ')[0],
          avatarUrl: emp.foto_url || emp.avatar_url || emp.avatar,
          employeeType: emp.type || 'Especialista',
          isActive: emp.active,
          totalRevenueCents: 0,
          operationsCount: 0,
          totalItemsCount: 0,
        });
      }
    });

    // Procesar cada venta
    salesData.forEach((sale) => {
      const saleRevenue = sale.total_price_cents || 0;
      generalRevenueCents += saleRevenue;

      // Verificar si la venta tiene desglose de ítems con distintos vendedores
      const items = Array.isArray(sale.detalles_items) && sale.detalles_items.length > 0
        ? sale.detalles_items
        : null;

      if (items && items.length > 0) {
        // Atribuir por cada ítem individualmente
        // Para no duplicar operaciones, agrupamos vendedores que participaron en esta venta
        const participantsInSale = new Set<string>();

        items.forEach((item: any) => {
          const itemSellerName = item.seller_name || item.vendedor || item.vendedor_nombre || sale.vendedor_nombre || 'Recepcionista';
          const itemEmpId = item.employee_id || item.vendedor_id || sale.vendedor_id;
          const qty = Number(item.quantity) || 1;
          const unitPrice = Number(item.unit_price) || 0;
          const itemTotalCents = Math.round(Number(item.total != null ? item.total : qty * unitPrice) * 100);

          if (isDirectStoreSale(itemSellerName)) {
            receptionRevenueCents += itemTotalCents;
            receptionItems += qty;
            participantsInSale.add('RECEPTION');
          } else {
            // Buscar en mapa por ID o por coincidencia de nombre
            let targetKey = itemEmpId && sellerMap.has(itemEmpId) ? itemEmpId : null;
            if (!targetKey) {
              for (const [id, entry] of sellerMap.entries()) {
                if (entry.name.toLowerCase() === itemSellerName.toLowerCase() || entry.firstName.toLowerCase() === itemSellerName.toLowerCase().split(' ')[0]) {
                  targetKey = id;
                  break;
                }
              }
            }

            if (targetKey) {
              const current = sellerMap.get(targetKey)!;
              current.totalRevenueCents += itemTotalCents;
              current.totalItemsCount += qty;
              participantsInSale.add(targetKey);
            } else {
              // Colaborador no encontrado en el directorio activo pero registrado en la venta
              const newKey = `ext-${itemSellerName}`;
              sellerMap.set(newKey, {
                name: itemSellerName,
                firstName: itemSellerName.split(' ')[0],
                employeeType: 'Especialista',
                isActive: true,
                totalRevenueCents: itemTotalCents,
                operationsCount: 0,
                totalItemsCount: qty,
              });
              participantsInSale.add(newKey);
            }
          }
        });

        // Contabilizar una operación para cada vendedor que participó en este ticket
        participantsInSale.forEach((key) => {
          if (key === 'RECEPTION') {
            receptionOps += 1;
          } else if (sellerMap.has(key)) {
            sellerMap.get(key)!.operationsCount += 1;
          }
        });
      } else {
        // Venta sin desglose múltiple de ítems: atribuir completamente a la cabecera
        const sellerName = sale.vendedor_nombre || sale.vendedor || 'Recepcionista';
        const sellerId = sale.vendedor_id;
        const totalQty = sale.quantity || 1;

        if (isDirectStoreSale(sellerName)) {
          receptionRevenueCents += saleRevenue;
          receptionOps += 1;
          receptionItems += totalQty;
        } else {
          let targetKey = sellerId && sellerMap.has(sellerId) ? sellerId : null;
          if (!targetKey) {
            for (const [id, entry] of sellerMap.entries()) {
              if (entry.name.toLowerCase() === sellerName.toLowerCase() || entry.firstName.toLowerCase() === sellerName.toLowerCase().split(' ')[0]) {
                targetKey = id;
                break;
              }
            }
          }

          if (targetKey) {
            const current = sellerMap.get(targetKey)!;
            current.totalRevenueCents += saleRevenue;
            current.operationsCount += 1;
            current.totalItemsCount += totalQty;
          } else {
            const newKey = `ext-${sellerName}`;
            sellerMap.set(newKey, {
              name: sellerName,
              firstName: sellerName.split(' ')[0],
              employeeType: 'Especialista',
              isActive: true,
              totalRevenueCents: saleRevenue,
              operationsCount: 1,
              totalItemsCount: totalQty,
            });
          }
        }
      }
    });

    // Calcular suma total recaudada por el equipo de colaboradores
    const teamRevenue = Array.from(sellerMap.values()).reduce((sum, s) => sum + s.totalRevenueCents, 0);

    // Convertir a lista y calcular métricas derivadas (promedios y porcentajes)
    const list: SellerPerformanceStat[] = Array.from(sellerMap.values()).map((s) => ({
      ...s,
      averageTicketCents: s.operationsCount > 0 ? Math.round(s.totalRevenueCents / s.operationsCount) : 0,
      percentageOfTeam: teamRevenue > 0 ? Math.round((s.totalRevenueCents / teamRevenue) * 100) : 0,
    }));

    // REGLA MATEMÁTICA ESTRICTA:
    // El orden base del ranking DEBE ser EXCLUSIVAMENTE por totalRevenueCents descendente
    list.sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);

    return {
      sellerRanking: list,
      directStoreStats: {
        totalRevenueCents: receptionRevenueCents,
        operationsCount: receptionOps,
        totalItemsCount: receptionItems,
        averageTicketCents: receptionOps > 0 ? Math.round(receptionRevenueCents / receptionOps) : 0,
        percentageOfTotal: generalRevenueCents > 0 ? Math.round((receptionRevenueCents / generalRevenueCents) * 100) : 0,
      },
      totalGeneralCents: generalRevenueCents,
      totalTeamCents: teamRevenue,
      totalOperationsGeneral: generalOps,
    };
  }, [salesData, employees]);

  // Lista ordenada y filtrada para la tabla
  const displayedRanking = useMemo(() => {
    let result = [...sellerRanking];

    // Búsqueda por texto
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.firstName.toLowerCase().includes(q) ||
          s.employeeType.toLowerCase().includes(q)
      );
    }

    // Ordenamiento interactivo si el usuario hace clic en columnas
    result.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'revenue') {
        diff = a.totalRevenueCents - b.totalRevenueCents;
      } else if (sortBy === 'operations') {
        diff = a.operationsCount - b.operationsCount;
      } else if (sortBy === 'name') {
        return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      return sortDirection === 'asc' ? diff : -diff;
    });

    return result;
  }, [sellerRanking, searchTerm, sortBy, sortDirection]);

  // Podio de los 3 mejores (Top 3) según recaudación en Soles
  const top3 = useMemo(() => {
    const withRevenue = sellerRanking.filter((s) => s.totalRevenueCents > 0);
    return [withRevenue[0] || null, withRevenue[1] || null, withRevenue[2] || null];
  }, [sellerRanking]);

  // Máximo para escala del gráfico de barras
  const maxRevenueValue = useMemo(() => {
    if (sellerRanking.length === 0) return 10000;
    const maxVal = Math.max(...sellerRanking.map((s) => s.totalRevenueCents));
    return maxVal > 0 ? maxVal : 10000;
  }, [sellerRanking]);

  const handleSortChange = (column: 'revenue' | 'operations' | 'name') => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. BARRA SUPERIOR: FILTRO DE FECHAS & RESUMEN DE RANGO */}
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#C8A45C]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875] shadow-inner">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif-luxury text-xl sm:text-2xl font-bold text-white tracking-wide">
                    Rendimiento de Vendedores
                  </h2>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40">
                    Métricas Económicas
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Ranking ordenado estrictamente por <strong className="text-[#E6C875]">monto total recaudado (S/)</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto">
            <button
              onClick={() => fetchSalesForRange()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] border border-neutral-700 hover:border-[#C8A45C]/50 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow"
              title="Actualizar métricas"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#C8A45C] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Botones de Presets de Rango */}
        <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-neutral-800/80">
          <span className="text-xs text-neutral-400 font-medium mr-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
            Período:
          </span>

          {(['hoy', 'semana', 'quincenal', 'mes', 'todos', 'personalizado'] as SalesDatePreset[]).map((p) => {
            const labels: Record<SalesDatePreset, string> = {
              hoy: 'Hoy',
              semana: 'Esta Semana',
              quincenal: 'Quincenal',
              mes: 'Este Mes',
              todos: 'Histórico Completo',
              personalizado: 'Personalizado',
            };
            const isActive = preset === p;

            return (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  isActive
                    ? 'bg-[#C8A45C] text-black border-[#C8A45C] font-bold shadow-md shadow-[#C8A45C]/20'
                    : 'bg-[#181818] text-neutral-400 hover:text-white border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* Selector de Quincena (si quincenal está seleccionado) */}
        {preset === 'quincenal' && (
          <div className="flex items-center gap-2 pt-2 animate-in fade-in duration-150">
            <span className="text-[11px] text-neutral-500 font-medium">Tramo quincenal:</span>
            {(['actual', 'primera', 'segunda'] as QuincenaChoice[]).map((q) => {
              const qLabels: Record<QuincenaChoice, string> = {
                actual: 'Quincena en Curso',
                primera: '1ra Quincena (1 al 15)',
                segunda: '2da Quincena (16 a fin de mes)',
              };
              const isQActive = quincenaChoice === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuincenaChoice(q)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    isQActive
                      ? 'bg-[#C8A45C]/20 text-[#E6C875] border-[#C8A45C]/50 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  {qLabels[q]}
                </button>
              );
            })}
          </div>
        )}

        {/* Rango de Fechas Personalizado */}
        {preset === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 bg-[#181818] border border-neutral-800 rounded-xl px-3 py-1.5">
              <span className="text-[11px] text-neutral-400">Desde:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#181818] border border-neutral-800 rounded-xl px-3 py-1.5">
              <span className="text-[11px] text-neutral-400">Hasta:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. TARJETAS DE MÉTRICAS GLOBALES (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Recaudado en Tienda */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-5 space-y-2 relative overflow-hidden shadow-lg group hover:border-[#C8A45C]/40 transition">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Recaudado</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-[#E6C875]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#E6C875] tracking-tight">
            {formatSoles(totalGeneralCents)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
            <span>{totalOperationsGeneral} operaciones</span>
            <span className="font-mono text-neutral-500">100% de caja</span>
          </div>
        </div>

        {/* KPI 2: Ventas por Colaboradores / Especialistas */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-5 space-y-2 relative overflow-hidden shadow-lg group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Ventas por Especialistas</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {formatSoles(totalTeamCents)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
            <span className="text-emerald-400 font-semibold">
              {totalGeneralCents > 0 ? Math.round((totalTeamCents / totalGeneralCents) * 100) : 0}% del total
            </span>
            <span className="font-mono text-neutral-500">Atribuido a personal</span>
          </div>
        </div>

        {/* KPI 3: Ventas Directas de Tienda (Recepción) */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-5 space-y-2 relative overflow-hidden shadow-lg group hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider">Ventas Directas de Tienda</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="font-serif-luxury text-2xl sm:text-3xl font-bold text-blue-200 tracking-tight">
            {formatSoles(directStoreStats.totalRevenueCents)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
            <span className="text-blue-300 font-medium">Recepción ({directStoreStats.operationsCount} ops)</span>
            <span className="font-mono text-neutral-500">{directStoreStats.percentageOfTotal}% tienda</span>
          </div>
        </div>

        {/* KPI 4: Vendedor Top 1 del Periodo */}
        <div className="bg-gradient-to-br from-[#1c1810] to-[#141414] border border-[#C8A45C]/40 rounded-2xl p-5 space-y-2 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-wider text-[#E6C875]">Top 1 Vendedor</span>
            <div className="p-2 rounded-xl bg-[#C8A45C]/20 text-[#E6C875]">
              <Crown className="w-4 h-4 fill-current" />
            </div>
          </div>
          {top3[0] && top3[0].totalRevenueCents > 0 ? (
            <>
              <div className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#E6C875] truncate">
                {top3[0].name}
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-300 pt-1 border-t border-[#C8A45C]/20">
                <span className="font-bold text-white font-mono">{formatSoles(top3[0].totalRevenueCents)}</span>
                <span className="text-[10px] text-amber-300 font-mono">
                  {top3[0].operationsCount} ventas ({top3[0].percentageOfTeam}% del equipo)
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-neutral-500 italic py-1">Sin ventas en el período</div>
              <div className="text-[11px] text-neutral-600 pt-1 border-t border-neutral-800">0 operaciones</div>
            </>
          )}
        </div>
      </div>

      {/* 3. PODIO DE HONOR: TOP 3 VENDEDORES (ESTRICTO POR MONTO S/) */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#C8A45C]" />
              <span>Podio de Rendimiento Económico</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Reconocimiento a los 3 colaboradores con mayor recaudación acumulada en ventas de mostrador.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
          {/* 2do Lugar (Plata) */}
          <div className="order-2 md:order-1 bg-gradient-to-b from-[#181818] to-[#121212] border border-slate-600/40 rounded-2xl p-5 text-center space-y-3 relative shadow-xl hover:border-slate-400/60 transition">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-400 text-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
              <Medal className="w-3.5 h-3.5 text-slate-300" />
              <span>2° PUESTO</span>
            </div>

            {top3[1] && top3[1].totalRevenueCents > 0 ? (
              <>
                <div className="pt-2 flex justify-center">
                  {top3[1].avatarUrl ? (
                    <img
                      src={top3[1].avatarUrl}
                      alt={top3[1].name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-slate-400 shadow-md ring-4 ring-slate-400/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-slate-200 font-bold text-xl font-serif-luxury shadow-md ring-4 ring-slate-400/20">
                      {top3[1].firstName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="font-serif-luxury text-base font-bold text-white leading-tight">
                    {top3[1].name}
                  </h4>
                  <span className="text-[10px] uppercase font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700 inline-block">
                    {top3[1].employeeType}
                  </span>
                </div>

                <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] text-neutral-400 block uppercase tracking-wider">Total Recaudado</span>
                  <span className="text-2xl font-bold font-serif-luxury text-[#E6C875] font-mono">
                    {formatSoles(top3[1].totalRevenueCents)}
                  </span>
                  <div className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-800 flex items-center justify-between">
                    <span>{top3[1].operationsCount} operaciones</span>
                    <span className="font-mono text-slate-300">{top3[1].percentageOfTeam}% equipo</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-neutral-600 text-xs italic">Sin clasificar</div>
            )}
          </div>

          {/* 1er Lugar (Oro / Campeón Económico) */}
          <div className="order-1 md:order-2 bg-gradient-to-b from-[#221c12] via-[#1a1710] to-[#12110c] border-2 border-[#C8A45C] rounded-2xl p-6 text-center space-y-4 relative shadow-2xl shadow-[#C8A45C]/15 -mt-3">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
              <Crown className="w-4 h-4 text-black fill-current" />
              <span>1° LUGAR - LÍDER DE VENTAS</span>
            </div>

            {top3[0] && top3[0].totalRevenueCents > 0 ? (
              <>
                <div className="pt-3 flex justify-center">
                  {top3[0].avatarUrl ? (
                    <img
                      src={top3[0].avatarUrl}
                      alt={top3[0].name}
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#C8A45C] shadow-xl ring-4 ring-[#C8A45C]/30"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2a2215] to-[#16120b] border-2 border-[#C8A45C] flex items-center justify-center text-[#E6C875] font-bold text-2xl font-serif-luxury shadow-xl ring-4 ring-[#C8A45C]/30">
                      {top3[0].firstName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="font-serif-luxury text-lg sm:text-xl font-bold text-white leading-tight flex items-center justify-center gap-1.5">
                    <span>{top3[0].name}</span>
                    <Sparkles className="w-4 h-4 text-[#C8A45C]" />
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-[#E6C875] bg-[#C8A45C]/20 px-2.5 py-0.5 rounded-md border border-[#C8A45C]/40 inline-block">
                    {top3[0].employeeType}
                  </span>
                </div>

                <div className="bg-[#181611] border border-[#C8A45C]/40 rounded-xl p-4 space-y-1.5 shadow-inner">
                  <span className="text-[11px] text-[#C8A45C] font-semibold block uppercase tracking-wider">
                    Total Recaudado en Mostrador
                  </span>
                  <span className="text-3xl sm:text-4xl font-bold font-serif-luxury text-[#E6C875] font-mono">
                    {formatSoles(top3[0].totalRevenueCents)}
                  </span>
                  <div className="text-xs text-neutral-300 pt-1.5 border-t border-[#C8A45C]/20 flex items-center justify-between">
                    <span>{top3[0].operationsCount} operaciones cerradas</span>
                    <span className="font-bold text-[#E6C875]">{top3[0].percentageOfTeam}% del equipo</span>
                  </div>
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

            {top3[2] && top3[2].totalRevenueCents > 0 ? (
              <>
                <div className="pt-2 flex justify-center">
                  {top3[2].avatarUrl ? (
                    <img
                      src={top3[2].avatarUrl}
                      alt={top3[2].name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-amber-700 shadow-md ring-4 ring-amber-700/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-amber-950/40 border-2 border-amber-700 flex items-center justify-center text-amber-200 font-bold text-xl font-serif-luxury shadow-md ring-4 ring-amber-700/20">
                      {top3[2].firstName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="font-serif-luxury text-base font-bold text-white leading-tight">
                    {top3[2].name}
                  </h4>
                  <span className="text-[10px] uppercase font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/60 inline-block">
                    {top3[2].employeeType}
                  </span>
                </div>

                <div className="bg-[#1c1c1c] border border-neutral-800 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] text-neutral-400 block uppercase tracking-wider">Total Recaudado</span>
                  <span className="text-2xl font-bold font-serif-luxury text-[#E6C875] font-mono">
                    {formatSoles(top3[2].totalRevenueCents)}
                  </span>
                  <div className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-800 flex items-center justify-between">
                    <span>{top3[2].operationsCount} operaciones</span>
                    <span className="font-mono text-amber-300">{top3[2].percentageOfTeam}% equipo</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-neutral-600 text-xs italic">Sin clasificar</div>
            )}
          </div>
        </div>
      </div>

      {/* 4. GRÁFICO DE BARRAS DESCENDENTE: RANKING POR MONTO RECAUDADO (S/) */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#C8A45C]" />
              <span>Comparativa Gráfica de Recaudación (S/)</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Diferenciación visual proporcional según ingresos generados en caja.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {sellerRanking.filter((s) => s.totalRevenueCents > 0).length > 0 ? (
            sellerRanking
              .filter((s) => s.totalRevenueCents > 0)
              .map((seller, idx) => {
                const percentageOfMax = Math.round((seller.totalRevenueCents / maxRevenueValue) * 100);

                return (
                  <div key={seller.employeeId || seller.name} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 text-center font-bold font-mono text-[11px] ${
                          idx === 0 ? 'text-[#E6C875]' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-400' : 'text-neutral-500'
                        }`}>
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-white group-hover:text-[#E6C875] transition-colors">
                          {seller.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          ({seller.operationsCount} {seller.operationsCount === 1 ? 'operación' : 'operaciones'})
                        </span>
                      </div>
                      <span className="font-bold text-[#E6C875] font-mono text-sm">
                        {formatSoles(seller.totalRevenueCents)}
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="h-3 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#E6C875] shadow-sm shadow-[#C8A45C]/30'
                            : idx === 1
                            ? 'bg-gradient-to-r from-slate-400 to-slate-200'
                            : idx === 2
                            ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                            : 'bg-neutral-600'
                        }`}
                        style={{ width: `${Math.max(percentageOfMax, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
          ) : (
            <div className="py-12 text-center text-neutral-500 text-xs">
              No hay ventas asignadas a colaboradores en este período.
            </div>
          )}
        </div>
      </div>

      {/* 5. TABLA COMPLETA DE DETALLE POR VENDEDOR */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#C8A45C]" />
              <span>Tabla de Posiciones y Rendimiento</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Desglose detallado por colaborador con ticket promedio y porcentaje de aporte.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-xs text-white rounded-xl pl-8 pr-3 py-2 outline-none transition placeholder:text-neutral-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181818] text-neutral-400 font-semibold border-b border-neutral-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-14 text-center">Rank</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSortChange('name')}>
                  <div className="flex items-center gap-1.5">
                    <span>Colaborador / Especialista</span>
                    {sortBy === 'name' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C8A45C]" /> : <ArrowDown className="w-3 h-3 text-[#C8A45C]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-[#E6C875]" onClick={() => handleSortChange('revenue')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total Recaudado (S/)</span>
                    {sortBy === 'revenue' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C8A45C]" /> : <ArrowDown className="w-3 h-3 text-[#C8A45C]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-center cursor-pointer hover:text-white" onClick={() => handleSortChange('operations')}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Operaciones</span>
                    {sortBy === 'operations' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C8A45C]" /> : <ArrowDown className="w-3 h-3 text-[#C8A45C]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Ticket Promedio</th>
                <th className="py-3 px-4 text-right">% Aporte Equipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {displayedRanking.length > 0 ? (
                displayedRanking.map((seller, idx) => {
                  const isTop1 = idx === 0 && seller.totalRevenueCents > 0;
                  const isTop2 = idx === 1 && seller.totalRevenueCents > 0;
                  const isTop3 = idx === 2 && seller.totalRevenueCents > 0;

                  return (
                    <tr
                      key={seller.employeeId || seller.name}
                      className={`hover:bg-[#181818]/70 transition ${
                        isTop1 ? 'bg-[#1a1710]/40' : ''
                      }`}
                    >
                      {/* Posición */}
                      <td className="py-3.5 px-4 text-center">
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#C8A45C] text-black font-bold text-xs shadow">
                            1
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-black font-bold text-xs shadow">
                            2
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs shadow">
                            3
                          </span>
                        ) : (
                          <span className="font-mono text-neutral-500 font-medium">
                            #{idx + 1}
                          </span>
                        )}
                      </td>

                      {/* Colaborador */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {seller.avatarUrl ? (
                            <img
                              src={seller.avatarUrl}
                              alt={seller.name}
                              className="w-8 h-8 rounded-full object-cover border border-neutral-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#E6C875] font-bold text-xs font-serif-luxury shrink-0">
                              {seller.firstName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-white flex items-center gap-1.5">
                              <span>{seller.name}</span>
                              {isTop1 && <Crown className="w-3.5 h-3.5 text-[#E6C875] fill-current" />}
                            </div>
                            <span className="text-[10px] text-neutral-400 capitalize">
                              {seller.employeeType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Total Recaudado */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-[#E6C875] font-mono text-sm block">
                          {formatSoles(seller.totalRevenueCents)}
                        </span>
                        <div className="w-24 ml-auto h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-[#D4AF37] to-[#E6C875] rounded-full"
                            style={{
                              width: `${maxRevenueValue > 0 ? (seller.totalRevenueCents / maxRevenueValue) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>

                      {/* Operaciones */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300">
                          <Receipt className="w-3 h-3 text-[#C8A45C]" />
                          <span>{seller.operationsCount}</span>
                        </span>
                      </td>

                      {/* Ticket Promedio */}
                      <td className="py-3.5 px-4 text-right font-mono text-neutral-300">
                        {formatSoles(seller.averageTicketCents)}
                      </td>

                      {/* % Aporte */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-emerald-400 font-mono text-xs">
                          {seller.percentageOfTeam}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    No se encontraron colaboradores con los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. CATEGORÍA AISLADA: VENTAS DIRECTAS DE TIENDA (RECEPCIÓN) */}
      <div className="bg-gradient-to-r from-[#141414] via-[#12141a] to-[#141414] border border-blue-900/40 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-950 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif-luxury text-base font-bold text-white flex items-center gap-2">
                <span>Ventas Directas de Tienda (Recepción)</span>
                <span className="text-[10px] font-semibold bg-blue-950/80 text-blue-300 px-2 py-0.5 rounded-full border border-blue-800/60">
                  Operaciones sin especialista asignado
                </span>
              </h4>
              <p className="text-xs text-neutral-400">
                Ventas de mostrador registradas por caja directa o sin atribución particular a colaborador.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
          <div className="bg-[#10131a] border border-blue-950/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-neutral-400 block">Total Recaudado en Mostrador</span>
            <span className="font-serif-luxury text-xl font-bold text-blue-300 font-mono">
              {formatSoles(directStoreStats.totalRevenueCents)}
            </span>
          </div>

          <div className="bg-[#10131a] border border-blue-950/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-neutral-400 block">Operaciones Realizadas</span>
            <span className="font-serif-luxury text-xl font-bold text-white font-mono">
              {directStoreStats.operationsCount} tickets
            </span>
          </div>

          <div className="bg-[#10131a] border border-blue-950/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-neutral-400 block">Ticket Promedio en Caja</span>
            <span className="font-serif-luxury text-xl font-bold text-neutral-200 font-mono">
              {formatSoles(directStoreStats.averageTicketCents)}
            </span>
          </div>

          <div className="bg-[#10131a] border border-blue-950/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-neutral-400 block">Participación en Ventas Globales</span>
            <span className="font-serif-luxury text-xl font-bold text-emerald-400 font-mono">
              {directStoreStats.percentageOfTotal}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
