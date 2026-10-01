import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Booking, VentaMostrador, formatSoles } from '../../types';
import { getServiceCategory } from '../../services/financialSSOT';
import { supabase } from '../../lib/supabase/client';
import { LOGO_ACICALADOS_THERMAL_BASE64 } from '../../assets/logoThermalBase64';
import { Printer, X, CheckCircle2, Loader2 } from 'lucide-react';

interface PreparedTicketService {
  code: string;
  service_name: string;
  price_cents: number;
  specialist: string;
  category: string;
}

interface PreparedBookingTicket {
  numeroTicket: string;
  fechaEmision: string;
  bookingCode: string;
  clientName: string;
  clientDni: string;
  horaCita: string;
  services: PreparedTicketService[];
  totalPriceCents: number;
  advanceAmountCents: number;
  balanceCents: number;
  paymentStatus: string;
}

// Formateador estricto para fecha de emisión de ticket: "23 oct. 2026 - 15:30 p. m."
function formatFechaEmisionTicket(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);

  const datePart = d.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const hour = d.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    hour12: false,
  });
  const minute = d.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    minute: '2-digit',
  }).padStart(2, '0');

  const isPm = parseInt(hour, 10) >= 12;
  const ampm = isPm ? 'p. m.' : 'a. m.';

  return `${datePart} - ${hour}:${minute} ${ampm}`;
}

// Filtro de Primer Nombre: nombre.split(' ')[0]
// Ej. "JORGE ROBERT HUAMANI AZURZA" -> "JORGE"
function extractFirstName(fullName?: string | null): string {
  if (!fullName) return 'ESPECIALISTA';
  const clean = fullName.trim();
  if (!clean) return 'ESPECIALISTA';
  return clean.split(/\s+/)[0].toUpperCase();
}

