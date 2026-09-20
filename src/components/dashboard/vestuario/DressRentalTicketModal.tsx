import React, { useRef } from 'react';
import { X, Printer, Send, ShieldCheck, Calendar, Clock, User, Phone, MapPin, Tag, CheckCircle2 } from 'lucide-react';
import { DressRental, formatSoles } from '../../../types';

interface DressRentalTicketModalProps {
  rental: DressRental;
  onClose: () => void;
}

export const DressRentalTicketModal: React.FC<DressRentalTicketModalProps> = ({ rental, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const totalCents = rental.rental_price_cents;
  const advanceCents = rental.advance_cents || 0;
  const pendingCents = rental.pending_cents || 0;
  const guaranteeCents = rental.guarantee_cents || 0;
  const returnedGuaranteeCents = rental.guarantee_returned_cents ?? guaranteeCents;
  const penaltyCents = rental.penalty_cents ?? Math.max(0, guaranteeCents - returnedGuaranteeCents);

  const isImmediate = rental.is_immediate_delivery;
  const isFinalized = rental.status === 'finalizado';
  const isEntregado = rental.status === 'entregado';

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = (rental.client_phone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;

    let summaryText = `*BOUTIQUE DE VESTIDOS - COMPROBANTE*\n`;
    summaryText += `Ticket Nro: ${rental.ticket_code}\n`;
    summaryText += `Estado: ${rental.status.toUpperCase()}\n\n`;
    summaryText += `*Cliente:* ${rental.client_first_name} ${rental.client_last_name}\n`;
    summaryText += `*DNI:* ${rental.client_dni}\n`;
    summaryText += `*Evento:* ${rental.event_name}\n`;
    summaryText += `*Prenda:* [${rental.item_code}] ${rental.item_name}\n`;
    summaryText += `*Fecha Evento:* ${rental.event_date}\n`;
    summaryText += `*Fecha Devolución:* ${rental.return_date}\n\n`;

    if (isImmediate || isEntregado) {
      summaryText += `*Total Alquiler:* ${formatSoles(totalCents)}\n`;
      summaryText += `*Total Pagado:* ${formatSoles(totalCents)}\n`;
      summaryText += `*Garantía Recibida:* ${formatSoles(guaranteeCents)}\n`;
    } else if (isFinalized) {
      summaryText += `*Total Alquiler:* ${formatSoles(totalCents)}\n`;
      summaryText += `*Garantía Reembolsada:* ${formatSoles(returnedGuaranteeCents)}\n`;
      if (penaltyCents > 0) {
        summaryText += `*Retención por Daños/Mora:* ${formatSoles(penaltyCents)}\n`;
        if (rental.penalty_reason) summaryText += `*Motivo:* ${rental.penalty_reason}\n`;
      }
    } else {
      summaryText += `*Total Alquiler:* ${formatSoles(totalCents)}\n`;
      summaryText += `*Adelanto Recibido:* ${formatSoles(advanceCents)}\n`;
      summaryText += `*Saldo Pendiente:* ${formatSoles(pendingCents)}\n`;
      summaryText += `\n_El día del recojo se abonará una garantía de ${formatSoles(guaranteeCents > 0 ? guaranteeCents : 5000)}, reembolsable a la devolución._\n`;
    }

    summaryText += `\n¡Gracias por su preferencia! ✨`;

    const encoded = encodeURIComponent(summaryText);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in print:p-0 print:bg-white overscroll-contain">
      <div className="bg-[#121212] border border-[#C8A45C]/40 rounded-2xl sm:rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-4 sm:my-auto print:max-w-none print:w-full print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Header Modal - Hide on print */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#121212] print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/20 border border-[#C8A45C]/40 flex items-center justify-center text-[#C8A45C]">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ticket de Comprobante</h3>
              <p className="text-[11px] text-neutral-400">Nro: {rental.ticket_code}</p>
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

        {/* Scrollable Receipt Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-mono text-xs text-neutral-300 print:text-black print:p-0">
          <div
            ref={printRef}
            className="bg-[#161616] p-5 sm:p-6 rounded-2xl border border-dashed border-neutral-700/80 space-y-4 shadow-inner print:bg-white print:border-none print:p-0"
          >
            {/* Header del Ticket */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-neutral-700">
              <div className="text-base sm:text-lg font-serif-luxury font-bold text-[#E6C875] tracking-widest uppercase print:text-black">
                Boutique de Vestidos
              </div>
              <div className="text-[11px] text-neutral-400 print:text-gray-600">
                Alta Costura & Trajes de Gala
              </div>
              <div className="text-xs font-bold text-white tracking-wide pt-1 print:text-black">
                Ticket Nro: <span className="text-[#C8A45C] print:text-black">{rental.ticket_code}</span>
              </div>
            </div>

            {/* Meta info */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 pb-2 border-b border-neutral-800 print:border-gray-300 print:text-gray-600">
              <span>FECHA EMISIÓN: {new Date(rental.created_at).toLocaleDateString('es-PE')}</span>
              <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/30 print:border-black print:text-black">
                {rental.status}
              </span>
            </div>

            {/* Datos del Cliente */}
            <div className="space-y-1 pb-3 border-b border-dashed border-neutral-700 print:border-gray-400">
              <div className="text-[10px] font-bold text-[#C8A45C] uppercase tracking-wider print:text-black">
                --- DATOS DEL CLIENTE ---
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 print:text-gray-600">NOMBRE:</span>
                <span className="font-bold text-white text-right print:text-black">
                  {rental.client_first_name} {rental.client_last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 print:text-gray-600">DNI:</span>
                <span className="font-bold text-white print:text-black">{rental.client_dni}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 print:text-gray-600">TELÉFONO:</span>
                <span className="font-bold text-white print:text-black">{rental.client_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 print:text-gray-600">EVENTO:</span>
                <span className="font-semibold text-white print:text-black">{rental.event_name}</span>
              </div>
              {rental.destination && (
                <div className="flex justify-between">
                  <span className="text-neutral-400 print:text-gray-600">DESTINO:</span>
                  <span className="font-semibold text-white print:text-black">{rental.destination}</span>
                </div>
              )}
            </div>

            {/* Detalle de Prendas */}
            <div className="space-y-1 pb-3 border-b border-dashed border-neutral-700 print:border-gray-400">
              <div className="text-[10px] font-bold text-[#C8A45C] uppercase tracking-wider print:text-black">
                --- DETALLE DE PRENDAS ---
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 print:text-gray-600">CÓDIGO:</span>
                <span className="font-bold text-[#E6C875] print:text-black">{rental.item_code}</span>
              </div>
              <div>
                <span className="text-neutral-400 print:text-gray-600">PRENDA: </span>
                <span className="font-bold text-white print:text-black">{rental.item_name}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-neutral-400 print:text-gray-600">FECHA DEL EVENTO:</span>
                <span className="font-bold text-white print:text-black">{rental.event_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 print:text-gray-600">FECHA DE DEVOLUCIÓN:</span>
                <span className="font-bold text-white print:text-black">{rental.return_date}</span>
              </div>
            </div>

            {/* Resumen Financiero Dinámico */}
            <div className="space-y-1.5 pb-3 border-b border-dashed border-neutral-700 print:border-gray-400">
              <div className="text-[10px] font-bold text-[#C8A45C] uppercase tracking-wider print:text-black">
                --- RESUMEN FINANCIERO ---
              </div>

              {isImmediate || (rental.status === 'entregado' && !isFinalized) ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 print:text-gray-600">COSTO TOTAL DEL ALQUILER:</span>
                    <span className="font-bold text-white print:text-black">{formatSoles(totalCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 print:text-gray-600">MONTO TOTAL RECIBIDO:</span>
                    <span className="font-bold text-emerald-400 print:text-black">{formatSoles(totalCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 print:text-gray-600">SALDO PENDIENTE:</span>
                    <span className="font-bold text-white print:text-black">S/ 0.00</span>
                  </div>
                  <div className="pt-2 flex justify-between border-t border-neutral-800 print:border-gray-300">
                    <span className="text-[#E6C875] font-bold print:text-black">GARANTÍA RECIBIDA HOY:</span>
                    <span className="font-extrabold text-[#E6C875] print:text-black">{formatSoles(guaranteeCents)}</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 italic pt-1 print:text-gray-600">
                    (Este monto será reembolsado al retornar la prenda en óptimas condiciones).
                  </p>
                </div>
              ) : isFinalized ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 print:text-gray-600">COSTO ALQUILER:</span>
                    <span className="font-bold text-white print:text-black">{formatSoles(totalCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 print:text-gray-600">GARANTÍA INICIAL:</span>
                    <span className="font-bold text-white print:text-black">{formatSoles(guaranteeCents)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 print:text-black">
                    <span>GARANTÍA DEVUELTA:</span>
                    <span className="font-bold">{formatSoles(returnedGuaranteeCents)}</span>
                  </div>
                  {penaltyCents > 0 && (
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 print:bg-gray-100 print:text-black print:border-black space-y-0.5">
                      <div className="flex justify-between font-bold">
                        <span>PENALIDAD / RETENCIÓN:</span>
                        <span>{formatSoles(penaltyCents)}</span>
                      </div>
                      {rental.penalty_reason && (
                        <div className="text-[10px] text-neutral-400 print:text-gray-700">
                          Motivo: {rental.penalty_reason}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="pt-1 flex justify-between font-bold text-emerald-400 print:text-black">
                    <span>ESTADO FINAL:</span>
                    <span>ORDEN CONCLUIDA</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 print:text-gray-600">COSTO TOTAL DEL ALQUILER:</span>
                    <span className="font-bold text-white print:text-black">{formatSoles(totalCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 print:text-gray-600">ADELANTO RECIBIDO:</span>
                    <span className="font-bold text-emerald-400 print:text-black">{formatSoles(advanceCents)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-neutral-800 print:border-gray-300">
                    <span className="text-amber-400 font-bold print:text-black">SALDO PENDIENTE A CANCELAR:</span>
                    <span className="font-extrabold text-amber-400 print:text-black">{formatSoles(pendingCents)}</span>
                  </div>

                  <div className="pt-2 text-[10px] bg-amber-500/10 border border-amber-500/20 rounded p-2 text-amber-300/90 space-y-0.5 print:bg-transparent print:border-black print:text-black">
                    <div className="font-bold flex items-center gap-1 text-amber-200 print:text-black">
                      ⚠️ IMPORTANTE SOBRE LA GARANTÍA:
                    </div>
                    <div>
                      El día del recojo del vestido se deberá abonar una garantía de {formatSoles(guaranteeCents > 0 ? guaranteeCents : 5000)}, la cual será reembolsada al devolver la prenda en óptimas condiciones.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Términos y Condiciones */}
            <div className="space-y-1 text-[10px] text-neutral-400 leading-relaxed print:text-gray-600">
              <div className="font-bold text-neutral-300 uppercase print:text-black">
                --- TÉRMINOS Y CONDICIONES ---
              </div>
              <div>1. Las manchas severas, roturas o quemaduras serán descontadas del monto de la garantía.</div>
              <div>2. La demora en la devolución incurrirá en una mora diaria.</div>
            </div>

            {/* Footer Agradecimiento */}
            <div className="text-center pt-2 border-t border-neutral-800 text-xs font-serif-luxury font-bold text-white tracking-widest uppercase print:text-black print:border-gray-300">
              ¡Gracias por su preferencia!
            </div>
          </div>
        </div>

        {/* Footer Actions - Hide on print */}
        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-[#161616] flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs border border-neutral-700 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#C8A45C]" />
              <span>Imprimir Ticket</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
