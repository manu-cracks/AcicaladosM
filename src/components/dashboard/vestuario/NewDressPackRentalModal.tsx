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
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { WardrobeItem, DressRental, formatSoles } from '../../../types';
import { DressAvailabilityCalendar } from './DressAvailabilityCalendar';
import { sanitizeDni, sanitizePhone } from '../../../lib/validators';

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

  // Paso 2: Arreglo de Prendas Seleccionadas (Mini Carrito de Pack)
  const [selectedItems, setSelectedItems] = useState<WardrobeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');
  const [customPriceSoles, setCustomPriceSoles] = useState<string>('');
  const [isPriceCustomized, setIsPriceCustomized] = useState<boolean>(false);

  // Paso 3: Horario y Fechas
  const [eventDate, setEventDate] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>('');

  // Paso 4: Modalidad de Pagos y Entrega
  const [isImmediateDelivery, setIsImmediateDelivery] = useState(false);
  const [advanceSoles, setAdvanceSoles] = useState<string>('100');
  const [paidTotalSoles, setPaidTotalSoles] = useState<string>('');
  const [customGuaranteeSoles, setCustomGuaranteeSoles] = useState<string>('');

  // Retroalimentación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Categorías disponibles en catálogo
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    wardrobe.forEach((w) => {
      if (w.category) cats.add(w.category);
    });
    return Array.from(cats);
  }, [wardrobe]);

  // Prendas filtradas para el buscador de prendas
  const filteredCatalogItems = useMemo(() => {
    let items = wardrobe.filter((w) => w.status !== 'inactivo' && w.status !== 'eliminado');

    if (selectedCategoryFilter !== 'todos') {
      items = items.filter((w) => (w.category || '').toLowerCase() === selectedCategoryFilter.toLowerCase());
    }

    if (!searchQuery.trim()) {
      return items.slice(0, 8); // Primeras 8 sugerencias
    }

    const q = searchQuery.toUpperCase().trim();
    return items.filter(
      (w) =>
        (w.code || w.codigo_unico || '').toUpperCase().includes(q) ||
        (w.name || '').toUpperCase().includes(q) ||
        (w.category || '').toUpperCase().includes(q)
    );
  }, [wardrobe, searchQuery, selectedCategoryFilter]);

  // Sumatorios Automáticos de Prendas en el Pack
  const autoCalculatedTotalRentalCents = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + (item.rental_price_cents || 0), 0);
  }, [selectedItems]);

  const autoCalculatedTotalGuaranteeCents = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + (item.deposit_cents || 5000), 0);
  }, [selectedItems]);

  // Actualizar precio de alquiler y garantía al modificar prendas si no está personalizado
  useEffect(() => {
    const autoRentalSoles = (autoCalculatedTotalRentalCents / 100).toFixed(0);
    const autoGuaranteeSoles = (autoCalculatedTotalGuaranteeCents / 100).toFixed(0);

    if (!isPriceCustomized) {
      setCustomPriceSoles(autoRentalSoles);
      setPaidTotalSoles(autoRentalSoles);
    }
    setCustomGuaranteeSoles(autoGuaranteeSoles);

    // Sugerir un adelanto del 50% aprox
    const totalNum = parseFloat(isPriceCustomized ? customPriceSoles : autoRentalSoles) || 0;
    const suggestedAdvance = Math.round(totalNum * 0.5);
    setAdvanceSoles(suggestedAdvance > 0 ? String(suggestedAdvance) : '50');
  }, [selectedItems, autoCalculatedTotalRentalCents, autoCalculatedTotalGuaranteeCents, isPriceCustomized]);

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

  // Cálculos de saldo pendiente
  const effectiveTotalPriceSolesNum = parseFloat(customPriceSoles) || 0;
  const advanceSolesNum = parseFloat(advanceSoles) || 0;
  const pendingBalanceSoles = Math.max(0, effectiveTotalPriceSolesNum - advanceSolesNum);

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

    const parsedGuarantee = parseFloat(customGuaranteeSoles);
    finalGuaranteeCents = isNaN(parsedGuarantee) || parsedGuarantee < 0
      ? autoCalculatedTotalGuaranteeCents
      : Math.round(parsedGuarantee * 100);

    if (isImmediateDelivery) {
      const paidNum = parseFloat(paidTotalSoles);
      finalAdvanceCents = Math.round((isNaN(paidNum) ? effectiveTotalPriceSolesNum : paidNum) * 100);
      finalPendingCents = 0;
    } else {
      if (isNaN(advanceSolesNum) || advanceSolesNum < 0) {
        setValidationError('Por favor ingresa un monto de adelanto válido (puede ser 0).');
        return;
      }
      finalAdvanceCents = Math.round(advanceSolesNum * 100);
      finalPendingCents = Math.round(pendingBalanceSoles * 100);
    }

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
        deposit_cents: it.deposit_cents || 5000,
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
                  DNI (8 dígitos) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={clientDni}
                  onChange={(e) => setClientDni(sanitizeDni(e.target.value))}
                  placeholder="Ej. 72345678"
                  className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A45C] transition font-mono"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 bg-[#101010] rounded-xl border border-neutral-800">
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
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                          isAlreadySelected
                            ? 'bg-neutral-900/90 border-[#C8A45C]/60 opacity-80'
                            : 'bg-[#161616] border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {item.images && item.images.length > 0 ? (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="w-10 h-10 object-cover rounded-lg border border-neutral-800 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#C8A45C] shrink-0">
                              <Shirt className="w-5 h-5 opacity-50" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono font-bold text-[#E6C875] block truncate">
                              {code}
                            </span>
                            <span className="text-xs font-semibold text-white block truncate" title={item.name}>
                              {item.name}
                            </span>
                            <span className="text-[10px] text-neutral-400 block truncate">
                              Talla: {item.size || 'M'} · {formatSoles(item.rental_price_cents)}
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
                    const depositVal = item.deposit_cents || 5000;

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-gradient-to-br from-[#1C1812] to-[#121212] border border-[#C8A45C]/50 relative space-y-2 shadow-md group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {item.images && item.images.length > 0 ? (
                              <img
                                src={item.images[0]}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded-xl border border-[#C8A45C]/30 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#C8A45C] shrink-0">
                                <Shirt className="w-6 h-6 text-[#C8A45C]" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40 inline-block font-mono">
                                #{idx + 1} · {code}
                              </span>
                              <h4 className="text-xs font-bold text-white truncate mt-0.5" title={item.name}>
                                {item.name}
                              </h4>
                              <span className="text-[10px] text-neutral-400 block">
                                Talla: <strong className="text-white">{item.size || 'M'}</strong> · Color: {item.color || 'Variado'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromPack(item.id)}
                            className="p-1 rounded-lg bg-neutral-900 hover:bg-red-950 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-800/80 transition cursor-pointer"
                            title="Quitar prenda del pack"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-neutral-800/80 font-mono">
                          <span className="text-neutral-400">
                            Alquiler: <strong className="text-emerald-400">{formatSoles(item.rental_price_cents)}</strong>
                          </span>
                          <span className="text-neutral-400">
                            Garantía: <strong className="text-amber-400">{formatSoles(depositVal)}</strong>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-center">
                {/* Costo Total del Alquiler */}
                <div className="p-3 rounded-xl bg-black/40 border border-neutral-800 space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Costo Total Alquiler (Sumado)
                  </span>
                  <span className="text-lg font-serif-luxury font-bold text-white block">
                    {formatSoles(autoCalculatedTotalRentalCents)}
                  </span>
                </div>

                {/* Garantía Total (Sumada) */}
                <div className="p-3 rounded-xl bg-black/40 border border-amber-800/40 space-y-1">
                  <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider block">
                    Garantía Total (Sumada)
                  </span>
                  <span className="text-lg font-serif-luxury font-bold text-amber-300 block">
                    {formatSoles(autoCalculatedTotalGuaranteeCents)}
                  </span>
                </div>

                {/* Tarifa Final Acordada de Alquiler */}
                <div className="p-3 rounded-xl bg-[#C8A45C]/10 border border-[#C8A45C]/60 space-y-1">
                  <label className="text-[10px] font-bold text-[#E6C875] uppercase tracking-wider block">
                    Precio Final Alquiler Pack (S/)
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

                {/* Garantía a Recibir */}
                <div className="p-3 rounded-xl bg-black/40 border border-neutral-800 space-y-1">
                  <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block">
                    Garantía a Recibir (S/)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={customGuaranteeSoles}
                    onChange={(e) => setCustomGuaranteeSoles(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-700 rounded-lg px-2 py-1 text-center font-bold text-amber-300 font-mono text-base focus:outline-none"
                  />
                  <span className="text-[9px] text-neutral-400 block">Reembolsable contra retorno</span>
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

            {/* Detalle Financiero según modalidad */}
            {!isImmediateDelivery ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-black/40 border border-neutral-800">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Monto de Adelanto Recibido Hoy (S/)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={advanceSoles}
                    onChange={(e) => setAdvanceSoles(e.target.value)}
                    className="w-full bg-[#111] border border-[#C8A45C]/60 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-neutral-500 block mt-0.5">Para apartar el pack</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Saldo Pendiente al Retirar
                  </span>
                  <div className="w-full bg-[#111] border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-blue-300 font-mono">
                    S/ {pendingBalanceSoles.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">Total Alquiler - Adelanto</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Garantía Total en Custodia (Al Entregar)
                  </span>
                  <div className="w-full bg-[#111] border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 font-mono">
                    S/ {(parseFloat(customGuaranteeSoles) || 0).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">Reembolsable en la devolución</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/40 border border-neutral-800">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Total Alquiler Cobrado 100% Hoy (S/)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={paidTotalSoles}
                    onChange={(e) => setPaidTotalSoles(e.target.value)}
                    className="w-full bg-[#111] border border-[#C8A45C]/60 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-neutral-500 block mt-0.5">Alquiler completo pagado</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-neutral-300 block mb-1">
                    Garantía Total Recibida Hoy en Custodia
                  </span>
                  <div className="w-full bg-[#111] border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 font-mono">
                    S/ {(parseFloat(customGuaranteeSoles) || 0).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">En custodia hasta retorno de prendas</span>
                </div>
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

            {/* BOTÓN PRINCIPAL DE CONFIRMACIÓN: DESHABILITADO SI < 2 PRENDAS O HAY CONFLICTO */}
            <button
              type="submit"
              disabled={
                selectedItems.length < 2 ||
                conflictingItems.length > 0 ||
                isSubmitting ||
                !eventDate ||
                !returnDate
              }
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                selectedItems.length < 2 || conflictingItems.length > 0 || !eventDate || !returnDate
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
                  : `Confirmar Reserva del Pack (${selectedItems.length} prendas)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
