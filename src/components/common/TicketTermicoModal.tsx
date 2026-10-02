import React, { useState, useEffect, useCallback, useMemo, Component, ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { Booking, VentaMostrador, formatSoles } from '../../types';
import { getServiceCategory } from '../../services/financialSSOT';
import { supabase } from '../../lib/supabase/client';
import { LOGO_TICKET_BASE64, LOGO_TICKET_SRC } from '../../assets/logoTicketBase64';
import { Printer, X, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Vectores monocromáticos oficiales para impresión térmica ESC/POS (80mm)
 * Codificados directamente en formato Base64 (blanco y negro puro) para
 * garantizar que la impresora térmica los procese como gráficos sólidos.
 */
export const ICON_FB_BASE64 =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="black"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>'
  );

export const ICON_IG_BASE64 =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>'
  );

export const ICON_TK_BASE64 =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="black"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.95-4.57V8.51a8.28 8.28 0 0 0 4.82 1.57V6.69z"/></svg>'
  );

export const ICON_YT_BASE64 =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="black"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'
  );
/**
 * Componente JSX 100% válido para los iconos vectorizados de redes sociales en ticket térmico.
 * Garantiza auto-cierre estricto en tags <path />, atributos className en lugar de class,
 * y alineación horizontal monocromática limpia para previsualización e impresión.
 */
export const SocialIconsRow: React.FC = () => (
  <div className="social-icons-row flex items-center justify-center gap-3 py-1 print:flex print:justify-center print:gap-3">
    {/* Facebook */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className="social-icon w-[18px] h-[18px] fill-black inline-block shrink-0"
      fill="black"
      aria-label="Facebook"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>

    {/* Instagram */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className="social-icon w-[18px] h-[18px] fill-black inline-block shrink-0"
      fill="black"
      aria-label="Instagram"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.07M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>

    {/* TikTok */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className="social-icon w-[18px] h-[18px] fill-black inline-block shrink-0"
      fill="black"
      aria-label="TikTok"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>

    {/* YouTube */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className="social-icon w-[18px] h-[18px] fill-black inline-block shrink-0"
      fill="black"
      aria-label="YouTube"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  </div>
);

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

/** Formateador estricto y ultra-seguro para fecha de emisión de reserva: "23 oct. 2026 - 03:30 p. m." */
function formatFechaEmisionTicket(isoString?: any): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);

    const datePart = d.toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const timePart = d.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return `${datePart} - ${timePart}`;
  } catch (err) {
    console.warn('Error formateando fecha de ticket:', err);
    return String(isoString || '');
  }
}

/** Formato de fecha para venta directa: "01 oct. 2026" */
function formatFechaEmisionDirecta(isoStr?: any): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(isoStr || '');
  }
}

/** Formato de hora para venta directa: "01:21 p. m." */
function formatHoraEmisionDirecta(isoStr?: any): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/**
 * Extracción ULTRA-SEGURA del primer nombre del especialista o colaborador.
 * Aplica ESTRICTAMENTE Optional Chaining (?.) y Nullish Coalescing (?? / ||) según directiva:
 * (item.especialista?.split(' ')[0]) || 'RECEPCIÓN' o (item.trabajador_nombre?.split(' ')[0]) || 'RECEPCIÓN'
 * Soporta de manera transparente objetos (de servicios, ventas o reservas) o strings directos.
 */
export function extractSpecialistFirstName(target?: any, defaultFallback = 'RECEPCIÓN'): string {
  if (!target) return defaultFallback;

  try {
    // Si se pasa un objeto (item de servicio, reserva, venta o colaborador)
    if (typeof target === 'object') {
      const candidate =
        (target.especialista?.split(' ')[0]) ||
        (target.trabajador_nombre?.split(' ')[0]) ||
        (target.employee_name?.split(' ')[0]) ||
        (target.seller_name?.split(' ')[0]) ||
        (target.vendedor?.split(' ')[0]) ||
        (target.first_name?.split(' ')[0]) ||
        (target.full_name?.split(' ')[0]) ||
        (target.name?.split(' ')[0]);

      if (candidate && typeof candidate === 'string' && candidate.trim()) {
        const clean = candidate.trim().toUpperCase();
        if (clean === 'RECEPCIÓN' || clean === 'RECEPCION') return 'RECEPCIÓN';
        if (clean === 'ESPECIALISTA') return defaultFallback;
        return clean;
      }
    }

    // Si se pasa directamente una cadena o cualquier valor convertible a texto
    if (typeof target === 'string' || typeof target === 'number') {
      const clean = String(target).trim();
      if (!clean) return defaultFallback;
      if (clean.toLowerCase() === 'recepción' || clean.toLowerCase() === 'recepcion') return 'RECEPCIÓN';
      if (clean.toLowerCase() === 'especialista') return defaultFallback;
      const firstWord = (clean.split(/\s+/)?.[0]) || defaultFallback;
      return firstWord.toUpperCase();
    }

    return defaultFallback;
  } catch {
    return defaultFallback;
  }
}

