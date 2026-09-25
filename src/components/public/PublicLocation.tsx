import { useApp } from '../../context/AppContext';
import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Compass,
  Phone,
  Clock,
  Star,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Car,
  Coffee,
  Wifi,
  CreditCard,
} from 'lucide-react';

export const PublicLocation: React.FC = () => {
  const [copiedPlusCode, setCopiedPlusCode] = useState<boolean>(false);
  const [isOpenNow, setIsOpenNow] = useState<boolean>(true);

  const googleMapsEmbedUrl =
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3894.9700706224057!2d-73.8301556!3d-12.5181417!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x910d3d42e669f4f9%3A0x2aca54dcda907e97!2sSpa%20Acicalados%20Barber%20Shop!5e0!3m2!1sen!2spe!4v1788895596216!5m2!1sen!2spe';

  const googleMapsDirectUrl = 'https://maps.app.goo.gl/9ojPm9qdawhvqEYu9';

  const plusCode = 'F5J9+PX9 Pichari';
  const { whatsappNumber } = useApp();
  const whatsappDisplay = `+${whatsappNumber}`;

  // Check if open now according to Peru local time
  useEffect(() => {
    const checkOpenStatus = () => {
      const now = new Date();
      const limaTimeStr = now.toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const [h, m] = limaTimeStr.split(':').map(Number);
      const currentMinutes = h * 60 + m;

      // Lima day of week (0 = Sunday)
      const limaDayStr = now.toLocaleDateString('en-US', {
        timeZone: 'America/Lima',
        weekday: 'short',
      });
      const isSunday = limaDayStr === 'Sun';

      if (isSunday) {
        // Domingo: 09:30 - 20:00 (570 to 1200 mins)
        setIsOpenNow(currentMinutes >= 570 && currentMinutes < 1200);
      } else {
        // Lunes a Sábado: 08:30 - 21:00 (510 to 1260 mins)
        setIsOpenNow(currentMinutes >= 510 && currentMinutes < 1260);
      }
    };

    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyPlusCode = () => {
    navigator.clipboard.writeText(plusCode);
    setCopiedPlusCode(true);
    setTimeout(() => setCopiedPlusCode(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <a
          href={googleMapsDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C8A45C]/15 hover:bg-[#C8A45C]/25 border border-[#C8A45C]/35 hover:border-[#C8A45C]/70 text-[#E6C875] text-xs font-bold tracking-widest uppercase shadow-sm transition-all duration-300 hover:scale-105"
        >
          <img src="/icons/maps.svg" alt="Google Maps" className="w-4 h-4 object-contain" />
          <span>Sede Oficial & Encuéntranos</span>
        </a>
        <h1 className="font-serif-luxury text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-wide">
          Visítanos en Pichari
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Ubicados en el corazón de Pichari, a pasos de la Plaza Mayor. Disfruta de una experiencia exclusiva de cuidado personal masculino y spa.
        </p>
      </div>

      {/* Main Grid: Left Informative Card + Right Interactive Google Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Informative Establishment Card */}
        <div className="lg:col-span-5 flex flex-col space-y-5">
          <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl shadow-black/80 relative overflow-hidden flex-1 flex flex-col justify-between">
            {/* Subtle luxury glow effect in card background */}
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-[#C8A45C]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-5">
              {/* Title, Badge & Reviews */}
              <div className="space-y-3 border-b border-neutral-800 pb-5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#C8A45C]">
                    Barbería & Spa Masculino
                  </span>
                  {/* Status: Open now indicator */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isOpenNow
                        ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOpenNow ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
                      }`}
                    />
                    <span>{isOpenNow ? 'Abierto Ahora' : 'Cerrado por hoy'}</span>
                  </div>
                </div>

                <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Spa Acicalados Barber Shop
                </h2>

                {/* Rating Badge: 4.2 ★ (Google Reviews) */}
                <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-[#C8A45C]/35">
                  <div className="flex items-center gap-1 text-[#E6C875]">
                    <Star className="w-4 h-4 fill-[#E6C875] text-[#E6C875]" />
                    <span className="font-bold text-sm font-mono text-white">4.2</span>
                  </div>
                  <span className="text-neutral-500">|</span>
                  <span className="text-xs font-medium text-neutral-300">
                    Google Reviews
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                    ★ Verificado
                  </span>
                </div>
              </div>

              {/* Establishment Details */}
              <div className="space-y-4 text-xs">
                {/* Address */}
                <div className="flex items-start gap-3.5 group">
                  <a
                    href={googleMapsDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir ubicación en Google Maps"
                    className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875] flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 group-hover:border-[#C8A45C]/80 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(200,164,92,0.35)]"
                  >
                    <img src="/icons/maps.svg" alt="Google Maps" className="w-5 h-5 object-contain" />
                  </a>
                  <div className="space-y-0.5">
                    <span className="text-neutral-400 font-semibold block text-[11px] uppercase tracking-wider">
                      Dirección Oficial:
                    </span>
                    <a
                      href={googleMapsDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-white hover:text-[#E6C875] text-sm transition-colors block"
                    >
                      Av. Arriba Perú Mz. K - Lt. 9, Pichari 08850
                    </a>
                    <p className="text-neutral-400 text-xs">Cusco, Perú</p>
                  </div>
                </div>

                {/* Reference */}
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875] flex items-center justify-center shrink-0 shadow-sm">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-neutral-400 font-semibold block text-[11px] uppercase tracking-wider">
                      Punto de Referencia:
                    </span>
                    <p className="font-medium text-neutral-200">
                      Cercanías a la Plaza Mayor de Pichari
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      A solo 2 minutos caminando del parque central y zona comercial.
                    </p>
                  </div>
                </div>

                {/* Plus Code with Copy Button */}
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875] flex items-center justify-center shrink-0 shadow-sm">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <span className="text-neutral-400 font-semibold block text-[11px] uppercase tracking-wider">
                      Plus Code (Google Maps):
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-neutral-800 text-[#E6C875] font-mono text-xs font-semibold">
                        {plusCode}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyPlusCode}
                        className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-[11px] font-medium transition flex items-center gap-1"
                        title="Copiar código para búsqueda rápida en Maps"
                      >
                        {copiedPlusCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Business Hours */}
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875] flex items-center justify-center shrink-0 shadow-sm">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-neutral-400 font-semibold block text-[11px] uppercase tracking-wider">
                      Horario de Atención (America/Lima):
                    </span>
                    <p className="font-medium text-white">
                      Lunes a Sábado: <span className="font-mono text-[#E6C875]">08:30 - 21:00</span>
                    </p>
                    <p className="font-medium text-white">
                      Domingos y Feriados: <span className="font-mono text-[#E6C875]">09:30 - 20:00</span>
                    </p>
                  </div>
                </div>

                {/* Phone / WhatsApp */}
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875] flex items-center justify-center shrink-0 shadow-sm">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-neutral-400 font-semibold block text-[11px] uppercase tracking-wider">
                      Atención Rápida / Citas:
                    </span>
                    <a
                      href={`tel:${whatsappNumber}`}
                      className="font-bold text-white hover:text-[#E6C875] font-mono text-sm transition block"
                    >
                      {whatsappDisplay}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions: Prominent Navigation Button & WhatsApp */}
            <div className="pt-5 border-t border-neutral-800 space-y-2.5">
              {/* Prominent Gold Button: Cómo llegar / Abrir en Google Maps */}
              <a
                href={googleMapsDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#E6C875] to-[#C8A45C] hover:brightness-110 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-[#C8A45C]/20 transition transform active:scale-[0.98]"
              >
                <img
                  src="/icons/maps.svg"
                  alt="Google Maps"
                  className="w-5 h-5 object-contain transition-transform duration-300 group-hover:scale-115 group-hover:rotate-6"
                />
                <span>Cómo llegar / Abrir en Google Maps</span>
                <ExternalLink className="w-4 h-4 text-black/80 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>

              {/* Direct WhatsApp Quick Chat */}
              <a
                href={`https://wa.me/${whatsappNumber}?text=Hola%20Spa%20Acicalados%20Barber%20Shop,%20quisiera%20consultar%20sobre%20su%20ubicaci%C3%B3n%20y%20disponibilidad%20de%20citas`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full py-3 px-4 rounded-2xl bg-[#181818] hover:bg-neutral-800 border border-neutral-800 hover:border-emerald-600/50 text-neutral-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2.5 transition shadow"
              >
                <img
                  src="/icons/whatsApp.svg"
                  alt="WhatsApp"
                  className="w-4 h-4 object-contain transition-transform duration-300 group-hover:scale-115"
                />
                <span>Chatear por WhatsApp con Recepción</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Google Map Container */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-[#141414] border border-[#C8A45C]/35 rounded-3xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col h-full min-h-[480px] lg:min-h-[580px]">
            {/* Top Bar for Map Frame */}
            <div className="bg-[#181818] px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-neutral-300">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-semibold text-white">Mapa en Vivo • GPS Activo</span>
                <span className="hidden sm:inline font-mono text-[11px] text-neutral-500">
                  (-12.51814, -73.83016)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#E6C875] font-medium hidden sm:flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Arrastra y haz zoom en el mapa</span>
                </span>
                <a
                  href={googleMapsDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-[#C8A45C] text-neutral-300 hover:text-black border border-neutral-800 text-[11px] font-semibold transition flex items-center gap-1.5"
                >
                  <img
                    src="/icons/maps.svg"
                    alt="Maps"
                    className="w-3.5 h-3.5 object-contain transition-transform group-hover:scale-110"
                  />
                  <span>Pantalla Completa</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Embedded Google Maps Iframe */}
            <div className="relative flex-1 w-full h-full min-h-[440px] lg:min-h-[520px] bg-neutral-950">
              <iframe
                src={googleMapsEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Mapa oficial de Spa Acicalados Barber Shop en Pichari"
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Amenities & Luxury Facilities Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4">
        {/* Amenity 1: Cochera */}
        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3 shadow-md hover:border-[#C8A45C]/40 transition">
          <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 text-[#E6C875] flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-xs">Estacionamiento</h4>
            <span className="text-[11px] text-neutral-400 block">Zona segura vigilada</span>
          </div>
        </div>

        {/* Amenity 2: Bebidas de cortesía */}
        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3 shadow-md hover:border-[#C8A45C]/40 transition">
          <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 text-[#E6C875] flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-xs">Bebidas de Cortesía</h4>
            <span className="text-[11px] text-neutral-400 block">Café espresso & whisky</span>
          </div>
        </div>

        {/* Amenity 3: Wifi de alta velocidad */}
        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3 shadow-md hover:border-[#C8A45C]/40 transition">
          <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 text-[#E6C875] flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-xs">Wifi de Alta Velocidad</h4>
            <span className="text-[11px] text-neutral-400 block">Fibra óptica y lounge</span>
          </div>
        </div>

        {/* Amenity 4: Métodos de Pago */}
        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3 shadow-md hover:border-[#C8A45C]/40 transition">
          <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 text-[#E6C875] flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-xs">Medios de Pago</h4>
            <span className="text-[11px] text-neutral-400 block">Yape, Plin, Tarjeta, Cash</span>
          </div>
        </div>
      </div>
    </div>
  );
};
