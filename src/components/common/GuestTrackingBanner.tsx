import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, ArrowRight, X, Sparkles } from 'lucide-react';

interface GuestTrackingBannerProps {
  onOpenTracking?: (code?: string) => void;
}

export const GuestTrackingBanner: React.FC<GuestTrackingBannerProps> = ({ onOpenTracking }) => {
  const { activeView, setActiveView } = useApp();
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Verificar si hay código de reserva guardado en localStorage
  useEffect(() => {
    const checkLastBooking = () => {
      try {
        const savedCode = localStorage.getItem('acicalados_last_booking_code');
        if (savedCode && savedCode.trim()) {
          setBookingCode(savedCode.trim());
        } else {
          setBookingCode(null);
        }
      } catch {
        setBookingCode(null);
      }
    };

    checkLastBooking();
    window.addEventListener('storage', checkLastBooking);
    return () => window.removeEventListener('storage', checkLastBooking);
  }, []);

  // Solo mostrar en vistas públicas (Landing, Tienda, Vestuario, Servicios) y si no fue cerrado
  const isPublicShopOrLanding =
    activeView === '/' ||
    activeView === '/tienda' ||
    activeView === '/productos' ||
    activeView === '/vestuario' ||
    activeView === '/servicios';

  if (!bookingCode || isDismissed || !isPublicShopOrLanding) {
    return null;
  }

  const handleOpenTracking = () => {
    if (onOpenTracking) {
      onOpenTracking(bookingCode);
    } else {
      setActiveView('/rastrear');
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div
        onClick={handleOpenTracking}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleOpenTracking()}
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#181818]/95 via-[#1E1B14]/95 to-[#181818]/95 border border-[#C8A45C]/50 hover:border-[#E6C875] p-3.5 sm:p-4 shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-[1.01] hover:shadow-[#C8A45C]/10"
      >
        {/* Glow de fondo */}
        <div className="absolute -inset-x-2 -top-10 h-16 bg-[#C8A45C]/10 blur-xl pointer-events-none group-hover:bg-[#C8A45C]/20 transition" />

        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Indicador de estado animado */}
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <span className="text-sm animate-pulse">🟡</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Tienes la reserva{' '}
                  <span className="text-[#E6C875] font-mono underline decoration-[#C8A45C]/60 underline-offset-2">
                    {bookingCode}
                  </span>{' '}
                  en proceso.
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate">
                Comprobante en validación por nuestro equipo de caja.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[#E6C875] bg-[#C8A45C]/15 border border-[#C8A45C]/30 px-3 py-1.5 rounded-xl group-hover:bg-[#C8A45C] group-hover:text-black transition">
              <span>CLIC PARA VER ESTADO</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>

            <button
              type="button"
              onClick={handleDismiss}
              title="Cerrar aviso temporal"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
