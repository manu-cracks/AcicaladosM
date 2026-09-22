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

export const INITIAL_PAYMENT_SETTINGS: PaymentSettings = {
  advance_percentage: 25,
  yape_phone: '987 654 321',
  yape_holder: 'Acicalados Spa & Barber Shop S.A.C.',
  yape_qr_url: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126580014pe.yape.pe01129876543215204000053036045802PE5925ACICALADOS+SPA+BARBER+SHOP6004LIMA6304E64A',
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
