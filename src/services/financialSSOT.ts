import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Booking,
  VentaMostrador,
  Expense,
  Service,
  DressRental,
  BookingServiceItem,
  getBookingCollectedAmountCents,
  getBookingServicesWithCollectedCents,
  formatLimaDate,
} from '../types';
import { getTodayDateString, getLimaDateFromTimestamp } from '../data/initialData';

export type DateFilterType = 'hoy' | 'semana' | 'mes' | 'todo' | string;

export interface DateRangeLima {
  filterType: string;
  isExact: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  dateLabel: string;
  exactDate?: string;
}

export interface FinancialFilterOptions {
  employeeId?: string;
  employeeArea?: 'spa' | 'barberia' | 'todos';
}

export interface FinancialMetrics {
  // Configuración de la ventana temporal (UTC-5 America/Lima)
  dateRange: DateRangeLima;

  // Ingresos por Servicios y Desglose por Área (SSOT)
  totalIngresosCents: number;          // Total Cobrado = Servicios + Ventas + Vestuario
  ingresosServiciosCents: number;      // Barbería Cobrado + Spa Cobrado
  barberiaCents: number;               // Tarjeta "INGRESOS POR BARBERÍA"
  barberiaCount: number;
  spaCents: number;                    // Tarjeta "INGRESOS POR SPA"
  spaCount: number;

  // Ventas de Mostrador
  ventasMostradorCents: number;        // Tarjeta "INGRESOS POR VENTAS"
  ventasCount: number;

  // Vestuario
  vestuarioCents: number;              // Tarjeta "ALQUILER DE VESTUARIO"
  vestuarioCount: number;

  // Egresos Operativos y Balance Neto
  totalEgresosCents: number;           // Tarjeta "TOTAL EGRESOS OPERATIVOS"
  egresosCount: number;
  balanceNetoCents: number;            // Tarjeta "GANANCIA NETA" / "BALANCE NETO"

  // Citas y Auditoría
  citasCount: number;                  // Total citas activas en el periodo
  citasConfirmadasCount: number;       // Citas con confirmación de pago (100% o adelanto)
  saldosPorCobrarCents: number;        // Saldo pendiente por cobrar

  // Colecciones filtradas en el bloque de tiempo
  filteredBookings: Booking[];
  confirmedBookings: Booking[];        // Exclusivo para Calendario y citas con cobro confirmado
  filteredVentas: VentaMostrador[];
  filteredExpenses: Expense[];
}

/**
 * Determina si una reserva cuenta con confirmación financiera comprobada:
 * - No está cancelada ni expirada.
 * - Tiene pago total, parcial, adelanto mayor a cero, o estado completada/pagada.
 * Las citas 'pendientes' o 'sin_pago' (sin adelanto abonado) quedan estrictamente excluidas.
 */
export function isBookingConfirmedPayment(b: Booking): boolean {
  if (
    b.status === 'cancelada' ||
    b.status === 'cancelled' ||
    b.status === 'expirada' ||
    Boolean(b.cancelled_at) ||
    Boolean(b.expired_at)
  ) {
    return false;
  }

  // Si tiene saldo cobrado efectivo mayor a cero
  const collected = getBookingCollectedAmountCents(b);
  if (collected > 0) return true;

  // Si está confirmada/liquidada financieramente
  if (
    b.payment_status === 'total' ||
    b.payment_status === 'parcial' ||
    b.status === 'completada' ||
    b.status === 'pagado' ||
    (b.advance_amount_cents != null && b.advance_amount_cents > 0)
  ) {
    return true;
  }

  return false;
}

/**
 * Determina si un egreso está activo y es válido para cálculos contables
 * (excluye ANULADO, ELIMINADO, INACTIVO, VOIDED o voided_at).
 */
export function isExpenseActive(e: Expense): boolean {
  if (e.voided) return false;
  const statusUpper = (e.status || '').toUpperCase();
  const estadoUpper = (e.estado || '').toUpperCase();
  return (
    statusUpper !== 'ANULADO' &&
    statusUpper !== 'VOIDED' &&
    statusUpper !== 'ELIMINADO' &&
    statusUpper !== 'INACTIVO' &&
    estadoUpper !== 'ANULADO' &&
    estadoUpper !== 'ELIMINADO' &&
    estadoUpper !== 'INACTIVO'
  );
}

/**
 * Determina si una venta de mostrador está activa (no anulada)
 */
export function isVentaActive(v: VentaMostrador): boolean {
  return !v.voided;
}

/**
 * Resuelve la categoría del servicio ('barberia' | 'spa') evaluando:
 * 1. Catálogo oficial de servicios en base de datos.
 * 2. Heurística de palabras clave si no está en catálogo o fue registrado libremente.
 */
