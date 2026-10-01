import { AttendanceSettings, EmployeeAttendance } from '../types';

/**
 * Utilidades avanzadas para el motor de Asistencias, Turnos y Nómina.
 * Zona horaria oficial: America/Lima (UTC-5)
 */

export interface ShiftConfigResult {
  isSunday: boolean;
  dayTypeLabel: 'Lunes a Sábado' | 'Domingo';
  entryTime: string;
  exitTime: string;
  entryMinutes: number;
  exitMinutes: number;
  entryTolerance: number;
  exitTolerance: number;
  maxEntryAllowed: number;
  overtimeThreshold: number;
}

/**
 * Obtiene la hora actual oficial en Lima en formato "HH:mm" y sus minutos transcurridos desde medianoche.
 */
export function getCurrentLimaMinutes(): { timeStr: string; minutes: number } {
  const timeStr = new Date().toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [h, m] = timeStr.split(':').map(Number);
  return { timeStr, minutes: h * 60 + m };
}

/**
 * Convierte un string "HH:mm" a minutos desde la medianoche.
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convierte minutos a un texto legible amigable como "8h 30m" o "45m".
 */
export function formatMinutesToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Determina dinámicamente los parámetros de horario y tolerancia según el día de la semana en Lima.
 * Si dateStr no se provee, evalúa la fecha actual en America/Lima.
 */
export function getShiftConfigForDate(
  settings: AttendanceSettings,
  dateStr?: string
): ShiftConfigResult {
  let isSunday = false;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Crear fecha con hora fija mediodía UTC para evitar desfases
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    isSunday = dateObj.getUTCDay() === 0;
  } else {
    const weekdayStr = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/Lima',
      weekday: 'short',
    });
    isSunday = weekdayStr === 'Sun';
  }

  if (isSunday) {
    const entryTime = settings.sunday_entry_time || '09:00';
    const exitTime = settings.sunday_exit_time || '19:00';
    const entryMinutes = parseTimeToMinutes(entryTime);
    const exitMinutes = parseTimeToMinutes(exitTime);
    const entryTolerance = settings.sunday_entry_tolerance_minutes ?? 15;
    const exitTolerance = settings.sunday_exit_tolerance_minutes ?? 15;

    return {
      isSunday: true,
      dayTypeLabel: 'Domingo',
      entryTime,
      exitTime,
      entryMinutes,
      exitMinutes,
      entryTolerance,
      exitTolerance,
      maxEntryAllowed: entryMinutes + entryTolerance,
      overtimeThreshold: exitMinutes + exitTolerance,
    };
  }

  const entryTime = settings.shift_entry_time || '09:00';
  const exitTime = settings.shift_exit_time || '21:00';
  const entryMinutes = parseTimeToMinutes(entryTime);
  const exitMinutes = parseTimeToMinutes(exitTime);
  const entryTolerance = settings.entry_tolerance_minutes ?? 15;
  const exitTolerance = settings.exit_tolerance_minutes ?? 15;

  return {
    isSunday: false,
    dayTypeLabel: 'Lunes a Sábado',
    entryTime,
    exitTime,
    entryMinutes,
    exitMinutes,
    entryTolerance,
    exitTolerance,
    maxEntryAllowed: entryMinutes + entryTolerance,
    overtimeThreshold: exitMinutes + exitTolerance,
  };
}

/**
 * Calcula la jornada neta trabajada restando las ausencias acumuladas (almuerzo, permisos médicos, etc.)
 */
export function calculateNetWorkedMinutes(
  checkIn: string,
  checkOut: string | null,
  absenceMinutes: number = 0
): number {
  if (!checkIn || !checkOut) return 0;
  const inMin = parseTimeToMinutes(checkIn);
  const outMin = parseTimeToMinutes(checkOut);
  const grossMinutes = Math.max(0, outMin - inMin);
  return Math.max(0, grossMinutes - (absenceMinutes || 0));
}

/**
 * Calcula el rango de fechas para los filtros rápidos de nómina:
 * - 'diario': Fecha seleccionada única
 * - 'quincenal': 1 al 15 o 16 al último día del mes
 * - 'mensual': 1 al último día del mes
 * - 'anual': 1 de enero al 31 de diciembre
 */
export function calculatePayrollDateRange(
  periodType: 'diario' | 'quincenal' | 'mensual' | 'anual',
  referenceDateStr?: string
): { startDate: string; endDate: string; label: string } {
  const baseDate = referenceDateStr
    ? new Date(`${referenceDateStr}T12:00:00Z`)
    : new Date();

  // Extraer año, mes (0-index), día en Lima
  const limaDateParts = baseDate
    .toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
    .split('-')
    .map(Number);
  const year = limaDateParts[0];
  const month = limaDateParts[1] - 1;
  const day = limaDateParts[2];

  const pad = (n: number) => n.toString().padStart(2, '0');
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Setiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  if (periodType === 'diario') {
    const dStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    return {
      startDate: dStr,
      endDate: dStr,
      label: `Día ${pad(day)} de ${monthNames[month]} ${year}`,
    };
  }

  if (periodType === 'quincenal') {
    if (day <= 15) {
      const sStr = `${year}-${pad(month + 1)}-01`;
      const eStr = `${year}-${pad(month + 1)}-15`;
      return {
        startDate: sStr,
        endDate: eStr,
        label: `1ra Quincena (01 - 15 ${monthNames[month]} ${year})`,
      };
    } else {
      const lastDay = new Date(year, month + 1, 0).getDate();
      const sStr = `${year}-${pad(month + 1)}-16`;
      const eStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
      return {
        startDate: sStr,
        endDate: eStr,
        label: `2da Quincena (16 - ${lastDay} ${monthNames[month]} ${year})`,
      };
    }
  }

  if (periodType === 'mensual') {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const sStr = `${year}-${pad(month + 1)}-01`;
    const eStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
    return {
      startDate: sStr,
      endDate: eStr,
      label: `Mes de ${monthNames[month]} ${year}`,
    };
  }

  // anual
  const sStr = `${year}-01-01`;
  const eStr = `${year}-12-31`;
  return {
    startDate: sStr,
    endDate: eStr,
    label: `Año ${year}`,
  };
}
