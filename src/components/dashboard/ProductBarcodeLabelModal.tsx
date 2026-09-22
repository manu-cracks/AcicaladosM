import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Product, formatSoles } from '../../types';
import { X, Printer, Download, Copy, Check, Barcode as BarcodeIcon, Sparkles } from 'lucide-react';

interface ProductBarcodeLabelModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductBarcodeLabelModal: React.FC<ProductBarcodeLabelModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [labelFormat, setLabelFormat] = useState<'58mm' | '80mm'>('58mm');

  const barcodeValue = product?.barcode || (product ? `775${product.id.replace(/[^0-9]/g, '').slice(0, 10).padEnd(10, '0')}` : '');

  // Generar el código de barras y la etiqueta compuesta
  useEffect(() => {
    if (!isOpen || !product || !barcodeCanvasRef.current) return;

    try {
      // 1. Dibujar código de barras en el canvas auxiliar
      JsBarcode(barcodeCanvasRef.current, barcodeValue, {
        format: 'CODE128',
        lineColor: '#000000',
        width: labelFormat === '80mm' ? 2.2 : 1.8,
        height: 55,
        displayValue: true,
        font: 'monospace',
        fontSize: 14,
        textMargin: 4,
        background: '#ffffff',
      });

      // 2. Componer la etiqueta completa (para descarga en PNG térmico de alta resolución)
      const compCanvas = compositeCanvasRef.current;
      if (!compCanvas) return;

      const width = labelFormat === '80mm' ? 480 : 380;
      const height = 240;
      compCanvas.width = width;
      compCanvas.height = height;

      const ctx = compCanvas.getContext('2d');
      if (!ctx) return;

      // Fondo blanco puro (óptimo para cabezal térmico)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Borde sutil de corte
      ctx.strokeStyle = '#E5E5E5';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      // Cabecera del negocio
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ACICALADOS • SPA & BARBERSHOP', width / 2, 24);

      // Nombre del producto (truncado si es muy largo)
      ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
      let prodName = product.name;
      if (prodName.length > 32) prodName = prodName.slice(0, 30) + '...';
      ctx.fillText(prodName, width / 2, 44);

      // Precio y detalles
      const priceText = `PRECIO: ${formatSoles(product.price_cents)}`;
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText(priceText, width / 2, 64);

      // Dibujar imagen del código de barras centrado
      const barcodeImg = barcodeCanvasRef.current;
      const bWidth = barcodeImg.width;
      const bHeight = barcodeImg.height;
      const startX = Math.max(10, (width - bWidth) / 2);
      ctx.drawImage(barcodeImg, startX, 74, Math.min(bWidth, width - 20), bHeight);

      // Pie de etiqueta (unidad de medida y uso)
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#333333';
      const footerText = `Unidad: ${(product.unit_measure || 'unidad').toUpperCase()} | Uso: ${(product.use_type || 'venta').toUpperCase()}`;
      ctx.fillText(footerText, width / 2, height - 12);
    } catch (err) {
      console.error('Error generando etiqueta de código de barras:', err);
    }
  }, [isOpen, product, barcodeValue, labelFormat]);

  if (!isOpen || !product) return null;

  const handleDownloadPng = () => {
    if (!compositeCanvasRef.current) return;
    const dataUrl = compositeCanvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `etiqueta-${product.name.replace(/\s+/g, '-').toLowerCase()}-${barcodeValue}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handlePrint = () => {
    if (!compositeCanvasRef.current) return;
    const dataUrl = compositeCanvasRef.current.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta Térmica - ${product.name}</title>
          <style>
            @page {
              size: ${labelFormat === '80mm' ? '80mm auto' : '58mm auto'};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 4px;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
            }
            img {
              width: 100%;
              max-width: ${labelFormat === '80mm' ? '74mm' : '52mm'};
              height: auto;
              image-rendering: pixelated;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C]">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-luxury font-bold text-white text-base">
                Etiqueta Térmica con Código de Barras
              </h3>
              <p className="text-xs text-neutral-400">
                Generada en formato PNG de alta densidad para rollos térmicos
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
        <div className="p-6 space-y-6">
          {/* Selector de Ancho de Rollo */}
          <div className="flex items-center justify-between gap-4 bg-[#111111] p-3 rounded-xl border border-neutral-800 text-xs">
            <span className="text-neutral-300 font-medium">Ancho de papel térmico:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLabelFormat('58mm')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  labelFormat === '58mm'
                    ? 'bg-[#C8A45C] text-black shadow-md'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => setLabelFormat('80mm')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  labelFormat === '80mm'
                    ? 'bg-[#C8A45C] text-black shadow-md'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                80 mm
              </button>
            </div>
          </div>

          {/* Previsualización de la Etiqueta Térmica */}
          <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 flex flex-col items-center justify-center space-y-3">
            <span className="text-[11px] uppercase tracking-wider text-[#C8A45C] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Vista previa de etiqueta monocromática
            </span>

            {/* Canvas oculto para JsBarcode */}
            <canvas ref={barcodeCanvasRef} className="hidden" />

            {/* Canvas visible compuesto */}
            <div className="bg-white p-2 rounded-lg shadow-xl max-w-full overflow-hidden flex justify-center">
              <canvas
                ref={compositeCanvasRef}
                className="max-w-full h-auto rounded border border-neutral-200"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-mono text-neutral-300">Código: {barcodeValue}</span>
              <button
                type="button"
                onClick={handleCopyBarcode}
                className="p-1 hover:text-[#C8A45C] transition flex items-center gap-1 text-[11px]"
                title="Copiar código numérico"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Información del Producto */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-[#111111] p-3 rounded-xl border border-neutral-800">
            <div>
              <span className="text-neutral-500 block">Producto:</span>
              <span className="text-white font-medium truncate block">{product.name}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Precio Oficial:</span>
              <span className="text-emerald-400 font-bold">{formatSoles(product.price_cents)}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Stock Disponible:</span>
              <span className="text-white font-medium">{product.stock} {product.unit_measure || 'unidades'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Tipo de Uso:</span>
              <span className="text-[#C8A45C] font-medium uppercase">{product.use_type || 'venta'}</span>
            </div>
          </div>
        </div>

        {/* Acciones de Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800 bg-[#161616]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            Descargar PNG
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] hover:bg-[#b5924d] text-black shadow-lg shadow-[#C8A45C]/20 flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4 text-black" />
            Imprimir Etiqueta
          </button>
        </div>
      </div>
    </div>
  );
};
