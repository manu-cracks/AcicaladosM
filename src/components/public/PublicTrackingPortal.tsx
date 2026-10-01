import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase/client';
import { downloadTicketPdf } from '../../lib/ticketPdfGenerator';
import { formatSoles } from '../../types';
import {
  Search,
  FileText,
  Phone,
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
} from 'lucide-react';
import {
  sanitizePhone,
  sanitizeDni,
  isValidPhone,
  isValidDni,
  handleNumericKeyDown,
  PHONE_PLACEHOLDER,
  DNI_PLACEHOLDER,
} from '../../lib/validators';

export interface TrackingReservationItem {
  reservation_id: string;
  code: string;
  reservation_type: 'vestuario' | 'servicio' | string;
  client_name: string;
  client_dni: string;
  client_phone: string;
  reservation_date: string;
  return_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  item_or_services: string;
  total_price_cents: number;
  advance_cents: number;
  pending_cents: number;
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

  // Campos de validación 2FA sin contraseña
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');

  // Estados de consulta
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [reservations, setReservations] = useState<TrackingReservationItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Intentar pre-cargar datos desde localStorage si existen
  useEffect(() => {
    try {
      const savedDni = localStorage.getItem('acicalados_last_booking_dni');
      const savedPhone = localStorage.getItem('acicalados_last_booking_phone');
      if (savedDni && !dni) setDni(savedDni);
      if (savedPhone && !phone) setPhone(savedPhone);

      // Si tenemos ambos datos guardados y el usuario abrió desde el banner, ejecutar búsqueda automática
      if (savedDni && savedPhone && isValidDni(savedDni) && isValidPhone(savedPhone) && !searched) {
        handleSearch(savedDni, savedPhone);
      }
    } catch {
      // Ignorar errores de acceso a storage
    }
  }, []);

