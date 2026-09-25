/**
 * Utilidades de cálculo de disponibilidad y aforo en tiempo real para reservas
 * Acicalados Spa & Barber Shop
 * Zona Horaria: America/Lima (UTC-5)
 * Bloques de 30 minutos (09:00 a 20:30 hrs)
 */

import { Service, Employee, EmployeeBlock, Booking } from '../types';

/**
 * Estados de reserva que NO deben bloquear disponibilidad de horarios.
 * QA-009: Reservas canceladas o expiradas no deben seguir ocupando cupos.
 */
const INACTIVE_BOOKING_STATUSES = new Set([
  'cancelada',
  'cancelled',
  'completada',
  'completed',
  'expirada',
  'anulada',
  'no_show',
  'liberada',
]);

/**
 * Determina si una reserva debe ser ignorada en el cálculo de disponibilidad.
 * Las reservas canceladas, expiradas, anuladas, no-show o liberadas liberan el horario.
 */
export function isBookingInactive(booking: Booking): boolean {
  if (booking.cancelled_at || booking.expired_at || booking.completed_at) return true;
  if (!booking.status) return false;
  return INACTIVE_BOOKING_STATUSES.has(booking.status.toLowerCase());
}

export const BUSINESS_HOURS = {
  open: '09:00',
  close: '21:00',
  openMinutes: 9 * 60, // 540
  closeMinutes: 21 * 60, // 1260
  slotIntervalMinutes: 30,
};

/**
 * Genera dinámicamente los bloques de tiempo (slots) de 30 minutos entre la hora de apertura y cierre.
 * @param openTime Hora oficial de apertura (por defecto 09:00)
 * @param closeTime Hora oficial de cierre (por defecto 21:00)
 * @param intervalMinutes Intervalo en minutos entre cada bloque (por defecto 30)
 */
export function generateSlots(
  openTime: string = BUSINESS_HOURS.open,
  closeTime: string = BUSINESS_HOURS.close,
  intervalMinutes: number = 30
): string[] {
  const startMin = timeToMinutes(openTime);
  const endMin = timeToMinutes(closeTime);

  // Fallback si la configuración es inválida o close <= open
  if (isNaN(startMin) || isNaN(endMin) || endMin <= startMin) {
    return generateSlots(BUSINESS_HOURS.open, BUSINESS_HOURS.close, intervalMinutes);
  }

  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) return [];
  const slots: string[] = [];
  for (let m = startMin; m < endMin; m += intervalMinutes) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

// Bloques estándar de 30 minutos (09:00 a 20:30 hrs) como referencia compatible
export const ALL_30MIN_SLOTS: string[] = generateSlots(
  BUSINESS_HOURS.open,
  BUSINESS_HOURS.close,
  30
);

export type SlotStatus = 'disponible' | 'pasado' | 'lleno';
export type SlotStatusLabel = 'Libre' | 'Pasado' | 'Lleno';

export interface ServiceExecutionPlan {
  serviceId: string;
  serviceName: string;
  employeeId: string;
  employeeName: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  priceCents: number;
}

export interface ComputedSlot {
  time: string; // HH:mm
  status: SlotStatus;
  statusLabel: SlotStatusLabel;
  isSelectable: boolean;
  totalDurationMinutes: number;
  overallEndTime: string;
  servicePlans?: ServiceExecutionPlan[];
  reason?: string;
}

/**
 * Convierte un string de hora "HH:mm" a minutos desde medianoche
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.substring(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convierte minutos desde medianoche a formato "HH:mm"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Obtiene la fecha y hora oficial en zona horaria America/Lima (UTC-5)
 */
export function getLimaDateTime(dateOverride?: Date): {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  totalMinutes: number;
} {
  const d = dateOverride || new Date();
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return {
    dateStr,
    timeStr,
    totalMinutes: timeToMinutes(timeStr),
  };
}

/**
 * Formatea una marca de tiempo de culminación (ISO o HH:mm) a una cadena limpia HH:mm (ej. "14:30").
 * Valida valores nulos o vacíos con seguridad antes de parsear.
 */
