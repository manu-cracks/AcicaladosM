import React, { useState } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Upload,
  Sparkles,
  MapPin,
  Tag,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WardrobeItem, formatSoles, DressRental } from '../../types';
import { DressAvailabilityCalendar } from '../dashboard/vestuario/DressAvailabilityCalendar';
import { supabase } from '../../lib/supabase/client';

interface PublicDressBookingModalProps {
  item: WardrobeItem;
  onClose: () => void;
}

export const PublicDressBookingModal: React.FC<PublicDressBookingModalProps> = ({ item, onClose }) => {
  const { paymentSettings, addDressRental, dressRentals } = useApp();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Paso 1: Fechas
  const [eventDate, setEventDate] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>('');

  // Paso 2: Datos del Cliente
  const [clientName, setClientName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientDni, setClientDni] = useState('');
  const [eventName, setEventName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destinationPlace, setDestinationPlace] = useState('');

  // Paso 3: Pago Yape
  const [advanceAmountCents, setAdvanceAmountCents] = useState<number>(5000); // S/ 50.00 por defecto
  const [voucherUrl, setVoucherUrl] = useState<string>('');
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [isUploadingVoucher, setIsUploadingVoucher] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Paso 4: Ticket generado
  const [createdRental, setCreatedRental] = useState<DressRental | null>(null);

  const priceFormatted = (item.rental_price_cents / 100).toFixed(2);
  const codeDisplay = (item.code || 'A').toUpperCase().trim();

  // Al seleccionar fecha de evento, calcular automáticamente retorno (evento + 2 días)
  const handleDatesSelect = (eDate: string, rDate: string) => {
    setEventDate(eDate);
    setReturnDate(rDate);
  };

  const validateStep2 = () => {
    setErrorMsg(null);
    if (!clientName.trim()) {
      setErrorMsg('El nombre del cliente es obligatorio.');
      return false;
    }
    if (!clientLastName.trim()) {
      setErrorMsg('Los apellidos del cliente son obligatorios.');
      return false;
    }
    if (!/^\d{8}$/.test(clientDni.trim())) {
      setErrorMsg('El DNI debe contener exactamente 8 dígitos numéricos.');
      return false;
    }
    if (!eventName.trim()) {
      setErrorMsg('El nombre o motivo del evento es obligatorio.');
      return false;
    }
    if (!/^\d{9}$/.test(clientPhone.trim())) {
      setErrorMsg('El teléfono celular debe contener exactamente 9 dígitos numéricos.');
      return false;
    }
    if (!destinationPlace.trim()) {
      setErrorMsg('El lugar de destino del evento es obligatorio.');
      return false;
    }
    return true;
  };

  const handleVoucherFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un comprobante en formato de imagen (JPG, PNG, WebP).');
      return;
    }

    setVoucherFile(file);
    setIsUploadingVoucher(true);
    setErrorMsg(null);

    try {
      const fileName = `voucher-${codeDisplay}-${Date.now()}.webp`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('wardrobe-images')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadErr) {
        const localBlob = URL.createObjectURL(file);
        setVoucherUrl(localBlob);
      } else {
        const { data: pubData } = supabase.storage
          .from('wardrobe-images')
          .getPublicUrl(uploadData.path || fileName);
        setVoucherUrl(pubData?.publicUrl || URL.createObjectURL(file));
      }
    } catch (err) {
      setVoucherUrl(URL.createObjectURL(file));
    } finally {
      setIsUploadingVoucher(false);
    }
  };

  const handleConfirmReservation = async () => {
    if (!voucherUrl && !voucherFile) {
      setErrorMsg('Debes adjuntar la captura del comprobante (voucher) de Yape.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const pendingBalance = Math.max(0, item.rental_price_cents - advanceAmountCents);

    try {
      const result = await addDressRental({
        origin: 'web',
        wardrobe_item_id: item.id,
        item_code: codeDisplay,
        item_name: item.name,
        client_first_name: clientName.trim(),
        client_last_name: clientLastName.trim(),
        client_dni: clientDni.trim(),
        client_phone: clientPhone.trim(),
        event_name: eventName.trim(),
        destination: destinationPlace.trim(),
        event_date: eventDate,
        return_date: returnDate,
        rental_price_cents: item.rental_price_cents,
        advance_cents: advanceAmountCents,
        pending_cents: pendingBalance,
        guarantee_cents: item.deposit_cents || 5000,
        is_immediate_delivery: false,
        status: 'por_validar',
        voucher_url: voucherUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        notes: `Solicitud de reserva online vía Yape por S/ ${(advanceAmountCents / 100).toFixed(2)}`,
      });

      if (result) {
        setCreatedRental(result);
        setStep(4);
      } else {
        setErrorMsg('No se pudo registrar la reserva. Por favor intenta nuevamente.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in overscroll-contain">
      <div className="bg-[#121212] border border-[#C8A45C]/40 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-4 sm:my-auto">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#121212]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8A45C] to-[#8C6F2D] text-black flex items-center justify-center font-bold shadow">
              {step === 4 ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif-luxury font-bold text-white">
                {step === 4 ? '¡Solicitud de Reserva Registrada!' : 'Reservar Prenda Online (Vía Yape)'}
              </h2>
              <p className="text-xs text-neutral-400">
                [{codeDisplay}] {item.name} • Tarifa: S/ {priceFormatted}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        {step < 4 && (
          <div className="px-5 py-3 bg-[#161616] border-b border-neutral-800/80 flex items-center justify-between text-xs">
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                step === 1 ? 'text-[#E6C875]' : step > 1 ? 'text-emerald-400' : 'text-neutral-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-current">
                1
              </span>
              <span>Fecha</span>
            </div>
            <span className="w-8 h-px bg-neutral-700" />
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                step === 2 ? 'text-[#E6C875]' : step > 2 ? 'text-emerald-400' : 'text-neutral-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-current">
                2
              </span>
              <span>Tus Datos</span>
            </div>
            <span className="w-8 h-px bg-neutral-700" />
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                step === 3 ? 'text-[#E6C875]' : 'text-neutral-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-current">
                3
              </span>
              <span>Pago Yape</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* PASO 1: SELECCIÓN DE FECHA */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-[#181818] p-4 rounded-2xl border border-neutral-800 flex items-center gap-3">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover border border-neutral-700"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#C8A45C]/20 border border-[#C8A45C]/40 text-[#E6C875] text-[10px] font-bold">
                      CÓDIGO {codeDisplay}
                    </span>
                    <span className="text-xs text-neutral-400">{item.category}</span>
                  </div>
                  <h4 className="font-bold text-sm text-white">{item.name}</h4>
                  <div className="text-xs text-[#E6C875] font-bold">
                    Alquiler: S/ {priceFormatted} • Garantía: {formatSoles(item.deposit_cents || 5000)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-[#C8A45C]" />
                  <span>Selecciona la Fecha de tu Evento en el Calendario:</span>
                </label>

                <DressAvailabilityCalendar
                  itemCode={codeDisplay}
                  itemName={item.name}
                  dressRentals={dressRentals}
                  selectedDate={eventDate}
                  returnDate={returnDate}
                  onSelectDates={handleDatesSelect}
                />
              </div>

              {eventDate && (
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-neutral-400 block">Fecha del Evento:</span>
                    <strong className="text-white text-sm font-mono">{eventDate}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-400 block">Fecha Límite Devolución (+2 días):</span>
                    <strong className="text-emerald-400 text-sm font-mono">{returnDate}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 2: DATOS DEL CLIENTE */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-400">
                Por favor ingresa tus datos para emitir tu orden de reserva y ticket de atención.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Nombres <span className="text-[#C8A45C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. María Lucía"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Apellidos <span className="text-[#C8A45C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Gómez Torres"
                    value={clientLastName}
                    onChange={(e) => setClientLastName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>DNI (8 dígitos) <span className="text-[#C8A45C]">*</span></span>
                    <span className="text-[10px] text-neutral-500">{clientDni.length}/8</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="70123456"
                    value={clientDni}
                    onChange={(e) => setClientDni(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>Celular WhatsApp (9 dígitos) <span className="text-[#C8A45C]">*</span></span>
                    <span className="text-[10px] text-neutral-500">{clientPhone.length}/9</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={9}
                    placeholder="987654321"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Nombre o Motivo del Evento <span className="text-[#C8A45C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Matrimonio Civil / Fiesta de Gala"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Lugar de Destino <span className="text-[#C8A45C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Miraflores / Club Campestre"
                    value={destinationPlace}
                    onChange={(e) => setDestinationPlace(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: CHECKOUT Y PAGO CON YAPE */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-[#181818] p-4 rounded-2xl border border-neutral-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-neutral-400 block">Prenda a Reservar:</span>
                  <span className="font-bold text-white">
                    [{codeDisplay}] {item.name}
                  </span>
                  <span className="text-[11px] text-neutral-400 block">Evento: {eventDate}</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-400 block">Adelanto Requerido:</span>
                  <span className="text-base font-bold text-[#E6C875]">
                    {formatSoles(advanceAmountCents)}
                  </span>
                </div>
              </div>

              {/* Sección QR Yape */}
              <div className="bg-[#161616] border border-[#6B2D82]/50 p-4 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6B2D82]/20 border border-[#8B3D9D]/40 flex items-center justify-center text-[#C96DE8]">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Paso 1: Escanea el Código QR o Yapea al Número</h4>
                    <p className="text-[11px] text-neutral-400">
                      Titular: <strong className="text-white">{paymentSettings.yape_holder}</strong> • Celular:{' '}
                      <strong className="text-[#C96DE8]">{paymentSettings.yape_phone}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                  <div className="w-36 h-36 bg-white p-2 rounded-2xl shadow-lg border border-neutral-300 flex items-center justify-center">
                    <img
                      src={paymentSettings.yape_qr_url}
                      alt="QR Yape"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-xs text-neutral-300 space-y-2 max-w-xs text-center sm:text-left">
                    <div className="p-2.5 rounded-xl bg-[#1D1224] border border-[#8B3D9D]/30">
                      <span className="text-[10px] text-neutral-400 block">Número para Yapear:</span>
                      <span className="text-sm font-bold font-mono text-[#E494FF]">
                        {paymentSettings.yape_phone}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Abona exactamente <strong>{formatSoles(advanceAmountCents)}</strong> para asegurar el pre-bloqueo del vestido en agenda.
                    </p>
                  </div>
                </div>
              </div>

              {/* Paso 2: Adjuntar Voucher */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                  <span>📸 Paso 2: Adjunta tu Comprobante de Pago (Obligatorio) <span className="text-[#C8A45C]">*</span></span>
                  {voucherUrl && <span className="text-[11px] text-emerald-400 font-bold">✓ Comprobante cargado</span>}
                </label>

                <div className="border-2 border-dashed border-neutral-700 hover:border-[#C8A45C] rounded-2xl p-4 text-center cursor-pointer transition-colors bg-[#181818]">
                  <input
                    type="file"
                    id="client-voucher-upload"
                    accept="image/*"
                    onChange={handleVoucherFileChange}
                    className="hidden"
                  />
                  <label htmlFor="client-voucher-upload" className="cursor-pointer block">
                    {voucherUrl ? (
                      <div className="flex items-center justify-center gap-3">
                        <img
                          src={voucherUrl}
                          alt="Voucher"
                          className="w-16 h-16 rounded-xl object-cover border border-emerald-500/50"
                        />
                        <div className="text-left text-xs">
                          <p className="font-bold text-white">Comprobante seleccionado</p>
                          <p className="text-[11px] text-neutral-400">Haz clic aquí para cambiar la captura</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-6 h-6 text-neutral-400 mx-auto" />
                        <p className="text-xs font-semibold text-white">
                          {isUploadingVoucher ? 'Cargando captura...' : 'Seleccionar imagen o captura del Yape'}
                        </p>
                        <p className="text-[10px] text-neutral-500">Formatos permitidos: JPG, PNG, WebP</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: CONFIRMACIÓN Y TICKET TEMPORAL */}
          {step === 4 && createdRental && (
            <div className="space-y-5">
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-amber-300">
                  ⏳ ¡Hemos recibido tu solicitud de reserva!
                </h3>
                <p className="text-xs text-neutral-300">
                  Estamos validando tu comprobante de Yape. Tu vestido está <strong>pre-separado</strong> para el{' '}
                  <span className="text-white font-mono">{createdRental.event_date}</span>.
                </p>
              </div>

              {/* Vista previa ticket digital */}
              <div className="bg-[#181818] border border-neutral-800 p-5 rounded-2xl font-mono text-xs space-y-3">
                <div className="text-center pb-2 border-b border-neutral-700">
                  <div className="font-serif-luxury font-bold text-base text-[#E6C875]">BOUTIQUE DE VESTIDOS</div>
                  <div className="text-[11px] text-neutral-400">Reserva Web Nro: {createdRental.ticket_code}</div>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">CLIENTE:</span>
                    <span className="font-bold text-white">
                      {createdRental.client_first_name} {createdRental.client_last_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">PRENDA:</span>
                    <span className="font-bold text-white">[{createdRental.item_code}] {createdRental.item_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">FECHA EVENTO:</span>
                    <span className="font-bold text-white">{createdRental.event_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">FECHA DEVOLUCIÓN:</span>
                    <span className="font-bold text-white">{createdRental.return_date}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-700 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">COSTO TOTAL DEL ALQUILER:</span>
                    <span className="font-bold text-white">{formatSoles(createdRental.rental_price_cents)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>ADELANTO ENVIADO (VÍA YAPE):</span>
                    <span className="font-bold">{formatSoles(createdRental.advance_cents)}</span>
                  </div>
                  <div className="flex justify-between text-amber-400 pt-1 border-t border-neutral-800">
                    <span>ESTADO DEL PAGO:</span>
                    <span className="font-bold">🟡 EN REVISIÓN</span>
                  </div>
                </div>

                <p className="text-[10px] text-neutral-400 italic pt-2 border-t border-neutral-800 text-center">
                  Te enviaremos un mensaje de confirmación final a tu WhatsApp en breve, una vez que verifiquemos la transferencia.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const msg = encodeURIComponent(
                      `¡Hola Acicalados! Acabo de registrar mi reserva web Nro *${createdRental.ticket_code}* para el vestido [${createdRental.item_code}] a nombre de ${createdRental.client_first_name}. Adjunto mi voucher para la validación.`
                    );
                    window.open(`https://wa.me/51${paymentSettings.yape_phone.replace(/\s+/g, '')}?text=${msg}`, '_blank');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Notificar a Recepción por WhatsApp</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-[#161616] flex items-center justify-between gap-3">
          {step === 4 ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#C8A45C] text-black hover:brightness-110 transition-all cursor-pointer"
            >
              Cerrar y Regresar al Catálogo
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (step > 1) setStep((prev) => (prev - 1) as any);
                  else onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                {step === 1 ? 'Cancelar' : 'Atrás'}
              </button>

              {step === 1 && (
                <button
                  type="button"
                  disabled={!eventDate}
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#C8A45C] to-[#A27F38] text-black hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Continuar con Mis Datos →
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep2()) {
                      setStep(3);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#C8A45C] to-[#A27F38] text-black hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Continuar al Pago con Yape →
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  disabled={isSubmitting || isUploadingVoucher || !voucherUrl}
                  onClick={handleConfirmReservation}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Registrando Reserva...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enviar Comprobante y Reservar</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
