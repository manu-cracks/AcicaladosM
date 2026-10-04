import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase/client';
import { downloadTicketPdf } from '../../lib/ticketPdfGenerator';
import { formatSoles } from '../../types';
import { OFFICIAL_YAPE_PHONE_CLEAN } from '../../data/initialData';
import {
  Search,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  X,
  Tag,
  Scissors,
  Shirt,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  sanitizeDni,
  handleNumericKeyDown,
  DNI_PLACEHOLDER,
} from '../../lib/validators';

export interface TrackingReservationItem {
  reservation_id: string;
  code: string;
  reservation_type: 'vestuario' | 'servicio' | string;
  client_name: string;
  client_dni: string;
  client_phone?: string;
  reservation_date: string;
  return_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  item_or_services: string;
  total_price_cents: number;
  advance_cents: number;
  pending_cents: number;
  guarantee_cents?: number;
  status: string;
  status_label: string;
  status_color: string;
  voucher_url?: string | null;
  created_at: string;
}

interface PublicTrackingPortalProps {
  initialCode?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export const PublicTrackingPortal: React.FC<PublicTrackingPortalProps> = ({
  initialCode,
  isModal = false,
  onClose,
}) => {
  const { paymentSettings, setActiveView } = useApp();

  // Búsqueda estrictamente por DNI (FASE 1)
  const [dni, setDni] = useState('');

  // Estados de consulta
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [reservations, setReservations] = useState<TrackingReservationItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtro de categoría en resultados (Todas / Vestuario / Servicios)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'vestuario' | 'servicio'>('all');

  // Modal para ver el "Ticket Web Temporal"
  const [selectedTicketModal, setSelectedTicketModal] = useState<TrackingReservationItem | null>(null);

  // Cargar DNI previamente guardado desde localStorage
  useEffect(() => {
    try {
      const savedDni = localStorage.getItem('acicalados_last_booking_dni');
      if (savedDni) {
        const clean = sanitizeDni(savedDni);
        if (clean.length === 8 && !dni) {
          setDni(clean);
          handleSearch(clean);
        }
      }
    } catch {
      // Ignorar errores de acceso a storage
    }
  }, []);

  const cleanDni = useMemo(() => sanitizeDni(dni), [dni]);
  const isDniValid = cleanDni.length === 8;

  const handleSearch = async (overrideDni?: string) => {
    const targetDni = sanitizeDni(overrideDni || dni);
    setErrorMsg(null);

    if (targetDni.length !== 8) {
      setErrorMsg('Por favor ingresa un número de DNI válido de exactamente 8 dígitos.');
      return;
    }

    setIsLoading(true);
    setSearched(true);

    try {
      // 1. Invocar función RPC unificada get_reservations_by_dni en Supabase
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
        'get_reservations_by_dni',
        { p_dni: targetDni }
      );

      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const parsed = (rpcData as any[]).map((r) => ({
          reservation_id: r.reservation_id,
          code: r.code,
          reservation_type: r.reservation_type,
          client_name: r.client_name,
          client_dni: r.client_dni,
          client_phone: r.client_phone || '',
          reservation_date: r.reservation_date,
          return_date: r.return_date,
          start_time: r.start_time,
          end_time: r.end_time,
          item_or_services: r.item_or_services,
          total_price_cents: r.total_price_cents,
          advance_cents: r.advance_cents,
          pending_cents: r.pending_cents,
          guarantee_cents: 5000,
          status: r.status,
          status_label: r.status_label,
          status_color: r.status_color,
          voucher_url: r.voucher_url,
          created_at: r.created_at,
        })) as TrackingReservationItem[];

        setReservations(parsed);
        try {
          localStorage.setItem('acicalados_last_booking_dni', targetDni);
        } catch {}
      } else {
        // 2. Fallback de SELECT directo a ambas tablas (dress_rentals y bookings)
        const [rentalsRes, bookingsRes] = await Promise.all([
          supabase
            .from('dress_rentals')
            .select('*')
            .eq('client_dni', targetDni)
            .order('created_at', { ascending: false }),
          supabase
            .from('bookings')
            .select('*, booking_services(*)')
            .eq('client_dni', targetDni)
            .order('created_at', { ascending: false }),
        ]);

        const combinedItems: TrackingReservationItem[] = [];

        // Mapear órdenes de vestuario
        if (rentalsRes.data && Array.isArray(rentalsRes.data)) {
          rentalsRes.data.forEach((dr: any) => {
            let statusLabel = '🟡 En Proceso';
            let statusColor = 'yellow';
            if (dr.status === 'por_validar' || dr.status === 'solicitado') {
              statusLabel = '🟠 Por Validar';
              statusColor = 'orange';
            } else if (dr.status === 'reservado') {
              statusLabel = '🔵 Reservado';
              statusColor = 'blue';
            } else if (dr.status === 'entregado') {
              statusLabel = '🟢 Entregado';
              statusColor = 'green';
            } else if (dr.status === 'devuelto' || dr.status === 'finalizado') {
              statusLabel = '✅ Finalizado';
              statusColor = 'gray';
            } else if (dr.status === 'anulado') {
              statusLabel = '🔴 Anulado';
              statusColor = 'red';
            }

            combinedItems.push({
              reservation_id: dr.id,
              code: dr.ticket_code,
              reservation_type: 'vestuario',
              client_name: `${dr.client_first_name} ${dr.client_last_name}`,
              client_dni: dr.client_dni,
              client_phone: dr.client_phone,
              reservation_date: dr.event_date,
              return_date: dr.return_date,
              start_time: null,
              end_time: null,
              item_or_services: `${dr.item_code} - ${dr.item_name}`,
              total_price_cents: dr.rental_price_cents,
              advance_cents: dr.advance_cents,
              pending_cents: dr.pending_cents,
              guarantee_cents: dr.guarantee_cents || 5000,
              status: dr.status,
              status_label: statusLabel,
              status_color: statusColor,
              voucher_url: dr.voucher_url,
              created_at: dr.created_at,
            });
          });
        }

        // Mapear reservas de servicios
        if (bookingsRes.data && Array.isArray(bookingsRes.data)) {
          bookingsRes.data.forEach((b: any) => {
            let statusLabel = '🟡 En Proceso';
            let statusColor = 'yellow';
            if (b.payment_status === 'sin_pago') {
              statusLabel = '🟠 Por Validar';
              statusColor = 'orange';
            } else if (['parcial', 'total', 'adelanto_pagado', 'pagado'].includes(b.payment_status)) {
              statusLabel = '🔵 Reservado';
              statusColor = 'blue';
            } else if (b.payment_status === 'cancelado') {
              statusLabel = '🔴 Anulado';
              statusColor = 'red';
            }

            const servicesStr =
              (b.booking_services || []).map((s: any) => s.service_name).join(', ') ||
              b.service_type ||
              'Servicio Acicalados';

            combinedItems.push({
              reservation_id: b.id,
              code: b.booking_code,
              reservation_type: 'servicio',
              client_name: `${b.client_first_name} ${b.client_last_name}`,
              client_dni: b.client_dni,
              client_phone: b.client_phone,
              reservation_date: b.booking_date,
              return_date: null,
              start_time: b.start_time,
              end_time: b.end_time,
              item_or_services: servicesStr,
              total_price_cents: b.total_price_cents,
              advance_cents: b.advance_amount_cents || 0,
              pending_cents: b.balance_cents || 0,
              status: b.payment_status,
              status_label: statusLabel,
              status_color: statusColor,
              voucher_url: null,
              created_at: b.created_at,
            });
          });
        }

        combinedItems.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setReservations(combinedItems);
        try {
          localStorage.setItem('acicalados_last_booking_dni', targetDni);
        } catch {}
      }
    } catch (err: any) {
      console.error('Error consultando estado de reservas:', err);
      setErrorMsg('Ocurrió un problema de conexión al verificar tu reserva.');
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReservations = useMemo(() => {
    if (categoryFilter === 'all') return reservations;
    return reservations.filter((r) => r.reservation_type === categoryFilter);
  }, [reservations, categoryFilter]);

  const vestuarioCount = useMemo(() => {
    return reservations.filter((r) => r.reservation_type === 'vestuario').length;
  }, [reservations]);

  const serviciosCount = useMemo(() => {
    return reservations.filter((r) => r.reservation_type === 'servicio').length;
  }, [reservations]);

  const handleDownloadPdf = (item: TrackingReservationItem) => {
    downloadTicketPdf({
      code: item.code,
      type: item.reservation_type,
      clientName: item.client_name,
      clientDni: item.client_dni,
      clientPhone: item.client_phone,
      eventOrBookingDate: item.reservation_date,
      returnDate: item.return_date,
      timeSlot: item.start_time ? `${item.start_time} - ${item.end_time || ''}` : null,
      itemOrServices: item.item_or_services,
      totalPriceCents: item.total_price_cents,
      advanceCents: item.advance_cents,
      pendingCents: item.pending_cents,
      guaranteeCents: item.guarantee_cents || 5000,
      statusLabel: item.status_label,
      voucherUrl: item.voucher_url,
    });
  };

  const handleContactWhatsApp = (item: TrackingReservationItem) => {
    const text = encodeURIComponent(
      `¡Hola Acicalados! Quisiera consultar el estado de mi reserva *${item.code}* a nombre de *${item.client_name}* (DNI: ${item.client_dni}). Estado actual: ${item.status_label}.`
    );
    window.open(`https://wa.me/51${OFFICIAL_YAPE_PHONE_CLEAN}?text=${text}`, '_blank');
  };

  const content = (
    <div className="space-y-6">
      {/* Header descriptivo */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875] text-[11px] font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C8A45C]" />
          <span>Rastreo Seguro por Documento de Identidad</span>
        </div>
        <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
          Rastrear Reserva
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
          Consulta en tiempo real el estado de tus citas de Spa & Barbería y tus alquileres de vestidos y trajes.
        </p>
      </div>

      {/* Formulario de Validación Estricto por DNI (8 dígitos) */}
      <div className="bg-[#161616] border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 max-w-lg mx-auto">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
            <span>DNI del Titular:</span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {cleanDni.length}/8 dígitos
            </span>
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{8}"
              maxLength={8}
              placeholder={DNI_PLACEHOLDER}
              value={dni}
              onKeyDown={handleNumericKeyDown}
              onChange={(e) => {
                setDni(sanitizeDni(e.target.value));
                if (errorMsg) setErrorMsg(null);
              }}
              className="w-full bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] text-white text-sm sm:text-base rounded-xl pl-10 pr-3 py-2.5 outline-none transition font-mono tracking-widest text-center"
            />
          </div>
          <p className="text-[11px] text-neutral-500 text-center">
            Ingresa los 8 dígitos exactos de tu DNI para activar la consulta.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-center gap-2.5 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Botón Consultar Estado (Disabled hasta que DNI sea exactamente de 8 dígitos) */}
        <button
          type="button"
          disabled={isLoading || !isDniValid}
          onClick={() => handleSearch()}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6C875] to-[#C8A45C] hover:brightness-110 active:scale-[0.99] text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#C8A45C]/15 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Buscando Reservas en Supabase...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 text-black" />
              <span>Consultar Estado</span>
            </>
          )}
        </button>
      </div>

      {/* Vista de Resultados */}
      {searched && !isLoading && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 border-b border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Resultados para DNI:</span>
                <span className="font-mono text-[#E6C875] bg-black/40 px-2 py-0.5 rounded border border-neutral-800">
                  {cleanDni}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Se consultó simultáneamente en Servicios de Spa/Barbería y Alquileres de Vestuario.
              </p>
            </div>

            {/* Pestañas de Filtro Unificado */}
            {reservations.length > 0 && (
              <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-xl border border-neutral-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-[#C8A45C] text-black shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Todas ({reservations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('vestuario')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'vestuario'
                      ? 'bg-[#C8A45C] text-black shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Shirt className="w-3 h-3" />
                  <span>Vestuario ({vestuarioCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('servicio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'servicio'
                      ? 'bg-[#C8A45C] text-black shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Scissors className="w-3 h-3" />
                  <span>Spa & Barbería ({serviciosCount})</span>
                </button>
              </div>
            )}
          </div>

          {filteredReservations.length === 0 ? (
            <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No se encontraron reservas</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                No localizamos ninguna cita o alquiler asociado al DNI <strong className="text-neutral-200">{cleanDni}</strong>.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = encodeURIComponent(
                      `¡Hola Acicalados! Registré una reserva pero no puedo verla con mi DNI ${cleanDni}. ¿Podrían ayudarme a verificarla?`
                    );
                    window.open(`https://wa.me/51${OFFICIAL_YAPE_PHONE_CLEAN}?text=${text}`, '_blank');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Consultar con Recepción por WhatsApp</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((item) => {
                const isVestuario = item.reservation_type === 'vestuario';
                const isPorValidar =
                  item.status === 'por_validar' ||
                  item.status === 'solicitado' ||
                  item.status === 'sin_pago' ||
                  item.status_label.includes('Validar') ||
                  item.status_label.includes('REVISIÓN');

                const isReservado =
                  item.status === 'reservado' ||
                  item.status_label.includes('Reservado') ||
                  item.status_label.includes('APROBADA') ||
                  item.status_label.includes('CONFIRMADA');

                return (
                  <div
                    key={item.reservation_id}
                    className="bg-[#161616] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 transition"
                  >
                    {/* Header de la tarjeta */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            isVestuario
                              ? 'bg-[#C8A45C]/15 border-[#C8A45C]/35 text-[#E6C875]'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                          }`}
                        >
                          {isVestuario ? <Shirt className="w-5 h-5" /> : <Scissors className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-white font-mono">
                              {item.code.startsWith('#') ? item.code : `#${item.code}`}
                            </span>
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                                isVestuario
                                  ? 'bg-[#C8A45C]/15 border-[#C8A45C]/40 text-[#E6C875]'
                                  : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                              }`}
                            >
                              {isVestuario ? 'Alquiler de Prenda' : 'Cita de Servicios'}
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-400 block mt-0.5">
                            Registrado el {new Date(item.created_at).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                      </div>

                      {/* Estado Visual */}
                      <div className="sm:text-right">
                        {isPorValidar && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow">
                            <span className="w-2 h-2 rounded-full animate-ping bg-amber-400" />
                            <span>🟠 Por Validar</span>
                          </div>
                        )}
                        {isReservado && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-500/20 border border-blue-500/50 text-blue-300 shadow">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            <span>🔵 Reservado</span>
                          </div>
                        )}
                        {!isPorValidar && !isReservado && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-neutral-800 border border-neutral-700 text-neutral-300">
                            <span>{item.status_label}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* FASE 1 - Feedback Específico de Estado (Vestuario & Servicios) */}
                    {isVestuario ? (
                      <div className="space-y-2">
                        {isPorValidar && (
                          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/50 text-amber-200 text-xs space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-amber-300">
                              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Estamos revisando tu pago.</span>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-relaxed">
                              Tu comprobante de Yape fue registrado con éxito. Nuestro personal de caja está validando la transferencia en la cuenta bancaria. Tu vestido se encuentra en reserva temporal mientras culmina la verificación.
                            </p>
                          </div>
                        )}

                        {isReservado && (
                          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-600/50 text-blue-200 text-xs space-y-1.5">
                            <div className="font-bold flex items-center gap-1.5 text-blue-300">
                              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                              <span>¡Reserva Confirmada Oficialmente!</span>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-relaxed">
                              Tu comprobante fue aprobado con éxito. La prenda ha quedado bloqueada en el inventario exclusivamente para tu evento. Puedes ver o descargar tu <strong>Ticket Web Temporal</strong> a continuación.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {isPorValidar && (
                          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/50 text-amber-200 text-xs">
                            <p className="text-[11px] leading-relaxed">
                              ⏳ <strong>Estamos revisando tu pago:</strong> Tu cita está agendada y validaremos tu comprobante en breve.
                            </p>
                          </div>
                        )}
                        {isReservado && (
                          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-600/50 text-emerald-200 text-xs">
                            <p className="text-[11px] leading-relaxed">
                              🎉 <strong>¡Cita Confirmada!</strong> Tu comprobante fue aprobado. Te esperamos puntualmente en el local.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grilla de Datos de la Reserva */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#1B1B1B] p-4 rounded-xl border border-neutral-800 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Titular:</span>
                        <span className="font-bold text-white block truncate">{item.client_name}</span>
                        <span className="text-neutral-400 block text-[10px] font-mono">DNI: {item.client_dni}</span>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px]">
                          {isVestuario ? 'Fecha del Evento:' : 'Fecha y Hora:'}
                        </span>
                        <span className="font-bold text-white block">
                          {item.reservation_date}
                          {item.start_time ? ` · ${item.start_time}` : ''}
                        </span>
                        {item.return_date && (
                          <span className="text-neutral-400 block text-[10px]">
                            Devolución: {item.return_date}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px]">Detalle Financiero:</span>
                        <span className="font-bold text-[#E6C875] block text-sm">
                          {formatSoles(item.total_price_cents)}
                        </span>
                        <span className="text-emerald-400 block text-[10px]">
                          Abonado: {formatSoles(item.advance_cents)} · Saldo: {formatSoles(item.pending_cents)}
                        </span>
                      </div>
                    </div>

                    {/* Prenda o Servicios */}
                    <div className="text-xs space-y-1">
                      <span className="text-neutral-400 font-semibold block text-[11px]">
                        {isVestuario ? 'Prenda Reservada:' : 'Servicios Contratados:'}
                      </span>
                      <div className="p-2.5 rounded-lg bg-[#181818] border border-neutral-800 font-mono text-neutral-200">
                        {item.item_or_services}
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-neutral-800">
                      <button
                        type="button"
                        onClick={() => handleContactWhatsApp(item)}
                        className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        <span>Consultar por WhatsApp</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {/* FASE 1: Botón para Ver Ticket Web Temporal (Habilitado para Vestuario Reservado) */}
                        {isVestuario && isReservado && (
                          <button
                            type="button"
                            onClick={() => setSelectedTicketModal(item)}
                            className="py-2.5 px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                          >
                            <FileText className="w-4 h-4 text-blue-400" />
                            <span>Ver Ticket Web Temporal</span>
                          </button>
                        )}

                        {/* Botón de Descarga Directa en PDF */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(item)}
                          className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:brightness-110 text-black text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-black" />
                          <span>Descargar PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: TICKET WEB TEMPORAL (FASE 1) */}
      {selectedTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-[#141414] border border-[#C8A45C]/50 rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative my-auto text-neutral-200">
            {/* Header del Ticket Modal */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8A45C] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Boutique Vestuario Acicalados
                </span>
                <h3 className="text-base font-bold text-white">
                  Ticket Web Temporal de Reserva
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicketModal(null)}
                className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Código y Estado */}
            <div className="bg-[#1C1C1C] border border-neutral-800 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest block font-mono">
                CÓDIGO DE ORDEN
              </span>
              <div className="text-xl font-bold font-mono text-[#E6C875]">
                {selectedTicketModal.code.startsWith('#')
                  ? selectedTicketModal.code
                  : `#${selectedTicketModal.code}`}
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 mt-1">
                <span>🔵 RESERVA CONFIRMADA EN SISTEMA</span>
              </div>
            </div>

            {/* Detalle Prenda & Fechas */}
            <div className="bg-[#181818] border border-neutral-800/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="text-neutral-400">Cliente:</span>
                <span className="text-white font-bold text-right">{selectedTicketModal.client_name}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-neutral-400">DNI:</span>
                <span className="text-white font-mono">{selectedTicketModal.client_dni}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-neutral-400">Prenda:</span>
                <span className="text-[#E6C875] font-semibold text-right">{selectedTicketModal.item_or_services}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-neutral-400">Fecha Evento:</span>
                <span className="text-neutral-200">{selectedTicketModal.reservation_date}</span>
              </div>
              {selectedTicketModal.return_date && (
                <div className="flex justify-between items-start">
                  <span className="text-neutral-400">Fecha Devolución:</span>
                  <span className="text-neutral-200">{selectedTicketModal.return_date}</span>
                </div>
              )}
            </div>

            {/* Desglose Financiero */}
            <div className="bg-black/50 border border-neutral-800 rounded-xl p-3.5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-neutral-300">
                <span>Costo Total Alquiler:</span>
                <span>{formatSoles(selectedTicketModal.total_price_cents)}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Adelanto Pagado (Yape):</span>
                <span>{formatSoles(selectedTicketModal.advance_cents)}</span>
              </div>
              <div className="flex justify-between text-blue-300 font-bold border-t border-neutral-800 pt-1">
                <span>Saldo Pendiente a Pagar en Local:</span>
                <span>{formatSoles(selectedTicketModal.pending_cents)}</span>
              </div>
              <div className="flex justify-between text-amber-300 font-bold">
                <span>Garantía en Custodia (Local):</span>
                <span>{formatSoles(selectedTicketModal.guarantee_cents || 5000)}</span>
              </div>
            </div>

            {/* AVISO IMPORTANTE: Saldo y Garantía en Local */}
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/60 text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Aviso Obligatorio para el Retiro:</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Al momento de recoger tu prenda en el local físico, deberás cancelar el saldo pendiente de{' '}
                <strong className="text-white">{formatSoles(selectedTicketModal.pending_cents)}</strong> y dejar la garantía reembolsable de{' '}
                <strong className="text-white">{formatSoles(selectedTicketModal.guarantee_cents || 5000)}</strong> en custodia (en efectivo o Yape). Dicha garantía te será devuelta íntegramente al retornar la prenda en óptimas condiciones.
              </p>
            </div>

            {/* Acciones del Modal */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setSelectedTicketModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-[#1C1C1C] border border-neutral-800 transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownloadPdf(selectedTicketModal);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:brightness-110 text-black text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar como Modal o como Vista de Página
  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
        <div className="bg-[#121212] border border-[#C8A45C]/40 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#141414]">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#C8A45C]" />
              <span className="text-sm font-bold text-white">Consulta Pública de Reservas</span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="p-5 sm:p-6 overflow-y-auto flex-1">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {content}
    </div>
  );
};
