import React, { useState, useEffect, useMemo } from 'react';
import { Product, Employee, formatSoles } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { useApp } from '../../context/AppContext';
import {
  Boxes,
  X,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  FileText,
} from 'lucide-react';

interface ConsumoInternoModalProps {
  isOpen: boolean;
  initialProduct?: Product | null;
  products: Product[];
  employees: Employee[];
  onClose: () => void;
  onSuccess: (info: { productName: string; quantity: number; area: string }) => void;
}

const AREAS_DESTINO = [
  'Barbería (Cortes & Barba)',
  'Spa / Tratamientos Capilares',
  'Área de Tintes & Químicos',
  'Lavado & Afeitado Clásico',
  'Recepción & Sala de Espera',
  'Limpieza & Desinfección',
  'Administración',
] as const;

export const ConsumoInternoModal: React.FC<ConsumoInternoModalProps> = ({
  isOpen,
  initialProduct,
  products,
  employees,
  onClose,
  onSuccess,
}) => {
  const { pulseRealtime, currentUser, setProducts } = useApp();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [areaDestination, setAreaDestination] = useState<string>(AREAS_DESTINO[0]);
  const [responsible, setResponsible] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inicializar producto seleccionado
  useEffect(() => {
    if (initialProduct) {
      setSelectedProductId(initialProduct.id);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [initialProduct, products]);

  // Inicializar responsable por defecto si hay colaboradores
  useEffect(() => {
    if (employees.length > 0 && !responsible) {
      setResponsible(`${employees[0].first_name} ${employees[0].last_name}`);
    }
  }, [employees]);

  const currentProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const availableStock = currentProduct?.stock ?? 0;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentProduct) {
      setErrorMessage('Seleccione un producto válido');
      return;
    }

    if (quantity <= 0) {
      setErrorMessage('La cantidad consumida debe ser al menos 1 unidad.');
      return;
    }

    if (quantity > availableStock) {
      setErrorMessage(
        `Stock insuficiente. Solo hay ${availableStock} ${currentProduct.unit_measure || 'unidades'} disponibles.`
      );
      return;
    }

    if (!responsible.trim()) {
      setErrorMessage('Indique el colaborador responsable del consumo.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Invocación de la función RPC atómica en Supabase
      const { data, error } = await supabase.rpc('process_internal_consumption', {
        p_product_id: currentProduct.id,
        p_quantity: quantity,
        p_area: areaDestination,
        p_responsible: responsible.trim(),
        p_notes: notes.trim() || null,
        p_user_id: currentUser?.id || null,
      });

      if (error) {
        throw new Error(error.message || 'Error en el servidor al procesar el consumo');
      }

      // Actualizar estado local reactivo de productos
      setProducts((prev) =>
        prev.map((p) =>
          p.id === currentProduct.id
            ? { ...p, stock: Math.max(0, p.stock - quantity) }
            : p
        )
      );

      pulseRealtime();

      onSuccess({
        productName: currentProduct.name,
        quantity,
        area: areaDestination,
      });
      onClose();
    } catch (err: any) {
      console.error('Error al registrar consumo interno:', err);
      setErrorMessage(err.message || 'No se pudo registrar el consumo interno');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-luxury font-bold text-white text-base">
                Registrar Consumo Interno
              </h3>
              <p className="text-xs text-neutral-400">
                Salida de insumos para uso en estación o servicios (sin ingreso económico)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Selector de Producto */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-[#C8A45C]" /> Producto de Inventario
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-[#111111] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#C8A45C] focus:outline-none transition"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Stock: {p.stock} {p.unit_measure || 'uds.'} ({formatSoles(p.price_cents)})
                </option>
              ))}
            </select>
          </div>

          {/* Indicador de Stock Actual */}
          {currentProduct && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0D0D0D] border border-neutral-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {currentProduct.image_url ? (
                    <img
                      src={currentProduct.image_url}
                      alt={currentProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-4 h-4 text-neutral-500" />
                  )}
                </div>
                <div>
                  <span className="font-semibold text-white block">{currentProduct.name}</span>
                  <span className="text-neutral-500 text-[11px]">
                    Código: {currentProduct.barcode || 'Sin código'} • Uso: {currentProduct.use_type || 'venta'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-neutral-500 block uppercase">Disponible</span>
                <span
                  className={`font-bold text-sm ${
                    availableStock > (currentProduct.min_stock ?? 5)
                      ? 'text-emerald-400'
                      : availableStock > 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {availableStock} {currentProduct.unit_measure || 'unidades'}
                </span>
              </div>
            </div>
          )}

          {/* Área / Servicio Destino y Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#C8A45C]" /> Área / Servicio Destino
              </label>
              <select
                value={areaDestination}
                onChange={(e) => setAreaDestination(e.target.value)}
                className="w-full bg-[#111111] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#C8A45C] focus:outline-none transition"
              >
                {AREAS_DESTINO.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#C8A45C]" /> Responsable del Retiro
              </label>
              {employees.length > 0 ? (
                <select
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="w-full bg-[#111111] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#C8A45C] focus:outline-none transition"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={`${emp.first_name} ${emp.last_name}`}>
                      {emp.first_name} {emp.last_name} ({emp.type})
                    </option>
                  ))}
                  <option value="Otro">Otro / Personal Externo</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Nombre del colaborador..."
                  className="w-full bg-[#111111] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#C8A45C] focus:outline-none transition"
                />
              )}
            </div>
          </div>

          {/* Cantidad Consumida */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#C8A45C]" /> Cantidad Consumida
              </span>
              <span className="text-[11px] text-neutral-400">
                Máximo disponible: <strong>{availableStock}</strong>
              </span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={Math.max(1, availableStock)}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-32 bg-[#111111] border border-neutral-800 rounded-xl px-3 py-2 text-sm font-bold text-center text-white focus:border-[#C8A45C] focus:outline-none transition"
              />
              <span className="text-xs text-neutral-400">
                {currentProduct?.unit_measure || 'unidades'} a descontar del inventario
              </span>
            </div>
          </div>

          {/* Motivo / Notas */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-neutral-400" /> Motivo / Observaciones (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Reposición de estación de corte, preparación de tinte..."
              className="w-full bg-[#111111] border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-600 focus:border-[#C8A45C] focus:outline-none transition resize-none"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableStock <= 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] hover:bg-[#b5924d] disabled:opacity-50 disabled:cursor-not-allowed text-black shadow-lg shadow-[#C8A45C]/20 flex items-center gap-2 transition"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  Confirmar Consumo Interno
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
