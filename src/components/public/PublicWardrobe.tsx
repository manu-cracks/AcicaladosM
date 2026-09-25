import { isWardrobeReservable } from '../../lib/businessRules';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles, WardrobeItem } from '../../types';
import { Shirt, MessageSquare, Sparkles, Tag, Maximize2, MoveHorizontal, Calendar } from 'lucide-react';
import { PublicDressBookingModal } from './PublicDressBookingModal';

export const PublicWardrobe: React.FC = () => {
  // QA-010: usar paymentSettings para número de WhatsApp (fuente única)
  const { wardrobe, openLightbox, paymentSettings, whatsappNumber } = useApp();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedBookingItem, setSelectedBookingItem] = useState<WardrobeItem | null>(null);

  // Las 5 categorías de evento exactas
  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'Bodas y Matrimonio', label: 'Bodas y Matrimonio' },
    { id: 'Quinceañeras', label: 'Quinceañeras' },
    { id: 'Gala y Noche', label: 'Gala y Noche' },
    { id: 'Trajes Típicos y Costumbristas', label: 'Trajes Típicos' },
    { id: 'Casual y Sesiones de Fotos', label: 'Casual & Sesiones' },
  ];

  // Requisito 3: "filtrando únicamente las prendas marcadas como 'Activo'"
  const filtered = wardrobe.filter((item) => {
    if (item.active === false) return false;
    if (filterCategory === 'all') return true;
    return (item.category || '').toLowerCase() === filterCategory.toLowerCase();
  });

  // Dividir el arreglo de datos filtrados en dos arreglos separados (índices pares e impares)
  const row1 = filtered.filter((_, idx) => idx % 2 === 0);
  const row2 = filtered.filter((_, idx) => idx % 2 !== 0);

  const handleInquireWhatsApp = (item: WardrobeItem) => {
    const code = (item.code || 'A').toUpperCase().trim();
    const text = encodeURIComponent(
      `¡Hola Acicalados! Quisiera consultar la disponibilidad de alquiler de la prenda:\n\n*Código:* ${code}\n*Prenda:* ${item.name}\n*Categoría:* ${item.category}\n*Tarifa Alquiler:* ${formatSoles(item.rental_price_cents)}\n*Garantía Reembolsable:* ${formatSoles(item.deposit_cents)}\n\n¿Para qué fechas tienen agenda de prueba disponible?`
    );
    // QA-010: número dinámico desde paymentSettings en lugar de número hardcodeado
    const whatsappPhone = whatsappNumber;
    window.open(`https://wa.me/${whatsappPhone}?text=${text}`, '_blank');
  };

  const renderWardrobeCard = (item: WardrobeItem) => {
    const codeDisplay = (item.code || 'A').toUpperCase().trim();
    const priceFormatted = (item.rental_price_cents / 100).toFixed(2);

    return (
      <div
        key={item.id}
        className="w-[285px] sm:w-[325px] md:w-[355px] min-w-[280px] flex-shrink-0 snap-start bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/50 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between group transition duration-300 hover:shadow-2xl hover:shadow-[#C8A45C]/5 select-none"
      >
        {/* Imagen y Badges */}
        <div
          onClick={() =>
            openLightbox({
              url: item.image_url,
              title: item.name,
              description: item.description,
              category: item.category,
              code: `Código: ${codeDisplay}`,
              price: `Alquiler: S/ ${priceFormatted}`,
              metadata: item.deposit_cents ? `Garantía Reembolsable: ${formatSoles(item.deposit_cents)}` : undefined,
            })
          }
          className="relative aspect-[4/3] bg-neutral-900 overflow-hidden cursor-zoom-in group/img"
          title="Clic para ampliar imagen"
        >
          <img
            src={item.image_url}
            alt={item.name}
            draggable={false}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500 pointer-events-none"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          {/* Indicador de Zoom al Hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 pointer-events-none">
            <span className="px-3 py-1.5 rounded-xl bg-black/80 border border-[#C8A45C]/60 text-[#E6C875] text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Ver imagen</span>
            </span>
          </div>

          {/* Badge Dorado del Código Interno */}
          <div className="absolute top-3 left-3">
            <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#C8A45C] to-[#A27F38] text-black font-extrabold text-xs tracking-wider shadow-lg shadow-[#C8A45C]/30 flex items-center gap-1.5 border border-[#FFE7A8]">
              <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Código: {codeDisplay}</span>
            </div>
          </div>

          {/* Badge de Categoría del Evento */}
          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/75 text-neutral-200 border border-neutral-700/80 backdrop-blur-md shadow">
              {item.category}
            </span>
          </div>

          {/* Badge de Garantía si aplica */}
          {item.deposit_cents ? (
            <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-neutral-800 text-[10px] text-neutral-300 font-medium">
              Garantía: {formatSoles(item.deposit_cents)}
            </div>
          ) : null}

          {/* Precio Alquiler */}
          <div className="absolute bottom-3 right-3">
            <div className="px-3 py-1.5 rounded-xl bg-black/85 border border-[#C8A45C]/50 backdrop-blur-md shadow flex items-baseline gap-1">
              <span className="text-[10px] text-[#C8A45C] font-semibold">S/</span>
              <span className="text-base font-bold text-white tracking-tight">
                {priceFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h3 className="font-serif-luxury text-base font-bold text-white group-hover:text-[#E6C875] transition leading-snug">
              {item.name}
            </h3>
            <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
              {item.description || 'Prenda exclusiva confeccionada para eventos de alta distinción.'}
            </p>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-neutral-500 block">Tarifa por Evento:</span>
                <span className="text-sm font-bold text-[#E6C875]">
                  {formatSoles(item.rental_price_cents)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-neutral-500 block">Garantía Reembolsable:</span>
                <span className="text-xs font-semibold text-neutral-300">
                  {formatSoles(item.deposit_cents || 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isWardrobeReservable(item)}
                onClick={() => setSelectedBookingItem(item)}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-[#C8A45C] via-[#E2C37D] to-[#C8A45C] text-black hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#C8A45C]/15"
              >
                <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isWardrobeReservable(item) ? 'Reservar Prenda' : 'No disponible'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleInquireWhatsApp(item)}
                title="Consultar por WhatsApp"
                className="p-2.5 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all flex items-center justify-center cursor-pointer border border-neutral-700/60"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in w-full overflow-x-hidden">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-[#C8A45C] flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Galería de Trajes & Vestidos de Gala</span>
        </span>
        <h1 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-wide">
          Alquiler de Vestuario de Alta Etiqueta
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
          Smokings italianos, tuxedos a medida y vestidos de alta costura para bodas, quinceañeras, galas y sesiones fotográficas en Lima.
        </p>

        {/* Filter pills con las 5 categorías oficiales */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                filterCategory === cat.id
                  ? 'bg-[#C8A45C] text-black font-bold shadow-lg shadow-[#C8A45C]/20'
                  : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wardrobe Grid / Independent Rows */}
      {filtered.length === 0 ? (
        <div className="bg-[#121212] border border-neutral-800 rounded-3xl p-12 text-center space-y-3 max-w-md mx-auto">
          <Shirt className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">No hay prendas disponibles</h3>
          <p className="text-xs text-neutral-400">
            En este momento no tenemos prendas activas en esta categoría. Puedes consultar por otras opciones o escribirnos a recepción.
          </p>
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] text-black hover:brightness-110 cursor-pointer"
          >
            Ver Todas las Prendas
          </button>
        </div>
      ) : (
        <div className="space-y-6 w-full max-w-full">
          {/* Fila 1 - Desplazamiento Horizontal Independiente */}
          <div
            className="flex overflow-x-auto touch-pan-x gap-4 sm:gap-6 snap-x scroll-smooth scrollbar-none py-2 px-1 w-full"
            style={{
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {row1.map(renderWardrobeCard)}
          </div>

          {/* Fila 2 - Desplazamiento Horizontal Independiente */}
          {row2.length > 0 && (
            <div
              className="flex overflow-x-auto touch-pan-x gap-4 sm:gap-6 snap-x scroll-smooth scrollbar-none py-2 px-1 w-full"
              style={{
                touchAction: 'pan-x pan-y',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {row2.map(renderWardrobeCard)}
            </div>
          )}

          {/* Guía interactiva inferior */}
          <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-neutral-400">
            <MoveHorizontal className="w-3.5 h-3.5 text-[#C8A45C] animate-pulse" />
            <span>Desliza cada fila de forma independiente para explorar todo el catálogo</span>
          </div>
        </div>
      )}

      {/* Modal de Reserva Online para Clientes */}
      {selectedBookingItem && (
        <PublicDressBookingModal
          item={selectedBookingItem}
          onClose={() => setSelectedBookingItem(null)}
        />
      )}
    </div>
  );
};
