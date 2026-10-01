import React, { useState } from 'react';
import {
  ShoppingCart,
  X,
  Package,
  Printer,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Barcode as BarcodeIcon,
  Tag,
  Boxes,
} from 'lucide-react';
import { Product, formatSoles } from '../../types';
import { useApp } from '../../context/AppContext';

interface ShoppingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStockIngress: (product: Product) => void;
}

export const ShoppingListModal: React.FC<ShoppingListModalProps> = ({
  isOpen,
  onClose,
  onOpenStockIngress,
}) => {
  const { products, toggleProductShoppingList } = useApp();
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtrar productos con bandera de lista de compras activa
  const shoppingItems = products.filter((p) => Boolean(p.in_shopping_list));

  const handleRemoveFromList = async (productId: string) => {
    setIsRemovingId(productId);
    try {
      await toggleProductShoppingList(productId, false);
    } finally {
      setIsRemovingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-3xl max-w-3xl w-full p-5 sm:p-7 space-y-6 shadow-2xl relative my-6 text-white">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#E6C875]">
                <ShoppingCart className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Lista Consolidada de Compras
                </h2>
                <p className="text-xs text-neutral-400">
                  {shoppingItems.length}{' '}
                  {shoppingItems.length === 1 ? 'producto reconocido' : 'productos reconocidos'} para reabastecimiento
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {shoppingItems.length > 0 && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                title="Imprimir lista de compras"
              >
                <Printer className="w-3.5 h-3.5 text-[#C8A45C]" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notificación explicativa (Regla de Negocio Anti-Olvido) */}
        <div className="bg-[#181818] border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-neutral-300">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold text-blue-200">
              Automatización de Limpieza de Inventario
            </p>
            <p className="text-neutral-400">
              Esta lista se mantiene activa mientras los productos estén en nivel crítico. Tan pronto como ingrese nuevo stock (escaneando con el lector de código de barras o por ajuste manual) y la cantidad supere el <strong className="text-white">Stock Mínimo individual</strong> de cada ítem, <strong className="text-white">se retirará automáticamente de esta lista</strong>.
            </p>
          </div>
        </div>

        {/* Contenido de la Lista */}
        {shoppingItems.length === 0 ? (
          <div className="py-14 text-center space-y-3 bg-[#111] rounded-2xl border border-dashed border-neutral-800">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto px-4">
              <h3 className="text-sm font-bold text-white">
                No hay productos en la Lista de Compras
              </h3>
              <p className="text-xs text-neutral-400">
                Todos los productos cuentan con stock suficiente o las alertas críticas fueron reabastecidas.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {shoppingItems.map((prod) => {
              const currentStock = prod.stock ?? 0;
              const minStock = prod.min_stock ?? 5;
              const isZero = currentStock === 0;
              // Sugerencia de compra: reabastecer al menos el doble del mínimo menos el stock actual
              const suggestedPurchase = Math.max(1, minStock * 2 - currentStock);

              return (
                <div
                  key={prod.id}
                  className="bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  {/* Foto y detalles */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        className="w-12 h-12 rounded-xl object-cover border border-neutral-700 bg-neutral-900 shrink-0"
                        referrerPolicy="no-referrer"
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

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-white font-bold text-xs truncate max-w-md">
                          {prod.name}
                        </h4>
                        <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400 uppercase">
                          {prod.category}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
                        {prod.barcode && (
                          <span className="font-mono text-[10px] text-[#E6C875] bg-[#C8A45C]/10 border border-[#C8A45C]/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <BarcodeIcon className="w-2.5 h-2.5" />
                            {prod.barcode}
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          Stock actual:{' '}
                          <strong className={isZero ? 'text-rose-400 font-mono font-bold' : 'text-amber-400 font-mono font-bold'}>
                            {currentStock} {prod.unit_measure || 'un.'}
                          </strong>
                        </span>

                        <span className="text-neutral-500 font-mono">
                          (Mínimo individual: <strong>{minStock} un.</strong>)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sugerencia y Acciones Rápidas */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block tracking-wider">
                        Sugerencia
                      </span>
                      <span className="text-xs font-bold text-[#E6C875] font-mono">
                        Pedir +{suggestedPurchase} un.
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenStockIngress(prod);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#C8A45C] hover:bg-[#D4AF37] text-black text-xs font-bold transition flex items-center gap-1 shadow cursor-pointer"
                        title="Registrar ingreso de nuevo stock para este producto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Ingreso</span>
                      </button>

                      <button
                        type="button"
                        disabled={isRemovingId === prod.id}
                        onClick={() => handleRemoveFromList(prod.id)}
                        className="p-1.5 rounded-xl bg-neutral-900 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-300 border border-neutral-800 hover:border-rose-500/40 transition disabled:opacity-40 cursor-pointer"
                        title="Quitar de la lista de compras"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-neutral-400">
            Total en lista: <strong className="text-white">{shoppingItems.length} productos</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition cursor-pointer"
          >
            Cerrar Lista
          </button>
        </div>
      </div>
    </div>
  );
};