export function formatCompletionTime(dateString?: string | null): string {
  if (!dateString) return '';
  const trimmed = dateString.trim();
  if (!trimmed) return '';

  // Si ya es un formato "HH:mm" o "HH:mm:ss"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return trimmed;
  }
}

/**
 * Determina los colaboradores activos aptos para brindar un servicio específico
 */
export function getEligibleEmployeesForService(
  service: Service,
  employees: Employee[]
): Employee[] {
  if (!employees || employees.length === 0) return [];

  // 1. Coincidencia directa por habilidades asignadas (skills)
  const withSkill = employees.filter(
    (e) => e.active && e.skills && e.skills.includes(service.id)
  );
  if (withSkill.length > 0) return withSkill;

  // 2. Coincidencia por tipo/categoría de servicio (barbero para barbería, spa para spa)
  const matchingCategory = employees.filter((e) => {
    if (!e.active) return false;
    if (e.type === 'recepcionista' || e.role === 'recepcionista') return false;
    if (service.category === 'barberia') {
      return e.type === 'barbero' || e.type === 'barberia';
    }
    if (service.category === 'spa') {
      return e.type === 'spa';
    }
    return true;
  });
  if (matchingCategory.length > 0) return matchingCategory;

  // 3. Fallback: cualquier colaborador activo que no sea recepcionista
  return employees.filter(
    (e) => e.active && e.type !== 'recepcionista' && e.role !== 'recepcionista'
  );
}

/**
 * Verifica si un colaborador tiene un permiso o bloqueo aprobado en el intervalo
 */
export function isEmployeeBlocked(
  empId: string,
  date: string,
  startMin: number,
  endMin: number,
  employeeBlocks: EmployeeBlock[]
): boolean {
  if (!employeeBlocks || employeeBlocks.length === 0) return false;

  return employeeBlocks.some((b) => {
    if (b.employee_id !== empId) return false;
    if (b.status && b.status !== 'aprobado' && b.status !== 'activo') return false;

    const bDate = b.block_date || b.date || b.start_date;
    const bEndDate = b.end_date || bDate;
    const inDateRange =
      bDate && bEndDate ? date >= bDate && date <= bEndDate : bDate === date;
    if (!inDateRange) return false;

    // Bloqueo de día completo
    if (b.is_full_day || (!b.start_time && !b.end_time)) return true;

    const bStart = timeToMinutes(b.start_time || '00:00');
    const bEnd = timeToMinutes(b.end_time || '23:59');

    // Solapamiento de intervalos [startMin, endMin) con [bStart, bEnd)
    return startMin < bEnd && endMin > bStart;
  });
}

/**
 * Verifica si un colaborador ya tiene una cita asignada en ese intervalo.
 * QA-009: Se excluyen reservas canceladas, expiradas, anuladas o liberadas.
 */
export function isEmployeeBooked(
  empId: string,
  date: string,
  startMin: number,
  endMin: number,
  bookings: Booking[]
): boolean {
  if (!bookings || bookings.length === 0) return false;

  return bookings.some((b) => {
    if (b.date !== date || isBookingInactive(b)) return false;

    // QA-009: Ignorar reservas que no bloquean disponibilidad
    if (isBookingInactive(b)) return false;

    // Verificar si el colaborador está asignado a nivel de algún servicio específico
    const matchingServices = b.services?.filter((s) => s.employee_id === empId && !s.liberado_at) || [];
    const isMainAssigned = (b as any).assigned_employee_id === empId;

    if (matchingServices.length > 0) {
      // Bloqueo de tiempo estricto: fin = inicio + duración de SU servicio particular
      return matchingServices.some((s) => {
        const sStart = timeToMinutes(s.hora_inicio || s.start_time || b.start_time);
        const duration = s.duration_minutes || (timeToMinutes(b.end_time) - timeToMinutes(b.start_time));
        const sEnd = sStart + duration;
        return startMin < sEnd && endMin > sStart;
      });
    }

    if (isMainAssigned && !b.services?.length) {
      // Fallback solo cuando la asignación fue global sin detalle de servicios
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return startMin < bEnd && endMin > bStart;
    }

    return false;
  });
}

