import {
  Service,
  Product,
  WardrobeItem,
  DressRental,
  Employee,
  Booking,
  PaymentLog,
  VentaMostrador,
  Expense,
  EmployeeAttendance,
  PaymentSettings,
  BonusSettings,
  AttendanceSettings,
} from '../types';

/**
 * Estados iniciales limpios: colecciones vacías para prevenir
 * destellos de datos quemados (flash of stale / mock data) al montar la app.
 */
export const INITIAL_SERVICES: Service[] = [];
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_WARDROBE: WardrobeItem[] = [];
export const INITIAL_DRESS_RENTALS: DressRental[] = [];
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_BOOKINGS: Booking[] = [];
export const INITIAL_PAYMENT_LOGS: PaymentLog[] = [];
export const INITIAL_VENTAS_MOSTRADOR: VentaMostrador[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_ATTENDANCE: EmployeeAttendance[] = [];

// Fecha oficial de Perú en zona horaria America/Lima en formato YYYY-MM-DD
export function getTodayDateString(): string {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

// Hora oficial de Perú en zona horaria America/Lima en formato HH:MM:SS
export function getLimaTimeString(): string {
  const d = new Date();
  return d.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Extrae la fecha YYYY-MM-DD en la zona horaria oficial America/Lima */
export function getLimaDateFromTimestamp(val?: string | null): string {
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

export const INITIAL_PAYMENT_SETTINGS: PaymentSettings = {
  advance_percentage: 25,
  yape_phone: import.meta.env.VITE_YAPE_PHONE || '',
  yape_holder: import.meta.env.VITE_YAPE_HOLDER || 'Acicalados Spa & Barber Shop',
  yape_qr_url: import.meta.env.VITE_YAPE_QR_URL || '',
};

export const INITIAL_BONUS_SETTINGS: BonusSettings = {
  weekday_cutoff: '21:10',
  sunday_cutoff: '20:10',
};

export const INITIAL_ATTENDANCE_SETTINGS: AttendanceSettings = {
  shift_entry_time: '09:00',
  shift_exit_time: '21:00',
  entry_tolerance_minutes: 15,
  exit_tolerance_minutes: 15,
};