export function getServiceCategory(
  item: { service_id?: string; service_name: string },
  catalogServices: Service[]
): 'barberia' | 'spa' {
  if (item.service_id) {
    const foundById = catalogServices.find((s) => s.id === item.service_id);
    if (foundById?.category) return foundById.category;
  }

  const cleanName = (item.service_name || '').trim().toLowerCase();
  const foundByName = catalogServices.find((s) => s.name.toLowerCase().trim() === cleanName);
  if (foundByName?.category) return foundByName.category;

  const spaKeywords = [
    'spa',
    'facial',
    'masaje',
    'uña',
    'acrilic',
    'pedicure',
    'manicure',
    'manicura',
    'alisado',
    'botox',
    'maquillaje',
    'peinado',
    'pestaña',
    'ceja',
    'depil',
    'cera',
    'hilo',
    'exfolia',
    'delineado',
    'microblading',
    'microshading',
    'blanqueamiento',
    'tinte',
    'mechas',
    'balayage',
    'laceado',
    'ondulaci',
    'acripie',
    'yelitip',
    'planchado',
  ];

  if (spaKeywords.some((kw) => cleanName.includes(kw))) {
    return 'spa';
  }

  return 'barberia';
}

/**
 * Homologa la resolución de fechas en la zona horaria oficial America/Lima (UTC-5)
 */