/** Filtro de Primer Nombre para trabajadores en Reservas */
export function extractFirstName(fullName?: any): string {
  return extractSpecialistFirstName(fullName, 'ESPECIALISTA');
}

/**
 * Filtro de Primer Nombre para Vendedor en Ventas Directas: split(' ')[0]
 * Ej. "JORGE ROBERT HUAMANI AZURZA" -> "JORGE"
 * Fallback: si vacío, default o "Recepción" -> "RECEPCIÓN"
 */
export function extractSellerFirstName(sellerName?: any): string {
  return extractSpecialistFirstName(sellerName, 'RECEPCIÓN');
}

/** Conversor numérico estricto para evitar NaN */
export function parseSafeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) || !Number.isFinite(val) ? fallback : val;
  try {
    const cleaned = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) || !Number.isFinite(num) ? fallback : num;
  } catch {
    return fallback;
  }
}

/** Conversor entero estricto para evitar NaN */
export function parseSafeInteger(val: any, fallback = 1): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) || !Number.isFinite(val) ? fallback : Math.floor(val);
  try {
    const cleaned = String(val).replace(/[^0-9-]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) || !Number.isFinite(num) || num < 1 ? fallback : num;
  } catch {
    return fallback;
  }
}

/** Formateo oficial a Soles Peruanos 100% blindado contra NaN */
export function formatSolesSafe(cents: any): string {
  const safeCents = parseSafeNumber(cents, 0);
  const soles = safeCents / 100;
  return `S/ ${soles.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Capitalización segura de nombres de servicios a Title Case */
export function formatServiceName(name: any): string {
  if (!name) return 'Servicio Acicalados';
  try {
    const str = typeof name === 'string' ? name : String(name || '');
    if (!str.trim()) return 'Servicio Acicalados';
    return str
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
  } catch {
    return 'Servicio Acicalados';
  }
}

const TicketTermicoModalInner: React.FC = () => {
  const { activeTicket, closeTicketModal, services } = useApp();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [preparedBooking, setPreparedBooking] = useState<PreparedBookingTicket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Diagnóstico en consola para confirmar la apertura del modal y la data entrante
  useEffect(() => {
    if (activeTicket) {
      console.log("TicketTermicoModal montado con activeTicket:", activeTicket);
    }
  }, [activeTicket]);

  const isBooking = activeTicket?.type === 'booking';
  const bookingData = isBooking ? (activeTicket.data as Booking) : null;
  const ventaData = !isBooking && activeTicket ? (activeTicket.data as VentaMostrador) : null;

  // Carga y aislamiento de datos por servicio en tiempo real justo antes de imprimir
  const prepareRealtimeBookingData = useCallback(async (b: Booking) => {
    if (!b) return;
    setIsLoading(true);
    try {
      let numeroTicket = b.numero_ticket || (b as any).ticket_number || '';
      let fechaEmision = b.fecha_emision_ticket || '';

      const isUuid = b.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(b.id));
      if (isUuid) {
        try {
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
        } catch (rpcEx) {
          console.warn('RPC get_or_create_booking_ticket error:', rpcEx);
        }
      }

      if (!fechaEmision) {
        fechaEmision = b.confirmed_at || b.created_at || new Date().toISOString();
      }

      let servicesList: any[] = [];
      if (Array.isArray(b.services)) {
        servicesList = b.services;
      } else if (typeof b.services === 'string') {
        try {
          const parsed = JSON.parse(b.services);
          if (Array.isArray(parsed)) servicesList = parsed;
        } catch {}
      }

      if (isUuid) {
        try {
          const { data: dbServices } = await supabase
            .from('booking_services')
            .select('id, service_name, service_price_cents, assigned_employee_id, service_id, hora_inicio, hora_fin')
            .eq('booking_id', b.id)
            .order('created_at', { ascending: true });

          if (dbServices && dbServices.length > 0) {
            servicesList = dbServices;
          }
        } catch (srvEx) {
          console.warn('Error fetching booking_services from DB:', srvEx);
        }
      }

      const empIds = (servicesList || [])
        .map((s: any) => s?.assigned_employee_id || s?.employee_id || (b as any)?.assigned_employee_id)
        .filter(Boolean);

      const empMap = new Map<string, { first_name: string; last_name: string; type: string }>();
      if (empIds.length > 0) {
        try {
          const { data: dbEmployees } = await supabase
            .from('employees')
            .select('id, first_name, last_name, type')
            .in('id', empIds);

          if (dbEmployees) {
            dbEmployees.forEach((e: any) => empMap.set(e.id, e));
          }
        } catch (empEx) {
          console.warn('Error fetching employees from DB:', empEx);
        }
      }

      const preparedServices: PreparedTicketService[] = (servicesList || []).map((srv: any, idx: number) => {
        if (!srv || typeof srv !== 'object') {
          return {
            code: `SERV-${String(idx + 1).padStart(2, '0')}`,
            service_name: 'Servicio Acicalados',
            price_cents: 0,
            specialist: 'ESPECIALISTA',
            category: 'Barbería',
          };
        }
        const empId = srv.assigned_employee_id || srv.employee_id || (b as any).assigned_employee_id;
        const emp = empId ? empMap.get(empId) : null;
        const rawEmpName = emp
          ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
          : (srv.employee_name || srv.especialista || srv.trabajador_nombre || 'RECEPCIÓN');

        const firstNameOnly =
          (emp?.first_name?.split(' ')[0]) ||
          (srv.especialista?.split(' ')[0]) ||
          (srv.trabajador_nombre?.split(' ')[0]) ||
          (srv.employee_name?.split(' ')[0]) ||
          extractSpecialistFirstName(rawEmpName, 'ESPECIALISTA');

        let cat = 'Barbería';
        try {
          if (emp?.type === 'barbero') cat = 'Barbería';
          else if (emp?.type === 'spa') cat = 'Spa';
          else if (getServiceCategory({ service_id: srv.service_id, service_name: srv.service_name || srv.name || '' }, services || []) === 'barberia') cat = 'Barbería';
          else cat = 'Spa';
        } catch {
          cat = 'Barbería';
        }

        return {
          code: `SERV-${String(idx + 1).padStart(2, '0')}`,
          service_name: formatServiceName(srv.service_name || srv.name || 'Servicio'),
          price_cents: parseSafeNumber(srv.service_price_cents ?? srv.price_cents ?? 0, 0),
          specialist: firstNameOnly || 'ESPECIALISTA',
          category: cat,
        };
      });

      const rawCode = String(b.code || (b as any).booking_code || 'AC-0000');
      const bookingCodeFormatted = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;

      const clientDisplayName = b.client_name || `${(b as any).client_first_name || ''} ${(b as any).client_last_name || ''}`.trim() || 'Cliente';
      const clientDisplayDni = b.client_dni || (b as any).dni || '';

      const sStart = typeof b.start_time === 'string' ? b.start_time.substring(0, 5) : '11:00';
      const sEnd = typeof b.end_time === 'string' ? b.end_time.substring(0, 5) : '12:30';
      const horaCitaStr = `${sStart} - ${sEnd}`;

      const totalCentsSafe = parseSafeNumber(b.total_price_cents, 0);
      const advanceCentsSafe = parseSafeNumber(b.advance_amount_cents, 0);
      const balanceCentsSafe = parseSafeNumber(
        b.balance_cents != null ? b.balance_cents : Math.max(0, totalCentsSafe - advanceCentsSafe),
        0
      );

      setPreparedBooking({
        numeroTicket: numeroTicket || '001-0000001',
        fechaEmision: fechaEmision,
        bookingCode: bookingCodeFormatted,
        clientName: clientDisplayName,
        clientDni: clientDisplayDni,
        horaCita: horaCitaStr,
        services: preparedServices.length > 0 ? preparedServices : [
          {
            code: 'SERV-01',
            service_name: 'Servicio Acicalados',
            price_cents: totalCentsSafe,
            specialist: (b as any).especialista?.split(' ')[0] || (b as any).trabajador_nombre?.split(' ')[0] || 'ESPECIALISTA',
            category: 'Barbería',
          }
        ],
        totalPriceCents: totalCentsSafe,
        advanceAmountCents: advanceCentsSafe,
        balanceCents: balanceCentsSafe,
        paymentStatus: b.payment_status || 'total',
      });
    } catch (err) {
      console.error('Error preparando ticket térmico en tiempo real:', err);
      // Fallback ultra-seguro usando datos en memoria
      const rawCode = String(b.code || (b as any).booking_code || 'AC-0000');
      const bookingCodeFormatted = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;
      const clientDisplayName = b.client_name || `${(b as any).client_first_name || ''} ${(b as any).client_last_name || ''}`.trim() || 'Cliente';
      const totalCentsSafe = parseSafeNumber(b.total_price_cents, 0);
      const advanceCentsSafe = parseSafeNumber(b.advance_amount_cents, 0);
      const balanceCentsSafe = parseSafeNumber(
        b.balance_cents != null ? b.balance_cents : Math.max(0, totalCentsSafe - advanceCentsSafe),
        0
      );

      let fallbackSrvs: any[] = [];
      if (Array.isArray(b.services)) fallbackSrvs = b.services;
      else if (typeof b.services === 'string') {
        try { fallbackSrvs = JSON.parse(b.services) || []; } catch {}
      }

      setPreparedBooking({
        numeroTicket: b.numero_ticket || (b as any).ticket_number || '001-0000001',
        fechaEmision: b.fecha_emision_ticket || b.confirmed_at || b.created_at || new Date().toISOString(),
        bookingCode: bookingCodeFormatted,
        clientName: clientDisplayName,
        clientDni: b.client_dni || (b as any).dni || '',
        horaCita: `${String(b.start_time || '11:00').substring(0, 5)} - ${String(b.end_time || '12:30').substring(0, 5)}`,
        services: (fallbackSrvs || []).map((srv: any, idx: number) => ({
          code: `SERV-${String(idx + 1).padStart(2, '0')}`,
          service_name: formatServiceName(srv?.service_name || srv?.name || 'Servicio'),
          price_cents: parseSafeNumber(srv?.service_price_cents ?? srv?.price_cents ?? 0, 0),
          specialist: (srv?.especialista?.split(' ')[0]) || (srv?.trabajador_nombre?.split(' ')[0]) || extractFirstName(srv?.employee_name || 'ESPECIALISTA'),
          category: 'Barbería',
        })),
        totalPriceCents: totalCentsSafe,
        advanceAmountCents: advanceCentsSafe,
        balanceCents: balanceCentsSafe,
        paymentStatus: b.payment_status || 'total',
      });
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

  const handlePrint = () => {
    window.print();
  };

  const servicesToRender: PreparedTicketService[] = useMemo(() => {
    if (preparedBooking?.services && Array.isArray(preparedBooking.services) && preparedBooking.services.length > 0) {
      return preparedBooking.services;
    }

    let rawServices: any[] = [];
    if (Array.isArray(bookingData?.services)) {
      rawServices = bookingData.services;
    } else if (typeof bookingData?.services === 'string') {
      try {
        const parsed = JSON.parse(bookingData.services);
        if (Array.isArray(parsed)) rawServices = parsed;
      } catch {}
    }

    if (rawServices.length > 0) {
      return (rawServices || []).map((srv: any, idx: number) => {
        let cat = 'Barbería';
        try {
          cat = getServiceCategory({ service_id: srv?.service_id, service_name: srv?.service_name || srv?.name || '' }, services || []) === 'barberia' ? 'Barbería' : 'Spa';
        } catch {
          cat = 'Barbería';
        }
        return {
          code: `SERV-${String(idx + 1).padStart(2, '0')}`,
          service_name: formatServiceName(srv?.service_name || srv?.name || 'Servicio'),
          price_cents: parseSafeNumber(srv?.service_price_cents ?? srv?.price_cents ?? 0, 0),
          specialist: (srv?.especialista?.split(' ')[0]) || (srv?.trabajador_nombre?.split(' ')[0]) || extractFirstName(srv?.employee_name || 'ESPECIALISTA'),
          category: cat,
        };
      });
    }

    return [
      {
        code: 'SERV-01',
        service_name: 'Servicio Acicalados',
        price_cents: parseSafeNumber(bookingData?.total_price_cents, 0),
        specialist: (bookingData as any)?.especialista?.split(' ')[0] || (bookingData as any)?.trabajador_nombre?.split(' ')[0] || 'ESPECIALISTA',
        category: 'Barbería',
      },
    ];
  }, [preparedBooking, bookingData, services]);

  const SEPARATOR_DASH = '----------------------------------------------------------------------';
  const SEPARATOR_EQUAL = '======================================================================';
  const SEPARATOR_DOT = '......................................................................';

  // Datos para renderizado de Reservas (resiliente a camelCase y snake_case)
  const ticketNumero = preparedBooking?.numeroTicket || bookingData?.numero_ticket || (bookingData as any)?.ticket_number || '001-0000001';
  const rawBkCode = String(preparedBooking?.bookingCode || bookingData?.code || (bookingData as any)?.booking_code || 'AC-6505');
  const bookingCode = rawBkCode.startsWith('#') ? rawBkCode : `#${rawBkCode}`;
  const fechaEmisionTxt = formatFechaEmisionTicket(preparedBooking?.fechaEmision || bookingData?.fecha_emision_ticket || bookingData?.confirmed_at || bookingData?.created_at);

  const clienteNombre =
    preparedBooking?.clientName ||
    (isBooking
      ? (bookingData?.client_name || `${(bookingData as any)?.client_first_name || ''} ${(bookingData as any)?.client_last_name || ''}`.trim() || 'Cliente')
      : (ventaData?.client_name || (ventaData as any)?.cliente_nombre || 'Cliente'));

  const clienteDni =
    preparedBooking?.clientDni ||
    (isBooking
      ? (bookingData?.client_dni || (bookingData as any)?.dni || '')
      : (ventaData?.client_dni || (ventaData as any)?.dni || ''));

  const startStr = bookingData?.start_time ? String(bookingData.start_time).substring(0, 5) : '';
  const endStr = bookingData?.end_time ? String(bookingData.end_time).substring(0, 5) : '';
  const horaCita = preparedBooking?.horaCita || (startStr && endStr ? `${startStr} - ${endStr}` : '11:00 - 12:30');

  const totalPresupuesto = parseSafeNumber(
    preparedBooking?.totalPriceCents ?? bookingData?.total_price_cents ?? ventaData?.total_price_cents ?? (ventaData as any)?.total != null ? (ventaData as any)?.total * 100 : 0,
    0
  );
  const adelantoCobrado = parseSafeNumber(
    preparedBooking?.advanceAmountCents ?? bookingData?.advance_amount_cents ?? (isBooking ? 0 : totalPresupuesto),
    0
  );
  const saldoPendiente = parseSafeNumber(
    preparedBooking?.balanceCents ?? (bookingData ? Math.max(0, totalPresupuesto - adelantoCobrado) : 0),
    0
  );
  const paymentStatus = preparedBooking?.paymentStatus || bookingData?.payment_status || 'total';

  const estadoPagoLabel = isBooking
    ? saldoPendiente <= 0 || paymentStatus === 'total'
      ? 'PAGADO COMPLETO'
      : adelantoCobrado > 0 || paymentStatus === 'parcial'
      ? 'SALDO PENDIENTE'
      : 'SIN PAGO'
    : 'PAGADO COMPLETO';

  // Datos preparados para Venta Directa (resiliente a snake_case y camelCase de BD)
  const ventaItems = useMemo(() => {
    if (!ventaData) return [];
    let items = ventaData.detalles_items || (ventaData as any).items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }
    if (Array.isArray(items) && items.length > 0) {
      return (items || []).map((it: any) => {
        const qty = parseSafeInteger(it?.quantity ?? it?.cantidad, 1);
        const unitPrice = parseSafeNumber(
          it?.unit_price != null
            ? it.unit_price
            : it?.precio_unitario != null
            ? it.precio_unitario
            : it?.unit_price_cents
            ? it.unit_price_cents / 100
            : 0,
          0
        );
        const lineTotal = parseSafeNumber(
          it?.total != null
            ? it.total
            : it?.total_price_cents
            ? it.total_price_cents / 100
            : qty * unitPrice,
          0
        );
        const seller =
          (it?.especialista?.split(' ')[0]) ||
          (it?.trabajador_nombre?.split(' ')[0]) ||
          (it?.seller_name?.split(' ')[0]) ||
          (it?.vendedor?.split(' ')[0]) ||
          extractSellerFirstName(it?.seller_name || it?.vendedor || 'RECEPCIÓN');

        return {
          product_name: it?.product_name || it?.producto_nombre || it?.name || 'Producto',
          quantity: qty,
          unit_price: unitPrice,
          total: lineTotal,
          seller_name: seller,
        };
      });
    }

    const qty = parseSafeInteger(ventaData.quantity ?? (ventaData as any).cantidad, 1);
    const unitPrice = parseSafeNumber(
      ventaData.unit_price_cents
        ? ventaData.unit_price_cents / 100
        : (ventaData as any).precio_unitario,
      0
    );
    const total = parseSafeNumber(
      ventaData.total_price_cents
        ? ventaData.total_price_cents / 100
        : (ventaData as any).total,
      qty * unitPrice
    );
    const singleSeller =
      ((ventaData as any).especialista?.split(' ')[0]) ||
      ((ventaData as any).trabajador_nombre?.split(' ')[0]) ||
      ((ventaData as any).seller_name?.split(' ')[0]) ||
      ((ventaData as any).vendedor?.split(' ')[0]) ||
      extractSellerFirstName((ventaData as any).seller_name || (ventaData as any).vendedor || 'RECEPCIÓN');

    return [{
      product_name: ventaData.product_name || (ventaData as any).producto_nombre || 'Venta en Mostrador',
      quantity: qty,
      unit_price: unitPrice,
      total: total,
      seller_name: singleSeller,
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
    if ((ventaData as any).numero_ticket) return (ventaData as any).numero_ticket;
    return `VP-${String(ventaData.id || '39028160').substring(0, 8).toUpperCase()}`;
  }, [ventaData]);

  const ventaFechaEmision = formatFechaEmisionDirecta(ventaData?.created_at || (ventaData as any)?.fecha);
  const ventaHoraEmision = formatHoraEmisionDirecta(ventaData?.created_at || (ventaData as any)?.fecha);

  return (
    <div
      id="thermal-ticket-modal-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:backdrop-blur-none print:overflow-visible print:block print:z-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeTicketModal();
        }
      }}
    >
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 thermal-modal-container print:bg-white print:border-none print:shadow-none print:max-w-none print:w-auto print:m-0 print:p-0 print:overflow-visible print:transform-none print:animate-none">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#1A1A1A] thermal-modal-header print:hidden">
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
        <div className="p-6 bg-neutral-900/60 flex justify-center max-h-[70vh] overflow-y-auto relative thermal-modal-body print:p-0 print:m-0 print:bg-white print:max-h-none print:overflow-visible print:block">
          {isLoading && !preparedBooking && (
            <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-[#C8A45C] gap-2 z-10 print:hidden">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-[11px] font-mono text-neutral-300">Consultando auditoría contable y especialistas...</p>
            </div>
          )}
          <div
            id="thermal-ticket-print"
            data-paper-width={paperWidth}
            className={`bg-white text-black p-4 shadow-xl border border-neutral-300 font-mono text-[11px] leading-tight select-text print:p-1 print:m-0 print:border-none print:shadow-none ${
              paperWidth === '80mm' ? 'w-[300px] max-w-[300px] print:w-[80mm]' : 'w-[260px] max-w-[260px] print:w-[58mm]'
            }`}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
            }}
          >
              {/* ============================================================ */}
              {/* ENCABEZADO CORPORATIVO OFICIAL CON LOGO LOCAL                */}
              {/* [ Imagen: public/logoTicket.png / Base64 spooler térmico ]   */}
              {/* ============================================================ */}
              <div className="text-center pb-2">
                <div className="flex justify-center mb-1">
                  <img
                    src="/logoTicket.png"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = LOGO_TICKET_BASE64;
                    }}
                    alt="Logo"
                    className={`h-auto object-contain mx-auto block filter grayscale contrast-200 ${
                      paperWidth === '80mm' ? 'w-48 max-w-[210px]' : 'w-36 max-w-[160px]'
                    }`}
                    style={{
                      filter: 'grayscale(100%) contrast(180%)',
                      WebkitFilter: 'grayscale(100%) contrast(180%)',
                      imageRendering: 'crisp-edges',
                    }}
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
                /* MODALIDAD A: TICKET DE RESERVA DE SERVICIOS (ESTRUCTURA)    */
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
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">DNI / DOC:</span>
                      <span className="font-mono">{clienteDni || '11111111'}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">HORA CITA:</span>
                      <span className="font-bold">{horaCita}</span>
                    </div>
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
                    {(servicesToRender || []).map((srv, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="text-[10px] text-neutral-800 font-bold">
                          {srv.code}
                        </div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-semibold">
                            1 x {srv.service_name} ({srv.category})
                          </span>
                          <span className="font-bold shrink-0">
                            {formatSolesSafe(srv.price_cents)}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-800 font-medium">
                          Esp: {(srv.specialist?.split(' ')[0]) || (srv as any).especialista?.split(' ')[0] || (srv as any).trabajador_nombre?.split(' ')[0] || 'ESPECIALISTA'}
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
                      <span>{formatSolesSafe(totalPresupuesto)}</span>
                    </div>
                    <div className="flex justify-between items-baseline font-semibold">
                      <span>ADELANTO COBRADO:</span>
                      <span>{formatSolesSafe(adelantoCobrado)}</span>
                    </div>
                    <div className="flex justify-between items-baseline font-semibold">
                      <span>SALDO PENDIENTE:</span>
                      <span>{formatSolesSafe(saldoPendiente)}</span>
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

                  {/* REDES SOCIALES Y MARCA OFICIAL */}
                  <div className="text-center py-1 space-y-1">
                    <SocialIconsRow />
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
                      <span className="font-semibold text-right max-w-[170px] truncate">{clienteNombre}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-normal">DNI / DOC:</span>
                      <span className="font-mono">{clienteDni || '72345678'}</span>
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
                      {(ventaItems || []).map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between items-start leading-tight">
                            <span className="w-10 font-medium">{item.quantity}</span>
                            <span className="flex-1 px-1 font-semibold break-words">{item.product_name}</span>
                            <span className="w-16 text-right font-medium">S/ {parseSafeNumber(item.unit_price, 0).toFixed(2)}</span>
                            <span className="w-16 text-right font-bold">S/ {parseSafeNumber(item.total, 0).toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] text-neutral-800 font-semibold pl-10">
                            Vend: {(item.seller_name?.split(' ')[0]) || (item as any).especialista?.split(' ')[0] || (item as any).trabajador_nombre?.split(' ')[0] || 'RECEPCIÓN'}
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
                      <span className="font-mono">S/ {parseSafeNumber(ventaDiscountSoles, 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline font-bold text-xs">
                      <span>TOTAL A COBRAR:</span>
                      <span className="font-mono">S/ {parseSafeNumber(ventaTotalCobrarSoles, 0).toFixed(2)}</span>
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
                      <span className="font-mono uppercase">{String(ventaData.payment_method || (ventaData as any).metodo_pago || 'EFECTIVO').toUpperCase()}</span>
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

                  {/* REDES SOCIALES Y MARCA OFICIAL */}
                  <div className="text-center py-1 space-y-1">
                    <SocialIconsRow />
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
              ) : (
                <div className="text-center py-6 text-neutral-600 text-xs">
                  <p>Información de comprobante cargada correctamente.</p>
                </div>
              )}
            </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-[#1A1A1A] thermal-modal-footer print:hidden">
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

/**
 * Error Boundary interno para el Ticket Térmico.
 * Garantiza que si algún registro antiguo o estructura malformada produce una excepción,
 * la aplicación NUNCA experimente un crasheo silencioso y presente una interfaz de recuperación.
 */
interface TicketErrorBoundaryProps {
  children: ReactNode;
}

interface TicketErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class TicketErrorBoundary extends (Component as any)<any, any> {
  state = { hasError: false, errorMessage: '' };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMessage: error?.message || 'Error al procesar formato de ticket' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('TicketErrorBoundary capturó una excepción:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-[#C8A45C] flex items-center justify-center mx-auto">
              <Printer className="w-6 h-6" />
            </div>
            <h4 className="text-white font-semibold text-sm">Visualizador de Ticket Térmico</h4>
            <p className="text-xs text-neutral-300">
              Se detectaron campos incompletos en el registro seleccionado.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#C8A45C] text-black font-semibold text-xs rounded-lg hover:bg-[#D4AF37] transition cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const TicketTermicoModal: React.FC = () => {
  return (
    <TicketErrorBoundary>
      <TicketTermicoModalInner />
    </TicketErrorBoundary>
  );
};
