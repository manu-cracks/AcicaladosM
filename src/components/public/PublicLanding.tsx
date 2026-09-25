import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles } from '../../types';
import { HeroParticleTitle } from './HeroParticleTitle';
import {
  Scissors,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Star,
  Award,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const PublicLanding: React.FC = () => {
  const { setActiveView, services, paymentSettings } = useApp();

  const featuredBarberia = services.filter((s) => s.category === 'barberia').slice(0, 3);
  const featuredSpa = services.filter((s) => s.category === 'spa').slice(0, 3);

  const testimonials = [
    {
      name: 'Dr. Alejandro Belmont',
      role: 'Cliente Frecuente',
      text: 'El servicio es impecable. El ritual de barba con toalla caliente y el café de cortesía hacen que cada visita sea una verdadera pausa de relajación en Lima.',
      rating: 5,
    },
    {
      name: 'Mariana Pardo & Esposo',
      role: 'Paquete de Novios',
      text: 'Contratamos el paquete para nuestro matrimonio civil. La atención de Valeria en el spa y Carlos en la barbería fue extraordinaria. Salimos como reyes.',
      rating: 5,
    },
    {
      name: 'Gonzalo Riva-Agüero',
      role: 'Empresario',
      text: 'Puntualidad suiza y técnica de degradado superior. Además, el sistema de reserva online te garantiza el sillón sin esperas incómodas.',
      rating: 5,
    },
    {
      name: 'Carlos Mendoza',
      role: 'Cliente Premium',
      text: 'El tratamiento facial y la limpieza de cutis superaron mis expectativas. Un ambiente exclusivo y profesionales de primer nivel.',
      rating: 5,
    },
    {
      name: 'Fernando Vargas',
      role: 'Abogado',
      text: 'Mi lugar de confianza para cortes de estilo clásico. La atención al detalle es insuperable y el trato siempre es impecable.',
      rating: 5,
    },
  ];

  return (
    <div className="space-y-16 pb-20 w-full max-w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8 py-20 bg-gradient-to-b from-black/40 via-transparent to-black/60 border-b border-[#C8A45C]/15">
        {/* Subtle Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#C8A45C]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181611] border border-[#C8A45C]/35 text-xs text-[#E6C875] font-medium shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#C8A45C]" />
            <span>Experiencia de Cuidado Personal & Estilo en Pichari</span>
          </div>

          <HeroParticleTitle />

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-neutral-400 font-normal leading-relaxed">
            Un santuario exclusivo donde se fusionan las técnicas clásicas del afeitado a navaja,
            la maestría en cortes masculinos modernos y terapias de relajación profunda de spa.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              id="hero-reservar-cta"
              onClick={() => setActiveView('/reservar')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:from-[#DFCA8D] hover:to-[#D4AF37] text-black shadow-lg hover:shadow-[#C8A45C]/20 transition flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Reservar Mi Cita Online</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => setActiveView('/servicios')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-medium text-sm bg-[#161616] hover:bg-[#1E1E1E] text-neutral-200 border border-[#C8A45C]/30 transition flex items-center justify-center gap-2"
            >
              <span>Explorar Carta de Servicios</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-10 border-t border-neutral-800/80 max-w-3xl mx-auto text-left">
            <div className="p-3 bg-[#121212] rounded-xl border border-neutral-800">
              <span className="block font-serif-luxury text-xl font-bold text-[#E6C875]">4.9 / 5</span>
              <span className="text-[11px] text-neutral-400">Calificación Google</span>
            </div>
            <div className="p-3 bg-[#121212] rounded-xl border border-neutral-800">
              <span className="block font-serif-luxury text-xl font-bold text-[#E6C875]">+8,500</span>
              <span className="text-[11px] text-neutral-400">Atenciones Realizadas</span>
            </div>
            <div className="p-3 bg-[#121212] rounded-xl border border-neutral-800">
              <span className="block font-serif-luxury text-xl font-bold text-[#E6C875]">100%</span>
              <span className="text-[11px] text-neutral-400">Especialistas Certificados</span>
            </div>
            <div className="p-3 bg-[#121212] rounded-xl border border-neutral-800">
              <span className="block font-serif-luxury text-xl font-bold text-[#E6C875]">{paymentSettings.advance_percentage}%</span>
              <span className="text-[11px] text-neutral-400">Garantía de Adelanto</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Services Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#C8A45C]">
            Servicios Insignia
          </span>
          <h2 className="font-serif-luxury text-3xl font-bold text-white">
            Nuestras Dos Especialidades
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Diseñadas tanto para caballeros como damas que buscan excelencia estética y relajación absoluta.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Barbería Card Block */}
          <div className="bg-[#121212] border border-[#C8A45C]/25 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C]">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-luxury text-lg font-bold text-white">Barbería de Élite</h3>
                  <p className="text-xs text-neutral-400">Tradición navajera y degradados de precisión</p>
                </div>
              </div>
              <button
                onClick={() => setActiveView('/servicios')}
                className="text-xs text-[#C8A45C] hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {featuredBarberia.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/40 transition group"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#E6C875] transition">
                      {item.name}
                    </h4>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#C8A45C]" />
                      <span>{item.duration_minutes} min</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#E6C875] block">
                      {formatSoles(item.price_cents)}
                    </span>
                    <button
                      onClick={() => setActiveView('/reservar')}
                      className="text-[10px] text-[#C8A45C] hover:underline font-semibold"
                    >
                      Reservar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spa Card Block */}
          <div className="bg-[#121212] border border-[#C8A45C]/25 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-luxury text-lg font-bold text-white">Spa & Bienestar</h3>
                  <p className="text-xs text-neutral-400">Masajes descontracturantes y estética facial</p>
                </div>
              </div>
              <button
                onClick={() => setActiveView('/servicios')}
                className="text-xs text-[#C8A45C] hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {featuredSpa.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/40 transition group"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#E6C875] transition">
                      {item.name}
                    </h4>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#C8A45C]" />
                      <span>{item.duration_minutes} min</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#E6C875] block">
                      {formatSoles(item.price_cents)}
                    </span>
                    <button
                      onClick={() => setActiveView('/reservar')}
                      className="text-[10px] text-[#C8A45C] hover:underline font-semibold"
                    >
                      Reservar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 overflow-hidden">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#C8A45C]">
            Experiencias Reales
          </span>
          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white">
            Lo Que Dicen Quienes Nos Visitan
          </h2>
        </div>

        {/* Viewport del Marquee con máscara lateral y contención estricta */}
        <div className="relative w-full overflow-hidden marquee-mask py-4">
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused]">
            {/* Grupo 1: 5 Testimonios originales */}
            <div className="flex gap-6 pr-6">
              {testimonials.map((t, i) => (
                <div
                  key={`orig-${i}`}
                  className="w-[320px] sm:w-[360px] flex-shrink-0 bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/30 rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/70"
                >
                  <div className="space-y-3">
                    <div className="flex gap-1 text-[#C8A45C]">
                      {[...Array(t.rating)].map((_, rIdx) => (
                        <Star key={rIdx} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <p className="text-xs text-neutral-300 italic leading-relaxed">
                      "{t.text}"
                    </p>
                  </div>
                  <div className="pt-3 border-t border-neutral-800/80">
                    <h4 className="text-xs font-bold text-white">{t.name}</h4>
                    <span className="text-[10px] text-neutral-500">{t.role}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Grupo 2: 5 Testimonios duplicados para bucle continuo */}
            <div className="flex gap-6 pr-6" aria-hidden="true">
              {testimonials.map((t, i) => (
                <div
                  key={`dup-${i}`}
                  className="w-[320px] sm:w-[360px] flex-shrink-0 bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/30 rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/70"
                >
                  <div className="space-y-3">
                    <div className="flex gap-1 text-[#C8A45C]">
                      {[...Array(t.rating)].map((_, rIdx) => (
                        <Star key={rIdx} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <p className="text-xs text-neutral-300 italic leading-relaxed">
                      "{t.text}"
                    </p>
                  </div>
                  <div className="pt-3 border-t border-neutral-800/80">
                    <h4 className="text-xs font-bold text-white">{t.name}</h4>
                    <span className="text-[10px] text-neutral-500">{t.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location & Schedules Info Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#171510] via-[#1A1813] to-[#171510] border border-[#C8A45C]/30 rounded-2xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#E6C875] font-semibold">
              <MapPin className="w-4 h-4" />
              <span>Pichari, Cusco - Zona Horaria America/Lima</span>
            </span>
            <h3 className="font-serif-luxury text-2xl font-bold text-white">
              Horario Continuado de Lunes a Domingo
            </h3>
            <p className="text-xs text-neutral-400 max-w-xl">
              Lunes a Sábado: 08:30 a 21:00 hrs. Domingos: 09:30 a 20:00 hrs. Estacionamiento privado vigilado para clientes.
            </p>
          </div>

          <button
            onClick={() => setActiveView('/ubicacion')}
            className="px-6 py-3 rounded-xl font-semibold text-xs bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow transition whitespace-nowrap"
          >
            Cómo Llegar & Contacto
          </button>
        </div>
      </section>
    </div>
  );
};
