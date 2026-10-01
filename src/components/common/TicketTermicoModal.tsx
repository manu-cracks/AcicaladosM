import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Booking, VentaMostrador, formatSoles } from '../../types';
import { getServiceCategory } from '../../services/financialSSOT';
import { supabase } from '../../lib/supabase/client';
import { LOGO_ACICALADOS_THERMAL_BASE64 } from '../../assets/logoThermalBase64';
import {
  ICON_FB_BASE64,
  ICON_IG_BASE64,
  ICON_TK_BASE64,
  ICON_YT_BASE64,
} from '../../assets/socialThermalIcons';
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

/** Formateador estricto para fecha de emisión de reserva: "23 oct. 2026 - 15:30 p. m." */
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

/** Formato de fecha para venta directa: "01 oct. 2026" */
function formatFechaEmisionDirecta(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Formato de hora para venta directa: "13:21 p. m." */
function formatHoraEmisionDirecta(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const h24 = d.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const isPm = parseInt(h24.split(':')[0], 10) >= 12;
  return `${h24} ${isPm ? 'p. m.' : 'a. m.'}`;
}

/** Filtro de Primer Nombre para trabajadores en Reservas */
function extractFirstName(fullName?: string | null): string {
  if (!fullName) return 'ESPECIALISTA';
  const clean = fullName.trim();
  if (!clean) return 'ESPECIALISTA';
  return clean.split(/\s+/)[0].toUpperCase();
}

/**
 * Filtro de Primer Nombre para Vendedor en Ventas Directas: split(' ')[0]
 * Ej. "JORGE ROBERT HUAMANI AZURZA" -> "JORGE"
 * Fallback: si vacío, default o "Recepción" -> "RECEPCIÓN"
 */
function extractSellerFirstName(sellerName?: string | null): string {
  if (!sellerName || !sellerName.trim()) return 'RECEPCIÓN';
  const clean = sellerName.trim();
  if (clean.toLowerCase() === 'recepción' || clean.toLowerCase() === 'recepcion') {
    return 'RECEPCIÓN';
  }
  const firstWord = clean.split(/\s+/)[0];
  return firstWord ? firstWord.toUpperCase() : 'RECEPCIÓN';
}

/** Conversor numérico estricto para evitar NaN */
function parseSafeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

/** Conversor entero estricto para evitar NaN */
function parseSafeInteger(val: any, fallback = 1): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) || !Number.isFinite(val) ? fallback : Math.floor(val);
  const cleaned = String(val).replace(/[^0-9-]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num < 1 ? fallback : num;
}