export function resolveDateRangeLima(filter: string = 'hoy'): DateRangeLima {
  const todayStr = getTodayDateString();

  if (/^\d{4}-\d{2}-\d{2}$/.test(filter)) {
    return {
      filterType: 'exact',
      isExact: true,
      startDate: filter,
      endDate: filter,
      dateLabel: filter === todayStr ? 'Hoy' : formatLimaDate(filter),
      exactDate: filter,
    };
  }

  if (filter === 'hoy') {
    return {
      filterType: 'hoy',
      isExact: true,
      startDate: todayStr,
      endDate: todayStr,
      dateLabel: 'Hoy',
      exactDate: todayStr,
    };
  }

  if (filter === 'semana') {
    const d = new Date(todayStr + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    const startDate = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return {
      filterType: 'semana',
      isExact: false,
      startDate,
      endDate: todayStr,
      dateLabel: 'Semana',
    };
  }

  if (filter === 'mes') {
    const d = new Date(todayStr + 'T12:00:00');
    d.setDate(d.getDate() - 30);
    const startDate = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return {
      filterType: 'mes',
      isExact: false,
      startDate,
      endDate: todayStr,
      dateLabel: 'Mes',
    };
  }

  return {
    filterType: 'todo',
    isExact: false,
    startDate: '1970-01-01',
    endDate: '2099-12-31',
    dateLabel: 'Todo el Historial',
  };
}

/**
 * MOTOR FINANCIERO CENTRALIZADO (Single Source of Truth - SSOT)
 *
 * Implementa de manera unificada:
 * 1. Filtrado riguroso por fecha (00:00:00 a 23:59:59 America/Lima UTC-5).
 * 2. Exclusión de citas no confirmadas para calendarios y cálculos.
 * 3. Desglose estricto por área (Spa vs Barbería) leyendo el detalle de cada ítem de ticket:
 *    - Si una cita contiene servicios de ambas áreas, el pago cobrado se prorratea
 *      internamente asignando el valor exacto a cada tarjeta sin inflar el total.
 * 4. Integridad contable: Ganancia Neta = Total Ingresos - Total Egresos Activos.
 */
export function calculateFinancialMetrics(params: {
  dateFilter: string;
  bookings: Booking[];
  ventasMostrador: VentaMostrador[];
  expenses: Expense[];
  services: Service[];
  dressRentals?: DressRental[];
  options?: FinancialFilterOptions;
}): FinancialMetrics {
  const {
    dateFilter,
    bookings,
    ventasMostrador,
    expenses,
    services,
    dressRentals = [],
    options = {},
  } = params;

  const dateRange = resolveDateRangeLima(dateFilter);
  const { isExact, startDate, endDate, exactDate } = dateRange;
  const { employeeId, employeeArea } = options;

  // 1. Filtrado de Citas en el bloque de tiempo (excluyendo canceladas y expiradas)
  const validBookings = bookings.filter((b) => {
    if (
      b.status === 'cancelada' ||
      b.status === 'cancelled' ||
      b.status === 'expirada' ||
      Boolean(b.cancelled_at) ||
      Boolean(b.expired_at)
    ) {
      return false;
    }

    const bDate = getLimaDateFromTimestamp(b.date);
    if (isExact && exactDate) {
      return bDate === exactDate;
    }
    return bDate >= startDate && bDate <= endDate;
  });

  // Citas con confirmación financiera efectiva
  const confirmedBookings = validBookings.filter((b) => isBookingConfirmedPayment(b));

  // 2. Desglose de Ingresos por Servicios a Nivel de Ítems (Regla de Citas Mixtas)
  let barberiaCents = 0;
  let spaCents = 0;
  let barberiaCount = 0;
  let spaCount = 0;

  validBookings.forEach((b) => {
    const servicesWithCollected = getBookingServicesWithCollectedCents(b);

    servicesWithCollected.forEach((srv) => {
      // Filtro opcional por colaborador
      if (employeeId) {
        const matchesId = srv.employee_id === employeeId || (b as any).assigned_employee_id === employeeId;
        const matchesName = Boolean(srv.employee_name) && srv.employee_name !== 'Especialista';
        if (!matchesId && !matchesName) {
          return;
        }
      }

      const itemCategory = getServiceCategory(
        { service_id: srv.service_id, service_name: srv.service_name },
        services
      );

      // Si se fuerza un área específica por el perfil del colaborador
      if (employeeArea === 'spa') {
        spaCents += srv.collected_cents;
        spaCount += 1;
      } else if (employeeArea === 'barberia') {
        barberiaCents += srv.collected_cents;
        barberiaCount += 1;
      } else if (itemCategory === 'spa') {
        spaCents += srv.collected_cents;
        spaCount += 1;
      } else {
        barberiaCents += srv.collected_cents;
        barberiaCount += 1;
      }
    });
  });

  const ingresosServiciosCents = barberiaCents + spaCents;

  // 3. Ventas de Mostrador (Solo aplican globalmente; 0 si se filtra por colaborador específico)
  const filteredVentas = ventasMostrador.filter((v) => {
    if (!isVentaActive(v)) return false;
    const vDate = getLimaDateFromTimestamp(v.created_at || v.fecha);
    if (isExact && exactDate) {
      return vDate === exactDate;
    }
    return vDate >= startDate && vDate <= endDate;
  });

  const ventasMostradorCents = employeeId
    ? 0
    : filteredVentas.reduce((acc, v) => acc + (v.total_price_cents || 0), 0);

  // 4. Alquiler de Vestuario (Solo aplica globalmente)
  const filteredRentals = dressRentals.filter((r) => {
    if (r.status === 'anulado') return false;
    const rDate = getLimaDateFromTimestamp(r.event_date || r.created_at);
    if (isExact && exactDate) {
      return rDate === exactDate;
    }
    return rDate >= startDate && rDate <= endDate;
  });

  const vestuarioCents = employeeId
    ? 0
    : filteredRentals.reduce(
        (acc, r) =>
          acc + (r.status === 'entregado' ? r.rental_price_cents || 0 : r.advance_cents || 0),
        0
      );

  // 5. Total Ingresos Cobrados (Servicios + Ventas + Vestuario)
  const totalIngresosCents = ingresosServiciosCents + ventasMostradorCents + vestuarioCents;

  // 6. Egresos Operativos Activos (excluye estrictamente ANULADOS)
  const filteredExpenses = expenses.filter((e) => {
    if (!isExpenseActive(e)) return false;
    const eDate = getLimaDateFromTimestamp(e.date || e.created_at);
    if (isExact && exactDate) {
      return eDate === exactDate;
    }
    return eDate >= startDate && eDate <= endDate;
  });

  const totalEgresosCents = employeeId
    ? 0
    : filteredExpenses.reduce((acc, e) => acc + (e.amount_cents || 0), 0);

  // 7. Balance Neto de Caja / Ganancia Neta
  const balanceNetoCents = totalIngresosCents - totalEgresosCents;

  // 8. Saldos por Cobrar
  const saldosPorCobrarCents = validBookings.reduce((acc, b) => {
    const collected = getBookingCollectedAmountCents(b);
    const saldo = Math.max(0, (b.total_price_cents || 0) - collected);
    return acc + saldo;
  }, 0);

  return {
    dateRange,
    totalIngresosCents,
    ingresosServiciosCents,
    barberiaCents,
    barberiaCount,
    spaCents,
    spaCount,
    ventasMostradorCents,
    ventasCount: filteredVentas.length,
    vestuarioCents,
    vestuarioCount: filteredRentals.length,
    totalEgresosCents,
    egresosCount: filteredExpenses.length,
    balanceNetoCents,
    citasCount: validBookings.length,
    citasConfirmadasCount: confirmedBookings.length,
    saldosPorCobrarCents,
    filteredBookings: validBookings,
    confirmedBookings,
    filteredVentas,
    filteredExpenses,
  };
}

/**
 * React Hook SSOT para ser consumido en cualquier componente del sistema
 */
export function useFinancialSSOT(
  dateFilter: string = 'hoy',
  options?: FinancialFilterOptions
): FinancialMetrics {
  const { bookings, ventasMostrador, expenses, services, dressRentals } = useApp();
  const empId = options?.employeeId;
  const empArea = options?.employeeArea;

  return useMemo(() => {
    return calculateFinancialMetrics({
      dateFilter,
      bookings,
      ventasMostrador,
      expenses,
      services,
      dressRentals,
      options: { employeeId: empId, employeeArea: empArea },
    });
  }, [dateFilter, bookings, ventasMostrador, expenses, services, dressRentals, empId, empArea]);
}