/**
 * Cuenta reservas activas no asignadas que solapan el intervalo para el mismo tipo de servicio.
 * QA-009: Se excluyen reservas canceladas, expiradas, anuladas o liberadas.
 */
export function countUnassignedBookings(
  service: Service,
  date: string,
  startMin: number,
  endMin: number,
  bookings: Booking[]
): number {
  if (!bookings || bookings.length === 0) return 0;

  return bookings.filter((b) => {
    if (b.date !== date || isBookingInactive(b)) return false;

    // QA-009: Ignorar reservas que no bloquean disponibilidad
    if (isBookingInactive(b)) return false;

    // Si no tiene asignado colaborador principal ni en servicios
    const hasAssigned =
      !!(b as any).assigned_employee_id ||
      b.services?.some((s) => !!s.employee_id && s.employee_id.trim() !== '');
    if (hasAssigned) return false;

    // Verificar coincidencia de tipo/categoría
    const isCategoryMatch =
      b.type === 'mixto' ||
      (service.category === 'barberia' && b.type === 'barberia') ||
      (service.category === 'spa' && b.type === 'spa');
    if (!isCategoryMatch) return false;

    const bStart = timeToMinutes(b.start_time);
    const bEnd = timeToMinutes(b.end_time);
    return startMin < bEnd && endMin > bStart;
  }).length;
}

/**
 * Calcula la disponibilidad completa de todos los slots de 30 minutos
 * considerando la fecha seleccionada, hora actual en Lima, y capacidad por especialista
 */
