import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Booking, formatSoles, formatLimaDate, PaymentLog, Service, Employee, EmployeeBlock, BookingServiceItem, getBookingCollectedAmountCents } from '../../types';
import { getTodayDateString } from '../../data/initialData';
import { isEmployeeBlocked, isEmployeeBooked, timeToMinutes, minutesToTime, formatCompletionTime } from '../../lib/bookingAvailability';
import { DashboardSkeleton } from './DashboardSkeleton';
import {
  BookOpen,
  Plus,
  Settings,
  Search,
  Filter,
  DollarSign,
  Printer,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertTriangle,
  Scissors,
  Sparkles,
  Shield,
  Trash2,
  Pencil,
  History,
  Info,
  Check,
  Clock,
  Wallet,
} from 'lucide-react';
import {
  sanitizePhone,
  isValidPhone,
  handleNumericKeyDown,
  PHONE_PLACEHOLDER,
  PHONE_ERROR_MESSAGE,
} from '../../lib/validators';
import { NewBookingModal } from './NewBookingModal';

interface ServiceSpecialistSelectorProps {
  booking: Booking;
  service: BookingServiceItem;
  serviceIndex: number;
  employees: Employee[];
  services: Service[];
  bookings: Booking[];
  employeeBlocks: EmployeeBlock[];
  onReassign: (bookingId: string, serviceIndex: number, employeeId: string, employeeName: string) => Promise<void>;
}

