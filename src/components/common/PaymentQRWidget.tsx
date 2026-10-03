import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { generateVoucherFilename } from '../../lib/ticketPdfGenerator';
import {
  OFFICIAL_YAPE_PHONE,
  OFFICIAL_YAPE_PHONE_CLEAN,
  OFFICIAL_YAPE_HOLDER,
  OFFICIAL_YAPE_QR_URL,
} from '../../data/initialData';
import { QrCode, Copy, Check, Upload, MessageSquare, Maximize2, X, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

interface PaymentQRWidgetProps {
  amountCents: number;
  bookingCode?: string;
  clientName?: string;
  clientDni?: string;
  onVoucherUploaded?: (voucherUrl: string) => void;
  title?: string;
}

export const PaymentQRWidget: React.FC<PaymentQRWidgetProps> = ({
  amountCents,
  bookingCode = 'AC-ONLINE',
  clientName = 'Cliente',
  clientDni = '',
  onVoucherUploaded,
  title = 'Pago de Adelanto con Yape',
}) => {
  const { paymentSettings } = useApp();
  const [copied, setCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [uploadedVoucher, setUploadedVoucher] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Garantizar datos oficiales estrictos y estandarizados
  const yapePhone = paymentSettings?.yape_phone?.trim() && !paymentSettings.yape_phone.includes('987')
    ? paymentSettings.yape_phone
    : OFFICIAL_YAPE_PHONE;
  const yapeHolder = OFFICIAL_YAPE_HOLDER;
  const yapeQrUrl = OFFICIAL_YAPE_QR_URL;
  const cleanPhone = OFFICIAL_YAPE_PHONE_CLEAN;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(cleanPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor selecciona un comprobante en formato de imagen (JPG, PNG, WebP).');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileName = generateVoucherFilename(clientDni || 'invitado', file.name);
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('comprobantes')
        .upload(fileName, file, { cacheControl: '3600', contentType: file.type, upsert: false });

      if (uploadErr) {
        console.error('Error al subir comprobante a Supabase Storage:', uploadErr);
        setUploadError('No se pudo subir el comprobante. Inténtalo nuevamente.');
        return;
      }

      const { data: pubData } = supabase.storage
        .from('comprobantes')
        .getPublicUrl(uploadData.path || fileName);

      const finalUrl = pubData?.publicUrl || URL.createObjectURL(file);
      setUploadedVoucher(finalUrl);

      if (onVoucherUploaded) {
        onVoucherUploaded(finalUrl);
      }
    } catch (err: any) {
      console.error('Error en carga de comprobante:', err);
      setUploadError('Error de red al subir la imagen.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleWhatsAppConfirmation = () => {
    const text = encodeURIComponent(
      `¡Hola Acicalados! Acabo de realizar el pago para mi reserva *${bookingCode}* a nombre de *${clientName}*.\n\n*Monto abonado:* ${formatSoles(amountCents)}\n*Medio:* Yape al número ${yapePhone} (${yapeHolder})\n\nAdjunto comprobante para confirmar mi cita. ¡Muchas gracias!`
    );
    window.open(`https://wa.me/51${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6B2D82]/20 border border-[#8B3D9D]/40 flex items-center justify-center text-[#A64BC6] shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 font-semibold">
                Yape Oficial
              </span>
            </h4>
            <p className="text-xs text-neutral-400">Escanea desde tu app Yape o transfiere al número</p>
          </div>
        </div>

        <div className="text-left sm:text-right bg-neutral-900/60 p-2 sm:p-0 rounded-lg sm:bg-transparent">
          <span className="text-[11px] text-neutral-400 block">Monto a Transferir:</span>
          <span className="text-xl font-extrabold text-[#E6C875]">{formatSoles(amountCents)}</span>
        </div>
      </div>

      {/* QR Code and Instructions */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
        {/* QR Display */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center p-4 bg-[#1A1A1A] rounded-xl border border-neutral-800">
          <div
            className="relative group cursor-pointer"
            onClick={() => setIsLightboxOpen(true)}
            title="Haz clic para ampliar el QR"
          >
            <img
              src={yapeQrUrl}
              alt="Código QR Yape Oficial Acicalados"
              className="w-48 h-48 sm:w-52 sm:h-52 rounded-xl bg-white p-2.5 object-contain shadow-md transition-transform duration-200 group-hover:scale-[1.02]"
              loading="eager"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-white text-xs font-semibold gap-1">
              <Maximize2 className="w-4 h-4" />
              <span>Ampliar QR</span>
            </div>
          </div>
          <span className="text-[10px] text-neutral-400 mt-2.5 text-center flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Código QR oficial verificado</span>
          </span>
        </div>

        {/* Payment Account Details */}
        <div className="sm:col-span-7 space-y-3">
          <div className="bg-[#1C1C1C] border border-neutral-800 rounded-xl p-3.5 space-y-3">
            <div>
              <span className="text-[11px] text-neutral-400 block font-medium">Titular de la Cuenta:</span>
              <span className="text-sm font-bold text-white tracking-wide block">
                {yapeHolder}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-800 pt-2.5">
              <div>
                <span className="text-[11px] text-neutral-400 block font-medium">Número Yape Oficial:</span>
                <span className="text-base sm:text-lg font-mono font-extrabold text-[#E6C875] tracking-wider">
                  {yapePhone}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#C8A45C]" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Voucher Upload Section */}
          <div className="border border-dashed border-[#C8A45C]/30 hover:border-[#C8A45C]/60 rounded-xl p-3 text-center bg-[#181818] transition">
            <input
              type="file"
              id={`voucher-upload-${bookingCode}`}
              accept="image/*"
              onChange={handleVoucherUpload}
              disabled={isUploading}
              className="hidden"
            />
            {uploadedVoucher ? (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-left">
                  <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 block">Comprobante Adjunto</span>
                    <span className="text-[10px] text-neutral-400">Listo para validación en caja</span>
                  </div>
                </div>
                <label
                  htmlFor={`voucher-upload-${bookingCode}`}
                  className="text-xs text-[#C8A45C] hover:underline cursor-pointer"
                >
                  Cambiar
                </label>
              </div>
            ) : (
              <label
                htmlFor={`voucher-upload-${bookingCode}`}
                className="cursor-pointer block py-1"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 text-[#C8A45C] animate-spin mx-auto mb-1" />
                ) : (
                  <Upload className="w-5 h-5 text-[#C8A45C] mx-auto mb-1" />
                )}
                <span className="text-xs font-medium text-neutral-300 block">
                  {isUploading ? 'Subiendo comprobante a Supabase...' : 'Subir Comprobante / Voucher (Captura de Yape)'}
                </span>
                <span className="text-[10px] text-neutral-500">Formato JPG, PNG o WebP</span>
              </label>
            )}

            {uploadError && (
              <div className="mt-2 text-[11px] text-red-400 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Verification CTA */}
      <button
        id="confirm-booking-whatsapp-btn"
        type="button"
        onClick={handleWhatsAppConfirmation}
        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-98"
      >
        <MessageSquare className="w-4 h-4" />
        <span>Confirmar Reserva por WhatsApp con Recepción</span>
      </button>

      {/* Lightbox for QR code */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="bg-[#141414] border border-[#C8A45C]/40 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
              <h5 className="font-semibold text-white text-sm">Escanea con tu App Yape</h5>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-inner max-w-[260px] mx-auto">
              <img
                src={yapeQrUrl}
                alt="QR Grande Yape Oficial"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="space-y-1">
              <div className="text-base text-[#E6C875] font-mono font-extrabold tracking-wider">
                {yapePhone}
              </div>
              <p className="text-xs text-neutral-300 font-semibold">{yapeHolder}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyPhone}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition cursor-pointer mx-auto"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Número Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Copiar Número</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
