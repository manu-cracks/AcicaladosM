import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Calendar,
  CreditCard,
  User,
  AlertCircle,
  Sparkles,
  Clock,
  CheckCircle2,
  Shirt,
  Package,
  Trash2,
  Plus,
  Boxes,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { WardrobeItem, DressRental, formatSoles, DressRentalPaymentMethod, DressRentalPaymentDetails } from '../../../types';
import { DressAvailabilityCalendar } from './DressAvailabilityCalendar';
import { sanitizeDni, sanitizePhone } from '../../../lib/validators';
import { supabase } from '../../../lib/supabase/client';
import { consultarDniApi } from '../../../lib/consultaDni';

interface NewDressPackRentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (rental: DressRental) => void;
}

export const NewDressPackRentalModal: React.FC<NewDressPackRentalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { wardrobe, dressRentals, addDressRental, currentUser } = useApp();

  // Referencias para controlar el scroll del modal
  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const resetScrollPosition = () => {
        if (modalOverlayRef.current) modalOverlayRef.current.scrollTop = 0;
        if (modalContentRef.current) modalContentRef.current.scrollTop = 0;
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

  // Paso 2: Arreglo de Prendas Seleccionadas (Mini Carrito de Pack)
  const [selectedItems, setSelectedItems] = useState<WardrobeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');
  const [customPriceSoles, setCustomPriceSoles] = useState<string>('');
  const [isPriceCustomized, setIsPriceCustomized] = useState<boolean>(false);
  const [supabaseActiveCatalog, setSupabaseActiveCatalog] = useState<WardrobeItem[] | null>(null);

  // Requisito 4: Consulta a Supabase que alimenta este catálogo filtrando prendas activas (no códigos fantasma ni inactivos)
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const fetchActiveWardrobe = async () => {
      try {
        const { data, error } = await supabase
          .from('wardrobe_items')
          .select('*')
          .eq('is_active', true)
          .order('code');

        if (!error && data && !isCancelled) {
          const mapped: WardrobeItem[] = data.map((w: any) => {
            const uniqueSku = (w.code || w.codigo_unico || w.codigo_prenda || 'A-100').toUpperCase().trim();
            const letter = uniqueSku.split('-')[0].toUpperCase() || 'A';
            return {
              id: w.id,
              code: uniqueSku,
              identificador: uniqueSku,
              codigo_unico: uniqueSku,
              letter_code: letter,
              name: w.name || w.titulo || 'Prenda de Gala',
              category: w.category || w.categoria_evento || 'Bodas y Matrimonio',
              rental_price_cents: w.price_cents || (w.precio_alquiler ? Math.round(w.precio_alquiler * 100) : 0),
              deposit_cents: w.deposit_cents || (w.garantia_reembolsable ? Math.round(w.garantia_reembolsable * 100) : 5000),
              status: (w.availability_status || 'disponible') as any,
              active: true,
              size: w.talla || w.size || 'M',
              talla: w.talla || w.size || 'M',
              color: w.color || 'Variado',
              image_url: w.images && w.images.length > 0 ? w.images[0] : (w.imagen_url || 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80'),
              description: w.description || w.descripcion || '',
            };
          });
          setSupabaseActiveCatalog(mapped);
        }
      } catch (err) {
        console.error('Error fetching active wardrobe items from Supabase:', err);
      }
    };

    fetchActiveWardrobe();
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Paso 3: Horario y Fechas
  const [eventDate, setEventDate] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>('');

  // Paso 4: Modalidad de Pagos y Entrega
  const [isImmediateDelivery, setIsImmediateDelivery] = useState(false);
  const [advanceSoles, setAdvanceSoles] = useState<string>('100');
  const [paidTotalSoles, setPaidTotalSoles] = useState<string>('');
  const [immediateGuaranteeSoles, setImmediateGuaranteeSoles] = useState<string>('50');

  // Método de Pago y Desglose JSONB
  const [paymentMethod, setPaymentMethod] = useState<DressRentalPaymentMethod>('Efectivo');
  const [cashAmountSoles, setCashAmountSoles] = useState<string>('0');
  const [yapeAmountSoles, setYapeAmountSoles] = useState<string>('0');

  // Retroalimentación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Categorías disponibles en catálogo
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    const base = supabaseActiveCatalog || wardrobe;
    base.forEach((w) => {
      if (w.category) cats.add(w.category);
    });
    return Array.from(cats);
  }, [supabaseActiveCatalog, wardrobe]);

  // Prendas filtradas para el buscador de prendas
  const filteredCatalogItems = useMemo(() => {
    const baseCatalog = supabaseActiveCatalog || wardrobe;

    // Filtrar estrictamente solo prendas activas (no códigos fantasma, eliminados o inactivos)
    let items = baseCatalog.filter((w) => {
      const isStatusInactive =
        w.status === 'inactivo' ||
        w.status === 'eliminado' ||
        (w.status as string) === 'baja';
      const isActiveFlag = w.active !== false;
      const isEstadoFlag = (w as any).estado !== false && (w as any).estado !== 'inactivo';

      return !isStatusInactive && isActiveFlag && isEstadoFlag;
    });

    if (selectedCategoryFilter !== 'todos') {
      items = items.filter((w) => (w.category || '').toLowerCase() === selectedCategoryFilter.toLowerCase());
    }

    if (!searchQuery.trim()) {
      return items.slice(0, 8); // Primeras 8 sugerencias
    }

    const q = searchQuery.toUpperCase().trim();

    // Requisito 4: Si el término buscado incluye un guion (ej. T-, A- o Y-),
    // el filtro debe aplicarse exclusiva y estrictamente sobre el campo del código, ignorando el título
    if (q.includes('-')) {
      return items.filter((w) => {
        const itemCode = (
          w.code ||
          w.codigo_unico ||
          (w as any).codigo ||
          (w as any).codigo_prenda ||
          w.identificador ||
          ''
        ).toUpperCase().trim();
        return itemCode.includes(q);
      });
    }

    // Búsqueda regular por código, nombre o categoría
    return items.filter((w) => {
      const itemCode = (
        w.code ||
        w.codigo_unico ||
        (w as any).codigo ||
        (w as any).codigo_prenda ||
        w.identificador ||
        ''
      ).toUpperCase().trim();

      return (
        itemCode.includes(q) ||
        (w.name || '').toUpperCase().includes(q) ||
        (w.category || '').toUpperCase().includes(q)
      );
    });
  }, [supabaseActiveCatalog, wardrobe, searchQuery, selectedCategoryFilter]);

  // Sumatorios Automáticos de Prendas en el Pack
  const autoCalculatedTotalRentalCents = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + (item.rental_price_cents || 0), 0);
  }, [selectedItems]);

  // Actualizar precio de alquiler al modificar prendas si no está personalizado
  useEffect(() => {
    const autoRentalSoles = (autoCalculatedTotalRentalCents / 100).toFixed(0);

    if (!isPriceCustomized) {
      setCustomPriceSoles(autoRentalSoles);
      setPaidTotalSoles(autoRentalSoles);
    }

    // Sugerir un adelanto del 50% aprox
    const totalNum = parseFloat(isPriceCustomized ? customPriceSoles : autoRentalSoles) || 0;
    const suggestedAdvance = Math.round(totalNum * 0.5);
    setAdvanceSoles(suggestedAdvance > 0 ? String(suggestedAdvance) : '50');
  }, [selectedItems, autoCalculatedTotalRentalCents, isPriceCustomized]);

  // Funciones para agregar y quitar prendas del carrito
  const handleAddItemToPack = (item: WardrobeItem) => {
    if (selectedItems.some((it) => it.id === item.id)) {
      return; // Ya está agregada
    }
    setSelectedItems((prev) => [...prev, item]);
    setValidationError(null);
  };

  const handleRemoveItemFromPack = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((it) => it.id !== itemId));
    setValidationError(null);
  };

  // Verificación estricta de conflictos de disponibilidad para TODAS las prendas del pack
  const conflictingItems = useMemo(() => {
    if (!eventDate || !returnDate || selectedItems.length === 0) {
      return [];
    }

    return selectedItems.filter((item) => {
      const targetCode = (item.code || item.codigo_unico || '').toUpperCase().trim();

      return dressRentals.some((r) => {
        const isStatusActive = r.status === 'por_validar' || r.status === 'reservado' || r.status === 'entregado';
        if (!isStatusActive) return false;

        const matchesId =
          (item.id && r.wardrobe_item_id && r.wardrobe_item_id === item.id) ||
          (item.id && r.pack_item_ids && r.pack_item_ids.includes(item.id));

        const rCode = (r.item_code || '').toUpperCase().trim();
        const matchesCode = Boolean(targetCode) && (rCode === targetCode || rCode.includes(targetCode));

        if (!matchesId && !matchesCode) return false;

        const rStart = r.event_date;
        const rEndD = new Date(r.event_date + 'T00:00:00');
        rEndD.setDate(rEndD.getDate() + 1);
        const rEnd = rEndD.toISOString().split('T')[0];

        return (
          (eventDate >= rStart && eventDate <= rEnd) ||
          (returnDate >= rStart && returnDate <= rEnd)
        );
      });
    });
  }, [selectedItems, eventDate, returnDate, dressRentals]);

  // Cálculos de saldo pendiente y métodos de pago
  const effectiveTotalPriceSolesNum = parseFloat(customPriceSoles) || 0;
  const advanceSolesNum = parseFloat(advanceSoles) || 0;
  const pendingBalanceSoles = Math.max(0, effectiveTotalPriceSolesNum - advanceSolesNum);
  const targetRequiredSoles = isImmediateDelivery ? effectiveTotalPriceSolesNum : advanceSolesNum;

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

  // Validación y Envío de la Orden de Pack
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

    // 2. Validación de Mínimo 2 Prendas en el Pack
    if (selectedItems.length < 2) {
      setValidationError('Una reserva de pack requiere seleccionar como mínimo 2 prendas.');
      return;
    }

    // 3. Validación de Fechas en el Calendario
    if (!eventDate || !returnDate) {
      setValidationError('Debes seleccionar la fecha del evento en el calendario de disponibilidad.');
      return;
    }

    // 4. Validación de Conflictos de Disponibilidad
    if (conflictingItems.length > 0) {
      const conflictCodes = conflictingItems.map((it) => it.code || it.codigo_unico || it.name).join(', ');
      setValidationError(
        `Conflicto de disponibilidad: La(s) prenda(s) con código [${conflictCodes}] ya está(n) reservada(s) para las fechas seleccionadas.`
      );
      return;
    }

    // 5. Validación de Pagos
    let finalAdvanceCents = 0;
    let finalPendingCents = 0;
    let finalGuaranteeCents = 0;
    const finalPriceCents = Math.round(effectiveTotalPriceSolesNum * 100);

    if (isImmediateDelivery) {
      const paidNum = parseFloat(paidTotalSoles);
      const guarNum = parseFloat(immediateGuaranteeSoles);
      finalAdvanceCents = Math.round((isNaN(paidNum) ? effectiveTotalPriceSolesNum : paidNum) * 100);
      finalPendingCents = 0;
      finalGuaranteeCents = isNaN(guarNum) || guarNum < 0 ? 0 : Math.round(guarNum * 100);
    } else {
      if (isNaN(advanceSolesNum) || advanceSolesNum < 0) {
        setValidationError('Por favor ingresa un monto de adelanto válido (puede ser 0).');
        return;
      }
      finalAdvanceCents = Math.round(advanceSolesNum * 100);
      finalPendingCents = Math.round(pendingBalanceSoles * 100);
      // Para la etapa de reserva inicial, la garantía queda en 0 y se habilita al recoger la prenda
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
      const itemCodesList = selectedItems.map((it) => (it.code || it.codigo_unico || '').toUpperCase().trim());
      const itemNamesList = selectedItems.map((it) => it.name.trim());
      const packItemIds = selectedItems.map((it) => it.id);

      const itemsDetail = selectedItems.map((it) => ({
        id: it.id,
        code: it.code || it.codigo_unico,
        name: it.name,
        size: it.size || 'M',
        color: it.color || 'Variado',
        price_cents: it.rental_price_cents,
        deposit_cents: it.deposit_cents || 0,
      }));

      const created = await addDressRental({
        origin: 'local',
        is_pack: true,
        pack_item_ids: packItemIds,
        wardrobe_item_id: selectedItems[0]?.id || null,
        item_code: `PACK: ${itemCodesList.join(', ')}`,
        item_name: `Pack (${selectedItems.length} prendas): ${itemNamesList.join(' + ')}`,
        item_size: selectedItems.map((it) => `${it.code || it.codigo_unico}: ${it.size || 'M'}`).join(' | '),
        item_color: 'Variado',
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
        detalles_pago: detallesPago,
        is_immediate_delivery: isImmediateDelivery,
        delivery_date: isImmediateDelivery ? new Date().toISOString() : null,
        notes: JSON.stringify({
          tipo: 'PACK_ALQUILER',
          items_count: selectedItems.length,
          prendas: itemsDetail,
        }),
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
        setValidationError('No se pudo guardar la reserva del pack. Intenta de nuevo.');
      }
    } catch (err: any) {
      console.error('Error al guardar reserva de pack:', err);
      setValidationError(err.message || 'Error inesperado al guardar la orden de pack.');
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
        className="bg-[#121212] border-2 border-[#C8A45C]/70 rounded-2xl sm:rounded-3xl max-w-5xl w-full min-h-0 p-4 sm:p-6 md:p-8 space-y-6 shadow-2xl relative my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-200 text-neutral-200"
      >
        {/* Encabezado del Modal con Estilo Distintivo de Pack */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#C8A45C]/25 to-amber-500/20 border border-[#C8A45C] text-[#E6C875] flex items-center gap-1.5 shadow-md">
                <Package className="w-3.5 h-3.5 text-[#C8A45C]" />
                <span>Reserva de Pack Múltiple</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center gap-1">
                <Boxes className="w-3 h-3 text-[#C8A45C]" />
                <span>Mínimo 2 prendas requerido</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-neutral-800/90 border border-neutral-700/80 text-neutral-300 flex items-center gap-1">
                <User className="w-3 h-3 text-[#C8A45C]" />
                <span>Asesora: <strong className="text-[#E6C875] font-semibold">{currentUser?.name || 'Modista Acicalados'}</strong></span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Reservar Pack de Vestidos & Prendas de Gala</span>
            </h2>
            <p className="text-xs text-neutral-400">
              Selecciona dos o más prendas sin límite de categoría, con carrito unificado, sumatorio automático y comprobación de disponibilidad.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de Validación Superior */}
        {validationError && (
          <div className="bg-red-950/70 border border-red-700/80 rounded-2xl p-4 text-xs text-red-200 flex items-start gap-3 shadow-lg animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-red-300 block">Atención:</span>
              <p>{validationError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* CAMPO 1: DATOS DEL CLIENTE */}
          <div className="bg-[#181818] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#C8A45C]/15 text-[#E6C875] flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <User className="w-4 h-4 text-[#C8A45C]" />
                <span>Datos del Cliente y Evento</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-neutral-300">
                    DNI (8 dígitos) <span className="text-red-400">*</span>
                  </label>
                  <span className="text-[10px] text-neutral-500">{clientDni.length}/8</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    maxLength={8}
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
                    placeholder="Ej. 72345678"
                    className="w-full bg-[#111] border border-neutral-700 rounded-xl pl-3 pr-10 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition font-mono"
                    required
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

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Nombre(s) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientFirstName}
                  onChange={(e) => setClientFirstName(e.target.value)}
                  placeholder="Ej. Valeria"
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Apellidos <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientLastName}
                  onChange={(e) => setClientLastName(e.target.value)}
                  placeholder="Ej. Mendoza Ríos"
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Celular / WhatsApp (9 dígitos) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={9}
                  value={clientPhone}
                  onChange={(e) => setClientPhone(sanitizePhone(e.target.value))}
                  placeholder="Ej. 987654321"
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Nombre del Evento <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ej. Graduación Médica / Boda"
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                  Lugar de Destino <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ej. Hotel Los Delfines, San Isidro"
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition"
                  required
                />
              </div>
            </div>
          </div>

          {/* CAMPO 2: ESCOGER VESTIDOS O PAQUETES (TIPO CARRITO MÚLTIPLE) */}
          <div className="bg-[#181818] border-2 border-[#C8A45C]/50 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#C8A45C]/20 text-[#E6C875] flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#C8A45C]" />
                    <span>Escoger Vestidos o Paquetes (Carrito de Prendas)</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Busca y agrega prendas de cualquier categoría. Mínimo 2 ítems requeridos.
                  </p>
                </div>
              </div>

              {/* Contador de Prendas en el Pack */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    selectedItems.length >= 2
                      ? 'bg-emerald-950/60 border-emerald-600/70 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-600/70 text-amber-300'
                  }`}
                >
                  <Shirt className="w-3.5 h-3.5" />
                  <span>{selectedItems.length} prenda(s) en el Pack</span>
                  {selectedItems.length >= 2 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] text-amber-400 font-normal">(Faltan {2 - selectedItems.length})</span>
                  )}
                </span>
              </div>
            </div>

            {/* Buscador de Prendas con Filtro de Categoría */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por código único (ej. A-101), nombre o estilo..."
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] transition uppercase"
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  aria-label="Filtrar prendas por categoría"
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition capitalize"
                >
                  <option value="todos">Todas las categorías</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sugerencias y Resultados de Búsqueda de Prendas */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
                Resultados del Catálogo ({filteredCatalogItems.length} disponibles):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 bg-[#101010] rounded-xl border border-neutral-800">
                {filteredCatalogItems.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-xs text-neutral-500">
                    No se encontraron prendas con el término especificado.
                  </div>
                ) : (
                  filteredCatalogItems.map((item) => {
                    const isAlreadySelected = selectedItems.some((it) => it.id === item.id);
                    const code = (item.code || item.codigo_unico || 'S/C').toUpperCase();

                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                          isAlreadySelected
                            ? 'bg-neutral-900/90 border-[#C8A45C]/60 opacity-80'
                            : 'bg-[#161616] border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Fotografía Real de la Prenda */}
                          <img
                            src={
                              item.image_url ||
                              ((item as any).images && (item as any).images[0]) ||
                              'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80'
                            }
                            alt={item.name}
                            className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-md border border-gray-700 flex-shrink-0 bg-neutral-900"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80';
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono font-bold text-[#E6C875] block truncate">
                              {code}
                            </span>
                            <span className="text-xs font-semibold text-white block truncate line-clamp-2" title={item.name}>
                              {item.name}
                            </span>
                            <span className="text-[10px] text-neutral-400 block truncate mt-0.5">
                              Talla: <strong className="text-neutral-200">{item.size || 'M'}</strong>
                            </span>
                            <span className="text-[11px] font-bold text-[#E6C875] font-mono block mt-0.5">
                              {formatSoles(item.rental_price_cents)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddItemToPack(item)}
                          disabled={isAlreadySelected}
                          className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            isAlreadySelected
                              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                              : 'bg-[#C8A45C]/20 hover:bg-[#C8A45C] text-[#E6C875] hover:text-black border border-[#C8A45C]/40'
                          }`}
                        >
                          {isAlreadySelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>En el Pack</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Agregar al Pack</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* MINI CARRITO: LISTA VISUAL DE PRENDAS EN EL PACK */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Prendas seleccionadas en el Pack ({selectedItems.length}):</span>
                </span>
                {selectedItems.length < 2 && (
                  <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Selecciona al menos 2 prendas para continuar</span>
                  </span>
                )}
              </div>

              {selectedItems.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-neutral-800 rounded-2xl text-center space-y-1.5 bg-[#101010]">
                  <Boxes className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-300">
                    El carrito de este Pack se encuentra vacío
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Utiliza el buscador superior para agregar dos o más vestidos o prendas de gala.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedItems.map((item, idx) => {
                    const code = (item.code || item.codigo_unico || 'S/C').toUpperCase();

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-gradient-to-br from-[#1C1812] to-[#121212] border border-[#C8A45C]/50 relative space-y-2 shadow-md group"
                      >
                        <div className="flex items-start justify-between gap-2.5 min-w-0">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {/* Fotografía Real de la Prenda */}
                            <img
                              src={
                                item.image_url ||
                                ((item as any).images && (item as any).images[0]) ||
                                'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80'
                              }
                              alt={item.name}
                              className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-md border border-gray-700 flex-shrink-0 bg-neutral-900"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40 inline-block font-mono">
                                #{idx + 1} · {code}
                              </span>
                              <h4 className="text-xs font-bold text-white truncate line-clamp-2 mt-0.5" title={item.name}>
                                {item.name}
                              </h4>
                              <span className="text-[10px] text-neutral-400 block truncate mt-0.5">
                                Talla: <strong className="text-white">{item.size || 'M'}</strong> · Color: {item.color || 'Variado'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromPack(item.id)}
                            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-800/80 transition cursor-pointer flex-shrink-0"
                            title="Quitar prenda del pack"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-neutral-800/80 font-mono">
                          <span className="text-neutral-400">
                            Alquiler: <strong className="text-emerald-400">{formatSoles(item.rental_price_cents)}</strong>
                          </span>
                          <span className="text-[10px] text-neutral-500 font-sans">
                            Prenda incluida
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SUMATORIO AUTOMÁTICO EN LA PARTE INFERIOR */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1A1813] to-[#0E0E0E] border border-[#C8A45C]/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#E6C875] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sumatorio Financiero del Pack ({selectedItems.length} prendas)</span>
                </span>
                <span className="text-[11px] text-neutral-400">
                  Cálculo automático en tiempo real
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                {/* Costo Total del Alquiler */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800 space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Costo Total Alquiler (Sumado)
                  </span>
                  <span className="text-xl font-serif-luxury font-bold text-white block">
                    {formatSoles(autoCalculatedTotalRentalCents)}
                  </span>
                  <span className="text-[9px] text-neutral-500 block">
                    Suma base de las prendas seleccionadas
                  </span>
                </div>

                {/* Tarifa Final Acordada de Alquiler */}
                <div className="p-3.5 rounded-xl bg-[#C8A45C]/10 border border-[#C8A45C]/60 space-y-1">
                  <label className="text-[10px] font-bold text-[#E6C875] uppercase tracking-wider block">
                    PRECIO FINAL ALQUILER PACK (S/)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={customPriceSoles}
                    onChange={(e) => {
                      setCustomPriceSoles(e.target.value);
                      setIsPriceCustomized(true);
                    }}
                    className="w-full bg-[#111] border border-[#C8A45C]/80 rounded-lg px-2 py-1 text-center font-bold text-white font-mono text-base focus:outline-none"
                  />
                  <span className="text-[9px] text-neutral-400 block">
                    {isPriceCustomized ? 'Tarifa personalizada' : 'Automático'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CAMPO 3: HORARIO Y DISPONIBILIDAD (VERIFICACIÓN DE TODAS LAS PRENDAS) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#C8A45C]/15 text-[#E6C875] flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#C8A45C]" />
                  <span>Disponibilidad Simultánea para Todas las Prendas del Pack</span>
                </h3>
                <p className="text-[11px] text-neutral-400">
                  El calendario valida que cada una de las {selectedItems.length} prendas esté completamente libre en la fecha del evento y su día de retorno (2 días de bloqueo).
                </p>
              </div>
            </div>

            {/* ALERTA DE CONFLICTO DE DISPONIBILIDAD (SI ALGUNA PRENDA CHOCA) */}
            {conflictingItems.length > 0 && (
              <div className="p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-600 text-rose-200 text-xs flex items-start gap-3 shadow-xl animate-bounce-subtle">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-extrabold text-rose-300 uppercase tracking-wider block">
                    ¡Conflicto de Disponibilidad en el Pack!
                  </span>
                  <p>
                    La(s) prenda(s) con código{' '}
                    <strong className="text-white underline">
                      [{conflictingItems.map((i) => i.code || i.codigo_unico).join(', ')}]
                    </strong>{' '}
                    ya cuenta(n) con una reserva activa que choca con las fechas seleccionadas ({eventDate} al {returnDate}).
                  </p>
                  <p className="text-[11px] text-rose-300">
                    Para continuar, selecciona otra fecha disponible en el calendario o quita la prenda en conflicto del pack.
                  </p>
                </div>
              </div>
            )}

            {/* Calendario de Disponibilidad */}
            <DressAvailabilityCalendar
              items={selectedItems}
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

          {/* CAMPO 4: MODALIDAD DE PAGOS Y ENTREGA */}
          <div className="bg-[#181818] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#C8A45C]/15 text-[#E6C875] flex items-center justify-center font-bold text-xs">
                4
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#C8A45C]" />
                  <span>Modalidad de Pago y Entrega del Pack</span>
                </h3>
              </div>
            </div>

            {/* Selector de Modalidad: Normal vs Entrega Inmediata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsImmediateDelivery(false)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  !isImmediateDelivery
                    ? 'bg-[#1F1B14] border-[#C8A45C] text-white shadow-md'
                    : 'bg-[#121212] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <Clock className={`w-5 h-5 shrink-0 ${!isImmediateDelivery ? 'text-[#C8A45C]' : 'text-neutral-500'}`} />
                <div>
                  <span className="text-xs font-bold block">Reserva Anticipada (Normal)</span>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    El cliente abona un adelanto para apartar el pack y liquida el saldo al momento de la entrega.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsImmediateDelivery(true)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  isImmediateDelivery
                    ? 'bg-[#1F1B14] border-[#C8A45C] text-white shadow-md'
                    : 'bg-[#121212] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${isImmediateDelivery ? 'text-[#C8A45C]' : 'text-neutral-500'}`} />
                <div>
                  <span className="text-xs font-bold block">Entrega Inmediata (Mismo Día)</span>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    El cliente retira las prendas hoy mismo: paga el 100% del alquiler y deja la garantía de inmediato.
                  </p>
                </div>
              </button>
            </div>

            {/* Selector de Método de Pago: Efectivo, Yape, Mixto */}
            <div className="space-y-2">
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

            {/* Detalle Financiero según modalidad */}
            {!isImmediateDelivery ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                {paymentMethod !== 'Mixto' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/40 border border-neutral-800">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                        * Adelanto Recibido ({paymentMethod.toUpperCase()}, sin decimales):
                      </label>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${
                          paymentMethod === 'Yape' ? 'text-purple-400' : 'text-emerald-400'
                        }`}>
                          S/
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={advanceSoles}
                          onChange={(e) => setAdvanceSoles(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-[#111] border border-[#C8A45C]/60 rounded-xl text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-neutral-500 block mt-0.5">Para apartar el pack</span>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-neutral-300 block mb-1">
                        Saldo Pendiente al Retirar
                      </span>
                      <div className="w-full bg-[#111] border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 font-mono">
                        S/ {pendingBalanceSoles.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-neutral-500 block mt-0.5">Total Pack - Adelanto</span>
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
                          placeholder="100"
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

                <div className="text-amber-500 bg-amber-500/10 p-2 rounded-md">⚠️ Nota: El pago de Garantía se habilitará en el sistema el día que el cliente recoja el vestido.</div>
              </div>
            ) : (
              /* Escenario Entrega Inmediata */
              <div className="space-y-3 animate-in fade-in duration-200">
                {paymentMethod !== 'Mixto' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/40 border border-neutral-800">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                        * Total Alquiler Pagado 100% ({paymentMethod.toUpperCase()}):
                      </label>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${
                          paymentMethod === 'Yape' ? 'text-purple-400' : 'text-emerald-400'
                        }`}>
                          S/
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={paidTotalSoles}
                          onChange={(e) => setPaidTotalSoles(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-[#111] border border-[#C8A45C]/60 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-neutral-500 block mt-0.5">Alquiler completo pagado</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                        * Garantía Total Recibida en Custodia (S/)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={immediateGuaranteeSoles}
                        onChange={(e) => setImmediateGuaranteeSoles(e.target.value)}
                        placeholder="50"
                        className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none"
                      />
                      <span className="text-[10px] text-neutral-500 block mt-0.5">En custodia hasta retorno de prendas</span>
                    </div>
                  </div>
                ) : (
                  /* Entrega Inmediata Mixto */
                  <div className="space-y-3 p-3.5 rounded-xl bg-black/40 border border-neutral-800 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
                      <span className="text-neutral-400 font-semibold">Total Alquiler Requerido (100%):</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">S/ {effectiveTotalPriceSolesNum}</span>
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
                    <div className="pt-2 border-t border-neutral-800">
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        * GARANTÍA RECIBIDA EN CUSTODIA (S/):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={immediateGuaranteeSoles}
                        onChange={(e) => setImmediateGuaranteeSoles(e.target.value)}
                        placeholder="50"
                        className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none"
                      />
                      <span className="text-[10px] text-neutral-500 block mt-0.5">En custodia hasta retorno de prendas</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTONES DE ACCIÓN: CONFIRMAR O CANCELAR */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            {/* BOTÓN PRINCIPAL DE CONFIRMACIÓN: DESHABILITADO SI < 2 PRENDAS O HAY CONFLICTO O MIXTO INVÁLIDO */}
            <button
              type="submit"
              disabled={
                selectedItems.length < 2 ||
                conflictingItems.length > 0 ||
                isSubmitting ||
                !eventDate ||
                !returnDate ||
                isMixedInvalid
              }
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                selectedItems.length < 2 || conflictingItems.length > 0 || !eventDate || !returnDate || isMixedInvalid
                  ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-[#C8A45C] via-[#E2C37D] to-[#C8A45C] text-black shadow-[#C8A45C]/25 hover:brightness-110 active:scale-95'
              }`}
            >
              <Package className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isSubmitting
                  ? 'Registrando Pack...'
                  : selectedItems.length < 2
                  ? `Mínimo 2 prendas requerido (${selectedItems.length}/2)`
                  : conflictingItems.length > 0
                  ? 'Conflicto de fecha detectado'
                  : !eventDate
                  ? 'Selecciona fecha en el calendario'
                  : isMixedInvalid
                  ? 'Ajusta la suma de pago mixto'
                  : isImmediateDelivery
                  ? `Confirmar Entrega Inmediata (${selectedItems.length} prendas)`
                  : `Guardar como Reservado (${selectedItems.length} prendas)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