export function computeSlotsAvailability(params: {
  bookingDate: string; // YYYY-MM-DD
  selectedServices: Service[];
  employees: Employee[];
  employeeBlocks: EmployeeBlock[];
  bookings: Booking[];
  currentLimaDateTime?: { dateStr: string; timeStr: string; totalMinutes: number };
  openTime?: string;
  closeTime?: string;
}): ComputedSlot[] {
  const {
    bookingDate,
    selectedServices,
    employees,
    employeeBlocks,
    bookings,
    currentLimaDateTime,
    openTime = BUSINESS_HOURS.open,
    closeTime = BUSINESS_HOURS.close,
  } = params;

  const limaNow = currentLimaDateTime || getLimaDateTime();
  const isSelectedDateToday = bookingDate === limaNow.dateStr;
  const isSelectedDatePast = bookingDate < limaNow.dateStr;

  // Generar dinámicamente los bloques a partir del horario configurado en el sistema
  const activeSlots = generateSlots(openTime, closeTime, 30);

  // Si no hay servicios seleccionados, duración estimada de 45 min
  const effectiveServices: Service[] =
    selectedServices.length > 0
      ? selectedServices
      : [
          {
            id: 'default-service',
            name: 'Servicio Estándar',
            slug: 'servicio-estandar',
            category: 'barberia',
            price_cents: 3500,
            duration_minutes: 45,
            capacity: 1,
            active: true,
            image_url: '',
            description: '',
          },
        ];

  const totalDuration = effectiveServices.reduce(
    (acc, s) => acc + (s.duration_minutes || 30),
    0
  );

  return activeSlots.map((slotTime) => {
    const slotStartMin = timeToMinutes(slotTime);
    const overallEndMin = slotStartMin + totalDuration;
    const overallEndTime = minutesToTime(overallEndMin);

    if (overallEndMin > timeToMinutes(closeTime)) return { time: slotTime, status: 'lleno', statusLabel: 'Lleno', isSelectable: false, totalDurationMinutes: totalDuration, overallEndTime, reason: 'El servicio termina después del cierre' };

    // 1. REGLA DE TIEMPO REAL (ZONA HORARIA AMERICA/LIMA UTC-5):
    // Si la fecha es anterior a hoy, o si es hoy y el slot es menor o igual a la hora actual
    if (isSelectedDatePast) {
      return {
        time: slotTime,
        status: 'pasado',
        statusLabel: 'Pasado',
        isSelectable: false,
        totalDurationMinutes: totalDuration,
        overallEndTime,
        reason: 'Fecha anterior transcurrida',
      };
    }

    if (isSelectedDateToday && slotStartMin <= limaNow.totalMinutes) {
      return {
        time: slotTime,
        status: 'pasado',
        statusLabel: 'Pasado',
        isSelectable: false,
        totalDurationMinutes: totalDuration,
        overallEndTime,
        reason: 'Hora pasada en tiempo real (UTC-5)',
      };
    }

    // 2. REGLA DE CONCURRENCIA EQUITATIVA Y CAPACIDAD POR ESPECIALISTA:
    // Evaluar cada servicio de forma independiente y secuencial
    let currentServiceStartMin = slotStartMin;
    const servicePlans: ServiceExecutionPlan[] = [];
    let hasCapacityForAllServices = true;
    let bottleneckReason = '';

    for (const srv of effectiveServices) {
      const srvDuration = srv.duration_minutes || 30;
      const srvEndMin = currentServiceStartMin + srvDuration;

      // Especialistas aptos y activos para este servicio
      const eligibleEmps = getEligibleEmployeesForService(srv, employees);

      if (eligibleEmps.length === 0) {
        hasCapacityForAllServices = false;
        bottleneckReason = `Sin especialistas aptos para ${srv.name}`;
        break;
      }

      // Filtrar especialistas que estén libres en la ventana [currentServiceStartMin, srvEndMin)
      const freeSpecialists = eligibleEmps.filter((emp) => {
        if ((emp.shift_start && currentServiceStartMin < timeToMinutes(emp.shift_start)) || (emp.shift_end && srvEndMin > timeToMinutes(emp.shift_end))) return false;
        // Bloqueos/permisos del colaborador
        const blocked = isEmployeeBlocked(
          emp.id,
          bookingDate,
          currentServiceStartMin,
          srvEndMin,
          employeeBlocks
        );
        if (blocked) return false;

        // Citas ya agendadas
        const booked = isEmployeeBooked(
          emp.id,
          bookingDate,
          currentServiceStartMin,
          srvEndMin,
          bookings
        );
        if (booked) return false;

        return true;
      });

      // Contar reservas sin asignar que compiten por el mismo cupo
      const unassignedCount = countUnassignedBookings(
        srv,
        bookingDate,
        currentServiceStartMin,
        srvEndMin,
        bookings
      );

      const netAvailableCount = Math.max(0, freeSpecialists.length - unassignedCount);

      if (netAvailableCount === 0 || freeSpecialists.length === 0) {
        hasCapacityForAllServices = false;
        bottleneckReason = `Aforo completo para ${srv.name}`;
        break;
      }

      // Seleccionar el primer especialista libre disponible para este servicio
      const selectedEmp = freeSpecialists[0];
      servicePlans.push({
        serviceId: srv.id,
        serviceName: srv.name,
        employeeId: selectedEmp.id,
        employeeName: selectedEmp.full_name,
        startTime: minutesToTime(currentServiceStartMin),
        endTime: minutesToTime(srvEndMin),
        durationMinutes: srvDuration,
        priceCents: srv.price_cents,
      });

      // El siguiente servicio inicia cuando concluye el actual
      currentServiceStartMin = srvEndMin;
    }

    if (!hasCapacityForAllServices) {
      return {
        time: slotTime,
        status: 'lleno',
        statusLabel: 'Lleno',
        isSelectable: false,
        totalDurationMinutes: totalDuration,
        overallEndTime,
        reason: bottleneckReason || 'Aforo completo',
      };
    }

    return {
      time: slotTime,
      status: 'disponible',
      statusLabel: 'Libre',
      isSelectable: true,
      totalDurationMinutes: totalDuration,
      overallEndTime,
      servicePlans,
    };
  });
}

export interface EmployeeAvailabilityResult {
  isAvailable: boolean;
  reason?: 'cita_solapada' | 'permiso_bloqueo' | 'fuera_de_turno' | 'inactivo';
  message?: string;
  conflictingBooking?: Booking;
  conflictingBlock?: EmployeeBlock;
}

/**
 * Valida la disponibilidad inmediata de un colaborador específico
 * para una fecha, hora de inicio y duración estimadas.
 */
