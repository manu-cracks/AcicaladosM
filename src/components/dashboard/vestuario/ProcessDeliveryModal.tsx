import React, { useState } from 'react';
import { X, Package, Check, AlertCircle, DollarSign, ShieldCheck } from 'lucide-react';
import { DressRental, formatSoles } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface ProcessDeliveryModalProps {
  rental: DressRental | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProcessDeliveryModal: React.FC<ProcessDeliveryModalProps> = ({
  rental,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { confirmDressDelivery } = useApp();

  const [balanceSoles, setBalanceSoles] = useState<string>('0');
  const [guaranteeSoles, setGuaranteeSoles] = useState<string>('50');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (rental) {
      setBalanceSoles(((rental.pending_cents || 0) / 100).toFixed(0));
      setGuaranteeSoles(((rental.guarantee_cents || 5000) / 100).toFixed(0));
      setErrorMsg(null);
    }
  }, [rental]);

  if (!isOpen || !rental) return null;

  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedBalance = parseFloat(balanceSoles);
    const parsedGuarantee = parseFloat(guaranteeSoles);

    if (isNaN(parsedBalance) || parsedBalance < 0) {
      setErrorMsg('Por favor ingresa un monto válido para el saldo pendiente.');
      return;
    }

    if (isNaN(parsedGuarantee) || parsedGuarantee <= 0) {
      setErrorMsg('El cobro de la garantía es obligatorio para entregar la prenda.');
      return;
    }

    setIsProcessing(true);
    try {
      const ok = await confirmDressDelivery(
        rental.id,
        Math.round(parsedBalance * 100),
        Math.round(parsedGuarantee * 100)
      );

      if (ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg('No se pudo registrar la entrega del vestido.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la entrega.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#141414] border border-[#C8A45C]/50 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl relative my-6 text-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3.5">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8A45C] flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Recojo en Local
            </span>
            <h3 className="text-lg font-bold text-white">
              Procesar Entrega del Vestido
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

        {/* Datos de la Prenda */}
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
        </div>

        {errorMsg && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2.5 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitDelivery} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              * COBRAR SALDO PENDIENTE:
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E6C875]">
                S/
              </span>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={balanceSoles}
                onChange={(e) => setBalanceSoles(e.target.value)}
                placeholder="70"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C1C] border border-neutral-700 focus:border-[#C8A45C] rounded-xl text-xs font-bold text-white outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>* COBRAR GARANTÍA (Obligatorio para entregar):</span>
              <span className="text-[10px] text-emerald-400 font-normal">Reembolsable al retorno</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                S/
              </span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={guaranteeSoles}
                onChange={(e) => setGuaranteeSoles(e.target.value)}
                placeholder="50"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C1C] border border-neutral-700 focus:border-emerald-500 rounded-xl text-xs font-bold text-emerald-400 outline-none transition"
              />
            </div>
          </div>

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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-950/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>CONFIRMAR ENTREGA (PASA A ENTREGADO)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
