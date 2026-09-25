import { qaRpc, mapBooking } from '../../lib/qaApi';
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Service, formatSoles, BusinessCategory, BookingServiceItem } from '../../types';
import { PaymentQRWidget } from '../common/PaymentQRWidget';
import confetti from 'canvas-confetti';
import {
  Scissors,
  Sparkles,
  Layers,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  sanitizePhone,
  sanitizeDni,
  isValidPhone,
  isValidDni,
  handleNumericKeyDown,
  PHONE_PLACEHOLDER,
  DNI_PLACEHOLDER,
  PHONE_ERROR_MESSAGE,
  DNI_ERROR_MESSAGE,
} from '../../lib/validators';
import { getTodayDateString } from '../../data/initialData';
import {
  computeSlotsAvailability,
  getLimaDateTime,
  ComputedSlot,
} from '../../lib/bookingAvailability';

export const PublicBookingFlow: React.FC = () => {
  const {
    services,
    addBooking,
    currentUser,
    currentRole,
    setActiveView,
    paymentSettings,
    attendanceSettings,
  } = useApp();

  // Step 1 to 5
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [selectedType, setSelectedType] = useState<BusinessCategory>('barberia');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [bookingDate, setBookingDate] = useState<string>(() => getTodayDateString());
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  const [availability, setAvailability] = useState<any>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  useEffect(() => {
    let active = true;
    setAvailability(null);
    const load = () => qaRpc<any>('qa_availability', { p_date: bookingDate }).then(data => {
      if (active) { setAvailability(data); setAvailabilityError(''); }
    }).catch(() => { if (active) { setAvailability(null); setAvailabilityError('No se pudo consultar la disponibilidad. Reintentando…'); } });
    load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [bookingDate]);
  const employees = availability?.employees || [];
  const employeeBlocks = availability?.blocks || [];
  const bookings = useMemo(() => (availability?.bookings || []).map(mapBooking), [availability]);

  // Real-time ticker for America/Lima (UTC-5)
  const [limaClock, setLimaClock] = useState(() => getLimaDateTime());
  useEffect(() => {
    const timer = setInterval(() => {
      setLimaClock(getLimaDateTime());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Client Details
  const [clientName, setClientName] = useState<string>(currentUser.role === 'cliente' ? currentUser.name : '');
  const [clientPhone, setClientPhone] = useState<string>(currentUser.role === 'cliente' ? (currentUser.phone || '') : '');
  const [clientEmail, setClientEmail] = useState<string>(currentUser.role === 'cliente' ? currentUser.email : '');
  const [clientDni, setClientDni] = useState<string>(currentUser.role === 'cliente' ? (currentUser.dni || '') : '');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (currentUser.role === 'cliente') {
      if (currentUser.name) setClientName(currentUser.name);
      if (currentUser.email) setClientEmail(currentUser.email);
      if (currentUser.phone) setClientPhone(currentUser.phone);
      if (currentUser.dni) setClientDni(currentUser.dni);
    }
  }, [currentUser]);
  const [bookingFormError, setBookingFormError] = useState<string | null>(null);
  // QA-022: Protección contra doble envío
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generated Booking Result
  const [createdBooking, setCreatedBooking] = useState<any | null>(null);

  // Filter services available for current type
  const availableServices = useMemo(() => {
    return services.filter((s) => {
      if (!s.active) return false;
      if (selectedType === 'mixto') return true;
      return s.category === selectedType;
    });
  }, [selectedType, services]);

  // Totals
  const totalPriceCents = selectedServices.reduce((acc, s) => acc + s.price_cents, 0);
  const totalDurationMinutes = selectedServices.reduce((acc, s) => acc + (s.duration_minutes || 30), 0);
  const effectiveAdvancePercentage = createdBooking?.advance_percentage ?? paymentSettings.advance_percentage;
  const minAdvanceCents = Math.round(((createdBooking?.total_price_cents ?? totalPriceCents) * effectiveAdvancePercentage) / 100);

  const toggleServiceSelection = (srv: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === srv.id);
      if (exists) {
        return prev.filter((s) => s.id !== srv.id);
      } else {
        return [...prev, srv];
      }
    });
  };

  const openTime = availability?.open_time || '09:00';
  const closeTime = availability?.close_time || '21:00';

  // Cálculo estricto de disponibilidad en bloques de 30 minutos y concurrencia por especialista
  const computedSlots: ComputedSlot[] = useMemo(() => {
    return computeSlotsAvailability({
      bookingDate,
      selectedServices,
      employees,
      employeeBlocks,
      bookings,
      currentLimaDateTime: limaClock,
      openTime,
      closeTime,
    });
  }, [bookingDate, selectedServices, employees, employeeBlocks, bookings, limaClock, openTime, closeTime]);

  // Slot seleccionado actualmente
  const selectedSlotObj = useMemo(() => {
    return computedSlots.find((s) => s.time === selectedSlot);
  }, [computedSlots, selectedSlot]);

  // Cantidad de slots libres disponibles para la fecha
  const availableSlotsCount = useMemo(() => {
    return computedSlots.filter((s) => s.status === 'disponible').length;
  }, [computedSlots]);

  // Auto-selección inteligente del primer horario disponible
  useEffect(() => {
    if (!selectedSlot || !selectedSlotObj || selectedSlotObj.status !== 'disponible') {
      const firstAvailable = computedSlots.find((s) => s.status === 'disponible');
      if (firstAvailable) {
        setSelectedSlot(firstAvailable.time);
      } else {
        setSelectedSlot('');
      }
    }
  }, [computedSlots, selectedSlot, selectedSlotObj]);

  // QA-002: handleFinishBooking ahora es async - espera confirmación de Supabase
  // antes de mostrar el paso 5. Si falla, muestra error y conserva el formulario.
  const handleFinishBooking = async () => {
    setBookingFormError(null);
    if (!clientName.trim()) {
      setBookingFormError('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!isValidPhone(clientPhone)) {
      setBookingFormError(PHONE_ERROR_MESSAGE);
      return;
    }
    if (clientDni.trim() && !isValidDni(clientDni)) {
      setBookingFormError(DNI_ERROR_MESSAGE);
      return;
    }

    if (!selectedSlot || !selectedSlotObj || selectedSlotObj.status !== 'disponible') {
      setBookingFormError('Por favor selecciona un horario disponible.');
      return;
    }

    // QA-022: Proteger contra doble clic
    if (isSubmitting) return;
    setIsSubmitting(true);

    const overallEnd = selectedSlotObj.overallEndTime;
    const plans = selectedSlotObj.servicePlans || [];

    // Mapear cada servicio con su especialista asignado y sus horas exactas de inicio y fin
    const mappedServices: BookingServiceItem[] = selectedServices.map((srv, idx) => {
      const planItem = plans.find((p) => p.serviceId === srv.id) || plans[idx];
      const specialistId = planItem?.employeeId || employees[0]?.id || 'emp-1';
      const specialistName = planItem?.employeeName || employees[0]?.full_name || 'Especialista';
      const srvStart = planItem?.startTime || selectedSlot;
      const srvEnd = planItem?.endTime || overallEnd;

      return {
        service_id: srv.id,
        service_name: srv.name,
        employee_id: specialistId,
        employee_name: specialistName,
        price_cents: srv.price_cents,
        duration_minutes: srv.duration_minutes || 30,
        hora_inicio: srvStart,
        hora_fin: srvEnd,
        start_time: srvStart,
        end_time: srvEnd,
      };
    });

    try {
      // QA-002: addBooking es async - solo avanzar si Supabase confirma el INSERT
      const newBooking = await addBooking({
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || '',
        client_dni: clientDni,
        date: bookingDate,
        start_time: selectedSlot,
        end_time: overallEnd,
        type: selectedType,
        services: mappedServices,
        total_price_cents: totalPriceCents,
        advance_amount_cents: 0,
        payment_status: 'sin_pago',
        notes,
      });

      if (!newBooking) {
        // QA-002: INSERT falló - mostrar error, NO mostrar ticket
        setBookingFormError(
          'No se pudo registrar tu reserva. Por favor verifica tu conexión e inténtalo nuevamente.'
        );
        return;
      }

      // QA-002: Solo llegar aquí si Supabase confirmó el INSERT
      setCreatedBooking(newBooking);
      setCurrentStep(5);

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#C8A45C', '#DFCA8D', '#22C55E', '#FFFFFF'],
        });
      } catch {
        // ignore
      }
    } catch (err: any) {
      setBookingFormError(
        err?.message || 'Error inesperado al procesar la reserva. Inténtalo nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsLabels = [
    { num: 1, label: 'Tipo' },
    { num: 2, label: 'Servicios' },
    { num: 3, label: 'Fecha y Hora' },
    { num: 4, label: 'Datos Contacto' },
    { num: 5, label: 'Pago de Adelanto' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {availabilityError && <p role="alert" className="text-amber-300 text-sm">{availabilityError}</p>}
      {/* Step Indicator Header */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[#C8A45C]">
          Asistente de Reserva en 5 Pasos
        </span>
        <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white">
          Agendar Cita en Acicalados
        </h1>
      </div>

      {/* Steps Breadcrumbs */}
      <div className="flex items-center justify-between max-w-2xl mx-auto px-2">
        {stepsLabels.map((s, idx) => {
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;
          return (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    isDone
                      ? 'bg-emerald-500 text-black'
                      : isCurrent
                      ? 'bg-[#C8A45C] text-black ring-4 ring-[#C8A45C]/20'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span
                  className={`text-[10px] hidden sm:block ${
                    isCurrent ? 'text-[#E6C875] font-semibold' : 'text-neutral-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < stepsLabels.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    currentStep > s.num ? 'bg-emerald-500' : 'bg-neutral-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 1: Type Selection */}
      {currentStep === 1 && (
        <div className="bg-[#141414] border border-[#C8A45C]/25 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="space-y-1">
            <h3 className="font-serif-luxury text-lg font-bold text-white">
              Paso 1: ¿Qué tipo de experiencia buscas hoy?
            </h3>
            <p className="text-xs text-neutral-400">
              Selecciona si deseas servicios de barbería, tratamientos de spa o combinar ambos en tu visita.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setSelectedType('barberia')}
              className={`p-5 rounded-xl text-left border transition flex flex-col justify-between space-y-4 ${
                selectedType === 'barberia'
                  ? 'bg-[#1F1C14] border-[#C8A45C] shadow-lg shadow-[#C8A45C]/10'
                  : 'bg-[#181818] border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C]">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif-luxury font-bold text-sm text-white">Barbería Clásica</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Degradados, afeitado a navaja, ritual de toalla caliente y cuidado de barba.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#C8A45C]">Especialistas barberos</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('spa')}
              className={`p-5 rounded-xl text-left border transition flex flex-col justify-between space-y-4 ${
                selectedType === 'spa'
                  ? 'bg-[#1F1C14] border-[#C8A45C] shadow-lg shadow-[#C8A45C]/10'
                  : 'bg-[#181818] border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-900/20 border border-purple-800/40 flex items-center justify-center text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif-luxury font-bold text-sm text-white">Spa & Estética</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Masajes descontracturantes, limpieza facial profunda, manicure y pedicure.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-purple-400">Terapeutas calificadas</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('mixto')}
              className={`p-5 rounded-xl text-left border transition flex flex-col justify-between space-y-4 ${
                selectedType === 'mixto'
                  ? 'bg-[#1F1C14] border-[#C8A45C] shadow-lg shadow-[#C8A45C]/10'
                  : 'bg-[#181818] border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-900/20 border border-blue-800/40 flex items-center justify-center text-blue-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif-luxury font-bold text-sm text-white">Experiencia Mixta</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Combina servicios de barbería y spa en una misma cita con especialistas asignados.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-blue-400">Atención coordinada</span>
            </button>
          </div>

          <div className="flex justify-end pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black transition flex items-center gap-2"
            >
              <span>Continuar a Selección de Servicios</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Service Selection */}
      {currentStep === 2 && (
        <div className="bg-[#141414] border border-[#C8A45C]/25 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
            <div>
              <h3 className="font-serif-luxury text-lg font-bold text-white">
                Paso 2: Elige tus servicios
              </h3>
              <p className="text-xs text-neutral-400">
                Puedes seleccionar uno o varios servicios para tu sesión.
              </p>
            </div>

            <div className="text-right bg-[#1A1A1A] px-3.5 py-2 rounded-xl border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">Total acumulado ({selectedServices.length} srv):</span>
              <span className="text-base font-bold text-[#E6C875]">{formatSoles(totalPriceCents)}</span>
              <span className="text-[10px] text-neutral-500 block">⏱️ {totalDurationMinutes} min</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableServices.map((service) => {
              const isSelected = selectedServices.some((s) => s.id === service.id);
              return (
                <div
                  key={service.id}
                  onClick={() => toggleServiceSelection(service)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#1C1A14] border-[#C8A45C] shadow-sm'
                      : 'bg-[#181818] border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-xs border ${
                          isSelected
                            ? 'bg-[#C8A45C] text-black border-[#C8A45C]'
                            : 'border-neutral-700 bg-neutral-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                      <h4 className="text-xs font-semibold text-white">{service.name}</h4>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-2 pl-7">
                      {service.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] pl-7 pt-1 text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#C8A45C]" />
                        <span>{service.duration_minutes} min</span>
                      </span>
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                          service.category === 'barberia' ? 'badge-gold' : 'bg-purple-900/30 text-purple-300'
                        }`}
                      >
                        {service.category}
                      </span>
                    </div>
                  </div>

                  <span className="text-sm font-bold text-[#E6C875] whitespace-nowrap">
                    {formatSoles(service.price_cents)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Advance calculation alert */}
          <div className="bg-[#181611] border border-[#C8A45C]/30 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-neutral-300">
              <ShieldCheck className="w-4 h-4 text-[#C8A45C]" />
              {/* QA-011: Usar advance_percentage dinámico, no hardcodeado */}
              <span>Adelanto del {paymentSettings.advance_percentage}% requerido para confirmar:</span>
            </div>
            <span className="font-bold text-[#E6C875]">{formatSoles(minAdvanceCents)}</span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>

            <button
              type="button"
              disabled={selectedServices.length === 0}
              onClick={() => setCurrentStep(3)}
              className={`px-6 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                selectedServices.length > 0
                  ? 'bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <span>Continuar a Fecha y Horario</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Date & Time Picker */}
      {currentStep === 3 && (
        <div className="bg-[#141414] border border-[#C8A45C]/25 rounded-2xl p-5 sm:p-8 space-y-6 shadow-xl">
          <div className="space-y-1.5 border-b border-neutral-800 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif-luxury text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#C8A45C]" />
                <span>Paso 3: Fecha y Horario de Atención</span>
              </h3>
              <span className="text-[11px] px-3 py-1 rounded-full bg-[#C8A45C]/10 border border-[#C8A45C]/30 text-[#C8A45C] font-semibold flex items-center gap-1.5 shadow-sm">
                <Clock className="w-3.5 h-3.5" />
                <span>Hora Oficial: {limaClock.timeStr} (UTC-5 Lima)</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Selecciona tu día y un bloque de 30 minutos de 09:00 a 21:00 hrs. Los cupos y aforo se calculan en tiempo real según la disponibilidad de nuestros especialistas.
            </p>
          </div>

          {/* Date Picker Bar */}
          <div className="bg-[#181818] border border-neutral-800/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[#C8A45C]/10 border border-[#C8A45C]/30 text-[#C8A45C] shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white block">
                  Fecha de la Cita:
                </label>
                <span className="text-[11px] text-neutral-400">
                  {bookingDate === limaClock.dateStr
                    ? 'Atención hoy (bloques anteriores bloqueados automáticamente)'
                    : 'Fecha programada con disponibilidad completa'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={bookingDate}
                min={limaClock.dateStr}
                onChange={(e) => setBookingDate(e.target.value)}
                className="bg-[#121212] border border-neutral-700 focus:border-[#C8A45C] text-white text-xs sm:text-sm rounded-xl px-4 py-2.5 outline-none transition font-medium cursor-pointer"
              />
            </div>
          </div>

          {/* Time Slots Grid (Bloques de 30 Minutos) */}
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Cuadrícula de Horarios para el {bookingDate}:
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#1C1C1C] text-[#E6C875] border border-[#C8A45C]/30 font-mono font-medium">
                  {openTime} - {closeTime} hrs
                </span>
              </div>
              <span className="text-[11px] font-medium text-neutral-400">
                <strong className="text-[#C8A45C]">{availableSlotsCount}</strong> de {computedSlots.length} bloques disponibles
              </span>
            </div>

            {/* Cuadrícula dinámica de bloques de 30 minutos */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2 sm:gap-2.5">
              {computedSlots.map((slot) => {
                const isSelected = selectedSlot === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.isSelectable}
                    onClick={() => setSelectedSlot(slot.time)}
                    title={slot.reason || `Turno ${slot.time} - ${slot.statusLabel}`}
                    className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl transition-all duration-200 text-center ${
                      isSelected
                        ? 'bg-[#C8A45C] text-black font-bold shadow-lg shadow-[#C8A45C]/25 ring-2 ring-[#C8A45C] scale-[1.02] z-10'
                        : slot.status === 'disponible'
                        ? 'bg-[#181818] hover:bg-[#222222] text-white border border-[#C8A45C]/40 hover:border-[#C8A45C] hover:shadow-md hover:shadow-[#C8A45C]/15 cursor-pointer'
                        : slot.status === 'lleno'
                        ? 'bg-red-950/20 text-red-400/80 border border-red-900/35 cursor-not-allowed opacity-65'
                        : 'bg-neutral-900/40 text-neutral-600 border border-neutral-800/40 cursor-not-allowed opacity-35'
                    }`}
                  >
                    <span
                      className={`text-sm sm:text-base font-bold tracking-tight ${
                        isSelected
                          ? 'text-black'
                          : slot.status === 'disponible'
                          ? 'text-white'
                          : slot.status === 'lleno'
                          ? 'text-red-300'
                          : 'text-neutral-600 line-through'
                      }`}
                    >
                      {slot.time}
                    </span>
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mt-0.5 ${
                        isSelected
                          ? 'text-neutral-950 font-black'
                          : slot.status === 'disponible'
                          ? 'text-[#C8A45C]'
                          : slot.status === 'lleno'
                          ? 'text-red-400 font-bold'
                          : 'text-neutral-600 font-normal'
                      }`}
                    >
                      {slot.statusLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Leyenda de Colores Indicativa */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-3 pb-1 border-t border-neutral-800/80 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded border border-[#C8A45C] bg-[#181818] flex items-center justify-center shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C8A45C]" />
                </div>
                <span className="text-neutral-300 font-medium">
                  Disponible (<strong className="text-[#C8A45C] font-semibold">Libre</strong>)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded border border-neutral-700 bg-neutral-900/60 flex items-center justify-center opacity-60">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                </div>
                <span className="text-neutral-500 font-medium">
                  Hora pasada (<span className="text-neutral-500">Pasado</span>)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded border border-red-700/60 bg-red-950/40 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                </div>
                <span className="text-red-400/90 font-medium">
                  Agotado / Lleno (<strong className="text-red-400 font-semibold">Lleno</strong>)
                </span>
              </div>
            </div>
          </div>

          {/* Desglose del Turno y Asignación de Servicios */}
          {selectedSlot && selectedSlotObj && selectedSlotObj.status === 'disponible' ? (
            <div className="bg-[#181818] border border-[#C8A45C]/35 rounded-xl p-4 sm:p-5 space-y-3 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-[#C8A45C]/10 text-[#C8A45C]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-neutral-400 block">Horario de Atención Estimado:</span>
                    <span className="text-sm sm:text-base font-bold text-white">
                      {selectedSlot} hrs <span className="text-[#C8A45C]">→</span> {selectedSlotObj.overallEndTime} hrs
                    </span>
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-[#C8A45C]/15 text-[#C8A45C] border border-[#C8A45C]/30 font-semibold">
                  Duración Total: {totalDurationMinutes} min
                </span>
              </div>

              {/* Distribución secuencial por servicio y especialista */}
              {selectedSlotObj.servicePlans && selectedSlotObj.servicePlans.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Distribución de especialistas por bloque de servicio:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedSlotObj.servicePlans.map((plan, idx) => (
                      <div
                        key={`${plan.serviceId}-${idx}`}
                        className="bg-[#121212] border border-neutral-800 rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">{plan.serviceName}</p>
                          <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                            <User className="w-3 h-3 text-[#C8A45C]" />
                            <span className="text-neutral-300">{plan.employeeName}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[#C8A45C] font-bold block">{plan.startTime} - {plan.endTime}</span>
                          <span className="text-[10px] text-neutral-500">{plan.durationMinutes} min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#C8A45C]" />
              <span>
                {availableSlotsCount > 0
                  ? 'Selecciona un bloque con estado Libre en la cuadrícula para continuar.'
                  : 'No hay cupos disponibles para la fecha seleccionada. Por favor, elige otro día.'}
              </span>
            </div>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>

            <button
              type="button"
              disabled={!selectedSlot || selectedSlotObj?.status !== 'disponible'}
              onClick={() => setCurrentStep(4)}
              className={`px-6 py-2.5 rounded-xl text-xs font-semibold shadow transition flex items-center gap-2 ${
                selectedSlot && selectedSlotObj?.status === 'disponible'
                  ? 'bg-[#C8A45C] hover:bg-[#D4AF37] text-black cursor-pointer font-bold'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <span>Continuar a Datos Personales</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Contact Information */}
      {currentStep === 4 && (
        <div className="bg-[#141414] border border-[#C8A45C]/25 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="space-y-1 border-b border-neutral-800 pb-4">
            <h3 className="font-serif-luxury text-lg font-bold text-white">
              Paso 4: Datos de Contacto
            </h3>
            <p className="text-xs text-neutral-400">
              Ingresa tus datos para registrar la reserva y emitir tu comprobante.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-300">Nombres y Apellidos *</label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ej: Sebastián Alarcón Peña"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-neutral-300">Teléfono WhatsApp *</label>
                <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  maxLength={9}
                  required
                  placeholder={PHONE_PLACEHOLDER}
                  value={clientPhone}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => {
                    setClientPhone(sanitizePhone(e.target.value));
                    if (bookingFormError) setBookingFormError(null);
                  }}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-neutral-300">DNI / Documento</label>
                <span className="text-[10px] text-neutral-500 font-mono">8 dígitos</span>
              </div>
              <div className="relative">
                <FileText className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  placeholder={DNI_PLACEHOLDER}
                  value={clientDni}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => {
                    setClientDni(sanitizeDni(e.target.value));
                    if (bookingFormError) setBookingFormError(null);
                  }}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-300">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="email"
                  placeholder="cliente@gmail.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition"
                />
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-neutral-300">Notas Adicionales (Opcional)</label>
              <textarea
                rows={2}
                placeholder="Indica preferencias de bebidas, requerimientos especiales o alergias..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white text-xs rounded-xl p-3 outline-none transition"
              />
            </div>
          </div>

          {bookingFormError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-center gap-2.5 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{bookingFormError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>

            {/* QA-022: Botón deshabilitado mientras isSubmitting para evitar doble envío */}
            <button
              type="button"
              disabled={isSubmitting || !clientName.trim() || !isValidPhone(clientPhone) || (Boolean(clientDni.trim()) && !isValidDni(clientDni))}
              onClick={handleFinishBooking}
              className={`px-7 py-3 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                !isSubmitting && clientName.trim() && isValidPhone(clientPhone) && (!clientDni.trim() || isValidDni(clientDni))
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] text-black shadow-lg hover:from-[#DFCA8D] hover:to-[#D4AF37]'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Registrando reserva...' : 'Confirmar y Ver Instrucciones de Pago'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Success & Payment QR Widget */}
      {currentStep === 5 && createdBooking && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          {/* Booking Confirmation Card */}
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
                  ¡Reserva Registrada Exitosamente!
                </span>
                <h3 className="font-serif-luxury text-lg sm:text-xl break-all font-bold text-white">
                  Código de Cita: #{createdBooking.code}
                </h3>
              </div>
            </div>

            {/* Appointment Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#181818] p-4 rounded-xl border border-neutral-800 text-xs">
              <div>
                <span className="text-neutral-500 block text-[11px]">Fecha y Hora:</span>
                <span className="font-bold text-white">
                  {createdBooking.date} a las {createdBooking.start_time} - {createdBooking.end_time}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Cliente:</span>
                <span className="font-bold text-white">{createdBooking.client_name}</span>
                <span className="text-neutral-400 block text-[10px]">{createdBooking.client_phone}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Presupuesto Total:</span>
                <span className="font-bold text-[#E6C875] text-sm">
                  {formatSoles(createdBooking.total_price_cents)}
                </span>
              </div>
            </div>

            {/* Selected Services Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-400">Servicios Reservados:</span>
              <div className="space-y-1.5">
                {createdBooking.services.map((s: BookingServiceItem, i: number) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-2.5 rounded-lg bg-[#181818] border border-neutral-800 text-xs"
                  >
                    <div>
                      <span className="font-medium text-white">{s.service_name}</span>
                      <span className="text-neutral-500 text-[10px] ml-2">({s.duration_minutes} min)</span>
                    </div>
                    <span className="font-bold text-[#E6C875]">{formatSoles(s.price_cents)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment QR Widget with dynamic advance percentage */}
          {/* QA-011: title usa advance_percentage dinámico */}
          <PaymentQRWidget
            amountCents={minAdvanceCents}
            bookingCode={createdBooking.code}
            bookingId={createdBooking.id}
            clientPhone={createdBooking.client_phone}
            clientName={createdBooking.client_name}
            title={`Abonar Adelanto Mínimo del ${effectiveAdvancePercentage}% (${formatSoles(minAdvanceCents)})`}
          />

          <div className="text-center pt-4">
            <button
              onClick={() => setActiveView('/mi-cuenta')}
              className="text-xs text-[#C8A45C] hover:underline font-medium"
            >
              Ir a Mi Cuenta para consultar el estado de esta reserva →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
