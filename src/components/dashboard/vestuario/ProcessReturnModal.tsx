import React, { useState, useMemo } from 'react';
import { X, RotateCcw, AlertTriangle, Check, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { DressRental, formatSoles } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface ProcessReturnModalProps {
  rental: DressRental | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProcessReturnModal: React.FC<ProcessReturnModalProps> = ({
  rental,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { processDressReturn, currentRole } = useApp();
  const isRecepcionista = currentRole === 'recepcionista';

  const originalGuaranteeSoles = useMemo(() => {
    return rental ? rental.guarantee_cents / 100 : 0;
  }, [rental]);

  const [returnedGuaranteeSoles, setReturnedGuaranteeSoles] = useState<string>('0');
  const [penaltyReason, setPenaltyReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (rental) {
      setReturnedGuaranteeSoles((rental.guarantee_cents / 100).toFixed(0));
      setPenaltyReason('');
      setErrorMsg(null);
    }
  }, [rental]);

  if (!isOpen || !rental) return null;

  const returnedNum = parseFloat(returnedGuaranteeSoles) || 0;
  const retentionSoles = Math.max(0, originalGuaranteeSoles - returnedNum);
  const hasRetention = retentionSoles > 0;

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(returnedNum) || returnedNum < 0) {
      setErrorMsg('Por favor ingresa un monto válido para la garantía a devolver.');
      return;
    }

    if (returnedNum > originalGuaranteeSoles) {
      setErrorMsg(`El monto a devolver no puede exceder la garantía original recibida (S/ ${originalGuaranteeSoles.toFixed(0)}).`);
      return;
    }

    // Regla estricta: Si se detecta retención, el motivo es OBLIGATORIO
    if (hasRetention && !penaltyReason.trim()) {
      setErrorMsg('Se ha detectado una retención de garantía. El motivo de la penalidad es obligatorio.');
      return;
    }

    setIsProcessing(true);
    try {
      const ok = await processDressReturn(
        rental.id,
        Math.round(returnedNum * 100),
        hasRetention ? penaltyReason.trim() : undefined
      );

      if (ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg('No se pudo finalizar la orden de devolución.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la devolución.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain">
      <div className="bg-[#141414] border border-[#C8A45C]/50 rounded-2xl sm:rounded-3xl max-w-md w-full min-h-0 p-4 sm:p-6 space-y-5 shadow-2xl relative my-4 sm:my-auto text-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3.5">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8A45C] flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Retorno de Prenda
            </span>
            <h3 className="text-lg font-bold text-white">
              Devolución del Vestido y Garantía
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

        {/* Resumen */}
        <div className="bg-[#1C1C1C] border border-neutral-800 rounded-2xl p-3.5 space-y-1.5 text-xs">
          <p className="text-neutral-400">
            Orden: <span className="text-white font-mono font-bold">{rental.ticket_code}</span> | Cliente:{' '}
            <span className="text-white font-semibold">{rental.client_first_name} {rental.client_last_name}</span>
          </p>
          <p className="text-neutral-400">
            Prenda:{' '}
            <span className="text-[#E6C875] font-bold">
              {rental.item_code} - {rental.item_name}
            </span>
          </p>
          <p className="text-neutral-400">
            Garantía Original Recibida:{' '}
            <span className="text-emerald-400 font-bold">
              {formatSoles(rental.guarantee_cents)}
            </span>
          </p>
        </div>

        {errorMsg && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2.5 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitReturn} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>* GARANTÍA A DEVOLVER AL CLIENTE:</span>
              <span className="text-[10px] text-neutral-400">
                (Monto original: S/ {originalGuaranteeSoles.toFixed(0)})
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E6C875]">
                S/
              </span>
              <input
                type="number"
                min="0"
                max={originalGuaranteeSoles}
                step="1"
                required
                value={returnedGuaranteeSoles}
                onChange={(e) => setReturnedGuaranteeSoles(e.target.value)}
                placeholder={originalGuaranteeSoles.toFixed(0)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C1C] border border-neutral-700 focus:border-[#C8A45C] rounded-xl text-xs font-bold text-white outline-none transition"
              />
            </div>
            <p className="text-[10px] text-neutral-500">
              ⚠️ Nota: Modifica este monto a un valor menor si el vestido presenta daños, manchas o demoras.
            </p>
          </div>

          {/* Detección de Retención de Garantía */}
          {hasRetention && (
            <div className="space-y-2 bg-amber-950/20 border border-amber-800/40 p-3.5 rounded-2xl animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>⚠️ SISTEMA: Se ha detectado una retención de S/ {retentionSoles.toFixed(0)}.</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300 block">
                  * MOTIVO DE LA PENALIDAD (Obligatorio):
                </label>
                <textarea
                  rows={2}
                  required
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  placeholder="Ej. Quemadura en la parte inferior del vestido / Mancha severa / 1 día de mora..."
                  className="w-full px-3 py-2 bg-[#171717] border border-amber-900/60 focus:border-amber-500 rounded-xl text-xs text-white placeholder-neutral-500 outline-none resize-none transition"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-[#1C1C1C] hover:bg-[#252525] border border-neutral-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black shadow-lg shadow-[#C8A45C]/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Finalizando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>FINALIZAR ORDEN (PASA A FINALIZADO)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
