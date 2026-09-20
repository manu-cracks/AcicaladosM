import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { WardrobeItem, DressRental, formatSoles } from '../../../types';
import { DressAvailabilityCalendar } from './DressAvailabilityCalendar';
import { sanitizeDni, sanitizePhone } from '../../../lib/validators';

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
  const { wardrobe, dressRentals, addDressRental, currentRole } = useApp();
  const isAdmin = currentRole === 'admin';
  const isRecepcionista = currentRole === 'recepcionista';

  // Paso 1: Datos del Cliente
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientDni, setClientDni] = useState('');
  const [eventName, setEventName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destination, setDestination] = useState('');

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

  // Estados de retroalimentación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filtrado de vestidos ÚNICAMENTE por código
  const codeFilteredWardrobe = useMemo(() => {
    if (!searchCodeQuery.trim()) {
      return wardrobe.slice(0, 5); // Sugerencias iniciales si no escribe
    }
    const q = searchCodeQuery.toUpperCase().trim();
    return wardrobe.filter((w) => (w.code || '').toUpperCase().includes(q));
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

  // Cálculo del saldo pendiente
  const totalPriceSolesNum = parseFloat(customPriceSoles) || 0;
  const advanceSolesNum = parseFloat(advanceSoles) || 0;
  const pendingBalanceSoles = Math.max(0, totalPriceSolesNum - advanceSolesNum);

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

    // 4. Validación del Campo 4: Pagos
    let finalAdvanceCents = 0;
    let finalPendingCents = 0;
    let finalGuaranteeCents = 0;
    const finalPriceCents = Math.round(totalPriceSolesNum * 100);

    if (isImmediateDelivery) {
      // Escenario 4.2: Entrega Inmediata
      const paidNum = parseFloat(paidTotalSoles);
      const guarNum = parseFloat(guaranteeSoles);
      if (isNaN(guarNum) || guarNum < 0) {
        setValidationError('Por favor ingresa un monto válido de garantía recibida.');
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
      finalGuaranteeCents = selectedWardrobeItem.deposit_cents || 5000;
    }

    setIsSubmitting(true);
    try {
      const created = await addDressRental({
        origin: 'local',
        wardrobe_item_id: selectedWardrobeItem.id,
        item_code: (selectedWardrobeItem.code || 'A-101').toUpperCase().trim(),
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
        is_immediate_delivery: isImmediateDelivery,
        delivery_date: isImmediateDelivery ? new Date().toISOString() : null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#121212] border border-[#C8A45C]/50 rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-6 shadow-2xl relative my-6 animate-in fade-in zoom-in-95 duration-200 text-neutral-200">
        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875] flex items-center gap-1.5 w-fit">
              <Sparkles className="w-3 h-3" />
              Nueva Orden de Alquiler
            </span>
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
                <label className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                  <span>DNI (8 dígitos) <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-neutral-500">{clientDni.length}/8</span>
                </label>
                <input
                  type="text"
                  maxLength={8}
                  required
                  value={clientDni}
                  onChange={(e) => setClientDni(sanitizeDni(e.target.value))}
                  placeholder="70123456"
                  className="w-full px-3 py-2 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none font-mono transition"
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
                  placeholder="987654321"
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
                          className="w-4 h-4 rounded border-neutral-700 text-[#C8A45C] focus:ring-0 cursor-pointer accent-[#C8A45C]"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#E6C875] bg-black/60 px-2 py-0.5 rounded border border-[#C8A45C]/30">
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
              itemCode={selectedWardrobeItem?.code || 'C-310'}
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
                  onChange={(e) => setIsImmediateDelivery(e.target.checked)}
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

            {/* Escenario 4.1: Reserva Normal */}
            {!isImmediateDelivery ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-300">
                      * ADELANTO (Manual, sin decimales):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E6C875]">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-300">
                      * TOTAL DEL ALQUILER PAGADO:
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
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
                    <div className="relative">
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
                        placeholder="50"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] rounded-xl text-xs font-bold text-[#E6C875] outline-none transition"
                      />
                    </div>
                  </div>
                </div>

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
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 ${
                isImmediateDelivery
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-950/40'
                  : 'bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black shadow-[#C8A45C]/20'
              }`}
            >
              {isSubmitting ? (
                <span>Guardando Orden...</span>
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
