import { validateVoucher } from '../../lib/businessRules';
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles } from '../../types';
import { QrCode, Copy, Check, Upload, MessageSquare, Maximize2, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { qaRpc, uploadVoucher } from '../../lib/qaApi';

interface PaymentQRWidgetProps {
  amountCents: number;
  bookingId: string;
  clientPhone: string;
  bookingCode?: string;
  clientName?: string;
  onVoucherUploaded?: (voucherUrl: string) => void;
  title?: string;
}

export const PaymentQRWidget: React.FC<PaymentQRWidgetProps> = ({
  amountCents,
  bookingId,
  clientPhone,
  bookingCode = 'AC-ONLINE',
  clientName = 'Cliente',
  onVoucherUploaded,
  title = 'Pago de Adelanto con Yape',
}) => {
  const { paymentSettings, whatsappNumber } = useApp();
  const uploading = useRef(false);
  const uploadedFile = useRef<{ fingerprint: string; path: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [uploadedVoucher, setUploadedVoucher] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // QA-003: Estado de error de upload visible al usuario
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [storedStatus, setStoredStatus] = useState('');
  useEffect(() => {
    let active = true;
    qaRpc<{status?: string}>('qa_booking_voucher_status', { p_id: bookingId, p_code: bookingCode, p_phone: clientPhone }).then(data => { if (active) setStoredStatus(data.status || ''); }).catch(() => {});
    return () => { active = false; };
  }, [bookingId, bookingCode, clientPhone]);
  const handleCopyPhone = () => {
    navigator.clipboard.writeText(paymentSettings.yape_phone.replace(/\s+/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading.current) return;
    uploading.current = true;
    setIsUploading(true);
    setUploadError(null);
    setUploadedVoucher(null);
    try {
      const validation = validateVoucher(file);
      if (validation) throw new Error(validation);
      const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const fingerprint = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
      const cached = uploadedFile.current;
      const path = cached?.fingerprint === fingerprint ? cached.path : await uploadVoucher(file, 'booking', bookingId, bookingCode, clientPhone);
      uploadedFile.current = { fingerprint, path };
      await qaRpc('qa_submit_booking_voucher', { p_booking_id: bookingId, p_code: bookingCode,
        p_phone: clientPhone, p_path: path, p_amount: amountCents });
      setStoredStatus('pending');
      setUploadedVoucher(path);
      onVoucherUploaded?.(path);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo guardar el comprobante. Inténtalo nuevamente.');
    } finally { uploading.current = false; setIsUploading(false); }
  };

  const handleWhatsAppConfirmation = () => {
    const text = encodeURIComponent(
      `¡Hola Acicalados! Acabo de realizar el pago para mi reserva *${bookingCode}* a nombre de *${clientName}*.\n\n*Monto abonado:* ${formatSoles(amountCents)}\n*Medio:* Yape al número ${paymentSettings.yape_phone}\n\nAdjunto comprobante para confirmar mi cita. ¡Muchas gracias!`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${text}`, '_blank');
  };

  if (!paymentSettings.yape_phone || !paymentSettings.yape_qr_url) return <div role="status" className="rounded-xl border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">Tu reserva está registrada. Contacta a recepción para obtener los datos de pago; Yape aún no está configurado.</div>;
  if (amountCents <= 0) return <p className="text-sm text-neutral-300">No se requiere adelanto. Recepción revisará tu reserva.</p>;

  return (
    <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6B2D82]/20 border border-[#8B3D9D]/40 flex items-center justify-center text-[#A64BC6]">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 font-semibold">
                Validación manual
              </span>
            </h4>
            <p className="text-xs text-neutral-400">Escanea desde tu app Yape o transfiere al número</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-neutral-400 block">Monto a Transferir:</span>
          <span className="text-lg font-extrabold text-[#E6C875]">{formatSoles(amountCents)}</span>
        </div>
      </div>

      {/* QR Code and Instructions */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
        {/* QR Display */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center p-4 bg-[#1A1A1A] rounded-xl border border-neutral-800">
          <div className="relative group cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
            <img
              src={paymentSettings.yape_qr_url}
              alt="Código QR Yape Acicalados"
              className="w-44 h-44 rounded-lg bg-white p-2 object-contain shadow-md"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center text-white text-xs font-semibold gap-1">
              <Maximize2 className="w-4 h-4" />
              <span>Ampliar QR</span>
            </div>
          </div>
          <span className="text-[10px] text-neutral-500 mt-2 text-center flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Código verificado por Acicalados</span>
          </span>
        </div>

        {/* Payment Account Details */}
        <div className="sm:col-span-7 space-y-3">
          <div className="bg-[#1C1C1C] border border-neutral-800 rounded-xl p-3.5 space-y-2">
            <div>
              <span className="text-[11px] text-neutral-400 block">Titular de la Cuenta:</span>
              <span className="text-xs font-bold text-white">{paymentSettings.yape_holder}</span>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-800 pt-2">
              <div>
                <span className="text-[11px] text-neutral-400 block">Número Yape:</span>
                <span className="text-sm font-mono font-bold text-[#E6C875] tracking-wider">
                  {paymentSettings.yape_phone}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {storedStatus && <p role="status" className="text-sm text-amber-200">{storedStatus === 'verified' ? 'Comprobante validado por recepción.' : storedStatus === 'pending' ? 'Comprobante recibido; pendiente de validación por recepción.' : 'El comprobante anterior requiere revisión. Contacta a recepción.'}</p>}
      {/* Voucher Upload Section */}
          <div className="border border-dashed border-[#C8A45C]/30 hover:border-[#C8A45C]/60 rounded-xl p-3 text-center bg-[#181818] transition">
            <input
              type="file"
              id={`voucher-upload-${bookingCode}`}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleVoucherUpload}
              disabled={isUploading || amountCents <= 0}
              className="hidden"
            />
            {/* QA-003: Mostrar error de upload si ocurre */}
            {uploadError && (
              <div className="mb-2 p-2 rounded-lg bg-rose-950/50 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadedVoucher ? (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-left">
                  <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 block">Comprobante Guardado</span>
                    <span className="text-[10px] text-neutral-400">Guardado • Pendiente de validación por recepción</span>
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
                <Upload className="w-5 h-5 text-[#C8A45C] mx-auto mb-1" />
                <span className="text-xs font-medium text-neutral-300 block">
                  {isUploading ? 'Subiendo comprobante...' : 'Subir Comprobante / Voucher'}
                </span>
                <span className="text-[10px] text-neutral-500">JPG, PNG o WebP • Máx. 5 MB</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Verification CTA */}
      <button
        id="confirm-booking-whatsapp-btn"
        type="button"
        onClick={handleWhatsAppConfirmation}
        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
      >
        <MessageSquare className="w-4 h-4" />
        <span>Confirmar Reserva por WhatsApp con Recepción</span>
      </button>

      {/* Lightbox for QR code */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="bg-[#141414] border border-[#C8A45C]/40 p-6 rounded-2xl max-w-sm w-full text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h5 className="font-semibold text-white text-sm">Escanea con la App Yape</h5>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={paymentSettings.yape_qr_url}
              alt="QR Grande Yape"
              className="w-64 h-64 mx-auto rounded-xl bg-white p-3"
            />
            <div className="text-xs text-neutral-300 font-mono font-bold">
              {paymentSettings.yape_phone}
            </div>
            <p className="text-xs text-neutral-400">{paymentSettings.yape_holder}</p>
          </div>
        </div>
      )}
    </div>
  );
};
