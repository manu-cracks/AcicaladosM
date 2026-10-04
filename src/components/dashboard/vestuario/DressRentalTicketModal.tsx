import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Printer,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
  User,
  Globe,
  Store,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { DressRental, formatSoles } from '../../../types';
import { supabase } from '../../../lib/supabase/client';
import { LOGO_TICKET_BASE64 } from '../../../assets/logoTicketBase64';
import {
  SocialIconsRow,
  formatFechaEmisionTicket,
  parseSafeNumber,
  formatSolesSafe,
} from '../../common/TicketTermicoModal';

export interface DressRentalTicketModalProps {
  rental: DressRental;
  onClose: () => void;
  isWeb?: boolean;
  defaultModista?: string;
}

/** Formateo estricto para fechas tipo YYYY-MM-DD a DD/MM/YYYY */
function formatDateSlash(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

/** Extracción del primer nombre con split(' ')[0] en mayúsculas */
export function extractModistaFirstName(nameOrObj?: any): string {
  if (!nameOrObj) return 'MODISTA';
  if (typeof nameOrObj === 'object') {
    const raw =
      nameOrObj.first_name ||
      nameOrObj.full_name ||
      nameOrObj.name ||
      nameOrObj.asesor_name ||
      '';
    const first = String(raw).trim().split(/\s+/)[0] || 'MODISTA';
    return first.toUpperCase();
  }
  const clean = String(nameOrObj).trim();
  if (!clean) return 'MODISTA';
  const first = clean.split(/\s+/)[0] || 'MODISTA';
  return first.toUpperCase();
}

export const DressRentalTicketModal: React.FC<DressRentalTicketModalProps> = ({
  rental,
  onClose,
  isWeb,
  defaultModista,
}) => {
  const { employees, currentUser } = useApp();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [isWebMode, setIsWebMode] = useState<boolean>(
    isWeb !== undefined ? isWeb : rental.origin === 'web'
  );

  const [ticketNumero, setTicketNumero] = useState<string>(
    rental.numero_ticket || ''
  );
  const [fechaEmision, setFechaEmision] = useState<string>(
    rental.fecha_emision_ticket || ''
  );
  const [isLoadingCorrelative, setIsLoadingCorrelative] = useState<boolean>(false);

  // Lista de colaboradoras tipo 'vestuario' o 'modista'
  const modistas = useMemo(() => {
    const filtered = (employees || []).filter(
      (e) =>
        e.type === 'modista' ||
        e.type === 'vestuario' ||
        e.role === 'vestuario_admin' ||
        e.type === 'recepcionista'
    );
    return filtered.length > 0 ? filtered : employees || [];
  }, [employees]);

  // Selección de modista / asesor para la impresión local
  const [selectedModista, setSelectedModista] = useState<string>(() => {
    if (rental.asesor_name && rental.asesor_name.trim()) return rental.asesor_name.trim();
    if (defaultModista && defaultModista.trim()) return defaultModista.trim();
    if (currentUser?.name && currentUser.name.trim()) return currentUser.name.trim();
    if (currentUser?.first_name) return `${currentUser.first_name} ${currentUser.last_name || ''}`.trim();
    if (modistas.length > 0) {
      const firstMod = modistas[0];
      return `${firstMod.first_name || ''} ${firstMod.last_name || ''}`.trim() || 'MODISTA';
    }
    return 'MODISTA';
  });

  // =========================================================================
  // FASE 1: AUDITORÍA CONTABLE Y DATOS (Correlativo Inmutable y Fecha Congelada)
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    async function syncOrEmitTicketCorrelative() {
      // Si el ticket ya tiene correlativo histórico en el registro, congelarlo directamente
      if (rental.numero_ticket && rental.fecha_emision_ticket) {
        setTicketNumero(rental.numero_ticket);
        setFechaEmision(rental.fecha_emision_ticket);
        if (rental.asesor_name) setSelectedModista(rental.asesor_name);
        return;
      }

      // Si tiene ID válido de Supabase, consumir RPC atómico inmutable
      const isUuid =
        rental.id &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(rental.id)
        );

      interface TicketRpcResult {
        success: boolean;
        numero_ticket?: string;
        fecha_emision_ticket?: string;
        asesor_name?: string;
        ticket_code?: string;
        is_reprint?: boolean;
      }

      if (isUuid) {
        setIsLoadingCorrelative(true);
        try {
          const { data: res, error } = await (supabase.rpc as any)(
            'get_or_create_dress_rental_ticket',
            {
              p_rental_id: rental.id,
              p_asesor_name: selectedModista ? selectedModista.trim() : undefined,
            }
          );

          const rpcData = res as TicketRpcResult | null;

          if (!error && rpcData && rpcData.success && isMounted) {
            if (rpcData.numero_ticket) {
              setTicketNumero(rpcData.numero_ticket);
              rental.numero_ticket = rpcData.numero_ticket;
            }
            if (rpcData.fecha_emision_ticket) {
              setFechaEmision(rpcData.fecha_emision_ticket);
              rental.fecha_emision_ticket = rpcData.fecha_emision_ticket;
            }
            if (rpcData.asesor_name) {
              setSelectedModista(rpcData.asesor_name);
              rental.asesor_name = rpcData.asesor_name;
            }
          }
        } catch (rpcEx) {
          console.warn('Error llamando a get_or_create_dress_rental_ticket:', rpcEx);
        } finally {
          if (isMounted) setIsLoadingCorrelative(false);
        }
      }
    }

    syncOrEmitTicketCorrelative();

    return () => {
      isMounted = false;
    };
  }, [rental.id, rental.numero_ticket, rental.fecha_emision_ticket, selectedModista]);

  const handleModistaChange = async (newName: string) => {
    setSelectedModista(newName);
    rental.asesor_name = newName;
    const isUuid =
      rental.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(rental.id)
      );
    if (isUuid) {
      try {
        await supabase
          .from('dress_rentals' as any)
          .update({ asesor_name: newName, updated_at: new Date().toISOString() } as any)
          .eq('id', rental.id);
      } catch (err) {
        console.warn('Error actualizando asesor_name en DB:', err);
      }
    }
  };

  const modistaFirstName = useMemo(() => {
    return extractModistaFirstName(selectedModista);
  }, [selectedModista]);

  // Valores financieros seguros
  const totalAlquilerCents = parseSafeNumber(rental.rental_price_cents, 0);
  const adelantoCents = parseSafeNumber(rental.advance_cents, 0);
  const pendingCents = parseSafeNumber(rental.pending_cents, 0);
  const guaranteeCents = parseSafeNumber(rental.guarantee_cents, 5000);
  const penaltyCents = parseSafeNumber(rental.penalty_cents, 0);
  const guaranteeReturnedCents = parseSafeNumber(
    rental.guarantee_returned_cents != null
      ? rental.guarantee_returned_cents
      : Math.max(0, guaranteeCents - penaltyCents),
    0
  );

  const isAnulado = rental.status === 'anulado';
  const isEntregado = rental.status === 'entregado';
  const isFinalizado = rental.status === 'finalizado';
  const isReservado = rental.status === 'reservado' || rental.status === 'por_validar';

  // Cálculos dinámicos según estado (Fase 2)
  const displayTotalAlquilerCents = isAnulado ? 0 : totalAlquilerCents;
  const displayAdelantoCents = isAnulado ? 0 : isEntregado || isFinalizado ? totalAlquilerCents : adelantoCents;
  const displaySaldoPendienteCents = isAnulado || isEntregado || isFinalizado ? 0 : pendingCents;

  // Correlativo y códigos
  const displayCorrelativo =
    ticketNumero ||
    rental.numero_ticket ||
    `001-${String(rental.ticket_code?.replace(/\D/g, '') || '0000001').padStart(7, '0')}`;

  const cleanOrderCode = String(rental.ticket_code || 'W-0001').trim();
  const displayOrderCode = cleanOrderCode.startsWith('#') ? cleanOrderCode : `#${cleanOrderCode}`;

  const displayFechaEmision = formatFechaEmisionTicket(
    fechaEmision || rental.fecha_emision_ticket || rental.created_at || new Date().toISOString()
  );

  const displayClientName = `${rental.client_first_name || ''} ${rental.client_last_name || ''}`.trim() || 'Cliente';
  const displayClientDni = rental.client_dni || '70123456';
  const displayClientPhone = rental.client_phone || '991044301';
  const displayEventName = rental.event_name || 'Matrimonio Civil';
  const displayDestination = (rental.destination || 'PICHARI').toUpperCase();

  // Etiqueta visual de estado
  const displayStatusBadge = useMemo(() => {
    switch (rental.status) {
      case 'entregado':
        return '🟢 ENTREGADO';
      case 'finalizado':
        return '🔵 FINALIZADO';
      case 'anulado':
        return '🔴 ANULADO';
      case 'por_validar':
        return '🟡 POR VALIDAR';
      case 'reservado':
      default:
        return '🟡 RESERVADO';
    }
  }, [rental.status]);

  const handlePrint = async () => {
    // Si aún no se guardó el correlativo, asegurar la emisión antes del spooler térmico
    if (!ticketNumero) {
      const isUuid =
        rental.id &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(rental.id)
        );
      if (isUuid) {
        try {
          const { data: res } = await (supabase.rpc as any)(
            'get_or_create_dress_rental_ticket',
            {
              p_rental_id: rental.id,
              p_asesor_name: selectedModista ? selectedModista.trim() : undefined,
            }
          );
          const rpcData = res as { success?: boolean; numero_ticket?: string; fecha_emision_ticket?: string } | null;
          if (rpcData?.success) {
            if (rpcData.numero_ticket) setTicketNumero(rpcData.numero_ticket);
            if (rpcData.fecha_emision_ticket) setFechaEmision(rpcData.fecha_emision_ticket);
          }
        } catch {}
      }
    }
    window.print();
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = (rental.client_phone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;

    let msg = `*SPA ACICALADOS - BOUTIQUE DE VESTIDOS*\n`;
    msg += `*TICKET DE ALQUILER NRO:* ${displayCorrelativo}\n`;
    msg += `*CÓDIGO ORDEN:* ${displayOrderCode}\n`;
    msg += `*ESTADO:* ${displayStatusBadge}\n\n`;
    msg += `*Cliente:* ${displayClientName}\n`;
    msg += `*DNI:* ${displayClientDni}\n`;
    msg += `*Evento:* ${displayEventName} (${displayDestination})\n`;
    msg += `*Prenda:* [${rental.item_code}] ${rental.item_name} (Talla ${rental.item_size || 'M'})\n`;
    msg += `*F. Evento:* ${formatDateSlash(rental.event_date)}\n`;
    msg += `*F. Devolución:* ${formatDateSlash(rental.return_date)}\n\n`;

    if (isAnulado) {
      msg += `*ORDEN ANULADA*: Esta orden ha sido cancelada.\n`;
    } else if (isEntregado) {
      msg += `*Total Alquiler:* ${formatSolesSafe(displayTotalAlquilerCents)}\n`;
      msg += `*Saldo Pendiente:* S/ 0.00 (Cancelado)\n`;
      msg += `*Garantía en Custodia:* ${formatSolesSafe(guaranteeCents)}\n`;
      msg += `_(Garantía protegida por la tienda, reembolsable contra entrega de prenda intacta)_\n`;
    } else if (isFinalizado) {
      msg += `*Total Alquiler:* ${formatSolesSafe(displayTotalAlquilerCents)}\n`;
      msg += `*Garantía Devuelta:* ${formatSolesSafe(guaranteeReturnedCents)}\n`;
      if (penaltyCents > 0) {
        msg += `*Retención por Daños/Mora:* ${formatSolesSafe(penaltyCents)}\n`;
        if (rental.penalty_reason) msg += `*Motivo:* ${rental.penalty_reason}\n`;
      }
      msg += `*Devolución de prenda:* Completada con éxito.\n`;
    } else {
      msg += `*Total Alquiler:* ${formatSolesSafe(displayTotalAlquilerCents)}\n`;
      msg += `*Adelanto Recibido:* ${formatSolesSafe(displayAdelantoCents)}\n`;
      msg += `*Saldo Pendiente:* ${formatSolesSafe(displaySaldoPendienteCents)}\n`;
      if (isWebMode) {
        msg += `\n_⚠️ IMPORTANTE: Al recoger la prenda se deberá abonar el saldo pendiente y una garantía reembolsable que será fijada en el local._\n`;
      } else {
        msg += `\n_⚠️ IMPORTANTE: El día del recojo se abonará una garantía de ${formatSolesSafe(guaranteeCents)}, reembolsable al devolver la prenda intacta._\n`;
      }
    }

    msg += `\n¡Gracias por su preferencia! ✨\nSpa Acicalados Barber Shop`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encoded}`, '_blank');
  };

  const SEPARATOR_DASH = '----------------------------------------------------------------------';
  const SEPARATOR_DOT = '......................................................................';

  return (
    <div
      id="thermal-ticket-modal-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:bg-white print:backdrop-blur-none print:overflow-visible print:block print:z-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 thermal-modal-container print:bg-white print:border-none print:shadow-none print:max-w-none print:w-auto print:m-0 print:p-0 print:overflow-visible print:transform-none print:animate-none">
        {/* Header Modal - Hide on print */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-neutral-800 bg-[#1A1A1A] thermal-modal-header print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C]">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                Ticket Térmico Boutique (80mm)
              </h3>
              <p className="text-xs text-neutral-400">
                Orden {displayOrderCode} · Correlativo: {displayCorrelativo}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de modo Web / Local */}
            <div className="flex items-center bg-black/40 border border-neutral-800 rounded p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setIsWebMode(false)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  !isWebMode
                    ? 'bg-[#C8A45C] text-black font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Modo Impresión Local POS"
              >
                <Store className="w-3 h-3" />
                <span>Local</span>
              </button>
              <button
                type="button"
                onClick={() => setIsWebMode(true)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  isWebMode
                    ? 'bg-[#C8A45C] text-black font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Modo Comprobante Web Cliente"
              >
                <Globe className="w-3 h-3" />
                <span>Web</span>
              </button>
            </div>

            {/* Paper Size selector */}
            <div className="flex items-center bg-black/40 border border-neutral-800 rounded p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-[#C8A45C] text-black font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-[#C8A45C] text-black font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                58mm
              </button>
            </div>

            <button
              id="close-ticket-modal-btn"
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra Secundaria de Configuración Operativa (Selector de Modista si es Local) */}
        {!isWebMode && (
          <div className="px-6 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between gap-3 text-xs print:hidden">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#C8A45C]" />
              <span className="text-neutral-400 font-medium">Asesor/Modista Asignado:</span>
            </div>
            <select
              value={selectedModista}
              onChange={(e) => handleModistaChange(e.target.value)}
              className="bg-neutral-800 border border-neutral-700/80 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#C8A45C] cursor-pointer"
            >
              {modistas.map((m) => {
                const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.full_name;
                return (
                  <option key={m.id} value={fullName}>
                    {extractModistaFirstName(fullName)} ({m.type || 'Personal'})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Modal Body: Thermal Paper Preview */}
        <div className="p-6 bg-neutral-900/60 flex justify-center max-h-[70vh] overflow-y-auto relative thermal-modal-body print:p-0 print:m-0 print:bg-white print:max-h-none print:overflow-visible print:block">
          {isLoadingCorrelative && (
            <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-[#C8A45C] gap-2 z-10 print:hidden">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-[11px] font-mono text-neutral-300">
                Sincronizando correlativo contable inmutable...
              </p>
            </div>
          )}

          <div
            id="thermal-ticket-print"
            data-paper-width={paperWidth}
            className={`bg-white text-black p-4 shadow-xl border border-neutral-300 font-mono text-[11px] leading-tight select-text print:p-1 print:m-0 print:border-none print:shadow-none ${
              paperWidth === '80mm'
                ? 'w-[300px] max-w-[300px] print:w-[80mm]'
                : 'w-[260px] max-w-[260px] print:w-[58mm]'
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
                ACICALADOS
              </div>
              <div className="font-bold text-center text-[11px] tracking-wide text-black">
                "SPA ACICALADOS BARBER SHOP"
              </div>
              <div className="text-center text-[10px] text-neutral-800 font-semibold">
                HUAMANI AZURZA, JORGE ROBERT
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

            {/* Subcabecera Boutique */}
            <div className="text-center py-1">
              <div className="font-bold text-xs uppercase tracking-wider text-black">
                BOUTIQUE DE VESTIDOS
              </div>
              <div className="text-[10px] text-neutral-800 font-medium">
                Alta Costura &amp; Trajes de Gala
              </div>
            </div>

            {/* METADATOS DEL TICKET */}
            <div className="py-1 space-y-0.5 text-[11px] font-mono">
              <div className="font-bold text-black pb-0.5">TICKET DE ALQUILER - BOUTIQUE</div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal">TICKET CORRELATIVO:</span>
                <span className="font-bold tracking-wider">{displayCorrelativo}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal">CÓDIGO ORDEN:</span>
                <span className="font-bold">{displayOrderCode}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal">FECHA EMISIÓN:</span>
                <span className="font-medium text-right">{displayFechaEmision}</span>
              </div>

              <div className="flex justify-between items-baseline pt-1">
                <span className="font-normal">CLIENTE:</span>
                <span className="font-semibold text-right max-w-[170px] truncate">
                  {displayClientName}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal">DNI / DOC:</span>
                <span className="font-mono">{displayClientDni}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal">TELÉFONO:</span>
                <span className="font-mono">{displayClientPhone}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal">EVENTO:</span>
                <span className="font-semibold text-right max-w-[170px] truncate">
                  {displayEventName}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal">DESTINO:</span>
                <span className="font-bold text-right uppercase">{displayDestination}</span>
              </div>
              {modistaFirstName && (
                <div className="flex justify-between items-baseline pt-0.5">
                  <span className="font-normal">MODISTA:</span>
                  <span className="font-bold text-right uppercase">{modistaFirstName}</span>
                </div>
              )}
            </div>

            {/* Separador - */}
            <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
              {SEPARATOR_DASH}
            </div>

            {/* DETALLE DE LA PRENDA */}
            <div className="py-1 text-[11px] font-mono space-y-1">
              <div className="flex justify-between font-bold text-[10px] text-neutral-900 border-b border-neutral-300 pb-0.5">
                <span>CÓDIGO PRENDA / DETALLE</span>
                <span>IMPORTE</span>
              </div>

              <div className="space-y-0.5 pt-0.5">
                <div className="flex justify-between items-start leading-tight">
                  <span className="font-bold">CÓDIGO: {rental.item_code}</span>
                  <span className="font-bold text-right">
                    {isAnulado ? 'S/ 0.00' : formatSolesSafe(totalAlquilerCents)}
                  </span>
                </div>
                <div className="font-semibold break-words text-[11px]">
                  PRENDA: {rental.item_name}
                </div>
                <div className="text-[10px] text-neutral-800">
                  Talla: <span className="font-semibold">{rental.item_size || 'M'}</span>
                </div>
                <div className="text-[10px] text-neutral-800 flex justify-between">
                  <span>F. Evento: {formatDateSlash(rental.event_date)}</span>
                  <span>F. Devolución: {formatDateSlash(rental.return_date)}</span>
                </div>
                {isFinalizado && rental.actual_return_date && (
                  <div className="text-[10px] text-neutral-800">
                    F. Real Devolución:{' '}
                    <span className="font-semibold">
                      {formatDateSlash(rental.actual_return_date)}
                    </span>
                  </div>
                )}
                {modistaFirstName && (
                  <div className="text-[10px] text-neutral-900 font-bold pt-0.5">
                    Modista: {modistaFirstName}
                  </div>
                )}
              </div>
            </div>

            {/* Separador - */}
            <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
              {SEPARATOR_DASH}
            </div>

            {/* ESTADO ACTUAL */}
            <div className="py-1 text-[11px] font-mono flex items-center justify-between font-bold">
              <span>ESTADO ACTUAL:</span>
              <span>{displayStatusBadge}</span>
            </div>

            {/* Separador - */}
            <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
              {SEPARATOR_DASH}
            </div>

            {/* ============================================================ */}
            {/* FASE 2: MOTOR DINÁMICO DE ESTADOS Y GARANTÍA                */}
            {/* ============================================================ */}
            <div className="py-1 space-y-1 text-[11px] font-mono">
              <div className="space-y-0.5">
                <div className="flex justify-between items-baseline font-bold">
                  <span>TOTAL ALQUILER:</span>
                  <span className="font-mono">
                    {formatSolesSafe(displayTotalAlquilerCents)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline font-semibold">
                  <span>ADELANTO RECIBIDO:</span>
                  <span className="font-mono">
                    {formatSolesSafe(displayAdelantoCents)}
                  </span>
                </div>
              </div>

              <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
                {SEPARATOR_DASH}
              </div>

              <div className="flex justify-between items-baseline font-bold text-xs">
                <span>SALDO PENDIENTE A COBRAR:</span>
                <span className="font-mono">
                  {formatSolesSafe(displaySaldoPendienteCents)}
                </span>
              </div>

              {/* Fila extra para ENTREGADO en Local */}
              {!isWebMode && isEntregado && (
                <div className="flex justify-between items-baseline font-bold text-xs pt-0.5 text-black">
                  <span>GARANTÍA EN CUSTODIA:</span>
                  <span className="font-mono">{formatSolesSafe(guaranteeCents)}</span>
                </div>
              )}

              {/* Filas extras para FINALIZADO en Local */}
              {!isWebMode && isFinalizado && (
                <div className="space-y-0.5 pt-0.5">
                  <div className="flex justify-between items-baseline font-semibold">
                    <span>GARANTÍA INICIAL:</span>
                    <span className="font-mono">{formatSolesSafe(guaranteeCents)}</span>
                  </div>
                  {penaltyCents > 0 && (
                    <div className="space-y-0.5 text-neutral-900">
                      <div className="flex justify-between items-baseline font-bold">
                        <span>DESCUENTO POR DAÑOS / MORA:</span>
                        <span className="font-mono">-{formatSolesSafe(penaltyCents)}</span>
                      </div>
                      {rental.penalty_reason && (
                        <div className="text-[10px] text-neutral-700 italic">
                          Motivo: {rental.penalty_reason}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between items-baseline font-bold text-black border-t border-neutral-300 pt-0.5">
                    <span>GARANTÍA DEVUELTA AL CLIENTE:</span>
                    <span className="font-mono">
                      {formatSolesSafe(guaranteeReturnedCents)}
                    </span>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* BLOQUE DINÁMICO DE AVISO DE GARANTÍA SEGÚN REGLAS DE NEGOCIO  */}
              {/* ============================================================ */}
              <div className="mt-2 p-1.5 border border-dashed border-neutral-400 bg-neutral-50 text-[10px] leading-snug space-y-1">
                <div className="font-bold text-center text-[10px] uppercase tracking-wider text-black">
                  *** AVISO DE GARANTÍA ***
                </div>

                {isAnulado ? (
                  <div className="text-center font-bold text-red-600 space-y-0.5">
                    <p className="tracking-wide">*** ORDEN ANULADA ***</p>
                    <p className="font-normal text-neutral-700">
                      Esta orden ha sido anulada. Todos los saldos y garantías quedan sin efecto.
                    </p>
                    {rental.rejection_reason && (
                      <p className="text-[9px] text-neutral-600 italic">
                        Motivo: {rental.rejection_reason}
                      </p>
                    )}
                  </div>
                ) : isWebMode && isReservado ? (
                  <div className="text-neutral-900">
                    ⚠️ IMPORTANTE: Al recoger la prenda se deberá abonar el saldo pendiente y
                    una garantía reembolsable que será fijada en el local.
                  </div>
                ) : !isWebMode && isReservado ? (
                  <div className="space-y-1 text-neutral-900">
                    <div>
                      ⚠️ IMPORTANTE: El día del recojo del vestido se deberá abonar una
                      garantía de {formatSolesSafe(guaranteeCents)}, la cual será
                      reembolsada al devolver la prenda.
                    </div>
                    <div className="text-neutral-700">
                      El día del recojo del vestido se deberá abonar una garantía de{' '}
                      {formatSolesSafe(guaranteeCents)}, la cual será reembolsada al
                      devolver la prenda en óptimas condiciones.
                    </div>
                  </div>
                ) : !isWebMode && isEntregado ? (
                  <div className="text-neutral-900 font-medium">
                    ⚠️ GARANTÍA EN CUSTODIA: El monto está protegido por la tienda y se
                    reembolsará contra entrega de la prenda intacta.
                  </div>
                ) : !isWebMode && isFinalizado ? (
                  <div className="space-y-0.5 text-center text-neutral-900 font-semibold">
                    <div className="text-emerald-700 font-bold uppercase tracking-wider">
                      GARANTÍA DEVUELTA AL CLIENTE
                    </div>
                    <div className="text-[9px] text-neutral-700 font-normal">
                      Prenda retornada satisfactoriamente. Liquidación de garantía efectuada
                      en tienda.
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-800">
                    Consulte en el mostrador para la liquidación de la garantía de esta prenda.
                  </div>
                )}
              </div>
            </div>

            {/* Separador - */}
            <div className="text-center font-mono my-0.5 tracking-tight select-none overflow-hidden whitespace-nowrap text-neutral-900 font-semibold">
              {SEPARATOR_DASH}
            </div>

            {/* TÉRMINOS Y CONDICIONES GENERALES */}
            <div className="py-1 text-[9.5px] leading-snug space-y-0.5 text-neutral-800 font-mono">
              <div className="font-bold text-neutral-900">
                TÉRMINOS Y CONDICIONES GENERALES:
              </div>
              <div>
                1. Manchas severas, roturas o quemaduras serán descontadas del monto de la garantía.
              </div>
              <div>
                2. La demora en la devolución incurrirá en una mora diaria.
              </div>
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
              ¡Gracias por su preferencia!
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-neutral-800 bg-[#1A1A1A] thermal-modal-footer print:hidden">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Listo para impresora térmica ESC/POS (80mm)</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              title="Compartir comprobante vía WhatsApp"
            >
              <Send className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              id="print-dress-ticket-btn"
              type="button"
              disabled={isLoadingCorrelative}
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[#C8A45C] hover:bg-[#D4AF37] disabled:opacity-50 rounded-lg shadow transition cursor-pointer"
            >
              {isLoadingCorrelative ? (
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
