import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Check,
  Calendar,
  CreditCard,
  User,
  ShieldCheck,
  AlertCircle,
  Tag,
  Sparkles,
  Lock,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
  Shirt,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { WardrobeItem, DressRental, formatSoles, DressRentalPaymentMethod, DressRentalPaymentDetails } from '../../../types';
import { DressAvailabilityCalendar } from './DressAvailabilityCalendar';
import { sanitizeDni, sanitizePhone } from '../../../lib/validators';
import { consultarDniApi } from '../../../lib/consultaDni';

interface NewDressRentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (rental: DressRental) => void;
}

export const NewDressRentalModal: React.FC<NewDressRentalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { wardrobe, dressRentals, addDressRental, currentRole, currentUser } = useApp();
  const isAdmin = currentRole === 'admin' || currentRole === 'VESTUARIO_ADMIN';
  const isRecepcionista = currentRole === 'recepcionista';

  // Referencias para controlar el desplazamiento (scroll)
  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Forzar inicio estricto en la parte superior cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      const resetScrollPosition = () => {
        if (modalOverlayRef.current) {
          modalOverlayRef.current.scrollTop = 0;
        }
        if (modalContentRef.current) {
          modalContentRef.current.scrollTop = 0;
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
      };

      resetScrollPosition();
      const raf = requestAnimationFrame(resetScrollPosition);
      const timer = setTimeout(resetScrollPosition, 40);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  // Paso 1: Datos del Cliente
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientDni, setClientDni] = useState('');
  const [eventName, setEventName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destination, setDestination] = useState('');

  // Consulta de DNI RENIEC / APIS PERU
  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [dniFeedback, setDniFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const handleConsultarDni = async () => {
    const cleanDni = sanitizeDni(clientDni);
    if (cleanDni.length !== 8) {
      setDniFeedback({
        type: 'warning',
        message: 'El DNI debe contener exactamente 8 dígitos.',
      });
      return;
    }

    setIsSearchingDni(true);
    setDniFeedback(null);

    try {
      const res = await consultarDniApi(cleanDni);
      if (res.success && res.nombres) {
        setClientFirstName(res.nombres);
        setClientLastName(res.apellidos || '');
        setDniFeedback({
          type: 'success',
          message: `✓ Datos encontrados: ${res.nombres} ${res.apellidos || ''}`.trim(),
        });
      } else {
        setDniFeedback({
          type: 'warning',
          message: res.message || 'DNI no encontrado. Puedes ingresar los nombres manualmente.',
        });
      }
    } catch (err: any) {
      console.error('Error al consultar DNI:', err);
      setDniFeedback({
        type: 'warning',
        message: 'No se pudo conectar con el servicio. Ingresa los nombres manualmente.',
      });
    } finally {
      setIsSearchingDni(false);
    }
  };

  // Paso 2: Búsqueda y Selección de Prenda (ÚNICAMENTE POR CÓDIGO)
  const [searchCodeQuery, setSearchCodeQuery] = useState('');
  const [selectedWardrobeItem, setSelectedWardrobeItem] = useState<WardrobeItem | null>(null);
  const [customPriceSoles, setCustomPriceSoles] = useState<string>('120');

  // Paso 3: Horario y Calendario
  const [eventDate, setEventDate] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>('');

  // Paso 4: Modalidad de Pagos y Entrega
  const [isImmediateDelivery, setIsImmediateDelivery] = useState(false);
  const [advanceSoles, setAdvanceSoles] = useState<string>('50');
  const [paidTotalSoles, setPaidTotalSoles] = useState<string>('120');
  const [guaranteeSoles, setGuaranteeSoles] = useState<string>('50');
  const [garantiaDniFisico, setGarantiaDniFisico] = useState<boolean>(false);

  // Método de Pago y Desglose JSONB
  const [paymentMethod, setPaymentMethod] = useState<DressRentalPaymentMethod>('Efectivo');
  const [cashAmountSoles, setCashAmountSoles] = useState<string>('0');
  const [yapeAmountSoles, setYapeAmountSoles] = useState<string>('0');

  // Estados de retroalimentación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filtrado de vestidos ÚNICAMENTE por código
  const codeFilteredWardrobe = useMemo(() => {
    if (!searchCodeQuery.trim()) {
      return wardrobe.slice(0, 5); // Sugerencias iniciales si no escribe
    }
    const q = searchCodeQuery.toUpperCase().trim();
    return wardrobe.filter(
      (w) =>
        (w.code || w.codigo_unico || '').toUpperCase().includes(q) ||
        (w.name || '').toUpperCase().includes(q)
    );
  }, [wardrobe, searchCodeQuery]);

  // Manejador al seleccionar prenda
  const handleSelectPrenda = (item: WardrobeItem) => {
    setSelectedWardrobeItem(item);
    const priceSolesVal = (item.rental_price_cents / 100).toFixed(0);
    setCustomPriceSoles(priceSolesVal);
    setPaidTotalSoles(priceSolesVal);
    setGuaranteeSoles(item.deposit_cents ? (item.deposit_cents / 100).toFixed(0) : '50');
    setValidationError(null);
  };

  // Cálculo del saldo pendiente y montos requeridos
  const totalPriceSolesNum = parseFloat(customPriceSoles) || 0;
  const advanceSolesNum = parseFloat(advanceSoles) || 0;
  const pendingBalanceSoles = Math.max(0, totalPriceSolesNum - advanceSolesNum);
  const targetRequiredSoles = isImmediateDelivery ? totalPriceSolesNum : advanceSolesNum;

  // Manejador al seleccionar método de pago
  const handleSelectPaymentMethod = (method: DressRentalPaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'Mixto') {
      const currentCash = parseInt(cashAmountSoles, 10);
      const currentYape = parseInt(yapeAmountSoles, 10);
      if (
        isNaN(currentCash) ||
        isNaN(currentYape) ||
        (currentCash === 0 && currentYape === 0) ||
        currentCash + currentYape !== targetRequiredSoles
      ) {
        const half = Math.floor(targetRequiredSoles / 2);
        setCashAmountSoles(String(half));
        setYapeAmountSoles(String(targetRequiredSoles - half));
      }
    }
  };

  // Validaciones dinámicas de Mixto
  const isCashEmpty = cashAmountSoles.trim() === '';
  const isYapeEmpty = yapeAmountSoles.trim() === '';
  const parsedCash = parseInt(cashAmountSoles, 10);
  const parsedYape = parseInt(yapeAmountSoles, 10);
  const mixedSum = (isNaN(parsedCash) ? 0 : parsedCash) + (isNaN(parsedYape) ? 0 : parsedYape);
  const isMixedInvalid =
    paymentMethod === 'Mixto' &&
    (isCashEmpty ||
      isYapeEmpty ||
      isNaN(parsedCash) ||
      isNaN(parsedYape) ||
      parsedCash < 0 ||
      parsedYape < 0 ||
      mixedSum !== targetRequiredSoles);

  // Validación y Envío del Formulario
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // 1. Validaciones del Campo 1: Datos del Cliente
    if (!clientFirstName.trim()) {
      setValidationError('Por favor ingresa el nombre del cliente.');
      return;
    }
    if (!clientLastName.trim()) {
      setValidationError('Por favor ingresa los apellidos del cliente.');
      return;
    }
    const cleanDni = sanitizeDni(clientDni);
    if (cleanDni.length !== 8) {
      setValidationError('El DNI debe tener exactamente 8 dígitos numéricos.');
      return;
    }
    if (!eventName.trim()) {
      setValidationError('Por favor ingresa el nombre del evento.');
      return;
    }
    const cleanPhone = sanitizePhone(clientPhone);
    if (cleanPhone.length !== 9) {
      setValidationError('El teléfono debe tener exactamente 9 dígitos numéricos.');
      return;
    }
    if (!destination.trim()) {
      setValidationError('Por favor ingresa el lugar de destino del evento.');
      return;
    }

    // 2. Validación del Campo 2: Prenda Seleccionada
    if (!selectedWardrobeItem) {
      setValidationError('Debes buscar y seleccionar un vestido mediante su código.');
      return;
    }

    // 3. Validación del Campo 3: Fechas
    if (!eventDate || !returnDate) {
      setValidationError('Debes seleccionar la fecha del evento en el calendario de disponibilidad.');
      return;
    }

    // Verificar que las fechas no se solapen con reservas activas de esta prenda (2 días)
    const targetItemCode = (selectedWardrobeItem.code || selectedWardrobeItem.codigo_unico || '').toUpperCase().trim();
    const hasDateConflict = dressRentals.some((r) => {
      const isStatusActive = r.status === 'por_validar' || r.status === 'reservado' || r.status === 'entregado';
      if (!isStatusActive) return false;
      const rCode = (r.item_code || '').toUpperCase().trim();
      const isSame = (r.wardrobe_item_id && r.wardrobe_item_id === selectedWardrobeItem.id) || (rCode && rCode === targetItemCode);
      if (!isSame) return false;

      const rStart = r.event_date;
      const rEndD = new Date(r.event_date + 'T00:00:00');
      rEndD.setDate(rEndD.getDate() + 1);
      const rEnd = rEndD.toISOString().split('T')[0];

      return (
        (eventDate >= rStart && eventDate <= rEnd) ||
        (returnDate >= rStart && returnDate <= rEnd)
      );
    });

    if (hasDateConflict) {
      setValidationError('La fecha seleccionada entra en conflicto con una reserva existente de esta prenda.');
      return;
    }

    // 4. Validación del Campo 4: Pagos
    let finalAdvanceCents = 0;
    let finalPendingCents = 0;
    let finalGuaranteeCents = 0;
    const finalPriceCents = Math.round(totalPriceSolesNum * 100);

    if (isImmediateDelivery) {
      // Escenario 4.2: Entrega Inmediata
      const paidNum = parseFloat(paidTotalSoles);
      const guarNum = guaranteeSoles === '' && garantiaDniFisico ? 0 : parseFloat(guaranteeSoles);
      if (isNaN(guarNum) || guarNum < 0) {
        setValidationError('Por favor ingresa un monto válido de garantía recibida (puede ser 0 si dejó DNI).');
        return;
      }
      finalAdvanceCents = Math.round((isNaN(paidNum) ? totalPriceSolesNum : paidNum) * 100);
      finalPendingCents = 0;
      finalGuaranteeCents = Math.round(guarNum * 100);
    } else {
      // Escenario 4.1: Reserva Normal
      if (isNaN(advanceSolesNum) || advanceSolesNum < 0) {
        setValidationError('Por favor ingresa un monto de adelanto válido (puede ser 0).');
        return;
      }
      finalAdvanceCents = Math.round(advanceSolesNum * 100);
      finalPendingCents = Math.round(pendingBalanceSoles * 100);
      // Para la etapa de reserva, la garantía queda en 0 y se habilita al momento de entrega
      finalGuaranteeCents = 0;
    }

    if (isMixedInvalid) {
      setValidationError('La suma de los montos en Efectivo y Yape debe coincidir exactamente con el total requerido.');
      return;
    }

    const detallesPago: DressRentalPaymentDetails =
      paymentMethod === 'Mixto'
        ? {
            metodo: 'Mixto',
            monto_efectivo: parsedCash,
            monto_yape: parsedYape,
            total_pagado: targetRequiredSoles,
          }
        : paymentMethod === 'Yape'
        ? {
            metodo: 'Yape',
            monto_yape: targetRequiredSoles,
            total_pagado: targetRequiredSoles,
          }
        : {
            metodo: 'Efectivo',
            monto_efectivo: targetRequiredSoles,
            total_pagado: targetRequiredSoles,
          };

    setIsSubmitting(true);
    try {
      const created = await addDressRental({
        origin: 'local',
        wardrobe_item_id: selectedWardrobeItem.id,
        item_code: (selectedWardrobeItem.code || selectedWardrobeItem.codigo_unico || 'A-101').toUpperCase().trim(),
        item_name: selectedWardrobeItem.name,
        item_size: selectedWardrobeItem.size || 'M',
        item_color: selectedWardrobeItem.color || 'Variado',
        client_first_name: clientFirstName.trim(),
        client_last_name: clientLastName.trim(),
        client_dni: cleanDni,
        client_phone: cleanPhone,
        event_name: eventName.trim(),
        destination: destination.trim(),
        event_date: eventDate,
        return_date: returnDate,
        status: isImmediateDelivery ? 'entregado' : 'reservado',
        rental_price_cents: finalPriceCents,
        advance_cents: finalAdvanceCents,
        pending_cents: finalPendingCents,
        guarantee_cents: finalGuaranteeCents,
        garantia_dni_fisico: isImmediateDelivery ? Boolean(garantiaDniFisico) : false,
        is_immediate_delivery: isImmediateDelivery,
        delivery_date: isImmediateDelivery ? new Date().toISOString() : null,
        detalles_pago: detallesPago,
        asesor_name: (
          currentUser?.name ||
          (currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : '') ||
          'Modista Acicalados'
        ).trim(),
      });

      if (created) {
        onSuccess(created);
        onClose();
      } else {
        setValidationError('No se pudo guardar la reserva. Intenta de nuevo.');
      }
    } catch (err: any) {
      console.error('Error al guardar reserva:', err);
      setValidationError(err.message || 'Error inesperado al guardar la orden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalOverlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-5 md:p-6 lg:p-8 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain"
    >
      <div
        ref={modalContentRef}
        className="bg-[#121212] border border-[#C8A45C]/50 rounded-2xl sm:rounded-3xl max-w-4xl w-full min-h-0 p-4 sm:p-6 md:p-8 space-y-6 shadow-2xl relative my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-200 text-neutral-200"
      >
        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875] flex items-center gap-1.5 w-fit">
                <Sparkles className="w-3 h-3" />
                Nueva Orden de Alquiler
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-neutral-800/90 border border-neutral-700/80 text-neutral-300 flex items-center gap-1">
                <User className="w-3 h-3 text-[#C8A45C]" />
                <span>Asesora: <strong className="text-[#E6C875] font-semibold">{currentUser?.name || 'Modista Acicalados'}</strong></span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Reservar Vestidos & Prendas de Gala
            </h2>
            <p className="text-xs text-neutral-400">
              Registro administrativo presencial con verificación estricta de disponibilidad y modalidad de entrega.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Error si aplica */}
        {validationError && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-7">
          {/* ======================================================== */}
          {/* CAMPO 1: DATOS DEL CLIENTE                               */}
          {/* ======================================================== */}
          <div className="bg-[#171717] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-800/80 pb-2.5">
              <User className="w-4 h-4 text-[#C8A45C]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#E6C875]">
                Campo 1: Datos del Cliente
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                  <span>DNI (8 dígitos) <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-neutral-500">{clientDni.length}/8</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    maxLength={8}
                    required
                    value={clientDni}
                    onChange={(e) => {
                      setClientDni(sanitizeDni(e.target.value));
                      if (dniFeedback) setDniFeedback(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConsultarDni();
                      }
                    }}
                    placeholder="70123456"
                    className="w-full pl-3 pr-10 py-2 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none font-mono transition"
                  />
                  <button
                    type="button"
                    onClick={handleConsultarDni}
                    disabled={isSearchingDni || clientDni.trim().length !== 8}
                    title="Consultar DNI en RENIEC / APIS PERU"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#C8A45C]/20 hover:bg-[#C8A45C] text-[#E6C875] hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center cursor-pointer"
                  >
                    {isSearchingDni ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {dniFeedback && (
                  <p
                    className={`text-[10px] font-medium leading-tight mt-1 ${
                      dniFeedback.type === 'success'
                        ? 'text-emerald-400'
                        : dniFeedback.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {dniFeedback.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">
                  Nombre del Cliente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientFirstName}
                  onChange={(e) => setClientFirstName(e.target.value)}
                  placeholder="Ej. María"
                  className="w-full px-3 py-2 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">
                  Apellidos del Cliente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientLastName}
                  onChange={(e) => setClientLastName(e.target.value)}
                  placeholder="Ej. Fernández Quispe"
                  className="w-full px-3 py-2 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">
                  Nombre del Evento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ej. Matrimonio Civil / Graduación"
                  className="w-full px-3 py-2 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                  <span>Teléfono (9 dígitos) <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-neutral-500">{clientPhone.length}/9</span>
                </label>
                <input
                  type="tel"
                  maxLength={9}
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(sanitizePhone(e.target.value))}
                  placeholder="991044301"
                  className="w-full px-3 py-2 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none font-mono transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">
                  Lugar de Destino <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ej. San Isidro, Lima"
                    className="w-full pl-8 pr-3 py-2 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* CAMPO 2: ESCOGER VESTIDOS O PAQUETES                     */}
          {/* ======================================================== */}
          <div className="bg-[#171717] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#C8A45C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E6C875]">
                  Campo 2: Escoger Vestidos o Paquetes
                </h3>
              </div>
              <span className="text-[10px] text-neutral-400 italic">
                Búsqueda exclusiva por código de prenda
              </span>
            </div>

            {/* Buscador ÚNICAMENTE por código */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#C8A45C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchCodeQuery}
                onChange={(e) => setSearchCodeQuery(e.target.value)}
                placeholder="🔍 Buscar vestido por código (ejemplo: A-101, B-205, C-310)..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#1F1F1F] border border-neutral-700/90 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-400 outline-none uppercase font-mono tracking-wider transition"
              />
            </div>

            {/* Lista de Resultados */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {codeFilteredWardrobe.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                  No se encontraron vestidos con el código ingresado.
                </div>
              ) : (
                codeFilteredWardrobe.map((item) => {
                  const isSelected = selectedWardrobeItem?.id === item.id;
                  const itemCode = (item.code || 'A-101').toUpperCase().trim();
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectPrenda(item)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#221D12] border-[#C8A45C] shadow-md shadow-[#C8A45C]/10'
                          : 'bg-[#1D1D1D] border-neutral-800 hover:border-neutral-700 hover:bg-[#222222]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectPrenda(item)}
                          className="w-4 h-4 rounded border-neutral-700 text-[#C8A45C] focus:ring-0 cursor-pointer accent-[#C8A45C] flex-shrink-0"
                        />
                        {/* Fotografía de la prenda */}
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-14 h-16 sm:w-16 sm:h-20 object-cover rounded-md border border-amber-500/30 flex-shrink-0 bg-neutral-900"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80';
                            }}
                          />
                        ) : (
                          <div className="w-14 h-16 sm:w-16 sm:h-20 rounded-md border border-amber-500/30 flex-shrink-0 bg-neutral-900 flex items-center justify-center text-amber-500/50">
                            <Shirt className="w-6 h-6 text-[#C8A45C]/50" />
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[#E6C875] bg-black/60 px-2 py-0.5 rounded border border-[#C8A45C]/30 flex-shrink-0">
                              CÓDIGO: {itemCode}
                            </span>
                            <span className="text-xs font-bold text-white truncate">{item.name}</span>
                          </div>
                          <p className="text-[11px] text-neutral-400">
                            talla: <span className="text-neutral-200 font-medium">{item.size || 'M'}</span> |{' '}
                            color: <span className="text-neutral-200 font-medium">{item.color || 'Variado'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-bold text-[#E6C875]">
                          {formatSoles(item.rental_price_cents)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Candado de Rol en el Precio Total */}
            {selectedWardrobeItem && (
              <div className="pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#131313] p-3 rounded-xl border border-neutral-800">
                <div>
                  <span className="text-xs font-semibold text-neutral-300">
                    * COSTO TOTAL DEL ALQUILER:
                  </span>
                  {isRecepcionista && (
                    <p className="text-[10px] text-amber-400/90 flex items-center gap-1 mt-0.5">
                      <Lock className="w-3 h-3" />
                      Solo el Administrador puede modificar precios base.
                    </p>
                  )}
                </div>

                <div className="relative w-full sm:w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E6C875]">
                    S/
                  </span>
                  <input
                    type="number"
                    min="0"
                    disabled={isRecepcionista}
                    value={customPriceSoles}
                    onChange={(e) => setCustomPriceSoles(e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs font-bold outline-none transition ${
                      isRecepcionista
                        ? 'bg-[#181818] border border-neutral-800 text-neutral-400 cursor-not-allowed'
                        : 'bg-[#222222] border border-[#C8A45C] text-white focus:ring-1 focus:ring-[#C8A45C]'
                    }`}
                  />
                  {isRecepcionista && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">
                      🔒 Bloqueado
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* CAMPO 3: HORARIO DE RESERVA (CALENDARIO)                 */}
          {/* ======================================================== */}
          <div className="space-y-2">
            <DressAvailabilityCalendar
              itemCode={selectedWardrobeItem?.code || selectedWardrobeItem?.codigo_unico || 'A-100'}
              wardrobeItemId={selectedWardrobeItem?.id}
              itemName={selectedWardrobeItem?.name || 'Vestido'}
              selectedDate={eventDate}
              returnDate={returnDate}
              onSelectDates={(evDate, retDate) => {
                setEventDate(evDate);
                setReturnDate(retDate);
                setValidationError(null);
              }}
              dressRentals={dressRentals}
            />
          </div>

          {/* ======================================================== */}
          {/* CAMPO 4: MODALIDAD DE PAGOS Y ENTREGA                    */}
          {/* ======================================================== */}
          <div className="bg-[#171717] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#C8A45C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E6C875]">
                  Campo 4: Modalidad de Pagos y Entrega
                </h3>
              </div>

              {/* Interruptor Switch "Entrega Inmediata" */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isImmediateDelivery}
                  onChange={(e) => {
                    const newVal = e.target.checked;
                    setIsImmediateDelivery(newVal);
                    if (paymentMethod === 'Mixto') {
                      const newTarget = newVal ? totalPriceSolesNum : advanceSolesNum;
                      const half = Math.floor(newTarget / 2);
                      setCashAmountSoles(String(half));
                      setYapeAmountSoles(String(newTarget - half));
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#C8A45C] relative" />
                <span className="text-xs font-semibold text-white">
                  {isImmediateDelivery
                    ? '⚡ Entregar vestido en este momento (Activado)'
                    : 'Entregar vestido en este momento (Desactivado)'}
                </span>
              </label>
            </div>

            {/* SELECTOR DE MÉTODO DE PAGO (Efectivo, Yape, Mixto) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 block">
                * Método de Pago:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('Efectivo')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'Efectivo'
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                      : 'bg-[#141414] border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <span>💵 Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('Yape')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'Yape'
                      ? 'bg-purple-950/40 border-purple-500 text-purple-300 shadow-md shadow-purple-950/40'
                      : 'bg-[#141414] border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <span>📱 Yape</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('Mixto')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'Mixto'
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40'
                      : 'bg-[#141414] border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <span>💳 Mixto</span>
                </button>
              </div>
            </div>

            {/* Escenario 4.1: Reserva Normal */}
            {!isImmediateDelivery ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Si es Efectivo o Yape: input general de adelanto */}
                {paymentMethod !== 'Mixto' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-300">
                        * ADELANTO ({paymentMethod.toUpperCase()}, sin decimales):
                      </label>
                      <div className="relative">
                        <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold ${
                          paymentMethod === 'Yape' ? 'text-purple-400' : 'text-emerald-400'
                        }`}>
                          S/
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={advanceSoles}
                          onChange={(e) => setAdvanceSoles(e.target.value)}
                          placeholder="50"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs font-bold text-white outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-300">
                        * SALDO PENDIENTE (Automático):
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                          S/
                        </span>
                        <input
                          type="text"
                          readOnly
                          value={pendingBalanceSoles.toFixed(0)}
                          className="w-full pl-9 pr-3.5 py-2.5 bg-[#151515] border border-neutral-800 rounded-xl text-xs font-bold text-amber-400 outline-none cursor-not-allowed"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">
                          🔒 Automático
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Si es Mixto: Oculta input general y muestra dos inputs paralelos (Efectivo y Yape) */
                  <div className="space-y-3 p-3.5 rounded-xl bg-black/40 border border-neutral-800 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
                      <span className="text-neutral-400 font-semibold">Total de Adelanto Requerido:</span>
                      <div className="flex items-center gap-1.5 bg-[#141414] px-2.5 py-1 rounded-lg border border-[#C8A45C]/40">
                        <span className="text-xs font-bold text-[#E6C875]">S/</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={advanceSoles}
                          onChange={(e) => {
                            setAdvanceSoles(e.target.value);
                            const newReq = parseFloat(e.target.value) || 0;
                            const half = Math.floor(newReq / 2);
                            setCashAmountSoles(String(half));
                            setYapeAmountSoles(String(newReq - half));
                          }}
                          className="w-16 bg-transparent text-xs font-bold text-white text-right outline-none font-mono"
                          placeholder="50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-300">
                          * MONTO EN EFECTIVO (S/):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">S/</span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            required
                            value={cashAmountSoles}
                            onChange={(e) => setCashAmountSoles(e.target.value)}
                            placeholder="0"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-emerald-500 rounded-xl text-xs font-bold text-white outline-none transition"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-300">
                          * MONTO EN YAPE (S/):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-400">S/</span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            required
                            value={yapeAmountSoles}
                            onChange={(e) => setYapeAmountSoles(e.target.value)}
                            placeholder="0"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-purple-500 rounded-xl text-xs font-bold text-white outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Validación en tiempo real de la suma */}
                    {isMixedInvalid ? (
                      <div className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-500/40 p-2.5 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                        <span>
                          {isCashEmpty || isYapeEmpty
                            ? 'Debes ingresar ambos montos enteros (Efectivo y Yape).'
                            : `La suma de Efectivo (S/ ${parsedCash || 0}) + Yape (S/ ${parsedYape || 0}) es S/ ${mixedSum}. Debe coincidir exactamente con el total requerido de S/ ${targetRequiredSoles}.`}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-500/40 p-2 rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                        <span>
                          ✓ Suma exacta validada: S/ {targetRequiredSoles} (Efectivo: S/ ${parsedCash} | Yape: S/ ${parsedYape})
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-800 text-neutral-400">
                      <span>Saldo pendiente al retirar:</span>
                      <strong className="text-amber-400 font-mono">S/ {pendingBalanceSoles.toFixed(2)}</strong>
                    </div>
                  </div>
                )}

                <div className="bg-[#121212] border border-amber-900/40 rounded-xl p-3 text-[11px] text-amber-300/90 flex items-start gap-2">
                  <span className="text-amber-400">⚠️</span>
                  <p>
                    <span className="font-semibold">Nota:</span> El pago de Garantía se habilitará en el sistema el día que el cliente recoja el vestido.
                  </p>
                </div>
              </div>
            ) : (
              /* Escenario 4.2: Entrega Inmediata */
              <div className="space-y-3 animate-in fade-in duration-200">
                {paymentMethod !== 'Mixto' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-300">
                        * TOTAL ALQUILER PAGADO ({paymentMethod.toUpperCase()}):
                      </label>
                      <div className="relative">
                        <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold ${
                          paymentMethod === 'Yape' ? 'text-purple-400' : 'text-emerald-400'
                        }`}>
                          S/
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={paidTotalSoles}
                          onChange={(e) => setPaidTotalSoles(e.target.value)}
                          placeholder="120"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-emerald-500 rounded-xl text-xs font-bold text-emerald-400 outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-300">
                        * GARANTÍA RECIBIDA (Manual, sin decimales):
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E6C875]">
                            S/
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={guaranteeSoles}
                            onChange={(e) => setGuaranteeSoles(e.target.value)}
                            placeholder={garantiaDniFisico ? "40" : "50"}
                            className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs font-bold text-[#E6C875] outline-none transition"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setGarantiaDniFisico(!garantiaDniFisico)}
                          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs font-semibold ${
                            garantiaDniFisico
                              ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-300 shadow-sm shadow-emerald-900/20'
                              : 'bg-[#181818] border-[#C8A45C]/30 text-neutral-300 hover:border-[#C8A45C]/60 hover:text-white'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              garantiaDniFisico
                                ? 'bg-emerald-500 border-emerald-400 text-black'
                                : 'border-[#C8A45C]/50 bg-black/40'
                            }`}
                          >
                            {garantiaDniFisico && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="whitespace-nowrap">Dejó DNI físico en custodia</span>
                        </button>
                      </div>
                      {garantiaDniFisico && (
                        <div className="text-[11px] text-emerald-400/90 flex items-center gap-1.5 pt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                          <span>Garantía Híbrida: Efectivo (S/ {guaranteeSoles || '0'}) + DNI físico en custodia</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Entrega Inmediata Mixto */
                  <div className="space-y-3 p-3.5 rounded-xl bg-black/40 border border-neutral-800 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
                      <span className="text-neutral-400 font-semibold">Total Alquiler Requerido (100%):</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">S/ {totalPriceSolesNum}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-300">
                          * MONTO EN EFECTIVO (S/):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">S/</span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            required
                            value={cashAmountSoles}
                            onChange={(e) => setCashAmountSoles(e.target.value)}
                            placeholder="0"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-emerald-500 rounded-xl text-xs font-bold text-white outline-none transition"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-300">
                          * MONTO EN YAPE (S/):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-400">S/</span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            required
                            value={yapeAmountSoles}
                            onChange={(e) => setYapeAmountSoles(e.target.value)}
                            placeholder="0"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-purple-500 rounded-xl text-xs font-bold text-white outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Validación en tiempo real */}
                    {isMixedInvalid ? (
                      <div className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-500/40 p-2.5 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                        <span>
                          {isCashEmpty || isYapeEmpty
                            ? 'Debes ingresar ambos montos enteros (Efectivo y Yape).'
                            : `La suma de Efectivo (S/ ${parsedCash || 0}) + Yape (S/ ${parsedYape || 0}) es S/ ${mixedSum}. Debe coincidir exactamente con el total requerido de S/ ${targetRequiredSoles}.`}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-500/40 p-2 rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                        <span>
                          ✓ Suma exacta validada: S/ {targetRequiredSoles} (Efectivo: S/ ${parsedCash} | Yape: S/ ${parsedYape})
                        </span>
                      </div>
                    )}

                    {/* Garantía en entrega inmediata */}
                    <div className="pt-2 border-t border-neutral-800 space-y-1">
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        * GARANTÍA RECIBIDA EN CUSTODIA (S/):
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E6C875]">S/</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={guaranteeSoles}
                            onChange={(e) => setGuaranteeSoles(e.target.value)}
                            placeholder={garantiaDniFisico ? "40" : "50"}
                            className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs font-bold text-[#E6C875] outline-none transition"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setGarantiaDniFisico(!garantiaDniFisico)}
                          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs font-semibold ${
                            garantiaDniFisico
                              ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-300 shadow-sm shadow-emerald-900/20'
                              : 'bg-[#181818] border-[#C8A45C]/30 text-neutral-300 hover:border-[#C8A45C]/60 hover:text-white'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              garantiaDniFisico
                                ? 'bg-emerald-500 border-emerald-400 text-black'
                                : 'border-[#C8A45C]/50 bg-black/40'
                            }`}
                          >
                            {garantiaDniFisico && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="whitespace-nowrap">Dejó DNI físico en custodia</span>
                        </button>
                      </div>
                      {garantiaDniFisico && (
                        <div className="text-[11px] text-emerald-400/90 flex items-center gap-1.5 pt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                          <span>Garantía Híbrida: Efectivo (S/ {guaranteeSoles || '0'}) + DNI físico en custodia</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-emerald-950/25 border border-emerald-800/40 rounded-xl p-3 text-[11px] text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold">Entrega Inmediata:</span> Se registrará como entregado hoy mismo con pago completo y garantía en custodia.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Botón Final de Guardado */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-[#1A1A1A] hover:bg-[#222222] border border-neutral-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isMixedInvalid}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isImmediateDelivery
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-950/40'
                  : 'bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black shadow-[#C8A45C]/20'
              }`}
            >
              {isSubmitting ? (
                <span>Guardando Orden...</span>
              ) : isMixedInvalid ? (
                <span>Suma Mixta No Cuadra</span>
              ) : isImmediateDelivery ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>REGISTRAR COMO ENTREGADO</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>GUARDAR COMO RESERVADO</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