/** Capitalización de nombres de servicios a Title Case */
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

      if (!fechaEmision) {
        fechaEmision = b.confirmed_at || b.created_at;
      }

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

        const firstNameOnly = extractFirstName(emp?.first_name || rawEmpName);

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

  // Datos para renderizado de Reservas
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

  // Datos preparados para Venta Directa
  const ventaItems = useMemo(() => {
    if (!ventaData) return [];
    if (Array.isArray(ventaData.detalles_items) && ventaData.detalles_items.length > 0) {
      return ventaData.detalles_items.map((it: any) => ({
        product_name: it.product_name || it.name || 'Producto',
        quantity: parseSafeInteger(it.quantity, 1),
        unit_price: parseSafeNumber(it.unit_price != null ? it.unit_price : (it.unit_price_cents ? it.unit_price_cents / 100 : 0), 0),
        total: parseSafeNumber(it.total != null ? it.total : (it.total_price_cents ? it.total_price_cents / 100 : (parseSafeInteger(it.quantity, 1) * parseSafeNumber(it.unit_price != null ? it.unit_price : 0, 0))), 0),
        seller_name: it.seller_name || it.vendedor || 'Recepción',
      }));
    }
    const qty = parseSafeInteger(ventaData.quantity, 1);
    const unitPrice = parseSafeNumber(ventaData.unit_price_cents ? ventaData.unit_price_cents / 100 : 0, 0);
    const total = parseSafeNumber(ventaData.total_price_cents ? ventaData.total_price_cents / 100 : qty * unitPrice, 0);
    return [{
      product_name: ventaData.product_name || 'Venta en Mostrador',
      quantity: qty,
      unit_price: unitPrice,
      total: total,
      seller_name: (ventaData as any).seller_name || (ventaData as any).vendedor || 'Recepción',
    }];
  }, [ventaData]);

  const ventaDiscountSoles = useMemo(() => {
    if (!ventaData) return 0;
    if (ventaData.monto_descuento != null) return parseSafeNumber(ventaData.monto_descuento, 0);
    if (ventaData.discount_cents != null) return parseSafeNumber(ventaData.discount_cents / 100, 0);
    return 0;
  }, [ventaData]);

  const ventaTotalCobrarSoles = useMemo(() => {
    if (!ventaData) return 0;
    if (ventaData.total_price_cents != null) return parseSafeNumber(ventaData.total_price_cents / 100, 0);
    if ((ventaData as any).total != null) return parseSafeNumber((ventaData as any).total, 0);
    return 0;
  }, [ventaData]);

  const ventaTicketCode = useMemo(() => {
    if (!ventaData) return 'VP-00000000';
    if (ventaData.ticket_number) return ventaData.ticket_number;
    return `VP-${ventaData.id?.substring(0, 8).toUpperCase() || '39028160'}`;
  }, [ventaData]);

  const ventaFechaEmision = formatFechaEmisionDirecta(ventaData?.created_at || (ventaData as any)?.fecha);
  const ventaHoraEmision = formatHoraEmisionDirecta(ventaData?.created_at || (ventaData as any)?.fecha);

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
                {isBooking ? `Reserva ${bookingCode} · Correlativo: ${ticketNumero}` : `Venta Directa ${ventaTicketCode}`}
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
                {/* Logo incrustado como Vector Base64 monocromático para ESC/POS */}
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

              {isBooking ? (
                /* ============================================================ */
                /* MODALIDAD A: TICKET DE RESERVA DE SERVICIOS */
                /* ============================================================ */
                <>
                  {/* METADATOS INMUTABLES Y DETALLES DE CITA */}
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
                    {horaCita && (
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

                  {/* CABECERA DE TABLA */}
                  <div className="flex justify-between font-bold text-[10px] text-neutral-900 py-0.5">
                    <span>DESCRIPCIÓN / SERVICIO</span>
                    <span>IMPORTE</span>
                  </div>

                  {/* Separador - */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                    {SEPARATOR_DASH}
                  </div>

                  {/* DETALLE AISLADO POR SERVICIO */}
                  <div className="py-1 space-y-2 text-[11px]">
                    {(preparedBooking?.services || []).map((srv, idx) => (
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
                        <div className="text-[10px] text-neutral-800 font-medium">
                          Esp: {srv.specialist}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Separador = */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-bold">
                    {SEPARATOR_EQUAL}
                  </div>

                  {/* RESUMEN FINANCIERO */}
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

                  {/* LEMA Y PROPÓSITO */}
                  <div className="text-center text-[10px] italic py-1 leading-snug text-neutral-800">
                    <p>Verte brillar es nuestro propósito; verte volver,</p>
                    <p>nuestro mayor orgullo</p>
                  </div>

                  {/* Separador . */}
                  <div className="text-center font-mono my-0.5 tracking-widest select-none overflow-hidden whitespace-nowrap text-neutral-700 font-bold">
                    {SEPARATOR_DOT}
                  </div>

                  {/* REDES SOCIALES Y MARCA CON VECTORES BASE64 */}
                  <div className="text-center py-1 space-y-1">
                    <div className="flex justify-center items-center gap-3 py-1">
                      <img src={ICON_FB_BASE64} alt="Facebook" className="w-4 h-4 object-contain inline-block" />
                      <img src={ICON_IG_BASE64} alt="Instagram" className="w-4 h-4 object-contain inline-block" />
                      <img src={ICON_TK_BASE64} alt="TikTok" className="w-4 h-4 object-contain inline-block" />
                      <img src={ICON_YT_BASE64} alt="YouTube" className="w-4 h-4 object-contain inline-block" />
                    </div>
                    <div className="text-[11px] font-bold text-black tracking-wide">
                      Spa Acicalados Barber Shop
                    </div>
                  </div>

                  {/* Separador - */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                    {SEPARATOR_DASH}
                  </div>

                  {/* PIE DE TICKET */}
                  <div className="text-center text-[11px] font-bold py-1 text-black">
                    ¡Gracias por tu preferencia!
                  </div>
                </>
              ) : ventaData ? (
                /* ============================================================ */
                /* MODALIDAD B: TICKET DE VENTA DIRECTA (80mm / ESC-POS)        */
                /* ============================================================ */
                <>
                  {/* METADATOS VENTA DIRECTA */}
                  <div className="py-1 space-y-0.5 text-[11px] font-mono">
                    <div className="font-bold text-black pb-0.5">TICKET DE VENTA DIRECTA</div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">CÓDIGO VENTA:</span>
                      <span className="font-bold tracking-wider">{ventaTicketCode}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">FECHA EMISIÓN:</span>
                      <span className="font-medium">{ventaFechaEmision}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">HORA EMISIÓN:</span>
                      <span className="font-medium">{ventaHoraEmision}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">CLIENTE:</span>
                      <span className="font-semibold text-right max-w-[170px] truncate">{ventaData.client_name || 'Cliente'}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">DNI / DOC:</span>
                      <span className="font-mono">{ventaData.client_dni || '72345678'}</span>
                    </div>
                  </div>

                  {/* Separador - */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                    {SEPARATOR_DASH}
                  </div>

                  {/* TABLA DE PRODUCTOS VENTA DIRECTA */}
                  <div className="py-1 text-[11px] font-mono">
                    <div className="flex justify-between font-bold text-[10px] text-neutral-900 pb-1">
                      <span className="w-10">CANT</span>
                      <span className="flex-1 px-1">DESCRIPCIÓN</span>
                      <span className="w-16 text-right">P. UNIT</span>
                      <span className="w-16 text-right">TOTAL</span>
                    </div>

                    <div className="space-y-2 py-0.5">
                      {ventaItems.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between items-start leading-tight">
                            <span className="w-10 font-medium">{item.quantity}</span>
                            <span className="flex-1 px-1 font-semibold break-words">{item.product_name}</span>
                            <span className="w-16 text-right font-medium">S/ {item.unit_price.toFixed(2)}</span>
                            <span className="w-16 text-right font-bold">S/ {item.total.toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] text-neutral-800 font-semibold pl-10">
                            Vend: {extractSellerFirstName(item.seller_name)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Separador - */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                    {SEPARATOR_DASH}
                  </div>

                  {/* DESCUENTO GLOBAL Y TOTAL A COBRAR */}
                  <div className="py-1 space-y-0.5 text-[11px] font-mono">
                    <div className="flex justify-between items-baseline font-semibold">
                      <span>DESCUENTO GLOBAL:</span>
                      <span className="font-mono">S/ {ventaDiscountSoles.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline font-bold text-xs">
                      <span>TOTAL A COBRAR:</span>
                      <span className="font-mono">S/ {ventaTotalCobrarSoles.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Separador - */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                    {SEPARATOR_DASH}
                  </div>

                  {/* MÉTODO DE PAGO */}
                  <div className="py-1 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between items-baseline font-bold">
                      <span>MÉTODO DE PAGO:</span>
                      <span className="font-mono uppercase">{ventaData.payment_method?.toUpperCase() || 'EFECTIVO'}</span>
                    </div>
                    <div className="text-center font-bold text-[11px] pt-0.5 tracking-wider text-black">
                      *** VENTA CANCELADA EN MOSTRADOR ***
                    </div>
                  </div>

                  {/* Separador - */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                    {SEPARATOR_DASH}
                  </div>

                  {/* LEMA Y PROPÓSITO */}
                  <div className="text-center text-[10px] italic py-1 leading-snug text-neutral-800">
                    <p>Verte brillar es nuestro propósito; verte volver,</p>
                    <p>nuestro mayor orgullo</p>
                  </div>

                  {/* Separador . */}
                  <div className="text-center font-mono my-0.5 tracking-widest select-none overflow-hidden whitespace-nowrap text-neutral-700 font-bold">
                    {SEPARATOR_DOT}
                  </div>

                  {/* REDES SOCIALES Y MARCA CON VECTORES BASE64 */}
                  <div className="text-center py-1 space-y-1">
                    <div className="flex justify-center items-center gap-3 py-1">
                      <img src={ICON_FB_BASE64} alt="Facebook" className="w-4 h-4 object-contain inline-block" />
                      <img src={ICON_IG_BASE64} alt="Instagram" className="w-4 h-4 object-contain inline-block" />
                      <img src={ICON_TK_BASE64} alt="TikTok" className="w-4 h-4 object-contain inline-block" />
                      <img src={ICON_YT_BASE64} alt="YouTube" className="w-4 h-4 object-contain inline-block" />
                    </div>
                    <div className="text-[11px] font-bold text-black tracking-wide">
                      Spa Acicalados Barber Shop
                    </div>
                  </div>

                  {/* Separador - */}
                  <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                    {SEPARATOR_DASH}
                  </div>

                  {/* PIE DE TICKET */}
                  <div className="text-center text-[11px] font-bold py-1 text-black">
                    ¡Gracias por su compra y preferencia!
                  </div>
                </>
              ) : null}
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
