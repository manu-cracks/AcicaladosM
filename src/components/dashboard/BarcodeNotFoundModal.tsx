import React from 'react';
import { AlertTriangle, Barcode, ShieldAlert, Plus, X } from 'lucide-react';

interface BarcodeNotFoundModalProps {
  isOpen: boolean;
  scannedBarcode: string;
  userRole: 'admin' | 'recepcionista' | 'cliente' | 'empleado';
  onClose: () => void;
  onRegisterNew?: (barcode: string) => void;
}

export const BarcodeNotFoundModal: React.FC<BarcodeNotFoundModalProps> = ({
  isOpen,
  scannedBarcode,
  userRole,
  onClose,
  onRegisterNew,
}) => {
  if (!isOpen) return null;

  const isAdmin = userRole === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-amber-600/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-0">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-luxury font-bold text-white text-base">
                Producto No Encontrado
              </h3>
              <p className="text-xs text-neutral-400">
                Código de barras no registrado en el inventario
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

        {/* Contenido */}
        <div className="p-6 space-y-5 text-center">
          {/* Badge del código escaneado */}
          <div className="bg-[#0D0D0D] border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium">
              <Barcode className="w-4 h-4 text-[#C8A45C]" />
              <span>Código escaneado:</span>
            </div>
            <span className="font-mono text-xl font-bold text-white tracking-widest bg-neutral-900 px-4 py-1.5 rounded-lg border border-neutral-700">
              {scannedBarcode || '---'}
            </span>
          </div>

          {/* Mensaje condicional según rol */}
          {isAdmin ? (
            <div className="space-y-2 text-left bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Alta Rápida de Producto (Modo Administrador)</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Este código de barras aún no existe en el catálogo. Como <strong>Administrador</strong>, puedes dar de alta este producto inmediatamente con este código precargado.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-left bg-rose-950/20 border border-rose-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Acceso Restringido</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed font-medium">
                Solicite apoyo del administrador para registrar este código en el sistema antes de procesar ventas o consumos.
              </p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800 bg-[#161616]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            Cerrar
          </button>

          {isAdmin && onRegisterNew && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRegisterNew(scannedBarcode);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] hover:bg-[#b5924d] text-black shadow-lg shadow-[#C8A45C]/20 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4 text-black" />
              Registrar nuevo producto
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
