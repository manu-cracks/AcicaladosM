import { voucherPreview } from '../../../lib/qaApi';
import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, Eye, ShieldAlert, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { DressRental, formatSoles } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface ValidateVoucherModalProps {
  rental: DressRental | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ValidateVoucherModal: React.FC<ValidateVoucherModalProps> = ({
  rental,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { validateYapeVoucher, currentRole, openLightbox } = useApp();
  const isRecepcionista = currentRole === 'recepcionista';

  const [showRejectField, setShowRejectField] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [preview, setPreview] = useState('');
  useEffect(() => {
    let active = true;
    setPreview('');
    if (isOpen && rental?.voucher_url) voucherPreview(rental.voucher_url).then(url => { if (active) setPreview(url); }).catch(() => { if (active) setErrorMessage('No se pudo abrir el comprobante.'); });
    return () => { active = false; };
  }, [isOpen, rental?.voucher_url]);
  if (!isOpen || !rental) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const ok = await validateYapeVoucher(rental.id, true);
      if (ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage('No se pudo aprobar la reserva.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al aprobar la reserva.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isRecepcionista && !rejectReason.trim()) {
      setErrorMessage('El motivo del rechazo es obligatorio para Recepción para fines de auditoría.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const ok = await validateYapeVoucher(rental.id, false, rejectReason.trim() || 'Comprobante no válido');
      if (ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage('No se pudo rechazar la reserva.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al rechazar el pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
      <div className="bg-[#141414] border border-[#C8A45C]/50 rounded-2xl sm:rounded-3xl max-w-lg w-full min-h-0 p-4 sm:p-6 space-y-5 shadow-2xl relative my-4 sm:my-auto text-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3.5">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8A45C] flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Validación de Comprobante Yape
            </span>
            <h3 className="text-lg font-bold text-white">
              Orden Web: {rental.ticket_code}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumen del Cliente y Prenda */}
        <div className="bg-[#1B1B1B] border border-neutral-800 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Cliente:</span>
            <span className="text-white font-bold">{rental.client_first_name} {rental.client_last_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Prenda:</span>
            <span className="text-[#E6C875] font-semibold">{rental.item_code} - {rental.item_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Fecha del Evento:</span>
            <span className="text-neutral-200 font-medium">{rental.event_date} (Devolución: {rental.return_date})</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
            <span className="text-neutral-400 font-semibold">Monto Declarado por el Cliente:</span>
            <span className="text-emerald-400 font-bold text-sm">
              {formatSoles(rental.voucher_declared_amount_cents || rental.advance_cents)}
            </span>
          </div>
        </div>

        {/* Voucher Adjunto */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-neutral-300 block">
            Voucher Adjunto (Captura de Yape):
          </label>
          {rental.voucher_url ? (
            <div
              onClick={() =>
                openLightbox({
                  url: preview,
                  title: `Voucher Yape - ${rental.ticket_code}`,
                  description: `Cliente: ${rental.client_first_name} ${rental.client_last_name} | Monto: ${formatSoles(rental.voucher_declared_amount_cents || rental.advance_cents)}`,
                })
              }
              className="relative aspect-video rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden cursor-zoom-in group shadow-md"
            >
              <img
                src={preview || undefined}
                alt="Comprobante Yape"
                className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <span className="px-3 py-1.5 rounded-xl bg-black/80 text-[#E6C875] text-xs font-bold border border-[#C8A45C]/40">
                  🔍 Clic para ampliar voucher
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-neutral-900/60 border border-dashed border-neutral-800 rounded-2xl text-xs text-neutral-500">
              No se adjuntó imagen de voucher en esta orden.
            </div>
          )}
        </div>

        {/* Campo de Motivo de Rechazo (si se desplegó) */}
        {showRejectField && (
          <div className="space-y-1.5 animate-in fade-in duration-200 bg-rose-950/20 border border-rose-900/50 p-3.5 rounded-2xl">
            <label className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Motivo del Rechazo {isRecepcionista ? '(Obligatorio para Recepción):' : '(Opcional):'}
            </label>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej. Foto borrosa, no coincide con el número o dinero no recibido en cuenta..."
              className="w-full px-3 py-2 bg-[#1A1A1A] border border-rose-900/60 focus:border-rose-500 rounded-xl text-xs text-white placeholder-neutral-500 outline-none resize-none transition"
            />
          </div>
        )}

        {errorMessage && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2.5 rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Pregunta y Botones de Acción */}
        <div className="pt-2 border-t border-neutral-800 space-y-3">
          <p className="text-xs text-center text-neutral-300 font-medium">
            ¿El pago ingresó correctamente a la cuenta bancaria de Yape?
          </p>

          <div className="flex items-center gap-2.5">
            {!showRejectField ? (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowRejectField(true)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-950/40 hover:bg-rose-950/80 border border-rose-800/80 text-rose-300 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>❌ RECHAZAR PAGO</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleReject}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50"
              >
                <span>CONFIRMAR RECHAZO</span>
              </button>
            )}

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleApprove}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>✅ APROBAR RESERVA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
