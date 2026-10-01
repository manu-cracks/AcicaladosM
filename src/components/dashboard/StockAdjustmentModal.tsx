import React, { useState, useEffect } from 'react';
import {
  Package,
  X,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Barcode as BarcodeIcon,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  product,
  onClose,
  onSuccess,
}) => {
  const { adjustProductStock } = useApp();

  const [quantity, setQuantity] = useState<number>(5);
  const [reason, setReason] = useState<string>('Ingreso de mercadería / Reabastecimiento');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setQuantity(Math.max(1, (product.min_stock ?? 5) * 2 - (product.stock ?? 0)));
      setReason('Ingreso de mercadería / Reabastecimiento');
      setErrorMessage(null);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentStock = product.stock ?? 0;
  const minStock = product.min_stock ?? 5;
  const newStock = Math.max(0, currentStock + quantity);
  const willClearShoppingList = newStock > minStock && Boolean(product.in_shopping_list);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity === 0) {
      setErrorMessage('Por favor ingrese una cantidad distinta de 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await adjustProductStock(product.id, quantity, reason.trim());
      if (res.success) {
        onSuccess?.(res.message);
        onClose();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al procesar el ingreso de inventario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative my-8 text-white">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A45C] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Gestión de Existencias
            </span>
            <h2 className="text-lg font-bold text-white">
              Ingreso Rápido de Stock
            </h2>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Producto info card */}
        <div className="bg-[#191919] border border-neutral-800 rounded-2xl p-3.5 flex items-center gap-3">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-12 h-12 rounded-xl object-cover border border-neutral-700 bg-neutral-900 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 text-[#C8A45C]">
              <Package className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-0.5">
            <h4 className="text-white font-bold text-xs truncate">{product.name}</h4>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
              {product.barcode && (
                <span className="font-mono text-[#E6C875] bg-[#C8A45C]/15 px-1.5 py-0.2 rounded border border-[#C8A45C]/30 flex items-center gap-1">
                  <BarcodeIcon className="w-2.5 h-2.5" />
                  {product.barcode}
                </span>
              )}
              <span>
                Stock Actual: <strong className="text-white font-mono">{currentStock} un.</strong>
              </span>
              <span className="text-neutral-500 font-mono">
                (Mín: <strong>{minStock} un.</strong>)
              </span>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Stepper de Cantidad a ingresar */}
          <div className="space-y-1.5">
            <label className="block text-neutral-300 font-semibold tracking-wide">
              Cantidad a Ingresar al Inventario (+ Unidades)
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl bg-black/60 border border-neutral-700 p-1 flex-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-[#C8A45C] hover:text-black text-neutral-300 flex items-center justify-center transition cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setQuantity(isNaN(v) ? 1 : Math.max(1, v));
                  }}
                  className="w-full text-center bg-transparent text-white font-bold text-sm font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-[#C8A45C] hover:text-black text-neutral-300 flex items-center justify-center transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Botones rápidos */}
              <div className="flex items-center gap-1">
                {[5, 10, 20].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setQuantity(step)}
                    className="px-2.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-semibold font-mono transition cursor-pointer"
                  >
                    +{step}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Motivo o comprobante */}
          <div className="space-y-1.5">
            <label className="block text-neutral-300 font-semibold tracking-wide">
              Motivo / Referencia del Ingreso
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Factura F001-234, Reabastecimiento de proveedor..."
              className="w-full px-3.5 py-2.5 bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-white placeholder-neutral-500 outline-none transition text-xs"
            />
          </div>

          {/* Resultado proyectado */}
          <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Nuevo stock resultante:</span>
              <span className="font-bold text-emerald-400 font-mono text-sm">
                {newStock} unidades
              </span>
            </div>

            {willClearShoppingList && (
              <p className="text-[11px] text-[#E6C875] flex items-center gap-1.5 pt-1 border-t border-neutral-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Supera el mínimo individual ({minStock} un.). <strong>Se retirará automáticamente de la lista de compras.</strong>
                </span>
              </p>
            )}
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#C8A45C] hover:bg-[#D4AF37] text-black text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-[#C8A45C]/20 disabled:opacity-50 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{isSubmitting ? 'Registrando...' : 'Confirmar Ingreso'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
