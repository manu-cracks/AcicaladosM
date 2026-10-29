import React, { useMemo } from 'react';
import {
  X,
  History,
  Calendar,
  User,
  Phone,
  CreditCard,
  DollarSign,
  Package,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Tag,
  Sparkles,
  MapPin,
  Clock,
  Layers,
  Store,
  Globe,
  Ban,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import { DressRental, formatSoles } from '../../../types';

export interface DressRentalHistoryModalProps {
  rental: DressRental | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Formatea fechas ISO a formato legible detallado con hora en America/Lima */
function formatTimestampDetailed(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return String(isoString);
  }
}

/** Formatea fechas tipo YYYY-MM-DD a DD/MM/YYYY */
function formatDateSlash(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

export const DressRentalHistoryModal: React.FC<DressRentalHistoryModalProps> = ({
  rental,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !rental) return null;

  // 1. Extracción de prendas si es Pack (a partir del campo notes serializado)
  const packItems = useMemo(() => {
    if (!rental.notes) return null;
    try {
      const parsed = JSON.parse(rental.notes);
      if (parsed && Array.isArray(parsed.prendas) && parsed.prendas.length > 0) {
        return parsed.prendas;
      }
    } catch {}
    return null;
  }, [rental.notes]);

  // 2. Extracción flexible de detalles_pago (desde el campo JSONB directo o dentro de notes)
  const paymentDetails = useMemo(() => {
    if (rental.detalles_pago && typeof rental.detalles_pago === 'object') {
      return rental.detalles_pago;
    }
    if (rental.notes) {
      try {
        const parsed = JSON.parse(rental.notes);
        if (parsed?.detalles_pago && typeof parsed.detalles_pago === 'object') {
          return parsed.detalles_pago;
        }
      } catch {}
    }
    return null;
  }, [rental.detalles_pago, rental.notes]);

  // Estados booleanos de trazabilidad
  const isAnulado = rental.status === 'anulado';
  const isEntregado = rental.status === 'entregado';
  const isFinalizado = rental.status === 'finalizado';
  const isReservado = rental.status === 'reservado';
  const isPorValidar = rental.status === 'por_validar';

  // Hito 2: renderizado si estado >= 'entregado' (es decir, entregado o finalizado)
  const hasEntregado = isEntregado || isFinalizado;
  // Hito 3: renderizado solo si estado === 'finalizado'
  const hasFinalizado = isFinalizado;

  // Fechas reales operativas
  const fechaEntregaReal = rental.fecha_entrega || rental.delivery_date || (hasEntregado ? rental.updated_at : null);
  const fechaDevolucionReal = rental.fecha_devolucion || rental.actual_return_date || (hasFinalizado ? rental.updated_at : null);

  // Cálculos de saldo cobrado al entregar
  const totalAlquiler = rental.rental_price_cents || 0;
  const adelantoInicial = rental.advance_cents || 0;
  const saldoLiquidadoCents = Math.max(0, totalAlquiler - adelantoInicial);

  // Cálculo de garantías y penalidades
  const originalGuaranteeCents = rental.guarantee_cents || 0;
  const penaltyCents = rental.penalty_cents != null 
    ? rental.penalty_cents 
    : rental.garantia_retenida != null 
    ? Math.round(Number(rental.garantia_retenida) * 100) 
    : 0;
  const guaranteeReturnedCents = rental.guarantee_returned_cents != null
    ? rental.guarantee_returned_cents
    : rental.garantia_devuelta != null
    ? Math.round(Number(rental.garantia_devuelta) * 100)
    : Math.max(0, originalGuaranteeCents - penaltyCents);
  const hasRetention = penaltyCents > 0;

  // Formato de código de ticket
  const ticketCodeDisplay = rental.ticket_code.startsWith('#')
    ? rental.ticket_code
    : `#${rental.ticket_code}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#C8A45C]/40 rounded-2xl sm:rounded-3xl max-w-3xl w-full my-4 sm:my-auto text-neutral-200 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* ========================================================= */}
        {/* ENCABEZADO DEL MODAL                                      */}
        {/* ========================================================= */}
        <div className="p-4 sm:p-6 border-b border-neutral-800/80 bg-gradient-to-r from-[#181818] via-[#141414] to-[#181818] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#C8A45C]/20 to-[#A27F38]/10 border border-[#C8A45C]/40 flex items-center justify-center text-[#E6C875] shadow-inner">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg bg-[#C8A45C]/20 border border-[#C8A45C]/50 text-[#FFE7A8] font-mono font-extrabold text-xs tracking-wide">
                  {ticketCodeDisplay}
                </span>
                {rental.numero_ticket && (
                  <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 font-mono text-[11px] border border-neutral-700">
                    Doc: {rental.numero_ticket}
                  </span>
                )}
                {/* Badge Estado Actual */}
                {isPorValidar && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    🟡 POR VALIDAR
                  </span>
                )}
                {isReservado && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    🔵 RESERVADO
                  </span>
                )}
                {isEntregado && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🟢 ENTREGADO
                  </span>
                )}
                {isFinalizado && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                    ⚫ FINALIZADO
                  </span>
                )}
                {isAnulado && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    🔴 ANULADO
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                Historial Detallado (Timeline de Auditoría)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition border border-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* CUERPO DEL MODAL (SCROLLABLE)                             */}
        {/* ========================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* ======================================================= */}
          {/* PANEL SUPERIOR: RESUMEN COMPLETO DE LA ORDEN            */}
          {/* ======================================================= */}
          <div className="bg-[#171717] border border-neutral-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8A45C] flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Resumen General de la Reserva
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                {rental.origin === 'web' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6B2D82]/20 border border-[#8B3D9D]/40 text-[#C96DE8] font-semibold text-[10px]">
                    <Globe className="w-3 h-3" />
                    Origen Web
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C8A45C]/15 border border-[#C8A45C]/35 text-[#E6C875] font-semibold text-[10px]">
                    <Store className="w-3 h-3" />
                    Atención Local
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Datos del Cliente */}
              <div className="space-y-2 bg-[#121212] p-3.5 rounded-xl border border-neutral-800/60">
                <div className="flex items-center gap-2 text-neutral-400 font-semibold text-[11px] uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Datos del Cliente</span>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-bold text-sm">
                    {rental.client_first_name} {rental.client_last_name}
                  </p>
                  <div className="flex items-center gap-3 text-neutral-300 text-xs">
                    <span>
                      DNI: <strong className="font-mono text-white">{rental.client_dni}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-neutral-400" />
                      <strong className="font-mono text-white">{rental.client_phone}</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-[#E6C875]/90 flex items-center gap-1 pt-1">
                    <span>🎉 {rental.event_name}</span>
                    {rental.destination && (
                      <span className="text-neutral-400">
                        • Destino: <strong className="text-neutral-200">{rental.destination}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Datos del Servicio (Prenda o Pack) */}
              <div className="space-y-2 bg-[#121212] p-3.5 rounded-xl border border-neutral-800/60">
                <div className="flex items-center gap-2 text-neutral-400 font-semibold text-[11px] uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Datos del Servicio / Prenda</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {rental.is_pack && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[9px] uppercase tracking-wider">
                        PACK MULTI-PRENDA
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-[#C8A45C]/20 border border-[#C8A45C]/40 text-[#E6C875] font-bold text-[10px] font-mono">
                      {rental.item_code}
                    </span>
                  </div>
                  <p className="text-white font-bold text-xs sm:text-sm mt-1" title={rental.item_name}>
                    {rental.item_name}
                  </p>

                  {/* Detalle si es Pack */}
                  {packItems && packItems.length > 0 ? (
                    <div className="mt-2 space-y-1 pt-2 border-t border-neutral-800">
                      <span className="text-[10px] text-neutral-400 font-semibold uppercase">
                        Prendas incluidas en el pack ({packItems.length}):
                      </span>
                      <ul className="space-y-1">
                        {packItems.map((pi: any, idx: number) => (
                          <li key={idx} className="flex items-center gap-2 text-[11px] text-neutral-300">
                            <span className="font-mono text-[#E6C875] font-bold">[{pi.code}]</span>
                            <span className="truncate">{pi.name}</span>
                            {pi.size && <span className="text-neutral-500 text-[10px]">(Talla {pi.size})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-[11px] text-neutral-400 flex items-center gap-3 mt-1.5">
                      <span>Talla: <strong className="text-white uppercase">{rental.item_size || 'M'}</strong></span>
                      <span>•</span>
                      <span>Color: <strong className="text-white">{rental.item_color || 'Variado'}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fechas Operativas y Resumen Financiero General */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Fechas Operativas */}
              <div className="bg-[#121212] p-3.5 rounded-xl border border-neutral-800/60 space-y-2">
                <div className="flex items-center gap-2 text-neutral-400 font-semibold text-[11px] uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Fechas Operativas Programadas</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block">Fecha Evento:</span>
                    <strong className="text-white font-mono text-xs">{formatDateSlash(rental.event_date)}</strong>
                  </div>
                  <div className="bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                    <span className="text-[10px] text-neutral-400 block">Devolución Esperada:</span>
                    <strong className="text-white font-mono text-xs">{formatDateSlash(rental.return_date)}</strong>
                  </div>
                </div>
              </div>

              {/* Resumen Financiero General */}
              <div className="bg-[#121212] p-3.5 rounded-xl border border-neutral-800/60 space-y-2">
                <div className="flex items-center gap-2 text-neutral-400 font-semibold text-[11px] uppercase tracking-wider">
                  <DollarSign className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Resumen Financiero General</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/90 border border-[#C8A45C]/30">
                  <span className="text-xs text-neutral-300 font-semibold">Costo Total del Alquiler:</span>
                  <span className="text-base font-extrabold text-[#FFE7A8] font-mono">
                    {formatSoles(totalAlquiler)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                  <span>Adelanto pagado: <strong className="text-white">{formatSoles(adelantoInicial)}</strong></span>
                  <span>Saldo pendiente: <strong className="text-amber-400">{formatSoles(rental.pending_cents || 0)}</strong></span>
                </div>
                {(() => {
                  const dp: any =
                    typeof rental.detalles_pago === 'string'
                      ? (() => {
                          try {
                            return JSON.parse(rental.detalles_pago);
                          } catch {
                            return null;
                          }
                        })()
                      : rental.detalles_pago;
                  if (!dp || !dp.metodo) return null;
                  if (dp.metodo === 'Mixto') {
                    return (
                      <div className="pt-1 px-1">
                        <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded inline-block">
                          Método de Pago: Mixto (Efec: S/ {dp.monto_efectivo ?? 0} | Yape: S/ {dp.monto_yape ?? 0})
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="pt-1 px-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded inline-block ${
                          dp.metodo === 'Yape'
                            ? 'text-purple-400 bg-purple-500/10'
                            : 'text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        Método de Pago: {dp.metodo}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Asesor de Atención */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800/70">
              <span>Atendido por: <strong className="text-neutral-200">{rental.asesor_name || 'Recepción'}</strong></span>
              <span>Modalidad: <strong className="text-neutral-200">{rental.is_immediate_delivery ? 'Entrega Inmediata' : 'Reserva con Anticipación'}</strong></span>
            </div>
          </div>

          {/* ======================================================= */}
          {/* PANEL INFERIOR: LÍNEA DE TIEMPO VERTICAL DE ESTADOS     */}
          {/* ======================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#C8A45C] flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Línea de Tiempo de Estados y Flujo de Dinero
              </h3>
              <span className="text-[11px] text-neutral-500">Trazabilidad auditada</span>
            </div>

            <div className="relative pl-6 sm:pl-8 space-y-6 sm:space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[#C8A45C] before:via-blue-500 before:to-neutral-700">
              
              {/* ===================================================== */}
              {/* HITO 1: RESERVA CREADA                                */}
              {/* ===================================================== */}
              <div className="relative group">
                {/* Indicador de nodo */}
                <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#181818] border-2 border-[#C8A45C] flex items-center justify-center text-[#E6C875] shadow-lg shadow-[#C8A45C]/20 z-10">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>

                <div className="bg-[#171717] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-4 space-y-3 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Hito 1: Reserva Creada
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/30">
                        {rental.origin === 'web' ? 'POR VALIDAR (WEB)' : 'RESERVADO (LOCAL)'}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {formatTimestampDetailed(rental.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300">
                    Se registró formalmente la orden de alquiler en el sistema para el cliente{' '}
                    <strong className="text-white">{rental.client_first_name} {rental.client_last_name}</strong>.
                  </p>

                  <div className="bg-[#121212] rounded-xl p-3 border border-neutral-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">Estado inicial asignado:</span>
                      <span className="font-semibold text-neutral-200">
                        {rental.origin === 'web' ? 'Por Validar (Pendiente revisión voucher)' : 'Reserva Confirmada en Local'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">Monto de adelanto ingresado:</span>
                      <span className="font-mono font-bold text-[#E6C875] text-sm">
                        {formatSoles(adelantoInicial)}
                      </span>
                    </div>

                    {/* Desglose de Método de Pago del JSONB detalles_pago */}
                    <div className="pt-2 border-t border-neutral-800/70 space-y-1.5">
                      <span className="text-[11px] font-semibold text-neutral-400 block uppercase tracking-wider">
                        Método de pago del adelanto (detalles_pago):
                      </span>

                      {paymentDetails ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          {paymentDetails.efectivo != null && Number(paymentDetails.efectivo) > 0 && (
                            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                              <span className="text-[11px] text-neutral-400">💵 Efectivo:</span>
                              <strong className="text-xs text-white font-mono">
                                S/ {Number(paymentDetails.efectivo).toFixed(2)}
                              </strong>
                            </div>
                          )}

                          {paymentDetails.yape != null && Number(paymentDetails.yape) > 0 && (
                            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                              <span className="text-[11px] text-purple-400">📱 Yape:</span>
                              <strong className="text-xs text-white font-mono">
                                S/ {Number(paymentDetails.yape).toFixed(2)}
                              </strong>
                            </div>
                          )}

                          {paymentDetails.transferencia != null && Number(paymentDetails.transferencia) > 0 && (
                            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                              <span className="text-[11px] text-blue-400">🏦 Transferencia:</span>
                              <strong className="text-xs text-white font-mono">
                                S/ {Number(paymentDetails.transferencia).toFixed(2)}
                              </strong>
                            </div>
                          )}

                          {/* Métodos listados en string o array */}
                          {paymentDetails.metodos && Array.isArray(paymentDetails.metodos) && paymentDetails.metodos.length > 0 && (
                            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 col-span-full flex items-center justify-between">
                              <span className="text-[11px] text-neutral-400">Modalidades combinadas:</span>
                              <span className="text-[11px] text-amber-300 font-semibold uppercase">
                                {paymentDetails.metodos.join(' + ')}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-[#C8A45C]" />
                          <span>
                            {rental.origin === 'web'
                              ? 'Comprobante Digital / Yape Web (Registrado vía portal)'
                              : adelantoInicial > 0
                              ? 'Pago en Caja / Mostrador Local'
                              : 'Sin pago inicial registrado (Adelanto S/ 0.00)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ===================================================== */}
              {/* HITO 2: PRENDAS ENTREGADAS                            */}
              {/* Renderiza solo si estado >= 'entregado'               */}
              {/* ===================================================== */}
              {hasEntregado && (
                <div className="relative group animate-in fade-in duration-300">
                  {/* Indicador de nodo */}
                  <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#181818] border-2 border-blue-500 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/20 z-10">
                    <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  <div className="bg-[#171717] border border-blue-500/30 hover:border-blue-500/50 rounded-2xl p-4 space-y-3 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Hito 2: Prendas Entregadas
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          🟢 ENTREGADO
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {formatTimestampDetailed(fechaEntregaReal)}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300">
                      El cliente retiró la(s) prenda(s) de tienda tras verificación técnica. Se actualizó el estado a{' '}
                      <strong className="text-emerald-400">ENTREGADO</strong>.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Cobro del Saldo Pendiente */}
                      <div className="bg-[#121212] rounded-xl p-3 border border-neutral-800/80 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">Saldo pendiente liquidado:</span>
                          <strong className="font-mono text-emerald-400">
                            {formatSoles(saldoLiquidadoCents)}
                          </strong>
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          Método de liquidación: Mostrador (Efectivo / POS / Yape al momento de entrega).
                        </p>
                      </div>

                      {/* Garantía Recibida en Custodia */}
                      <div className="bg-[#121212] rounded-xl p-3 border border-neutral-800/80 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Garantía en Custodia:
                          </span>
                          <strong className="font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                            {formatSoles(originalGuaranteeCents)}
                            {rental.garantia_dni_fisico && (
                              <span className="font-sans text-[10px] px-1.5 py-0.5 rounded bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40">
                                + DNI FÍSICO
                              </span>
                            )}
                          </strong>
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          {rental.garantia_dni_fisico
                            ? 'Monto en efectivo + DNI físico en custodia preventiva de respaldo.'
                            : 'Monto en custodia preventiva retenido para respaldo de las prendas.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* HITO 3: DEVOLUCIÓN FINALIZADA                         */}
              {/* Renderiza solo si estado === 'finalizado'             */}
              {/* ===================================================== */}
              {hasFinalizado && (
                <div className="relative group animate-in fade-in duration-300">
                  {/* Indicador de nodo */}
                  <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#181818] border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 z-10">
                    <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  <div className="bg-[#171717] border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl p-4 space-y-3 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Hito 3: Devolución Finalizada
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-200 border border-neutral-700">
                          ⚫ FINALIZADO (CERRADO)
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {formatTimestampDetailed(fechaDevolucionReal)}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300">
                      Recepción de prendas de vuelta en almacén y cierre administrativo del ciclo de alquiler.
                    </p>

                    {/* Detalle explícito de la garantía */}
                    <div className={`p-3.5 rounded-xl border ${
                      hasRetention 
                        ? 'bg-amber-950/20 border-amber-500/40 text-amber-200' 
                        : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    }`}>
                      <div className="flex items-start gap-2.5">
                        {hasRetention ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1.5 flex-1">
                          <p className="font-bold text-xs">
                            {hasRetention
                              ? 'Liquidación con Retención de Garantía'
                              : 'Garantía Reembolsada Íntegramente al Cliente'}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-neutral-300">
                            <div>
                              <span className="text-neutral-400 block text-[10px]">Monto Devuelto al Cliente:</span>
                              <strong className="font-mono text-emerald-400 text-sm">
                                {formatSoles(guaranteeReturnedCents)}
                              </strong>
                            </div>

                            {hasRetention && (
                              <div>
                                <span className="text-neutral-400 block text-[10px]">Monto Retenido (Penalidad):</span>
                                <strong className="font-mono text-rose-400 text-sm">
                                  {formatSoles(penaltyCents)}
                                </strong>
                              </div>
                            )}
                          </div>

                          {hasRetention && rental.penalty_reason && (
                            <div className="text-[11px] text-amber-300/90 pt-1 border-t border-amber-500/30">
                              <strong>Motivo de la retención:</strong> "{rental.penalty_reason}"
                            </div>
                          )}

                          {!hasRetention && (
                            <p className="text-[11px] text-emerald-400/90">
                              Prenda(s) recibidas en perfecto estado. Se devolvió el 100% de la garantía en custodia.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hito adicional si fue anulado */}
              {isAnulado && (
                <div className="relative group animate-in fade-in duration-300">
                  <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#181818] border-2 border-rose-500 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20 z-10">
                    <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  <div className="bg-[#171717] border border-rose-500/30 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                        Orden Anulada
                      </span>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {formatTimestampDetailed(rental.updated_at)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300">
                      Esta orden fue cancelada y liberada del calendario de disponibilidad.
                    </p>
                    {rental.rejection_reason && (
                      <div className="text-xs text-rose-300 bg-rose-950/40 p-2 rounded-lg border border-rose-900">
                        <strong>Motivo:</strong> {rental.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PIE DEL MODAL (CERRAR)                                    */}
        {/* ========================================================= */}
        <div className="p-3.5 sm:p-4 border-t border-neutral-800 bg-[#161616] flex items-center justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 transition-all cursor-pointer"
          >
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
};
