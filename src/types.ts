/**
 * Especificación de Tipos y Modelos de Datos
 * Acicalados Spa & Barber Shop - Versión 2.6
 * Moneda: Soles Peruanos (PEN) almacenado en céntimos (cents)
 * Zona Horaria: America/Lima (UTC-5)
 */

export type UserRole = 'admin' | 'recepcionista' | 'empleado' | 'cliente' | 'anon' | 'anonimo' | 'VESTUARIO_ADMIN';

export type BusinessCategory = 'barberia' | 'spa' | 'mixto';

export interface Service {
  id: string;
  name: string;
  slug: string;
  category: 'barberia' | 'spa';
  price_cents: number;
  duration_minutes: number;
  capacity: number;
  active: boolean;
  image_url: string;
  description?: string;
}

export type ProductUnitMeasure = 'unidad' | 'ml' | 'frasco' | 'paquete' | 'litro' | 'caja' | string;
export type ProductUseType = 'venta' | 'consumo_interno' | 'mixto';

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: 'ceras_pomadas' | 'shampoos' | 'barba_afeitado' | 'tratamientos' | 'accesorios';
  price_cents: number;
  stock: number;
  min_stock?: number;
  in_shopping_list?: boolean;
  barcode?: string;
  unit_measure?: ProductUnitMeasure;
  use_type?: ProductUseType;
  image_url: string;
  description: string;
  active?: boolean;
}

export type InventoryMovementType = 'VENTA' | 'CONSUMO_INTERNO' | 'INGRESO' | 'AJUSTE';

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  user_id?: string;
  area_destination?: string;
  notes?: string;
  created_at: string;
  product_name?: string;
}

export type WardrobeStatus = 'disponible' | 'reservado' | 'en_uso' | 'mantenimiento';

export type WardrobeCategory =
  | 'Bodas y Matrimonio'
  | 'Quinceañeras'
  | 'Gala y Noche'
  | 'Trajes Típicos y Costumbristas'
  | 'Casual y Sesiones de Fotos';

export interface WardrobeItem {
  id: string;
  code?: string;
  name: string;
  category: WardrobeCategory | string;
  rental_price_cents: number;
  deposit_cents: number;
  status: WardrobeStatus;
  active?: boolean;
  image_url: string;
  description?: string;
  size?: string;
  color?: string;
}

export type DressRentalStatus = 'por_validar' | 'reservado' | 'entregado' | 'finalizado' | 'anulado';
export type DressRentalOrigin = 'web' | 'local';