// Capitalización de nombres de servicios a Title Case
function formatServiceName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export const TicketTermicoModal: React.FC = () => {
  const { activeTicket, closeTicketModal, services } = useApp();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [preparedBooking, setPreparedBooking] = useState<PreparedBookingTicket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isBooking = activeTicket?.type === 'booking';
  const bookingData = isBooking ? (activeTicket.data as Booking) : null;
  const ventaData = !isBooking && activeTicket ? (activeTicket.data as VentaMostrador) : null;

  // Carga y aislamiento de datos por servicio en tiempo real justo antes de imprimir
  const prepareRealtimeBookingData = useCallback(async (b: Booking) => {
    setIsLoading(true);
    try {
      // 1. Obtener número de ticket y fecha inmutable desde Supabase (vía RPC)
      let numeroTicket = b.numero_ticket || '';
      let fechaEmision = b.fecha_emision_ticket || '';

      const { data: ticketRes, error: rpcErr } = await supabase.rpc('get_or_create_booking_ticket', {
        p_booking_id: b.id,
      });

      if (!rpcErr && ticketRes && typeof ticketRes === 'object') {
        const res = ticketRes as { success?: boolean; numero_ticket?: string; fecha_emision_ticket?: string };
        if (res.success) {
          numeroTicket = res.numero_ticket || numeroTicket;
          fechaEmision = res.fecha_emision_ticket || fechaEmision;
        }
      }

      // Si por alguna razón la RPC no devolvió fecha de emisión, usar confirmed_at o created_at original
      if (!fechaEmision) {
        fechaEmision = b.confirmed_at || b.created_at;
      }

      // 2. Aislamiento por Servicio en tiempo real:
      // Itera sobre cada servicio individual de la reserva mixta para obtener a su especialista asignado en tiempo real
      const { data: dbServices } = await supabase
        .from('booking_services')
        .select('id, service_name, service_price_cents, assigned_employee_id, service_id, hora_inicio, hora_fin')
        .eq('booking_id', b.id)
        .order('created_at', { ascending: true });

      const servicesList = dbServices && dbServices.length > 0 ? dbServices : b.services;
      const empIds = (servicesList || [])
        .map((s: any) => s.assigned_employee_id || (s as any).employee_id)
        .filter(Boolean);

      const empMap = new Map<string, { first_name: string; last_name: string; type: string }>();
      if (empIds.length > 0) {
        const { data: dbEmployees } = await supabase
          .from('employees')
          .select('id, first_name, last_name, type')
          .in('id', empIds);

        if (dbEmployees) {
          dbEmployees.forEach((e: any) => empMap.set(e.id, e));
        }
      }

      const preparedServices: PreparedTicketService[] = (servicesList || []).map((srv: any, idx: number) => {
        const empId = srv.assigned_employee_id || srv.employee_id;
        const emp = empId ? empMap.get(empId) : null;
        const rawEmpName = emp ? `${emp.first_name} ${emp.last_name}` : (srv.employee_name || 'Especialista');

        // Filtro de Primer Nombre:
        // Si la BD devuelve "JORGE ROBERT HUAMANI AZURZA", el ticket SOLO debe recibir y mostrar "JORGE"
        const firstNameOnly = extractFirstName(emp?.first_name || rawEmpName);

        // Categoría (Barbería vs Spa)
        const cat = emp?.type === 'barbero'
          ? 'Barbería'
          : emp?.type === 'spa'
          ? 'Spa'
          : getServiceCategory({ service_id: srv.service_id, service_name: srv.service_name }, services || []) === 'barberia'
          ? 'Barbería'
          : 'Spa';

        return {
          code: `SERV-${String(idx + 1).padStart(2, '0')}`,
          service_name: formatServiceName(srv.service_name),
          price_cents: srv.service_price_cents ?? srv.price_cents ?? 0,
          specialist: firstNameOnly,
          category: cat,
        };
      });

      // Código de reserva formateado con '#'
      const bookingCodeFormatted = b.code?.startsWith('#') ? b.code : `#${b.code || 'AC-0000'}`;

      setPreparedBooking({
        numeroTicket: numeroTicket || '001-0000001',
        fechaEmision: fechaEmision,
        bookingCode: bookingCodeFormatted,
        clientName: b.client_name,
        clientDni: b.client_dni || '',
        horaCita: `${b.start_time?.substring(0, 5) || '11:00'} - ${b.end_time?.substring(0, 5) || '12:30'}`,
        services: preparedServices,
        totalPriceCents: b.total_price_cents,
        advanceAmountCents: b.advance_amount_cents,
        balanceCents: b.balance_cents != null ? b.balance_cents : Math.max(0, b.total_price_cents - b.advance_amount_cents),
        paymentStatus: b.payment_status,
      });
    } catch (err) {
      console.error('Error preparando ticket térmico en tiempo real:', err);
    } finally {
      setIsLoading(false);
    }
  }, [services]);

  useEffect(() => {
    if (activeTicket && isBooking && bookingData) {
      prepareRealtimeBookingData(bookingData);
    } else {
      setPreparedBooking(null);
    }
  }, [activeTicket, isBooking, bookingData, prepareRealtimeBookingData]);

  if (!activeTicket) return null;

  const handlePrint = async () => {
    if (isBooking && bookingData && (!preparedBooking || isLoading)) {
      await prepareRealtimeBookingData(bookingData);
    }
    window.print();
  };

  const SEPARATOR_DASH = '----------------------------------------------------------------------';
  const SEPARATOR_EQUAL = '======================================================================';
  const SEPARATOR_DOT = '......................................................................';

  // Datos para renderizado
  const ticketNumero = preparedBooking?.numeroTicket || bookingData?.numero_ticket || '001-0000001';
  const bookingCode = preparedBooking?.bookingCode || (bookingData?.code?.startsWith('#') ? bookingData.code : `#${bookingData?.code || 'AC-0000'}`);
  const fechaEmisionTxt = formatFechaEmisionTicket(preparedBooking?.fechaEmision || bookingData?.fecha_emision_ticket || bookingData?.confirmed_at || bookingData?.created_at);
  const clienteNombre = preparedBooking?.clientName || (isBooking ? bookingData?.client_name : ventaData?.client_name) || 'Cliente';
  const clienteDni = preparedBooking?.clientDni || (isBooking ? bookingData?.client_dni : ventaData?.client_dni) || '';
  const horaCita = preparedBooking?.horaCita || (bookingData ? `${bookingData.start_time?.substring(0, 5)} - ${bookingData.end_time?.substring(0, 5)}` : '');

  const totalPresupuesto = preparedBooking?.totalPriceCents ?? bookingData?.total_price_cents ?? ventaData?.total_price_cents ?? 0;
  const adelantoCobrado = preparedBooking?.advanceAmountCents ?? bookingData?.advance_amount_cents ?? ventaData?.total_price_cents ?? 0;
  const saldoPendiente = preparedBooking?.balanceCents ?? (bookingData ? Math.max(0, (bookingData.total_price_cents || 0) - (bookingData.advance_amount_cents || 0)) : 0);
  const paymentStatus = preparedBooking?.paymentStatus || bookingData?.payment_status || 'total';

  const estadoPagoLabel = isBooking
    ? saldoPendiente <= 0 || paymentStatus === 'total'
      ? 'PAGADO COMPLETO'
      : adelantoCobrado > 0 || paymentStatus === 'parcial'
      ? 'SALDO PENDIENTE'
      : 'SIN PAGO'
    : 'PAGADO COMPLETO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C]">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                Ticket Térmico POS (80mm) Oficial
              </h3>
              <p className="text-xs text-neutral-400">
                {isBooking ? `Reserva ${bookingCode} · Correlativo: ${ticketNumero}` : `Venta Mostrador #${ventaData?.ticket_number}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper Size selector */}
            <div className="flex items-center bg-black/40 border border-neutral-800 rounded p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  paperWidth === '80mm' ? 'bg-[#C8A45C] text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  paperWidth === '58mm' ? 'bg-[#C8A45C] text-black font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                58mm
              </button>
            </div>

            <button
              id="close-ticket-modal-btn"
              type="button"
              onClick={closeTicketModal}
              className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Thermal Paper Preview */}
        <div className="p-6 bg-neutral-900/60 flex justify-center max-h-[70vh] overflow-y-auto">
          {isLoading && !preparedBooking ? (
            <div className="flex flex-col items-center justify-center p-12 text-[#C8A45C] gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-mono text-neutral-300">Consultando auditoría contable y especialistas...</p>
            </div>
          ) : (
            <div
              id="thermal-ticket-print"
              className={`bg-white text-black p-4 shadow-xl border border-neutral-300 font-mono text-[11px] leading-tight select-text ${
                paperWidth === '80mm' ? 'w-[340px]' : 'w-[260px]'
              }`}
              style={{
                fontFamily: "'Courier New', Courier, monospace",
              }}
            >
              {/* ============================================================ */}
              {/* ENCABEZADO CORPORATIVO OFICIAL */}
              {/* ============================================================ */}
              <div className="text-center pb-2">
                {/* Logo incrustado como Base64 monocromático para térmica */}
                <div className="flex justify-center mb-1">
                  <img
                    src={LOGO_ACICALADOS_THERMAL_BASE64}
                    alt="Logo Acicalados"
                    className="h-16 w-16 object-contain"
                    style={{ filter: 'grayscale(100%) contrast(200%)' }}
                  />
                </div>
                <div className="font-bold text-center text-xs tracking-wider uppercase text-black">
                  "SPA ACICALADOS BARBER SHOP"
                </div>
                <div className="text-center text-[10px] text-neutral-800 font-semibold mt-0.5">
                  RUC: 10436217574
                </div>
                <div className="text-center text-[10px] text-neutral-800">
                  Av. Arriba Perú Nro. 263 - Pichari
                </div>
                <div className="text-center text-[9px] text-neutral-700">
                  Telf: 997766828/947702355 | www.spaacicalados.com
                </div>
              </div>

              {/* Separador - */}
              <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                {SEPARATOR_DASH}
              </div>

              {/* ============================================================ */}
              {/* METADATOS INMUTABLES Y DETALLES DE CITA */}
              {/* ============================================================ */}
              <div className="py-1 space-y-0.5 text-[11px]">
                <div className="flex justify-between items-baseline">
                  <span className="font-normal">TICKET CORRELATIVO:</span>
                  <span className="font-bold tracking-wider">{ticketNumero}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-normal">CÓDIGO DE RESERVA:</span>
                  <span className="font-bold">{bookingCode}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-normal">FECHA EMISIÓN:</span>
                  <span className="text-right font-medium">{fechaEmisionTxt}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-normal">CLIENTE:</span>
                  <span className="font-semibold text-right max-w-[170px] truncate">{clienteNombre}</span>
                </div>
                {clienteDni && (
                  <div className="flex justify-between items-baseline">
                    <span className="font-normal">DNI / DOC:</span>
                    <span className="font-mono">{clienteDni}</span>
                  </div>
                )}
                {isBooking && horaCita && (
                  <div className="flex justify-between items-baseline">
                    <span className="font-normal">HORA CITA:</span>
                    <span className="font-bold">{horaCita}</span>
                  </div>
                )}
              </div>

              {/* Separador = */}
              <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-bold">
                {SEPARATOR_EQUAL}
              </div>

              {/* ============================================================ */}
              {/* CABECERA DE TABLA */}
              {/* ============================================================ */}
              <div className="flex justify-between font-bold text-[10px] text-neutral-900 py-0.5">
                <span>{isBooking ? 'DESCRIPCIÓN / SERVICIO' : 'DESCRIPCIÓN / PRODUCTO'}</span>
                <span>IMPORTE</span>
              </div>

              {/* Separador - */}
              <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                {SEPARATOR_DASH}
              </div>

              {/* ============================================================ */}
              {/* DETALLE AISLADO POR SERVICIO (SIN DURACIÓN) */}
              {/* ============================================================ */}
              <div className="py-1 space-y-2 text-[11px]">
                {isBooking ? (
                  (preparedBooking?.services || []).map((srv, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="text-[10px] text-neutral-800 font-bold">
                        {srv.code}
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-semibold">
                          1 x {srv.service_name} ({srv.category})
                        </span>
                        <span className="font-bold shrink-0">
                          {formatSoles(srv.price_cents)}
                        </span>
                      </div>
                      {/* Especialista con filtro de primer nombre aplicado */}
                      <div className="text-[10px] text-neutral-800 font-medium">
                        Esp: {srv.specialist}
                      </div>
                    </div>
                  ))
                ) : ventaData ? (
                  ventaData.detalles_items && ventaData.detalles_items.length > 0 ? (
                    ventaData.detalles_items.map((item, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="text-[10px] text-neutral-800 font-bold">
                          PROD-{String(idx + 1).padStart(2, '0')}
                        </div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-semibold">
                            {item.quantity} x {item.product_name}
                          </span>
                          <span className="font-bold shrink-0">
                            {formatSoles(item.subtotal_cents)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-neutral-800 font-bold">PROD-01</div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-semibold">
                          {ventaData.quantity} x {ventaData.product_name}
                        </span>
                        <span className="font-bold shrink-0">
                          {formatSoles(ventaData.total_price_cents)}
                        </span>
                      </div>
                    </div>
                  )
                ) : null}
              </div>

              {/* Separador = */}
              <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-bold">
                {SEPARATOR_EQUAL}
              </div>

              {/* ============================================================ */}
              {/* RESUMEN FINANCIERO */}
              {/* ============================================================ */}
              <div className="py-1 space-y-0.5 text-[11px]">
                <div className="flex justify-between items-baseline font-bold text-xs">
                  <span>TOTAL PRESUPUESTO:</span>
                  <span>{formatSoles(totalPresupuesto)}</span>
                </div>
                <div className="flex justify-between items-baseline font-semibold">
                  <span>ADELANTO COBRADO:</span>
                  <span>{formatSoles(adelantoCobrado)}</span>
                </div>
                <div className="flex justify-between items-baseline font-semibold">
                  <span>SALDO PENDIENTE:</span>
                  <span>{formatSoles(saldoPendiente)}</span>
                </div>
                <div className="flex justify-between items-baseline font-bold pt-0.5">
                  <span>ESTADO PAGO:</span>
                  <span className="tracking-wider">{estadoPagoLabel}</span>
                </div>
              </div>

              {/* Separador - */}
              <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                {SEPARATOR_DASH}
              </div>

              {/* ============================================================ */}
              {/* LEMA Y PROPÓSITO */}
              {/* ============================================================ */}
              <div className="text-center text-[10px] italic py-1 leading-snug text-neutral-800">
                <p>Verte brillar es nuestro propósito; verte volver,</p>
                <p>nuestro mayor orgullo</p>
              </div>

              {/* Separador . */}
              <div className="text-center font-mono my-0.5 tracking-widest select-none overflow-hidden whitespace-nowrap text-neutral-700 font-bold">
                {SEPARATOR_DOT}
              </div>

              {/* ============================================================ */}
              {/* REDES SOCIALES Y MARCA */}
              {/* ============================================================ */}
              <div className="text-center py-1 space-y-1">
                <div className="text-[10px] tracking-widest font-semibold text-neutral-800">
                  (f)  (ig)  (tk)  (yt)
                </div>
                <div className="text-[11px] font-bold text-black tracking-wide">
                  Spa Acicalados Barber Shop
                </div>
              </div>

              {/* Separador - */}
              <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                {SEPARATOR_DASH}
              </div>

              {/* ============================================================ */}
              {/* PIE DE TICKET */}
              {/* ============================================================ */}
              <div className="text-center text-[11px] font-bold py-1 text-black">
                ¡Gracias por tu preferencia!
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-[#1A1A1A]">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Listo para impresora térmica ESC/POS (80mm)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeTicketModal}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              id="print-ticket-btn"
              type="button"
              disabled={isLoading}
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[#C8A45C] hover:bg-[#D4AF37] disabled:opacity-50 rounded-lg shadow transition cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>Imprimir Ticket</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