  const handleSearch = async (overrideDni?: string, overridePhone?: string) => {
    const targetDni = overrideDni || dni;
    const targetPhone = overridePhone || phone;

    setErrorMsg(null);

    const cleanDni = sanitizeDni(targetDni);
    const cleanPhone = sanitizePhone(targetPhone);

    if (!cleanDni || cleanDni.length < 6) {
      setErrorMsg('Por favor ingresa un número de DNI o documento válido (mínimo 6 dígitos).');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 6) {
      setErrorMsg('Por favor ingresa el número telefónico registrado en tu reserva.');
      return;
    }

    setIsLoading(true);
    setSearched(true);

    try {
      // Invocación a función RPC con seguridad Security Definer en Supabase
      const { data, error } = await supabase.rpc('get_guest_reservations_tracking', {
        p_dni: cleanDni,
        p_phone: cleanPhone,
      });

      if (error) {
        console.error('Error al consultar estado de reservas de invitado:', error);
        setErrorMsg('Error al conectar con el servidor. Por favor, intenta nuevamente.');
        setReservations([]);
        return;
      }

      if (data && Array.isArray(data)) {
        const items = data as unknown as TrackingReservationItem[];
        setReservations(items);
        // Persistir datos para conveniencia futura del cliente
        try {
          localStorage.setItem('acicalados_last_booking_dni', cleanDni);
          localStorage.setItem('acicalados_last_booking_phone', cleanPhone);
          if (items.length > 0 && items[0]?.code) {
            localStorage.setItem('acicalados_last_booking_code', items[0].code);
          }
        } catch {}
      } else {
        setReservations([]);
      }
    } catch (err: any) {
      console.error('Excepción consultando reservas:', err);
      setErrorMsg('Ocurrió un problema de conexión al verificar tu reserva.');
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  };

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
      statusLabel: item.status_label,
      voucherUrl: item.voucher_url,
    });
  };

  const handleContactWhatsApp = (item: TrackingReservationItem) => {
    const text = encodeURIComponent(
      `¡Hola Acicalados! Quisiera consultar el estado de mi reserva *${item.code}* a nombre de *${item.client_name}* (DNI: ${item.client_dni}). Estado actual: ${item.status_label}.`
    );
    window.open(`https://wa.me/51${paymentSettings.yape_phone.replace(/\s+/g, '')}?text=${text}`, '_blank');
  };

  const content = (
    <div className="space-y-6">
      {/* Header descriptivo */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875] text-[11px] font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C8A45C]" />
          <span>Acceso Seguro 2FA sin Contraseña</span>
        </div>
        <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
          Rastrear mi Reserva
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
          Ingresa el documento y teléfono celular con los que realizaste tu reserva para consultar su estado en tiempo real.
        </p>
      </div>

      {/* Formulario de Validación 2FA */}
      <div className="bg-[#161616] border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Campo DNI */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>DNI / Documento:</span>
              <span className="text-[10px] text-neutral-500 font-mono">8 dígitos</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
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
                className="w-full bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] text-white text-xs sm:text-sm rounded-xl pl-9 pr-3 py-2.5 outline-none transition font-mono tracking-wider"
              />
            </div>
          </div>

          {/* Campo Teléfono */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>Teléfono Registrado:</span>
              <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{9}"
                maxLength={9}
                placeholder={PHONE_PLACEHOLDER}
                value={phone}
                onKeyDown={handleNumericKeyDown}
                onChange={(e) => {
                  setPhone(sanitizePhone(e.target.value));
                  if (errorMsg) setErrorMsg(null);
                }}
                className="w-full bg-[#1F1F1F] border border-neutral-700/80 focus:border-[#C8A45C] text-white text-xs sm:text-sm rounded-xl pl-9 pr-3 py-2.5 outline-none transition font-mono tracking-wider"
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-center gap-2.5 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="button"
          disabled={isLoading || !dni.trim() || !phone.trim()}
          onClick={() => handleSearch()}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6C875] to-[#C8A45C] hover:brightness-110 active:scale-[0.99] text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#C8A45C]/15 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Consultando Base de Datos...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 text-black" />
              <span>Consultar Estado de mi Reserva</span>
            </>
          )}
        </button>
      </div>

      {/* Vista de Resultados */}
      {searched && !isLoading && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Resultados Encontrados</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] font-mono">
                {reservations.length}
              </span>
            </h3>

            {reservations.length > 0 && (
              <button
                type="button"
                onClick={() => handleSearch()}
                className="text-[11px] text-[#C8A45C] hover:text-[#E6C875] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Actualizar</span>
              </button>
            )}
          </div>

          {reservations.length === 0 ? (
            <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No se encontraron reservas</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                No localizamos ninguna cita o alquiler asociado al DNI <strong className="text-neutral-200">{dni}</strong> y teléfono <strong className="text-neutral-200">{phone}</strong>.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = encodeURIComponent(
                      `¡Hola Acicalados! Registré una reserva pero no puedo verla con mi DNI ${dni}. ¿Podrían ayudarme a verificarla?`
                    );
                    window.open(`https://wa.me/51${paymentSettings.yape_phone.replace(/\s+/g, '')}?text=${text}`, '_blank');
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
              {reservations.map((item) => {
                const isUnderReview = item.status_label.includes('REVISIÓN') || item.status_label.includes('PROCESO');
                const isApproved = item.status_label.includes('APROBADA') || item.status_label.includes('CONFIRMADA');

                return (
                  <div
                    key={item.reservation_id}
                    className="bg-[#161616] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 transition"
                  >
                    {/* Header de la tarjeta */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C] shrink-0">
                          {item.reservation_type === 'vestuario' ? (
                            <Sparkles className="w-5 h-5" />
                          ) : (
                            <Calendar className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-white font-mono">
                              {item.code.startsWith('#') ? item.code : `#${item.code}`}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 uppercase font-semibold">
                              {item.reservation_type === 'vestuario' ? 'Alquiler de Prenda' : 'Cita de Servicios'}
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-400 block mt-0.5">
                            Registrado el {new Date(item.created_at).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                      </div>

                      {/* Estado en Tiempo Real */}
                      <div className="sm:text-right">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                            isApproved
                              ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400'
                              : isUnderReview
                              ? 'bg-amber-950/50 border-amber-500/50 text-amber-300'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full animate-ping bg-current" />
                          <span>{item.status_label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Explicación amigable del estado */}
                    <div
                      className={`p-3 rounded-xl text-xs ${
                        isApproved
                          ? 'bg-emerald-950/30 border border-emerald-900/40 text-emerald-300'
                          : isUnderReview
                          ? 'bg-amber-950/30 border border-amber-900/40 text-amber-300'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
                      }`}
                    >
                      {isUnderReview && (
                        <p>
                          ⏳ <strong>Comprobante en Auditoría:</strong> Tu captura de Yape fue registrada con éxito. Nuestro personal de caja está validando la transferencia.
                        </p>
                      )}
                      {isApproved && (
                        <p>
                          🎉 <strong>¡Reserva Confirmada!</strong> Tu comprobante fue aprobado y tu agenda está asegurada en Acicalados. Te esperamos puntualmente.
                        </p>
                      )}
                      {!isUnderReview && !isApproved && (
                        <p>
                          ℹ️ Estado actual de la orden: <strong>{item.status_label}</strong>.
                        </p>
                      )}
                    </div>

                    {/* Grilla de Datos de la Reserva */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#1B1B1B] p-4 rounded-xl border border-neutral-800 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Titular:</span>
                        <span className="font-bold text-white block truncate">{item.client_name}</span>
                        <span className="text-neutral-400 block text-[10px] font-mono">DNI: {item.client_dni}</span>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px]">
                          {item.reservation_type === 'vestuario' ? 'Fecha Evento:' : 'Fecha y Hora:'}
                        </span>
                        <span className="font-bold text-white block">
                          {item.reservation_date}
                          {item.start_time ? ` · ${item.start_time}` : ''}
                        </span>
                        {item.return_date && (
                          <span className="text-neutral-400 block text-[10px]">Devolución: {item.return_date}</span>
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
                        {item.reservation_type === 'vestuario' ? 'Prenda Reservada:' : 'Servicios Contratados:'}
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

                      {/* Botón Obligatorio de Re-descarga de Ticket en PDF */}
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(item)}
                        className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:brightness-110 text-black text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-black" />
                        <span>📥 DESCARGAR TICKET EN PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