export interface DressRental {
  id: string;
  ticket_code: string;
  origin: DressRentalOrigin;
  wardrobe_item_id?: string;
  item_code: string;
  item_name: string;
  item_size?: string;
  item_color?: string;
  client_first_name: string;
  client_last_name: string;
  client_dni: string;
  client_phone: string;
  event_name: string;
  destination: string;
  event_date: string;
  return_date: string;
  status: DressRentalStatus;
  rental_price_cents: number;
  advance_cents: number;
  pending_cents: number;
  guarantee_cents: number;
  guarantee_returned_cents?: number | null;
  penalty_cents?: number;
  penalty_reason?: string | null;
  is_immediate_delivery: boolean;
  delivery_date?: string | null;
  actual_return_date?: string | null;
  voucher_url?: string | null;
  voucher_declared_amount_cents?: number | null;
  rejection_reason?: string | null;
  notes?: string | null;
  numero_ticket?: string | null;
  fecha_emision_ticket?: string | null;
  asesor_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeType = 'barbero' | 'spa' | 'recepcionista' | 'vestuario' | 'modista';

export interface Employee {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  role?: 'admin' | 'recepcionista' | 'empleado' | 'vestuario_admin';
  type: string;
  skills: string[]; // Service IDs
  active: boolean;
  handles_reception?: boolean;
  avatar_url?: string;
  foto_url?: string;
  avatar?: string;
  qr_code_uuid?: string;
  qr_code?: string;
  phone: string;
  dni?: string;
  email?: string;
  rotation_order?: number;
}

export type AttendanceStatus =
  | 'presente'
  | 'tardanza'
  | 'salida_temprana'
  | 'falta_justificada'
  | 'falta_injustificada'
  | 'en_permiso';

export interface EmployeeAttendance {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_type: 'barberia' | 'spa' | 'recepcion';
  date: string; // YYYY-MM-DD
  check_in: string; // HH:mm
  check_out: string | null; // HH:mm
  worked_minutes: number;
  bonus_minutes: number;
  bonus_calculation_type: 'auto' | 'manual';
  status: AttendanceStatus;
  tardy_minutes?: number;
  overtime_minutes?: number;
  justification_note?: string;
  justification_document_url?: string;
  exit_type?: 'definitiva' | 'permiso' | 'emergencia' | null;
  exit_reason?: string | null;
  is_on_leave?: boolean;
  leave_start_time?: string | null;
  leave_reason?: string | null;
  absence_minutes?: number;
}

export interface EmployeeBlock {
  id: string;
  employee_id: string;
  employee_name?: string;
  block_date?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  reason: string;
  leave_type?: string;
  document_url?: string;
  is_full_day?: boolean;
  status?: 'aprobado' | 'pendiente' | string;
  created_at?: string;
}

export interface BookingServiceItem {
  id?: string;
  service_id: string;
  service_name: string;
  employee_id: string;
  employee_name: string;
  price_cents: number;
  duration_minutes: number;
  hora_inicio?: string; // HH:mm
  hora_fin?: string; // HH:mm
  start_time?: string; // HH:mm
  end_time?: string; // HH:mm
  liberado_at?: string; // If service finished early
  solicitud_eliminacion?: boolean; // Solicitud de eliminación pendiente de autorización de Administrador
  advance_amount_cents?: number; // Adelanto proporcional retenido por este servicio
}

export interface EmployeeAppointmentItem {
  id: string;
  booking_id: string;
  booking_code: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  booking_date: string;
  service_id: string;
  service_name: string;
  service_price_cents: number;
  duration_minutes: number;
  start_time: string; // HH:mm
  end_time: string;   // HH:mm (strictly start_time + duration_minutes)
  payment_status?: PaymentStatus | string;
  status?: string;
}

export interface EmployeePerformanceItem {
  employee_id: string;
  employee_name: string;
  foto_url: string | null;
  avatar_url: string | null;
  employee_type: string;
  is_active: boolean;
  total_jobs: number;
  presencial_jobs: number;
  online_jobs: number;
  total_revenue_cents: number;
}

export interface ServiceAuditItem {
  service_item_id: string;
  service_id: string | null;
  service_name: string;
  area: 'SPA' | 'BARBERÍA' | string;
  booking_id: string;
  booking_code: string;
  client_name: string;
  price_cents: number;
  employee_id: string | null;
  employee_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  hora_rango: string;
  completed_timestamp: string | null;
  payment_method: string;
  payment_status: string;
}

export type PaymentStatus = 'sin_pago' | 'parcial' | 'total';

export interface Booking {
  id: string;
  code: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_dni?: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  type: BusinessCategory;
  services: BookingServiceItem[];
  total_price_cents: number;
  advance_amount_cents: number; // Verificado cobrado
  balance_cents?: number;
  payment_status: PaymentStatus;
  status?: string;
  created_at: string;
  confirmed_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  expired_at?: string;
  numero_ticket?: string;
  fecha_emision_ticket?: string;
  notes?: string;
  payment_method?: string;
  cash_cents?: number;
  yape_cents?: number;
  transfer_cents?: number;
  payment_notes?: string;
}

export interface PaymentLog {
  id: string;
  booking_id: string;
  booking_code: string;
  amount_cents: number;
  payment_method: 'yape' | 'efectivo' | 'transferencia' | 'mixto' | string;
  cash_cents?: number;
  yape_cents?: number;
  transfer_cents?: number;
  voucher_url?: string;
  created_at: string;
  voided: boolean;
  voided_reason?: string;
  voided_by?: string;
  notes?: string;
}

export interface VentaMostrador {
  id: string;
  ticket_number: string;
  client_name: string;
  client_dni?: string;
  client_phone?: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  payment_method: 'efectivo' | 'yape' | 'transferencia' | 'mixto' | 'MIXTO';
  cash_cents?: number;
  yape_cents?: number;
  transfer_cents?: number;
  monto_efectivo?: number;
  monto_yape?: number;
  monto_transferencia?: number;
  detalles_pago?: {
    efectivo?: number;
    yape?: number;
    transferencia?: number;
    metodos?: string[];
    [key: string]: any;
  };
  subtotal?: number;
  subtotal_cents?: number;
  monto_descuento?: number;
  discount_cents?: number;
  detalles_items?: any[];
  notes?: string;
  created_at: string;
  fecha?: string;
  voided?: boolean;
}

export type ExpenseCategory =
  | 'insumos'
  | 'insumos_barberia'
  | 'insumos_spa'
  | 'servicios'
  | 'refrigerios'
  | 'productos'
  | 'servicios_basicos'
  | 'mantenimiento'
  | 'personal'
  | 'transporte'
  | 'otros';

export interface Expense {
  id: string;
  description: string;
  concept?: string;
  category: ExpenseCategory;
  amount_cents: number;
  payment_method: 'efectivo' | 'yape' | 'transferencia';
  beneficiary?: string;
  responsible?: string;
  voucher_url?: string;
  date: string; // YYYY-MM-DD
  status?: string;
  estado?: string;
  motivo_anulacion?: string;
  voided: boolean;
  voided_reason?: string;
  voided_by?: string;
  created_at: string;
}

export interface PaymentSettings {
  advance_percentage: number; // e.g. 25
  yape_phone: string;
  yape_holder: string;
  yape_qr_url: string;
}

export interface BonusSettings {
  weekday_cutoff: string; // "21:10"
  sunday_cutoff: string; // "20:10"
}

export interface AttendanceSettings {
  id?: string;
  shift_entry_time: string; // "09:00" (Lunes a Sábado)
  shift_exit_time: string; // "21:00" (Lunes a Sábado)
  entry_tolerance_minutes: number; // e.g. 15
  exit_tolerance_minutes: number; // e.g. 15
  sunday_entry_time?: string; // "09:00" (Domingos)
  sunday_exit_time?: string; // "19:00" (Domingos)
  sunday_entry_tolerance_minutes?: number; // e.g. 15
  sunday_exit_tolerance_minutes?: number; // e.g. 15
}

export interface CartItem {
  product: Product;
  quantity: number;
}

/** Formateo monetario oficial en Soles Peruanos */
export function formatSoles(cents: number): string {
  const soles = cents / 100;
  return `S/ ${soles.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formateo de fecha según zona horaria oficial America/Lima */
export function formatLimaDate(dateString: string): string {
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('es-PE', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch {
    // fallback
  }
  return dateString;
}

export interface LightboxData {
  url: string;
  title: string;
  description?: string;
  category?: string;
  badge?: string;
  code?: string;
  price?: string;
  metadata?: string;
}

/**
 * Regla estricta de cobranza real:
 * - Si la cita está cancelada o expirada: S/ 0.00.
 * - Si la cita está en estado "PAGADO" (payment_status === 'total', status === 'completada', o advance >= total):
 *   Se suma el 100% del monto total de la cita.
 * - Si la cita está registrada solo con adelanto (pago parcial):
 *   Se suma ÚNICAMENTE el monto abonado del adelanto en tiempo real. El saldo restante por pagar queda totalmente excluido.
 * - Si la cita está pendiente o no registra abono: Aporta S/ 0.00.
 */
export function getBookingCollectedAmountCents(b: Booking): number {
  // Citas anuladas, canceladas o expiradas no aportan recaudación efectiva
  if (
    b.status === 'cancelada' ||
    b.status === 'cancelled' ||
    b.status === 'expirada' ||
    Boolean(b.cancelled_at) ||
    Boolean(b.expired_at)
  ) {
    return 0;
  }

  const totalPrice = b.total_price_cents || 0;
  const advance = b.advance_amount_cents || 0;

  // Lógica Estricta de "Adelantos":
  // Si el cliente hizo un pago parcial o adelanto menor al precio total,
  // se suma ESTRICTAMENTE el monto de ese adelanto cobrado, NUNCA el precio total.
  if (b.payment_status === 'parcial' || (advance > 0 && totalPrice > 0 && advance < totalPrice)) {
    return advance;
  }

  // Solo se suma el monto total si el estado del pago es completamente cancelado/liquidado (100% pagado)
  const isPaidTotal =
    b.payment_status === 'total' ||
    (advance > 0 && totalPrice > 0 && advance >= totalPrice);

  if (isPaidTotal) {
    return Math.max(totalPrice, advance);
  }

  // Pendiente o sin pago confirmado
  return 0;
}

/**
 * Algoritmo de Distribución de Adelantos Estrictamente Entero (Proporcional Truncado + Ajuste de Residuo)
 * 1. Truncamiento Absoluto (Math.floor) de la proporción de cada servicio en Soles enteros.
 * 2. Sumatoria Temporal de los enteros truncados.
 * 3. Cálculo del Residuo Entero: Total Adelanto - Sumatoria Temporal.
 * 4. Inyección del Residuo al servicio con mayor precio (o primer ítem del array).
 */
export function distributeAdvanceStrictInteger(
  services: Array<{ price_cents?: number }>,
  totalAdvanceCents: number
): number[] {
  if (!services || services.length === 0 || totalAdvanceCents <= 0) {
    return (services || []).map(() => 0);
  }

  if (services.length === 1) {
    return [totalAdvanceCents];
  }

  const totalServicesPriceCents = services.reduce(
    (sum, s) => sum + (s.price_cents || 0),
    0
  );

  if (totalServicesPriceCents <= 0) {
    return services.map(() => 0);
  }

  // Si cubre o supera el 100%, cada servicio cubre su precio
  if (totalAdvanceCents >= totalServicesPriceCents) {
    return services.map((s) => s.price_cents || 0);
  }

  // Cálculo en unidades enteras de Soles
  const advanceSoles = Math.floor(totalAdvanceCents / 100);
  const centsRemainder = totalAdvanceCents - advanceSoles * 100;

  // Encontrar el servicio de mayor precio para inyectar el residuo
  let maxPriceIdx = 0;
  let maxPrice = -1;
  services.forEach((s, idx) => {
    const p = s.price_cents || 0;
    if (p > maxPrice) {
      maxPrice = p;
      maxPriceIdx = idx;
    }
  });

  // Paso 1: Truncamiento Absoluto (Math.floor)
  const truncatedSoles: number[] = services.map((s) => {
    const price = s.price_cents || 0;
    const proportion = (price / totalServicesPriceCents) * advanceSoles;
    return Math.floor(proportion);
  });

  // Paso 2: Sumatoria Temporal
  const tempSumSoles = truncatedSoles.reduce((acc, val) => acc + val, 0);

  // Paso 3: Cálculo del Residuo Entero
  const residueSoles = advanceSoles - tempSumSoles;

  // Paso 4: Inyección del Residuo al servicio de mayor precio
  const allocatedSoles = [...truncatedSoles];
  allocatedSoles[maxPriceIdx] += residueSoles;

  // Conversión a centavos exactos (sin decimales ni céntimos fraccionados)
  return allocatedSoles.map((soles, idx) => {
    const cents = soles * 100;
    return idx === maxPriceIdx ? cents + centsRemainder : cents;
  });
}

/**
 * Prorratea el monto efectivamente cobrado de una cita entre sus servicios asignados.
 * Garantiza que la suma de los servicios sea idéntica al total cobrado real en números estrictamente enteros.
 */
export function getBookingServicesWithCollectedCents(
  b: Booking
): Array<BookingServiceItem & { collected_cents: number }> {
  const collectedTotal = getBookingCollectedAmountCents(b);
  if (!b.services || b.services.length === 0) {
    if (collectedTotal > 0) {
      return [
        {
          service_id: 'default',
          service_name: b.type === 'spa' ? 'Servicio Spa' : 'Servicio Barbería',
          employee_id: '',
          employee_name: 'Especialista',
          price_cents: b.total_price_cents || collectedTotal,
          duration_minutes: 30,
          collected_cents: collectedTotal,
        },
      ];
    }
    return [];
  }

  if (collectedTotal <= 0) {
    return b.services.map((s) => ({ ...s, collected_cents: 0 }));
  }

  const totalPrice = b.total_price_cents || 0;
  if (totalPrice <= 0) {
    const perService = Math.floor(collectedTotal / b.services.length);
    return b.services.map((s, idx) => ({
      ...s,
      collected_cents:
        idx === b.services.length - 1
          ? Math.max(0, collectedTotal - perService * (b.services.length - 1))
          : perService,
    }));
  }

  if (collectedTotal >= totalPrice) {
    let accumulated = 0;
    return b.services.map((s, idx) => {
      if (idx === b.services.length - 1) {
        return { ...s, collected_cents: Math.max(0, collectedTotal - accumulated) };
      }
      const sPrice = s.price_cents || 0;
      accumulated += sPrice;
      return { ...s, collected_cents: sPrice };
    });
  }

  // Si cada ítem ya tiene su advance_amount_cents guardado y suma exactamente el collectedTotal
  const hasSavedItemAdvances = b.services.some(
    (s) => s.advance_amount_cents != null && s.advance_amount_cents > 0
  );
  if (hasSavedItemAdvances) {
    const savedSum = b.services.reduce(
      (sum, s) => sum + (s.advance_amount_cents || 0),
      0
    );
    if (savedSum === collectedTotal) {
      return b.services.map((s) => ({
        ...s,
        collected_cents: s.advance_amount_cents || 0,
      }));
    }
  }

  // Distribución Proporcional Truncada Estricta a Enteros + Inyección de Residuo
  const distributed = distributeAdvanceStrictInteger(b.services, collectedTotal);
  return b.services.map((s, idx) => ({
    ...s,
    collected_cents: distributed[idx] || 0,
  }));
}

