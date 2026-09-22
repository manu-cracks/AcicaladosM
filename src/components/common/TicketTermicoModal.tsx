import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Booking, VentaMostrador, formatSoles, formatLimaDate } from '../../types';
import { formatCompletionTime } from '../../lib/bookingAvailability';
import { Printer, X, Scissors, CheckCircle2 } from 'lucide-react';

export const TicketTermicoModal: React.FC = () => {
  const { activeTicket, closeTicketModal } = useApp();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');

  if (!activeTicket) return null;

  const isBooking = activeTicket.type === 'booking';
  const bookingData = isBooking ? (activeTicket.data as Booking) : null;
  const ventaData = !isBooking ? (activeTicket.data as VentaMostrador) : null;

  const handlePrint = () => {
    window.print();
  };

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
                Impresión de Ticket Térmico POS
              </h3>
              <p className="text-xs text-neutral-400">
                {isBooking ? `Reserva #${bookingData?.code}` : `Venta #${ventaData?.ticket_number}`}
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
              className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Thermal Paper Preview */}
        <div className="p-6 bg-neutral-900/60 flex justify-center max-h-[70vh] overflow-y-auto">
          <div
            id="thermal-ticket-print"
            className={`bg-white text-black p-5 shadow-lg border border-neutral-300 font-mono text-xs leading-tight ${
              paperWidth === '80mm' ? 'w-[320px]' : 'w-[250px]'
            }`}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-neutral-400">
              <div className="flex items-center justify-center gap-1 font-bold text-sm tracking-wider uppercase">
                <Scissors className="w-3.5 h-3.5" />
                <span>ACICALADOS</span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-600 mt-0.5">
                SPA & BARBER SHOP
              </p>
              <p className="text-[10px] text-neutral-600 mt-1">RUC: 20608941231</p>
              <p className="text-[10px] text-neutral-600">Av. Javier Prado Este 2450, San Borja</p>
              <p className="text-[10px] text-neutral-600">Lima - Perú | Tel: +51 987 654 321</p>
            </div>

            {/* Ticket Info */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>COMPROBANTE:</span>
                <span className="font-bold">
                  {isBooking ? `TICKET CITA #${bookingData?.code}` : `TICKET POS #${ventaData?.ticket_number}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>FECHA EMISIÓN:</span>
                <span>
                  {isBooking && bookingData ? formatLimaDate(bookingData.date) : 'Hoy'} -{' '}
                  {new Date().toLocaleTimeString('es-PE', {
                    timeZone: 'America/Lima',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-semibold text-right max-w-[150px] truncate">
                  {isBooking ? bookingData?.client_name : ventaData?.client_name}
                </span>
              </div>
              {(isBooking ? bookingData?.client_dni : ventaData?.client_dni) && (
                <div className="flex justify-between">
                  <span>DNI / DOC:</span>
                  <span className="font-mono">{isBooking ? bookingData?.client_dni : ventaData?.client_dni}</span>
                </div>
              )}
              {(isBooking ? bookingData?.client_phone : ventaData?.client_phone) && (
                <div className="flex justify-between">
                  <span>TELÉFONO:</span>
                  <span className="font-mono">{isBooking ? bookingData?.client_phone : ventaData?.client_phone}</span>
                </div>
              )}
              {isBooking && bookingData?.start_time && (
                <div className="flex justify-between text-neutral-800 font-medium">
                  <span>HORA CITA:</span>
                  <span>
                    {bookingData.start_time} - {bookingData.end_time}
                  </span>
                </div>
              )}
            </div>

            {/* Items Breakdown */}
            <div className="py-2.5 border-b border-dashed border-neutral-400">
              <div className="flex justify-between font-bold text-[10px] text-neutral-700 pb-1 border-b border-neutral-300">
                <span>DESCRIPCIÓN / SERVICIO</span>
                <span>TOTAL</span>
              </div>

              <div className="mt-2 space-y-2 text-[11px]">
                {isBooking && bookingData ? (
                  bookingData.services.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.service_name}</span>
                        <span className="font-semibold">{formatSoles(item.price_cents)}</span>
                      </div>
                      <div className="text-[10px] text-neutral-600 flex justify-between">
                        <span>Esp: {item.employee_name}</span>
                        <span>{item.duration_minutes} min</span>
                      </div>
                      {item.liberado_at && (
                        <div className="text-[9px] text-emerald-800 font-semibold">
                          ✓ Concluido anticipado ({formatCompletionTime(item.liberado_at)})
                        </div>
                      )}
                    </div>
                  ))
                ) : ventaData ? (
                  ventaData.detalles_items && ventaData.detalles_items.length > 0 ? (
                    ventaData.detalles_items.map((item, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.product_name}</span>
                          <span className="font-semibold">{formatSoles(item.subtotal_cents)}</span>
                        </div>
                        <div className="text-[10px] text-neutral-600">
                          Cant: {item.quantity} × {formatSoles(item.unit_price_cents)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-medium">{ventaData.product_name}</span>
                        <span className="font-semibold">{formatSoles(ventaData.total_price_cents)}</span>
                      </div>
                      <div className="text-[10px] text-neutral-600">
                        Cant: {ventaData.quantity} × {formatSoles(ventaData.unit_price_cents)}
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2.5 space-y-1 text-[11px]">
              {isBooking && bookingData ? (
                <>
                  <div className="flex justify-between font-bold text-xs pt-1">
                    <span>TOTAL PRESUPUESTO:</span>
                    <span>{formatSoles(bookingData.total_price_cents)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>ADELANTO COBRADO:</span>
                    <span>{formatSoles(bookingData.advance_amount_cents)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-700 font-bold border-t border-neutral-300 pt-1">
                    <span>SALDO PENDIENTE:</span>
                    <span>
                      {formatSoles(
                        Math.max(0, bookingData.total_price_cents - bookingData.advance_amount_cents)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>ESTADO PAGO:</span>
                    <span className="uppercase font-bold">
                      {bookingData.payment_status === 'total'
                        ? 'PAGADO COMPLETO'
                        : bookingData.payment_status === 'parcial'
                        ? 'SALDO PENDIENTE'
                        : 'SIN PAGO'}
                    </span>
                  </div>
                </>
              ) : ventaData ? (
                <>
                  {(ventaData.discount_cents && ventaData.discount_cents > 0) || (ventaData.monto_descuento && ventaData.monto_descuento > 0) ? (
                    <>
                      <div className="flex justify-between text-neutral-700">
                        <span>SUBTOTAL:</span>
                        <span>{formatSoles(ventaData.subtotal_cents ?? Math.round((ventaData.subtotal || 0) * 100))}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 font-medium">
                        <span>DESCUENTO:</span>
                        <span>- {formatSoles(ventaData.discount_cents ?? Math.round((ventaData.monto_descuento || 0) * 100))}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                    <span>TOTAL COBRADO:</span>
                    <span>{formatSoles(ventaData.total_price_cents)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-700">
                    <span>MÉTODO DE PAGO:</span>
                    <span className="uppercase font-semibold">{ventaData.payment_method}</span>
                  </div>
                  {ventaData.payment_method?.toLowerCase() === 'mixto' && (
                    <div className="pl-2 pt-1 mt-0.5 space-y-0.5 text-[10px] text-neutral-600 border-l-2 border-neutral-300">
                      {((ventaData.monto_efectivo != null && ventaData.monto_efectivo > 0) || (ventaData.cash_cents != null && ventaData.cash_cents > 0)) && (
                        <div className="flex justify-between">
                          <span>• Efectivo:</span>
                          <span className="font-mono font-medium">{formatSoles(ventaData.cash_cents ?? Math.round((ventaData.monto_efectivo || 0) * 100))}</span>
                        </div>
                      )}
                      {((ventaData.monto_yape != null && ventaData.monto_yape > 0) || (ventaData.yape_cents != null && ventaData.yape_cents > 0)) && (
                        <div className="flex justify-between">
                          <span>• Yape:</span>
                          <span className="font-mono font-medium">{formatSoles(ventaData.yape_cents ?? Math.round((ventaData.monto_yape || 0) * 100))}</span>
                        </div>
                      )}
                      {((ventaData.monto_transferencia != null && ventaData.monto_transferencia > 0) || (ventaData.transfer_cents != null && ventaData.transfer_cents > 0)) && (
                        <div className="flex justify-between">
                          <span>• Transferencia:</span>
                          <span className="font-mono font-medium">{formatSoles(ventaData.transfer_cents ?? Math.round((ventaData.monto_transferencia || 0) * 100))}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Barcode & Footer */}
            <div className="pt-3 border-t border-dashed border-neutral-400 text-center space-y-2">
              <div className="font-mono text-[9px] tracking-widest text-neutral-500">
                ||| | ||||| ||| |||| |||| |||||| || |
              </div>
              <p className="text-[10px] font-semibold text-neutral-800">
                ¡Gracias por su preferencia!
              </p>
              <p className="text-[9px] text-neutral-600">
                Conserve este comprobante para cualquier consulta.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-[#1A1A1A]">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Listo para impresora térmica ESC/POS</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeTicketModal}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition"
            >
              Cerrar
            </button>
            <button
              id="print-ticket-btn"
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[#C8A45C] hover:bg-[#D4AF37] rounded-lg shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ticket</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
