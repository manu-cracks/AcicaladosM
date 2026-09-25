import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DashboardSkeleton } from './DashboardSkeleton';
import { formatSoles, Booking } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { isBookingConfirmedPayment } from '../../services/financialSSOT';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  Calendar as CalendarIcon,
  X,
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  type: 'reserva' | 'permiso';
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endTime?: string;
  specialist: string;
  specialistId?: string;
  client: string;
  label: string;
  serviceName?: string;
  status?: string;
  priceCents?: number;
  rawBooking?: Booking;
  reason?: string;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAY_NAMES = [
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
  'DOMINGO',
];

export const CalendarioView: React.FC = () => {
  const { bookings, employees, attendance, pulseRealtime, lastSyncTimestamp, refreshData, isDataLoading } = useApp();

  // Selected date state (defaults to current month)
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes'>('mes');
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('all');
  const [showReservations, setShowReservations] = useState(true);
  const [showAbsences, setShowAbsences] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbBlocks, setDbBlocks] = useState<any[]>([]);

  // Modal detail states
  const [dayDetailModal, setDayDetailModal] = useState<{
    dateStr: string;
    events: CalendarEvent[];
  } | null>(null);

  const [selectedBookingModal, setSelectedBookingModal] = useState<Booking | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Helper string for today in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  // Fetch employee blocks / permissions from Supabase directly
  useEffect(() => {
    supabase
      .from('employee_blocks')
      .select('*, employees(first_name, last_name)')
      .then(({ data }) => {
        if (data) setDbBlocks(data);
      });
  }, [lastSyncTimestamp]);

  // Handle refresh action
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (refreshData) {
        await refreshData();
      } else {
        pulseRealtime();
      }
      const { data } = await supabase
        .from('employee_blocks')
        .select('*, employees(first_name, last_name)');
      if (data) setDbBlocks(data);
    } catch (err) {
      console.error('Error refreshing calendar:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMode === 'mes') {
      setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    } else if (viewMode === 'semana') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      setCurrentDate(prevWeek);
    } else {
      const prevDay = new Date(currentDate);
      prevDay.setDate(prevDay.getDate() - 1);
      setCurrentDate(prevDay);
    }
  };

  const handleNextMonth = () => {
    if (viewMode === 'mes') {
      setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    } else if (viewMode === 'semana') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      setCurrentDate(nextWeek);
    } else {
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setCurrentDate(nextDay);
    }
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  // Convert bookings and absences into unified CalendarEvents
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // 1. Process bookings at service-specialist level (Filtro estricto: solo reservas con pago confirmado)
    const confirmedBookings = bookings.filter((b) => isBookingConfirmedPayment(b));
    confirmedBookings.forEach((b) => {
      if (b.services && b.services.length > 0) {
        b.services.forEach((srv, idx) => {
          let specialistName = srv.employee_name || '';
          if (!specialistName || specialistName === 'Especialista') {
            const emp = employees.find(
              (e) => e.id === (srv.employee_id || (b as any).assigned_employee_id)
            );
            specialistName = emp ? emp.full_name : 'Especialista';
          }
          const specialistId = srv.employee_id || (b as any).assigned_employee_id || '';
          const srvStart = srv.start_time || srv.hora_inicio || b.start_time?.substring(0, 5) || '10:00';
          const srvEnd = srv.end_time || srv.hora_fin || b.end_time?.substring(0, 5) || '11:00';

          events.push({
            id: `booking-${b.id}-${srv.service_id || idx}`,
            type: 'reserva',
            date: b.date,
            time: srvStart,
            endTime: srvEnd,
            specialist: specialistName,
            specialistId: specialistId,
            client: b.client_name,
            label: 'Cita',
            serviceName: srv.service_name || 'Servicio',
            priceCents: srv.price_cents || b.total_price_cents,
            rawBooking: b,
          });
        });
      } else {
        const specialistId = (b as any).assigned_employee_id || '';
        const emp = employees.find((e) => e.id === specialistId);
        const specialistName = emp ? emp.full_name : 'Especialista';

        events.push({
          id: `booking-${b.id}`,
          type: 'reserva',
          date: b.date,
          time: b.start_time?.substring(0, 5) || '10:00',
          endTime: b.end_time?.substring(0, 5) || '11:00',
          specialist: specialistName,
          specialistId: specialistId,
          client: b.client_name,
          label: 'Cita',
          serviceName: 'Servicio Programado',
          priceCents: b.total_price_cents,
          rawBooking: b,
        });
      }
    });

    // 2. Process real Supabase employee_blocks
    dbBlocks.forEach((block: any) => {
      const empName = block.employees
        ? `${block.employees.first_name || ''} ${block.employees.last_name || ''}`.trim()
        : employees.find((e) => e.id === block.employee_id)?.full_name || 'Colaborador';

      events.push({
        id: `block-${block.id}`,
        type: 'permiso',
        date: block.block_date,
        time: block.start_time ? block.start_time.substring(0, 5) : '09:00',
        endTime: block.end_time ? block.end_time.substring(0, 5) : '18:00',
        specialist: empName,
        specialistId: block.employee_id,
        client: empName,
        label: 'Permiso',
        reason: block.reason || 'Permiso laboral programado',
      });
    });

    // 3. Process attendance absences / permissions
    attendance.forEach((att) => {
      if (att.status === 'en_permiso' || att.status === 'falta_justificada') {
        events.push({
          id: `attendance-${att.id}`,
          type: 'permiso',
          date: att.date,
          time: att.check_in || '09:00',
          endTime: att.check_out || '18:00',
          specialist: att.employee_name,
          specialistId: att.employee_id,
          client: att.employee_name,
          label: att.status === 'en_permiso' ? 'Permiso' : 'Ausencia Justificada',
          reason: att.justification_note || 'Permiso laboral aprobado',
        });
      }
    });

    return events;
  }, [bookings, employees, dbBlocks, attendance]);

  // Filter events by specialist & toggles
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (ev.type === 'reserva' && !showReservations) return false;
      if (ev.type === 'permiso' && !showAbsences) return false;
      if (selectedSpecialistId !== 'all') {
        if (ev.specialistId && ev.specialistId !== selectedSpecialistId) return false;
      }
      return true;
    });
  }, [allEvents, showReservations, showAbsences, selectedSpecialistId]);

  // Map events by date string YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((ev) => {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    });
    // Sort events chronologically by time
    map.forEach((list) => {
      list.sort((a, b) => a.time.localeCompare(b.time));
    });
    return map;
  }, [filteredEvents]);

  // Generate 7-column calendar cells for currentMonth
  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    const totalDaysInMonth = lastDay.getDate();

    // Monday = 0, Tuesday = 1, ... Sunday = 6
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const cells: {
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
    }[] = [];

    // Previous month trailing days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: true,
      });
    }

    // Next month leading days to complete grid (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Title formatting: e.g. "Septiembre 2026"
  const formattedTitle = useMemo(() => {
    if (viewMode === 'mes') {
      return `${MONTH_NAMES[currentMonth]} ${currentYear}`;
    } else if (viewMode === 'semana') {
      return `Semana · ${MONTH_NAMES[currentMonth]} ${currentYear}`;
    } else {
      return `${currentDate.getDate()} de ${MONTH_NAMES[currentMonth]} ${currentYear}`;
    }
  }, [viewMode, currentMonth, currentYear, currentDate]);

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 flex flex-col font-sans">
      
      {/* 1. BARRA SUPERIOR DE ESTADO */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-[#111111] border-b border-[#C8A45C]/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-xs font-semibold text-emerald-400 tracking-wide">
            Sincronización en tiempo real activa (Supabase Realtime)
          </span>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1C1A14] hover:bg-[#2A2415] text-[#E6C875] border border-[#C8A45C]/40 hover:border-[#C8A45C] transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#C8A45C] ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* 2. BARRA DE CONTROL Y NAVEGACIÓN DEL CALENDARIO */}
      <div className="px-4 sm:px-6 py-4 border-b border-neutral-800 bg-[#0E0E0E] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shrink-0">
        
        {/* Controles de Navegación Temporal (Flechas, Hoy y Título Mes/Año) */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-xl bg-[#141414] border border-neutral-800 p-0.5 shadow-sm">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Anterior"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              className="px-3 py-1 text-xs font-semibold text-neutral-200 hover:text-[#C8A45C] transition cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Siguiente"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#C8A45C] tracking-wide capitalize pl-1">
            {formattedTitle}
          </h2>
        </div>

        {/* Segmented Mode Selector [ Día | Semana | Mes ] + Toggles + Especialistas */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Selector de modo [ Día | Semana | Mes ] con Mes por defecto */}
          <div className="inline-flex p-1 rounded-xl bg-[#141414] border border-neutral-800 shadow-sm">
            {(['dia', 'semana', 'mes'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer capitalize ${
                  viewMode === mode
                    ? 'bg-[#C8A45C] text-black font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {mode === 'dia' ? 'Día' : mode === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          {/* Filtros de Tipo de Evento en Chips/Toggles */}
          <div className="flex items-center gap-2">
            {/* Chip Reserva (azul/dorado) */}
            <button
              type="button"
              onClick={() => setShowReservations(!showReservations)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                showReservations
                  ? 'bg-[#C8A45C]/20 border-[#C8A45C] text-[#E6C875]'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#C8A45C]" />
              <span>Reserva</span>
            </button>

            {/* Chip Permiso / Ausencia (amarillo/ámbar) */}
            <button
              type="button"
              onClick={() => setShowAbsences(!showAbsences)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                showAbsences
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Permiso / Ausencia</span>
            </button>
          </div>

          {/* Selector desplegable de especialistas al extremo derecho */}
          <select
            value={selectedSpecialistId}
            onChange={(e) => setSelectedSpecialistId(e.target.value)}
            className="bg-[#141414] text-xs font-medium text-neutral-200 border border-neutral-800 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C8A45C] cursor-pointer shadow-sm ml-auto lg:ml-0"
          >
            <option value="all">Todos los Especialistas</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. VISTAS DEL CALENDARIO */}
      <div className="flex-1 p-4 sm:p-6 overflow-x-auto">
        
        {/* VISTA MENSUAL (Grid de 7 Columnas) */}
        {viewMode === 'mes' && (
          <div className="min-w-[850px] bg-[#0E0E0E] rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl">
            
            {/* Cabeceras de días: LUNES a DOMINGO */}
            <div className="grid grid-cols-7 border-b border-neutral-800 bg-[#121212]">
              {WEEKDAY_NAMES.map((name) => (
                <div
                  key={name}
                  className="py-3 px-2 text-center text-xs font-bold tracking-widest text-neutral-400 uppercase font-serif-luxury"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Cuadrícula de Celdas */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-neutral-800/80 bg-[#0E0E0E]">
              {calendarCells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateStr) || [];
                const isToday = cell.dateStr === todayStr;

                // Max 3 chips in cell, excess shown in "+X más"
                const visibleEvents = dayEvents.slice(0, 3);
                const excessCount = dayEvents.length - visibleEvents.length;

                return (
                  <div
                    key={cell.dateStr}
                    className={`min-h-[130px] sm:min-h-[145px] p-2 flex flex-col justify-between transition-colors ${
                      cell.isCurrentMonth ? 'bg-[#0E0E0E]' : 'bg-[#090909] opacity-40'
                    } ${isToday ? 'ring-1 ring-inset ring-[#C8A45C]/60 bg-[#14120C]' : 'hover:bg-[#131313]'}`}
                  >
                    {/* Header de la Celda: Número de día y Contador de Eventos */}
                    <div className="flex items-center justify-between mb-1.5">
                      {isToday ? (
                        <span className="w-6 h-6 rounded-full bg-[#C8A45C] text-black font-extrabold flex items-center justify-center text-xs shadow-md">
                          {cell.dayNumber}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-neutral-300 pl-0.5">
                          {cell.dayNumber}
                        </span>
                      )}

                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/30">
                          {dayEvents.length} ev.
                        </span>
                      )}
                    </div>

                    {/* Lista de citas acumuladas para ese día */}
                    <div className="space-y-1 flex-1 overflow-hidden">
                      {visibleEvents.map((ev) => {
                        const isAbsence = ev.type === 'permiso';

                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              if (ev.rawBooking) {
                                setSelectedBookingModal(ev.rawBooking);
                              } else {
                                setDayDetailModal({
                                  dateStr: cell.dateStr,
                                  events: dayEvents,
                                });
                              }
                            }}
                            className={`px-1.5 py-1 rounded text-[11px] truncate flex items-center gap-1.5 transition cursor-pointer border ${
                              isAbsence
                                ? 'bg-amber-950/25 border-amber-500/40 text-amber-300 hover:bg-amber-900/40'
                                : 'bg-[#181611] border-[#C8A45C]/35 text-neutral-200 hover:bg-[#221E14] hover:border-[#C8A45C]'
                            }`}
                            title={`${ev.time} ${ev.specialist} · ${ev.label}: ${ev.client}`}
                          >
                            <span className="font-bold text-[#C8A45C] shrink-0 text-[10px]">
                              {ev.time}
                            </span>
                            <User className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                            <span className="truncate">
                              <span className="font-semibold text-neutral-300">{ev.specialist}</span> · {ev.label}: {ev.client}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botón "+X más" si hay excedente de citas */}
                    {excessCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDayDetailModal({
                            dateStr: cell.dateStr,
                            events: dayEvents,
                          })
                        }
                        className="text-[10px] font-bold text-[#C8A45C] hover:text-[#E6C875] hover:underline pt-1 text-left cursor-pointer transition"
                      >
                        +{excessCount} más
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VISTA SEMANAL */}
        {viewMode === 'semana' && (
          <div className="min-w-[850px] bg-[#0E0E0E] rounded-2xl border border-neutral-800 p-4 space-y-4">
            <p className="text-xs text-neutral-400">
              Desglose detallado de la semana seleccionada. Haz clic en cualquier cita para ver sus detalles.
            </p>
            <div className="grid grid-cols-7 gap-3">
              {calendarCells.slice(0, 7).map((cell, idx) => {
                const dayEvents = eventsByDate.get(cell.dateStr) || [];
                const isToday = cell.dateStr === todayStr;

                return (
                  <div
                    key={cell.dateStr}
                    className={`rounded-xl p-3 border ${
                      isToday
                        ? 'bg-[#16140E] border-[#C8A45C]'
                        : 'bg-[#121212] border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
                      <span className="text-[11px] font-bold text-[#C8A45C]">
                        {WEEKDAY_NAMES[idx]}
                      </span>
                      <span className="text-xs font-semibold text-neutral-200">
                        {cell.dayNumber}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-96 overflow-y-auto">
                      {dayEvents.length > 0 ? (
                        dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => {
                              if (ev.rawBooking) setSelectedBookingModal(ev.rawBooking);
                            }}
                            className="p-2 rounded-lg bg-[#1A1813] border border-[#C8A45C]/30 text-xs cursor-pointer hover:border-[#C8A45C]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[#C8A45C] font-bold">{ev.time}</span>
                              <span className="text-[10px] text-neutral-400">{ev.label}</span>
                            </div>
                            <p className="text-neutral-200 font-semibold truncate mt-0.5">{ev.client}</p>
                            <p className="text-[10px] text-neutral-400 truncate">{ev.specialist}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-neutral-500 italic py-2 text-center">
                          Sin eventos
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VISTA DIARIA */}
        {viewMode === 'dia' && (
          <div className="max-w-3xl mx-auto bg-[#0E0E0E] rounded-2xl border border-neutral-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-serif-luxury text-lg font-bold text-white">
                  Agenda del {currentDate.getDate()} de {MONTH_NAMES[currentMonth]} {currentYear}
                </h3>
                <p className="text-xs text-neutral-400">
                  Total de eventos programados para hoy:{' '}
                  <span className="text-[#C8A45C] font-bold">
                    {(eventsByDate.get(todayStr) || []).length}
                  </span>
                </p>
              </div>
            </div>

            <div className="divide-y divide-neutral-800">
              {(eventsByDate.get(todayStr) || []).length > 0 ? (
                (eventsByDate.get(todayStr) || []).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => {
                      if (ev.rawBooking) setSelectedBookingModal(ev.rawBooking);
                    }}
                    className="py-3 px-2 flex items-center justify-between hover:bg-[#141414] rounded-lg transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-center">
                        <span className="text-sm font-bold text-[#C8A45C] block">{ev.time}</span>
                        {ev.endTime && <span className="text-[10px] text-neutral-500 block">{ev.endTime}</span>}
                      </div>
                      <div className="w-px h-8 bg-neutral-800" />
                      <div>
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{ev.client}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/30">
                            {ev.label}
                          </span>
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Especialista: <span className="text-neutral-200">{ev.specialist}</span>
                          {ev.serviceName && ` · ${ev.serviceName}`}
                        </p>
                      </div>
                    </div>

                    {ev.priceCents && (
                      <span className="text-xs font-bold text-[#E6C875]">
                        {formatSoles(ev.priceCents)}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-neutral-500">
                  <CalendarIcon className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm">No hay citas registradas para este día.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLE DE DÍA (Al hacer clic en "+X más") */}
      {dayDetailModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDayDetailModal(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#111111] border border-[#C8A45C]/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#C8A45C]/20 bg-[#161616]">
              <div>
                <h3 className="font-serif-luxury text-lg font-bold text-white">
                  Eventos del {dayDetailModal.dateStr}
                </h3>
                <p className="text-xs text-[#C8A45C]">
                  {dayDetailModal.events.length} eventos acumulados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDayDetailModal(null)}
                className="p-1 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 divide-y divide-neutral-800">
              {dayDetailModal.events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (ev.rawBooking) {
                      setDayDetailModal(null);
                      setSelectedBookingModal(ev.rawBooking);
                    }
                  }}
                  className="py-3 px-2 flex items-center justify-between hover:bg-[#161616] rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#C8A45C] w-12 text-center">
                      {ev.time}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {ev.client}{' '}
                        <span className="text-[10px] text-neutral-400 font-normal">
                          · {ev.label}
                        </span>
                      </p>
                      <p className="text-xs text-neutral-400">
                        Especialista: <span className="text-neutral-200">{ev.specialist}</span>
                        {ev.serviceName && ` · ${ev.serviceName}`}
                      </p>
                    </div>
                  </div>

                  {ev.priceCents && (
                    <span className="text-xs font-bold text-[#E6C875]">
                      {formatSoles(ev.priceCents)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#141414] border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDayDetailModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1C1A14] text-[#E6C875] border border-[#C8A45C]/30 hover:border-[#C8A45C] transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE RESERVA INDIVIDUAL */}
      {selectedBookingModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedBookingModal(null)}
        >
          <div
            className="w-full max-w-md bg-[#111111] border border-[#C8A45C]/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#C8A45C] uppercase tracking-wider">
                  Código: {selectedBookingModal.code}
                </span>
                <h3 className="font-serif-luxury text-lg font-bold text-white">
                  {selectedBookingModal.client_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingModal(null)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="flex justify-between text-neutral-400">
                <span>Fecha y Horario:</span>
                <span className="text-white font-semibold">
                  {selectedBookingModal.date} ({selectedBookingModal.start_time} - {selectedBookingModal.end_time})
                </span>
              </p>
              <p className="flex justify-between text-neutral-400">
                <span>Teléfono:</span>
                <span className="text-white font-semibold">{selectedBookingModal.client_phone}</span>
              </p>
              <p className="flex justify-between text-neutral-400">
                <span>Estado Reserva:</span>
                <span className="text-emerald-400 font-semibold uppercase">
                  {selectedBookingModal.status}
                </span>
              </p>
              <p className="flex justify-between text-neutral-400">
                <span>Total a Pagar:</span>
                <span className="text-[#E6C875] font-bold text-sm">
                  {formatSoles(selectedBookingModal.total_price_cents)}
                </span>
              </p>
            </div>

            <div className="pt-2 border-t border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
                Servicios Contratados:
              </span>
              <div className="space-y-1 mt-1">
                {selectedBookingModal.services.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-neutral-900 border border-neutral-800 flex justify-between items-center text-xs"
                  >
                    <span>{s.service_name}</span>
                    <span className="text-[#C8A45C] font-semibold">{formatSoles(s.price_cents)}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedBookingModal(null)}
              className="w-full py-2 rounded-xl text-xs font-semibold bg-[#C8A45C] text-black font-bold hover:bg-[#D4AF37] transition cursor-pointer"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