export function checkEmployeeAvailability(params: {
  employee: Employee;
  date: string;
  startTime: string;
  durationMinutes: number;
  bookings: Booking[];
  employeeBlocks: EmployeeBlock[];
}): EmployeeAvailabilityResult {
  const { employee, date, startTime, durationMinutes, bookings, employeeBlocks } = params;

  if (!employee || !employee.active) {
    return {
      isAvailable: false,
      reason: 'inactivo',
      message: 'Colaborador no se encuentra activo',
    };
  }

  const startMin = timeToMinutes(startTime);
  const endMin = startMin + durationMinutes;

  // 1. Validar turnos de trabajo
  if (employee.shift_start && employee.shift_end) {
    const shiftStartMin = timeToMinutes(employee.shift_start);
    const shiftEndMin = timeToMinutes(employee.shift_end);
    if (startMin < shiftStartMin || endMin > shiftEndMin) {
      return {
        isAvailable: false,
        reason: 'fuera_de_turno',
        message: `Fuera de turno (Horario: ${employee.shift_start} a ${employee.shift_end})`,
      };
    }
  }

  // 2. Validar permisos / ausencias
  const blockConflict = (employeeBlocks || []).find((b) => {
    if (b.employee_id !== employee.id) return false;
    if (b.status && b.status !== 'aprobado' && b.status !== 'activo') return false;

    const bDate = b.block_date || b.date || b.start_date;
    const bEndDate = b.end_date || bDate;
    const inDateRange =
      bDate && bEndDate ? date >= bDate && date <= bEndDate : bDate === date;
    if (!inDateRange) return false;

    if (b.is_full_day || (!b.start_time && !b.end_time)) return true;

    const bStart = timeToMinutes(b.start_time || '00:00');
    const bEnd = timeToMinutes(b.end_time || '23:59');
    return startMin < bEnd && endMin > bStart;
  });

  if (blockConflict) {
    return {
      isAvailable: false,
      reason: 'permiso_bloqueo',
      message: `En permiso o ausencia (${blockConflict.reason || 'Horario bloqueado'})`,
      conflictingBlock: blockConflict,
    };
  }

  // 3. Validar citas agendadas que solapen
  let conflictingBookingDetails: { code?: string; start_time: string; end_time: string } | null = null;
  const bookingConflict = (bookings || []).find((b) => {
    if (b.date !== date || isBookingInactive(b)) return false;

    const matchingServices = b.services?.filter((s) => s.employee_id === employee.id && !s.liberado_at) || [];
    const isMainAssigned = (b as any).assigned_employee_id === employee.id;

    if (matchingServices.length > 0) {
      const match = matchingServices.find((s) => {
        const sStart = timeToMinutes(s.hora_inicio || s.start_time || b.start_time);
        const duration = s.duration_minutes || (timeToMinutes(b.end_time) - timeToMinutes(b.start_time));
        const sEnd = sStart + duration;
        return startMin < sEnd && endMin > sStart;
      });
      if (match) {
        const sStart = timeToMinutes(match.hora_inicio || match.start_time || b.start_time);
        const duration = match.duration_minutes || (timeToMinutes(b.end_time) - timeToMinutes(b.start_time));
        conflictingBookingDetails = {
          code: b.code,
          start_time: minutesToTime(sStart),
          end_time: minutesToTime(sStart + duration),
        };
        return true;
      }
      return false;
    }

    if (isMainAssigned && !b.services?.length) {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      if (startMin < bEnd && endMin > bStart) {
        conflictingBookingDetails = {
          code: b.code,
          start_time: b.start_time,
          end_time: b.end_time,
        };
        return true;
      }
    }

    return false;
  });

  if (bookingConflict && conflictingBookingDetails) {
    return {
      isAvailable: false,
      reason: 'cita_solapada',
      message: `Cita ya reservada (${conflictingBookingDetails.code || 'Cita'}: ${conflictingBookingDetails.start_time} - ${conflictingBookingDetails.end_time})`,
      conflictingBooking: bookingConflict,
    };
  }

  return { isAvailable: true };
}