const ServiceSpecialistSelector: React.FC<ServiceSpecialistSelectorProps> = ({
  booking,
  service,
  serviceIndex,
  employees,
  services,
  bookings,
  employeeBlocks,
  onReassign,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  // 1. Determinar categoría del servicio
  const catalogSrv = useMemo(() => {
    return services.find(
      (s) => s.id === service.service_id || s.name.toLowerCase() === service.service_name.toLowerCase()
    );
  }, [services, service.service_id, service.service_name]);

  const category = useMemo(() => {
    return catalogSrv?.category || (booking.type === 'spa' ? 'spa' : 'barberia');
  }, [catalogSrv, booking.type]);

  // 2. Filtrar candidatos obligatoriamente por categoría (Barbería vs Spa)
  const candidateOptions = useMemo(() => {
    const eligibleEmployees = employees.filter((emp) => {
      if (!emp.active) return false;
      if (emp.type === 'recepcionista' || emp.role === 'recepcionista') return false;
      if (category === 'barberia') {
        return emp.type === 'barbero' || emp.type === 'barberia';
      }
      if (category === 'spa') {
        return (
          emp.type === 'spa' ||
          emp.type === 'terapeuta_spa' ||
          emp.type === 'masajista' ||
          emp.type === 'cosmiatra' ||
          emp.type === 'estilista'
        );
      }
      return true;
    });

    // Garantizar que el especialista actual figure siempre en la lista
    if (service.employee_id && !eligibleEmployees.some((e) => e.id === service.employee_id)) {
      const currentAssigned = employees.find((e) => e.id === service.employee_id);
      if (currentAssigned) eligibleEmployees.push(currentAssigned);
    }

    const srvStart = (service.hora_inicio || service.start_time || booking.start_time)?.substring(0, 5) || '10:00';
    const duration = service.duration_minutes || catalogSrv?.duration_minutes || 30;
    const startMin = timeToMinutes(srvStart);
    const endMin = startMin + duration;

    const options = eligibleEmployees.map((emp) => {
      const isCurrent = emp.id === service.employee_id;

      // 1. Bloqueo o permiso aprobado
      const isBlocked = isEmployeeBlocked(emp.id, booking.date, startMin, endMin, employeeBlocks);
      if (isBlocked) {
        return {
          emp,
          isAvailable: false,
          label: `🔴 ${emp.full_name} — Ocupado (En permiso/ausencia)`,
          isCurrent,
        };
      }

      // 2. Conflicto en otro servicio simultáneo de la misma reserva
      const conflictSameBooking = (booking.services || []).some((otherSrv, idx) => {
        if (idx === serviceIndex) return false;
        if (otherSrv.employee_id !== emp.id) return false;
        const otherStart = timeToMinutes(otherSrv.hora_inicio || otherSrv.start_time || booking.start_time);
        const otherDuration = otherSrv.duration_minutes || 30;
        const otherEnd = otherStart + otherDuration;
        return startMin < otherEnd && endMin > otherStart;
      });

      if (conflictSameBooking) {
        return {
          emp,
          isAvailable: false,
          label: `🔴 ${emp.full_name} — Ocupado (En otro servicio de esta cita)`,
          isCurrent,
        };
      }

      // 3. Conflicto en otras reservas activas
      const otherBookings = (bookings || []).filter((b) => b.id !== booking.id);
      const isBookedElsewhere = isEmployeeBooked(emp.id, booking.date, startMin, endMin, otherBookings);
      if (isBookedElsewhere) {
        return {
          emp,
          isAvailable: false,
          label: `🔴 ${emp.full_name} — Ocupado (Tiene otra cita)`,
          isCurrent,
        };
      }

      // 4. Disponible o asignado actual
      if (isCurrent) {
        return {
          emp,
          isAvailable: true,
          label: `🟢 ${emp.full_name} — Asignado actual`,
          isCurrent,
        };
      }

      return {
        emp,
        isAvailable: true,
        label: `🟢 ${emp.full_name} — Disponible`,
        isCurrent,
      };
    });

    // Ordenar priorizando: 1. Asignado actual, 2. Disponibles, 3. Ocupados
    return options.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      if (a.isAvailable && !b.isAvailable) return -1;
      if (!a.isAvailable && b.isAvailable) return 1;
      return a.emp.full_name.localeCompare(b.emp.full_name);
    });
  }, [
    employees,
    category,
    service.employee_id,
    service.hora_inicio,
    service.start_time,
    service.duration_minutes,
    booking.start_time,
    booking.date,
    booking.id,
    booking.services,
    catalogSrv?.duration_minutes,
    employeeBlocks,
    serviceIndex,
    bookings,
  ]);

  const srvStart = (service.hora_inicio || service.start_time || booking.start_time)?.substring(0, 5) || '10:00';
  const duration = service.duration_minutes || catalogSrv?.duration_minutes || 30;
  const srvEnd = (service.hora_fin || service.end_time)?.substring(0, 5) || minutesToTime(timeToMinutes(srvStart) + duration);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEmpId = e.target.value;
    if (!newEmpId || newEmpId === service.employee_id) return;

    const chosenOption = candidateOptions.find((opt) => opt.emp.id === newEmpId);
    if (!chosenOption) return;

    if (!chosenOption.isAvailable && !chosenOption.isCurrent) {
      const confirmOverride = window.confirm(
        `El especialista ${chosenOption.emp.full_name} figura como ocupado en ese horario. ¿Deseas reasignarlo de todas formas?`
      );
      if (!confirmOverride) return;
    }

    try {
      setIsSaving(true);
      await onReassign(booking.id, serviceIndex, chosenOption.emp.id, chosenOption.emp.full_name);
    } catch (err) {
      console.error('Error reasignando especialista:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <span className="font-semibold text-white block text-xs">
        {service.service_name}
      </span>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-400 font-medium shrink-0">
            Especialista:
          </span>
          <div className="relative inline-flex items-center">
            <select
              value={service.employee_id || ''}
              disabled={isSaving}
              onChange={handleChange}
              className="bg-[#121212] border border-[#C8A45C]/35 hover:border-[#C8A45C] focus:border-[#C8A45C] text-[#E6C875] text-[11px] font-semibold rounded-lg px-2.5 py-1 outline-none transition cursor-pointer pr-7 appearance-none shadow-sm disabled:opacity-50"
              title="Reasignar especialista para este servicio"
            >
              <option value="" disabled className="bg-[#141414] text-neutral-400">
                -- Seleccionar ({category === 'barberia' ? 'Barbería' : 'Spa'}) --
              </option>
              {candidateOptions.map((opt) => (
                <option
                  key={opt.emp.id}
                  value={opt.emp.id}
                  disabled={!opt.isAvailable && !opt.isCurrent}
                  className={`bg-[#141414] py-1 ${
                    opt.isCurrent
                      ? 'text-[#E6C875] font-bold'
                      : opt.isAvailable
                      ? 'text-emerald-400'
                      : 'text-neutral-500'
                  }`}
                >
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#C8A45C] absolute right-2 pointer-events-none" />
          </div>
          {isSaving && (
            <span className="text-[10px] text-[#C8A45C] animate-pulse font-medium">
              Guardando...
            </span>
          )}
        </div>

        <span className="text-[10px] text-neutral-400">
          • Duración: <span className="text-neutral-200 font-medium">{duration} min</span> ({srvStart} - {srvEnd})
        </span>
      </div>
    </div>
  );
};

interface ServicePriceEditorProps {
  bookingId: string;
  serviceIndex: number;
  priceCents: number;
  isAdmin: boolean;
  onUpdatePrice: (bookingId: string, serviceIndex: number, newPriceCents: number) => Promise<void>;
}

const ServicePriceEditor: React.FC<ServicePriceEditorProps> = ({
  bookingId,
  serviceIndex,
  priceCents,
  isAdmin,
  onUpdatePrice,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [priceInput, setPriceInput] = useState((priceCents / 100).toFixed(2));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sincronizar precio si cambia externamente mientras no se edita
  React.useEffect(() => {
    if (!isEditing) {
      setPriceInput((priceCents / 100).toFixed(2));
    }
  }, [priceCents, isEditing]);

  // Si no es administrador, mostrar texto estático
  if (!isAdmin) {
    return (
      <span className="font-bold text-[#E6C875]">
        {formatSoles(priceCents)}
      </span>
    );
  }

  const handleStartEdit = () => {
    setPriceInput((priceCents / 100).toFixed(2));
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPriceInput((priceCents / 100).toFixed(2));
  };

  const handleSave = async () => {
    const rawVal = priceInput.replace(',', '.').trim();
    const num = parseFloat(rawVal);
    if (isNaN(num) || num < 0) {
      alert('Por favor ingrese un precio numérico válido mayor o igual a 0.');
      return;
    }

    const newCents = Math.round(num * 100);
    if (newCents === priceCents) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdatePrice(bookingId, serviceIndex, newCents);
      setIsEditing(false);
    } catch (err: any) {
      alert(`No se pudo actualizar el precio: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1 bg-[#121212] border border-[#C8A45C]/60 rounded-lg px-2 py-1 shadow-inner">
        <span className="text-[11px] font-bold text-[#C8A45C] select-none">S/</span>
        <input
          ref={inputRef}
          type="number"
          step="0.50"
          min="0"
          disabled={isSaving}
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCancel();
            }
          }}
          className="w-16 bg-transparent text-xs font-bold text-white text-right outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          autoFocus
        />
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="p-1 rounded hover:bg-emerald-950/60 text-emerald-400 hover:text-emerald-300 transition cursor-pointer disabled:opacity-50"
          title="Guardar nuevo precio (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleCancel}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer disabled:opacity-50"
          title="Cancelar (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {isSaving && (
          <span className="text-[10px] text-[#C8A45C] animate-pulse font-medium">...</span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 group">
      <span className="font-bold text-[#E6C875]">
        {formatSoles(priceCents)}
      </span>
      <button
        type="button"
        onClick={handleStartEdit}
        className="p-1 rounded text-neutral-400 hover:text-[#C8A45C] hover:bg-neutral-800/80 transition cursor-pointer border border-transparent hover:border-[#C8A45C]/30"
        title="Modificar precio del servicio (Solo Administrador)"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
};

export const ReservasManager: React.FC = () => {
  const {
    bookings,
    services,
    employees,
    employeeBlocks,
    paymentLogs,
    currentRole,
    currentUser,
    paymentSettings,
    updatePaymentSettings,
    registerBookingPayment,
    voidPayment,
    liberateServiceEarly,
    reassignBookingService,
    updateBookingServicePrice,
    deleteBooking,
    editBooking,
    addBooking,
    openTicketModal,
    isDataLoading,
  } = useApp();

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  // Permisos: Administrador estricto vs Recepcionista
  const isAdmin = currentRole === 'admin' || currentUser?.role === 'admin';

  // Filters
  const [dateFilter, setDateFilter] = useState<'hoy' | 'manana' | 'todas' | 'custom'>('hoy');
  const [customDate, setCustomDate] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bloqueo estricto de fechas: Recepcionista solo tiene acceso a las citas de "Hoy"
  useEffect(() => {
    if (!isAdmin && (dateFilter !== 'hoy' || customDate !== '')) {
      setDateFilter('hoy');
      setCustomDate('');
    }
  }, [isAdmin, dateFilter, customDate]);

  // Expandable Row State
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [selectedBookingForHistory, setSelectedBookingForHistory] = useState<Booking | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Edit Reservation Modal State (Admin)
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<Booking | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');

  // Delete Reservation Modal State (Admin)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'efectivo' | 'mixto'>('yape');
  const [payAmountInput, setPayAmountInput] = useState<string>('');
  const [cashAmountInput, setCashAmountInput] = useState<string>('');
  const [yapeAmountInput, setYapeAmountInput] = useState<string>('');

  // Voiding State
  const [voidReason, setVoidReason] = useState<string>('');
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);

  // Settings Form State
  const [tempAdvancePct, setTempAdvancePct] = useState<number>(paymentSettings.advance_percentage);
  const [tempYapePhone, setTempYapePhone] = useState<string>(paymentSettings.yape_phone);
  const [tempYapeHolder, setTempYapeHolder] = useState<string>(paymentSettings.yape_holder);

  const todayStr = getTodayDateString();

  // Filter Bookings
  const filteredBookings = useMemo(() => {
    const effectiveDateFilter = isAdmin ? dateFilter : 'hoy';
    return bookings.filter((b) => {
      // Date filter (Recepcionista forzada estrictamente al día de "Hoy")
      if (effectiveDateFilter === 'hoy' && b.date !== todayStr) return false;
      if (isAdmin && effectiveDateFilter === 'manana') {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        const mananaStr = t.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        if (b.date !== mananaStr) return false;
      }
      if (isAdmin && effectiveDateFilter === 'custom' && customDate && b.date !== customDate) return false;

      // Category filter
      if (categoryFilter !== 'all' && b.type !== categoryFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.client_name.toLowerCase().includes(q) ||
          b.client_phone.includes(q) ||
          b.code.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [bookings, categoryFilter, customDate, dateFilter, isAdmin, searchQuery, todayStr]);

  // 4 Métricas Financieras y Operativas en Tiempo Real (Exclusivo Administrador)
  const adminKPIs = useMemo(() => {
    let citasPendientesCobrarCount = 0;
    let citasConfirmadasCount = 0;
    let totalIngresosCobradosCents = 0;
    let totalPorCobrarLocalCents = 0;

    for (const b of filteredBookings) {
      const cobrado = getBookingCollectedAmountCents(b);
      const saldo = Math.max(0, (b.total_price_cents || 0) - cobrado);

      // Cuadro 1: Citas Pendientes por Cobrar (saldo mayor a 0)
      if (saldo > 0 || b.payment_status === 'parcial' || b.payment_status === 'sin_pago') {
        citasPendientesCobrarCount++;
      }

      // Cuadro 2: Total de Citas Confirmadas
      const isConfirmed =
        (b.status && (b.status.toLowerCase() === 'confirmada' || b.status.toLowerCase() === 'confirmed')) ||
        Boolean(b.confirmed_at) ||
        b.payment_status === 'total' ||
        b.payment_status === 'parcial';

      if (isConfirmed && b.status?.toLowerCase() !== 'cancelada' && b.status?.toLowerCase() !== 'cancelled') {
        citasConfirmadasCount++;
      }

      // Cuadro 3: Total Ingresos Cobrados
      totalIngresosCobradosCents += cobrado;

      // Cuadro 4: Total por Cobrar en Local
      totalPorCobrarLocalCents += saldo;
    }

    return {
      citasPendientesCobrarCount,
      citasConfirmadasCount,
      totalIngresosCobradosCents,
      totalPorCobrarLocalCents,
    };
  }, [filteredBookings]);

  // Open Payment Modal
  const handleOpenPaymentModal = (b: Booking) => {
    setSelectedBookingForPayment(b);
    const saldo = Math.max(0, b.total_price_cents - b.advance_amount_cents);
    setPayAmountInput((saldo / 100).toFixed(2));
    setPaymentMethod('yape');
    setCashAmountInput('');
    setYapeAmountInput('');
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForPayment) return;

    let amountCents = Math.round(parseFloat(payAmountInput || '0') * 100);
    let cashCents = 0;
    let yapeCents = 0;

    if (paymentMethod === 'mixto') {
      cashCents = Math.round(parseFloat(cashAmountInput || '0') * 100);
      yapeCents = Math.round(parseFloat(yapeAmountInput || '0') * 100);
      amountCents = cashCents + yapeCents;
    } else if (paymentMethod === 'efectivo') {
      cashCents = amountCents;
    } else {
      yapeCents = amountCents;
    }

    if (amountCents <= 0) return;

    registerBookingPayment(
      selectedBookingForPayment.id,
      amountCents,
      paymentMethod,
      cashCents,
      yapeCents
    );

    setIsPaymentModalOpen(false);
  };

  // Handle Void Payment (Admin only with audit reason >= 5 chars)
  const handleVoidPaymentConfirm = (paymentId: string) => {
    if (voidReason.trim().length < 5) {
      alert('Debe ingresar un motivo de auditoría de al menos 5 caracteres.');
      return;
    }
    voidPayment(paymentId, voidReason);
    setVoidingPaymentId(null);
    setVoidReason('');
  };

  // Handle Edit Reservation (Admin only)
  const handleOpenEditModal = (b: Booking) => {
    if (!isAdmin) {
      alert('Acceso denegado: Solo el Administrador puede editar reservas.');
      return;
    }
    setSelectedBookingForEdit(b);
    setEditClientName(b.client_name);
    setEditClientPhone(b.client_phone);
    setEditDate(b.date);
    setEditStartTime(b.start_time);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForEdit) return;

    if (!isAdmin) {
      alert('Acceso no autorizado: Se requieren privilegios de Administrador para editar reservas.');
      return;
    }

    if (!isValidPhone(editClientPhone.trim())) {
      alert(PHONE_ERROR_MESSAGE);
      return;
    }

    await editBooking(selectedBookingForEdit.id, {
      client_name: editClientName.trim(),
      client_phone: editClientPhone.trim(),
      date: editDate,
      start_time: editStartTime,
    });

    setIsEditModalOpen(false);
    setSelectedBookingForEdit(null);
  };

  // Handle Delete Reservation (Admin only)
  const handleOpenDeleteModal = (b: Booking) => {
    if (!isAdmin) {
      alert('Acceso denegado: Solo el Administrador puede eliminar reservas permanentemente.');
      return;
    }
    setBookingToDelete(b);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!bookingToDelete) return;

    if (!isAdmin) {
      alert('Acceso no autorizado: Se requieren privilegios de Administrador para eliminar reservas.');
      setIsDeleteModalOpen(false);
      setBookingToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteBooking(bookingToDelete.id);
      setIsDeleteModalOpen(false);
      setBookingToDelete(null);
    } catch (err: any) {
      alert(`No se pudo eliminar la reserva: ${err?.message || 'Error en el servidor o permisos denegados.'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(tempYapePhone.trim())) {
      alert(PHONE_ERROR_MESSAGE);
      return;
    }
    updatePaymentSettings({
      advance_percentage: Number(tempAdvancePct),
      yape_phone: tempYapePhone.trim(),
      yape_holder: tempYapeHolder,
    });
    setIsSettingsModalOpen(false);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Tablero Maestro de Reservas & Caja
          </h1>
          <p className="text-xs text-neutral-400">
            Control de citas, cobro de adelantos (25%), liberación anticipada e impresión térmica.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-[#181818] hover:bg-[#202020] border border-neutral-800 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#C8A45C]" />
              <span>Configurar Pagos Yape</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsNewBookingModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Reserva Manual</span>
          </button>
        </div>
      </div>

      {/* 4 Métricas Financieras y Operativas (Exclusivo Administrador) */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Cuadro 1: Citas Pendientes por Cobrar */}
          <div className="bg-[#141414] border border-amber-900/40 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">Citas Pendientes por Cobrar</span>
              <div className="w-8 h-8 rounded-lg bg-amber-950/40 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div>
              <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-amber-400 tracking-tight block">
                {adminKPIs.citasPendientesCobrarCount} {adminKPIs.citasPendientesCobrarCount === 1 ? 'cita' : 'citas'}
              </span>
              <span className="text-[11px] text-neutral-500 mt-0.5 block">
                Con saldo restante por liquidar
              </span>
            </div>
          </div>

          {/* Cuadro 2: Total de Citas Confirmadas */}
          <div className="bg-[#141414] border border-blue-900/40 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">Total Citas Confirmadas</span>
              <div className="w-8 h-8 rounded-lg bg-blue-950/40 text-blue-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div>
              <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-tight block">
                {adminKPIs.citasConfirmadasCount} {adminKPIs.citasConfirmadasCount === 1 ? 'cita' : 'citas'}
              </span>
              <span className="text-[11px] text-neutral-500 mt-0.5 block">
                Citas activas en agenda
              </span>
            </div>
          </div>

          {/* Cuadro 3: Total Ingresos Cobrados */}
          <div className="bg-[#141414] border border-[#C8A45C]/35 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-[#C8A45C]/60 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">Total Ingresos Cobrados</span>
              <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/15 text-[#C8A45C] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#E6C875] tracking-tight block">
                {formatSoles(adminKPIs.totalIngresosCobradosCents)}
              </span>
              <span className="text-[11px] text-neutral-500 mt-0.5 block">
                Monto ya pagado (Adelanto + Total)
              </span>
            </div>
          </div>

          {/* Cuadro 4: Total por Cobrar en Local */}
          <div className="bg-[#141414] border border-emerald-900/40 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">Total por Cobrar en Local</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-950/40 text-emerald-400 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight block">
                {formatSoles(adminKPIs.totalPorCobrarLocalCents)}
              </span>
              <span className="text-[11px] text-neutral-500 mt-0.5 block">
                Saldo pendiente a cobrar en caja
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Fast Date Filters */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setDateFilter('hoy');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                dateFilter === 'hoy'
                  ? 'bg-[#C8A45C] text-black font-semibold shadow-sm'
                  : 'bg-[#1A1A1A] text-neutral-400 hover:text-white'
              }`}
            >
              Hoy
            </button>

            {isAdmin && (
              <>
                {(['manana', 'todas'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDateFilter(d);
                      setCustomDate('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                      dateFilter === d
                        ? 'bg-[#C8A45C] text-black font-semibold shadow-sm'
                        : 'bg-[#1A1A1A] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {d === 'todas' ? 'Todas' : 'Mañana'}
                  </button>
                ))}

                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomDate(val);
                    if (val) {
                      setDateFilter('custom');
                    } else {
                      setDateFilter('hoy');
                    }
                  }}
                  className="bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] text-xs text-white px-2.5 py-1.5 rounded-lg outline-none transition"
                  title="Seleccionar fecha específica"
                />
              </>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#1A1A1A] border border-neutral-800 text-xs text-neutral-300 px-3 py-1.5 rounded-lg outline-none"
            >
              <option value="all">Categoría: Todas</option>
              <option value="barberia">Barbería</option>
              <option value="spa">Spa</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>

          {/* Search Query */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar cliente, teléfono, código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-xs text-white rounded-lg pl-8 pr-3 py-1.5 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons Legend (Responsivo y Adaptable) */}
      <div className="bg-[#141414] border border-neutral-800/80 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-neutral-400 shrink-0">
            <div className="p-1 rounded-md bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#C8A45C]">
              <Info className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-200">
              Leyenda de Acciones:
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:flex xl:flex-wrap xl:items-center gap-2.5 sm:gap-3.5 text-[11px]">
            {/* 1. Cobrar */}
            <div className="flex items-center gap-1.5" title="Registrar cobro en caja">
              <span className="px-2 py-0.5 rounded bg-[#C8A45C] text-black font-bold text-[10px] shadow-sm shrink-0">
                💳 Cobrar
              </span>
              <span className="text-neutral-400">Cobro en caja</span>
            </div>

            {/* 2. Historial de Pagos & Auditoría */}
            <div className="flex items-center gap-1.5" title="Historial de pagos y auditoría">
              <span className="p-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/50 shrink-0 flex items-center justify-center">
                <History className="w-3.5 h-3.5" />
              </span>
              <span className="text-neutral-400">Historial / Auditoría</span>
            </div>

            {/* 3. Ticket Térmico */}
            <div className="flex items-center gap-1.5" title="Imprimir ticket térmico">
              <span className="p-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/50 shrink-0 flex items-center justify-center">
                <Printer className="w-3.5 h-3.5" />
              </span>
              <span className="text-neutral-400">Ticket térmico</span>
            </div>

            {/* 4. WhatsApp */}
            <div className="flex items-center gap-1.5" title="Enviar recordatorio WhatsApp">
              <span className="p-1 rounded bg-neutral-800 text-emerald-400 border border-emerald-900/50 shrink-0 flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5" />
              </span>
              <span className="text-neutral-400">WhatsApp</span>
            </div>

            {/* 5. Editar Reserva (Solo Admin) */}
            <div className="flex items-center gap-1.5" title="Editar reserva (Solo Administrador)">
              <span className="p-1 rounded bg-neutral-800 text-amber-300 border border-amber-900/50 shrink-0 flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5" />
              </span>
              <span className="text-neutral-400">Editar</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/40 shrink-0">
                Solo Admin
              </span>
            </div>

            {/* 6. Eliminar Reserva (Solo Admin) */}
            <div className="flex items-center gap-1.5" title="Eliminar reserva permanentemente (Solo Administrador)">
              <span className="p-1 rounded bg-neutral-800 text-red-400 border border-red-900/50 shrink-0 flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5" />
              </span>
              <span className="text-neutral-400">Eliminar</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-950/80 text-red-400 border border-red-800/40 shrink-0">
                Solo Admin
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181818] text-neutral-400 font-semibold border-b border-neutral-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Fecha / Horario</th>
                <th className="py-3.5 px-4">Servicios</th>
                <th className="py-3.5 px-4 text-right">Total</th>
                <th className="py-3.5 px-4 text-right">Cobrado</th>
                <th className="py-3.5 px-4 text-right">Saldo</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap min-w-[140px]">Estado Pago</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[190px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    No se encontraron reservas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const saldo = Math.max(0, b.total_price_cents - b.advance_amount_cents);
                  const isExpanded = expandedBookingId === b.id;

                  return (
                    <React.Fragment key={b.id}>
                      <tr className="hover:bg-[#1A1813]/40 transition group">
                        {/* Code */}
                        <td className="py-3 px-4 font-mono font-bold text-[#E6C875]">
                          <button
                            type="button"
                            onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                            className="flex items-center gap-1 hover:underline"
                          >
                            <span>#{b.code}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>

                        {/* Client */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white block">{b.client_name}</span>
                          <span className="text-[10px] text-neutral-500">{b.client_phone}</span>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-4 text-neutral-300">
                          <span className="block font-medium">{formatLimaDate(b.date)}</span>
                          <span className="text-[10px] text-neutral-500">
                            {b.start_time} - {b.end_time}
                          </span>
                        </td>

                        {/* Services Count */}
                        <td className="py-3 px-4 text-neutral-300">
                          <span className="capitalize">{b.type}</span>
                          <span className="text-[10px] text-neutral-500 block">
                            {b.services.length} {b.services.length === 1 ? 'servicio' : 'servicios'}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3 px-4 text-right font-bold text-white">
                          {formatSoles(b.total_price_cents)}
                        </td>

                        {/* Advance Paid */}
                        <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                          {formatSoles(b.advance_amount_cents)}
                        </td>

                        {/* Pending Balance */}
                        <td className="py-3 px-4 text-right font-bold text-[#E6C875]">
                          {formatSoles(saldo)}
                        </td>

                        {/* Payment Status Badge */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-md ${
                              b.payment_status === 'total'
                                ? 'badge-success'
                                : b.payment_status === 'parcial'
                                ? 'badge-warning'
                                : 'badge-error'
                            }`}
                          >
                            {b.payment_status === 'total'
                              ? 'PAGADO COMPLETO'
                              : b.payment_status === 'parcial'
                              ? 'SALDO PENDIENTE'
                              : 'SIN PAGO'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Pay Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(b)}
                              className="px-2.5 py-1 rounded bg-[#C8A45C] hover:bg-[#D4AF37] text-black font-semibold text-[11px] transition shadow cursor-pointer"
                              title="Registrar cobro"
                            >
                              💳 Cobrar
                            </button>

                            {/* Payment History & Audit */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBookingForHistory(b);
                                setIsHistoryModalOpen(true);
                              }}
                              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer border border-neutral-700/50"
                              title="Historial de pagos y auditoría"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {/* Print Ticket */}
                            <button
                              type="button"
                              onClick={() => openTicketModal('booking', b)}
                              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer border border-neutral-700/50"
                              title="Imprimir ticket térmico"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* WhatsApp Notification */}
                            <a
                              href={`https://wa.me/${b.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `¡Hola ${b.client_name}! Te confirmamos tu cita #${b.code} en Acicalados para el ${b.date} a las ${b.start_time}. Saldo pendiente: ${formatSoles(saldo)}.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded bg-neutral-800 hover:bg-emerald-900/50 text-emerald-400 transition border border-emerald-900/40"
                              title="Enviar recordatorio WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>

                            {/* Botón Editar Reserva (Exclusivo Administrador - Oculto para Recepcionista) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(b)}
                                className="p-1.5 rounded bg-neutral-800 hover:bg-amber-950/60 text-amber-300 hover:text-amber-200 transition cursor-pointer border border-amber-900/40"
                                title="Editar reserva (Solo Administrador)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Botón Eliminar Reserva (Exclusivo Administrador - Oculto para Recepcionista) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(b)}
                                className="p-1.5 rounded bg-neutral-800 hover:bg-red-950/60 text-red-400 hover:text-red-300 transition cursor-pointer border border-red-900/40"
                                title="Eliminar reserva permanentemente (Solo Administrador)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Row with Services & Early Release */}
                      {isExpanded && (
                        <tr className="bg-[#111111] border-b border-neutral-800">
                          <td colSpan={9} className="p-4 sm:p-5">
                            <div className="space-y-3 max-w-4xl mx-auto">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#E6C875] uppercase tracking-wider">
                                  Detalle de Servicios Individuales & Asignación de Especialistas
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  Reasigna especialistas en tiempo real con validación de disponibilidad o libera al personal al culminar.
                                </span>
                              </div>

                              <div className="space-y-2">
                                {b.services.map((srv, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="p-3 rounded-lg bg-[#181818] border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                                  >
                                    <ServiceSpecialistSelector
                                      booking={b}
                                      service={srv}
                                      serviceIndex={sIdx}
                                      employees={employees}
                                      services={services}
                                      bookings={bookings}
                                      employeeBlocks={employeeBlocks}
                                      onReassign={reassignBookingService}
                                    />

                                    <div className="flex items-center gap-3">
                                      <ServicePriceEditor
                                        bookingId={b.id}
                                        serviceIndex={sIdx}
                                        priceCents={srv.price_cents}
                                        isAdmin={isAdmin}
                                        onUpdatePrice={updateBookingServicePrice}
                                      />

                                      {srv.liberado_at ? (
                                        <span className="px-2.5 py-1 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/70 text-[10px] font-semibold flex items-center gap-1.5 shadow-sm">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                          <span>Culminado a las {formatCompletionTime(srv.liberado_at)}</span>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => liberateServiceEarly(b.id, sIdx)}
                                          className="px-2.5 py-1 rounded text-[10px] font-semibold bg-[#C8A45C]/15 hover:bg-emerald-600/30 text-[#E6C875] hover:text-emerald-200 border border-[#C8A45C]/35 hover:border-emerald-500/50 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                          title="Culminar servicio y liberar disponibilidad del especialista de inmediato"
                                        >
                                          <Sparkles className="w-3 h-3 text-[#E6C875] shrink-0" />
                                          <span>Culminar / Liberar</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Registrar Pago */}
      {isPaymentModalOpen && selectedBookingForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-serif-luxury text-base font-bold text-white">
                  Registrar Cobro en Caja
                </h3>
                <p className="text-xs text-neutral-400">
                  Reserva #{selectedBookingForPayment.code} - {selectedBookingForPayment.client_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary */}
            <div className="bg-[#181818] p-3 rounded-xl border border-neutral-800 grid grid-cols-3 gap-2 text-xs text-center">
              <div>
                <span className="text-neutral-500 block text-[10px]">Total Cita:</span>
                <span className="font-bold text-white">
                  {formatSoles(selectedBookingForPayment.total_price_cents)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px]">Ya Cobrado:</span>
                <span className="font-bold text-emerald-400">
                  {formatSoles(selectedBookingForPayment.advance_amount_cents)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px]">Saldo Pendiente:</span>
                <span className="font-bold text-[#E6C875]">
                  {formatSoles(
                    Math.max(
                      0,
                      selectedBookingForPayment.total_price_cents -
                        selectedBookingForPayment.advance_amount_cents
                    )
                  )}
                </span>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Método de Pago:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['yape', 'efectivo', 'mixto'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 rounded-lg font-semibold capitalize transition ${
                        paymentMethod === m
                          ? 'bg-[#C8A45C] text-black shadow'
                          : 'bg-[#1E1E1E] text-neutral-400 hover:text-white border border-neutral-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'mixto' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-neutral-400">Monto en Efectivo (S/)</label>
                    <input
                      type="number"
                      step="0.10"
                      required
                      placeholder="0.00"
                      value={cashAmountInput}
                      onChange={(e) => setCashAmountInput(e.target.value)}
                      className="w-full bg-[#181818] border border-neutral-800 text-white rounded-lg p-2 outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-neutral-400">Monto en Yape (S/)</label>
                    <input
                      type="number"
                      step="0.10"
                      required
                      placeholder="0.00"
                      value={yapeAmountInput}
                      onChange={(e) => setYapeAmountInput(e.target.value)}
                      className="w-full bg-[#181818] border border-neutral-800 text-white rounded-lg p-2 outline-none font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">
                    Monto Recibido en {paymentMethod === 'yape' ? 'Yape' : 'Efectivo'} (S/):
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-lg font-bold text-[#E6C875] rounded-xl p-3 outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow"
                >
                  Guardar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Historial de Pagos & Anulación Auditada */}
      {isHistoryModalOpen && selectedBookingForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-serif-luxury text-base font-bold text-white">
                  Auditoría de Pagos - Cita #{selectedBookingForHistory.code}
                </h3>
                <p className="text-xs text-neutral-400">{selectedBookingForHistory.client_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of payments for this booking */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {paymentLogs
                .filter((p) => p.booking_id === selectedBookingForHistory.id)
                .map((p) => (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      p.voided
                        ? 'bg-red-950/20 border-red-900/40 text-neutral-400'
                        : 'bg-[#181818] border-neutral-800 text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#E6C875]">
                          {formatSoles(p.amount_cents)}
                        </span>
                        <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                          {p.payment_method}
                        </span>
                        {p.voided && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-900/40 text-red-300 font-bold">
                            ANULADO
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-500 block mt-0.5">
                        {p.created_at.replace('T', ' ').substring(0, 16)}
                      </span>
                      {p.voided && p.voided_reason && (
                        <span className="text-[10px] text-red-400 block mt-1">
                          Motivo: {p.voided_reason} (por {p.voided_by})
                        </span>
                      )}
                    </div>

                    {!p.voided && isAdmin && (
                      <button
                        type="button"
                        onClick={() => setVoidingPaymentId(p.id)}
                        className="px-2.5 py-1 rounded text-[10px] font-semibold bg-red-950/40 text-red-300 hover:bg-red-900 border border-red-800/40 transition"
                      >
                        Anular Pago
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {/* Voiding Reason Prompt */}
            {voidingPaymentId && (
              <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-900/50 space-y-2 text-xs">
                <span className="text-red-300 font-bold block">
                  Auditoría Requerida: Ingrese motivo de anulación (mínimo 5 caracteres)
                </span>
                <input
                  type="text"
                  placeholder="Ej: Error en digitación de monto por cliente..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full bg-[#181818] border border-red-800 text-white rounded-lg p-2 outline-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setVoidingPaymentId(null);
                      setVoidReason('');
                    }}
                    className="px-3 py-1 rounded bg-neutral-800 text-neutral-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVoidPaymentConfirm(voidingPaymentId)}
                    className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white font-bold shadow"
                  >
                    Confirmar Anulación
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Configurar Pagos Yape (Admin Only) */}
      {isSettingsModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <h3 className="font-serif-luxury text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#C8A45C]" />
                <span>Configuración de Pagos & Yape</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Porcentaje Mínimo de Adelanto (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={tempAdvancePct}
                  onChange={(e) => setTempAdvancePct(Number(e.target.value))}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none font-bold text-sm"
                />
                <span className="text-[10px] text-neutral-500">
                  Por regla oficial es 25%. Al recibir este monto, la cita pasa a confirmada.
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-neutral-300 font-medium">Número Telefónico Yape Oficial</label>
                  <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  maxLength={9}
                  required
                  placeholder={PHONE_PLACEHOLDER}
                  value={tempYapePhone}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => setTempYapePhone(sanitizePhone(e.target.value))}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Titular de la Cuenta Yape</label>
                <input
                  type="text"
                  required
                  value={tempYapeHolder}
                  onChange={(e) => setTempYapeHolder(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow"
                >
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Nueva Reserva Manual */}
      <NewBookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
      />

      {/* MODAL: Editar Reserva (Solo Administrador) */}
      {isEditModalOpen && selectedBookingForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#C8A45C]" />
                <h3 className="font-serif-luxury text-base font-bold text-white">
                  Editar Reserva #{selectedBookingForEdit.code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Nombre del Cliente *</label>
                <input
                  type="text"
                  required
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-neutral-300 font-medium">Teléfono WhatsApp *</label>
                  <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  maxLength={9}
                  required
                  placeholder={PHONE_PLACEHOLDER}
                  value={editClientPhone}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => setEditClientPhone(sanitizePhone(e.target.value))}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Fecha</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2 outline-none focus:border-[#C8A45C]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Hora Inicio</label>
                  <input
                    type="time"
                    required
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2 outline-none focus:border-[#C8A45C]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Eliminación (Exclusivo Administrador) */}
      {isDeleteModalOpen && bookingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141414] border border-red-800/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-luxury text-base font-bold text-white">
                  Eliminar Reserva
                </h3>
                <p className="text-xs text-neutral-400">
                  Reserva #{bookingToDelete.code} - {bookingToDelete.client_name}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-[#1c1414] p-3 rounded-xl border border-red-900/30">
              ¿Estás seguro de que deseas eliminar permanentemente esta reserva? Esta acción es <span className="text-red-400 font-semibold">irreversible</span> y removerá los servicios vinculados y el bloqueo de horario en la base de datos de Supabase.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setBookingToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
