import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DressRental, WardrobeItem } from '../../../types';

interface DressAvailabilityCalendarProps {
  itemCode?: string;
  wardrobeItemId?: string;
  itemName?: string;
  items?: WardrobeItem[];
  selectedDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  onSelectDates: (eventDate: string, returnDate: string) => void;
  dressRentals: DressRental[];
}

export const DressAvailabilityCalendar: React.FC<DressAvailabilityCalendarProps> = ({
  itemCode = '',
  wardrobeItemId,
  itemName = 'Prenda seleccionada',
  items,
  selectedDate,
  returnDate,
  onSelectDates,
  dressRentals,
}) => {
  // Fecha actual de referencia
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

  // Mes visible en el calendario
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date();
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // Nombres de meses en español
  const monthNames = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
  ];

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  // Calcular las fechas ocupadas/bloqueadas (Soporta Prenda Única o Pack de Múltiples Prendas)
  const { blockedDatesSet, blockedRangesText, blockedByItemMap } = useMemo(() => {
    const set = new Set<string>();
    const textList: string[] = [];
    const dateItemMap = new Map<string, string[]>();

    // Lista de prendas a evaluar
    const itemsToEvaluate: { id?: string; code: string }[] = [];
    if (items && items.length > 0) {
      items.forEach((it) => {
        const c = (it.code || it.codigo_unico || '').toUpperCase().trim();
        if (c || it.id) itemsToEvaluate.push({ id: it.id, code: c });
      });
    } else if (itemCode || wardrobeItemId) {
      itemsToEvaluate.push({ id: wardrobeItemId, code: (itemCode || '').toUpperCase().trim() });
    }

    if (itemsToEvaluate.length === 0) {
      return { blockedDatesSet: set, blockedRangesText: textList, blockedByItemMap: dateItemMap };
    }

    itemsToEvaluate.forEach((target) => {
      const activeRentals = dressRentals.filter((r) => {
        const isStatusActive = r.status === 'por_validar' || r.status === 'reservado' || r.status === 'entregado';
        if (!isStatusActive) return false;

        const matchesId =
          (target.id && r.wardrobe_item_id && r.wardrobe_item_id === target.id) ||
          (target.id && r.pack_item_ids && r.pack_item_ids.includes(target.id));

        const rCode = (r.item_code || '').toUpperCase().trim();
        const matchesCode = Boolean(target.code) && (rCode === target.code || rCode.includes(target.code));

        return matchesId || matchesCode;
      });

      activeRentals.forEach((rental) => {
        const start = new Date(rental.event_date + 'T00:00:00');
        // Toda reserva bloquea exactamente 2 días: día del evento y retorno al día siguiente
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const curr = new Date(start);
        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          set.add(dStr);
          const existing = dateItemMap.get(dStr) || [];
          if (target.code && !existing.includes(target.code)) {
            existing.push(target.code);
          }
          dateItemMap.set(dStr, existing);
          curr.setDate(curr.getDate() + 1);
        }

        const startDay = start.getDate();
        const endDay = end.getDate();
        const startMonth = monthNames[start.getMonth()].toLowerCase();
        const endMonth = monthNames[end.getMonth()].toLowerCase();
        const prefix = items && items.length > 0 ? `[${target.code}] ` : '';
        if (startMonth === endMonth) {
          textList.push(`${prefix}${startDay} al ${endDay} de ${startMonth}`);
        } else {
          textList.push(`${prefix}${startDay} de ${startMonth} al ${endDay} de ${endMonth}`);
        }
      });
    });

    const uniqueTextList = Array.from(new Set(textList));
    return { blockedDatesSet: set, blockedRangesText: uniqueTextList, blockedByItemMap: dateItemMap };
  }, [itemCode, wardrobeItemId, items, dressRentals]);

  // Generación de la grilla de días (Lunes a Domingo)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes = 0

  const daysGrid = useMemo(() => {
    const grid: { dayNum: number | null; dateStr: string; isPast: boolean; isBlocked: boolean }[] = [];

    // Celdas vacías previas
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push({ dayNum: null, dateStr: '', isPast: true, isBlocked: false });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const dayFormatted = String(d).padStart(2, '0');
      const monthFormatted = String(month + 1).padStart(2, '0');
      const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;
      const isPast = dateStr < todayStr;
      const isBlocked = blockedDatesSet.has(dateStr);

      grid.push({
        dayNum: d,
        dateStr,
        isPast,
        isBlocked,
      });
    }

    return grid;
  }, [year, month, daysInMonth, firstDayIndex, todayStr, blockedDatesSet]);

  const handleSelectDay = (dateStr: string) => {
    if (!dateStr || dateStr < todayStr || blockedDatesSet.has(dateStr)) return;

    // Calcular automáticamente fecha de devolución (+ 1 día, total 2 días de reserva)
    const eventD = new Date(dateStr + 'T00:00:00');
    const returnD = new Date(eventD);
    returnD.setDate(returnD.getDate() + 1);
    const returnStr = returnD.toISOString().split('T')[0];

    onSelectDates(dateStr, returnStr);
  };

  const isCurrentSelectionConflict = useMemo(() => {
    if (!selectedDate || !returnDate) return false;
    const start = new Date(selectedDate + 'T00:00:00');
    const end = new Date(returnDate + 'T00:00:00');
    const curr = new Date(start);
    while (curr <= end) {
      if (blockedDatesSet.has(curr.toISOString().split('T')[0])) {
        return true;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return false;
  }, [selectedDate, returnDate, blockedDatesSet]);

  return (
    <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header del Calendario */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/10 border border-[#C8A45C]/30 flex items-center justify-center text-[#E6C875]">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide uppercase">
              Calendario de Disponibilidad
            </h4>
            <p className="text-[11px] text-[#C8A45C]">
              {items && items.length > 0 ? (
                <>
                  Pack ({items.length} prendas):{' '}
                  <span className="font-bold">
                    {items.map((i) => i.code || i.codigo_unico).join(', ')}
                  </span>
                </>
              ) : (
                <>
                  Prenda seleccionada: <span className="font-bold">{itemCode || 'Ninguna'}</span> - {itemName}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Controles de Navegación del Mes */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-200">
            {monthNames[month]} {year}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Encabezado de Días de la Semana */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map((day) => (
          <div key={day} className="text-[10px] font-bold text-neutral-400 py-1 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Grilla de Días del Mes */}
      <div className="grid grid-cols-7 gap-1.5">
        {daysGrid.map((cell, idx) => {
          if (!cell.dayNum) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-10 sm:h-11 rounded-xl bg-neutral-900/30 border border-transparent flex items-center justify-center text-neutral-700 text-xs select-none"
              >
                ---
              </div>
            );
          }

          if (cell.isPast) {
            return (
              <div
                key={cell.dateStr}
                className="h-10 sm:h-11 rounded-xl bg-neutral-900/40 border border-neutral-900 flex items-center justify-center text-neutral-600 text-xs select-none"
                title="Fecha pasada (no disponible)"
              >
                ---
              </div>
            );
          }

          if (cell.isBlocked) {
            const blockedItems = blockedByItemMap.get(cell.dateStr);
            const blockedTooltip =
              blockedItems && blockedItems.length > 0
                ? `Bloqueado: La(s) prenda(s) [${blockedItems.join(', ')}] ya está(n) reservada(s) en esta fecha`
                : `Bloqueado: La prenda ${itemCode} ya está reservada en esta fecha`;

            return (
              <div
                key={cell.dateStr}
                className="h-10 sm:h-11 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 font-bold text-xs flex flex-col items-center justify-center select-none shadow-sm cursor-not-allowed group relative"
                title={blockedTooltip}
              >
                <span className="text-[10px] text-rose-400">XX</span>
                <span className="text-[11px]">{cell.dayNum}</span>
              </div>
            );
          }

          const isEventDate = cell.dateStr === selectedDate;
          const isReturnDate = cell.dateStr === returnDate;
          const isInRange = selectedDate && returnDate && cell.dateStr > selectedDate && cell.dateStr < returnDate;

          let btnClass = 'bg-[#181818] border-neutral-800 text-neutral-200 hover:border-[#C8A45C] hover:text-white';
          if (isEventDate) {
            btnClass = 'bg-[#C8A45C] border-[#FFE7A8] text-black font-extrabold shadow-md shadow-[#C8A45C]/30';
          } else if (isReturnDate) {
            btnClass = 'bg-amber-600/80 border-amber-400 text-white font-bold shadow-md';
          } else if (isInRange) {
            btnClass = 'bg-[#C8A45C]/20 border-[#C8A45C]/40 text-[#E6C875]';
          }

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => handleSelectDay(cell.dateStr)}
              className={`h-10 sm:h-11 rounded-xl border flex flex-col items-center justify-center text-xs transition-all cursor-pointer select-none ${btnClass}`}
              title={isEventDate ? 'Fecha del Evento' : isReturnDate ? 'Fecha de Devolución' : `Disponible: ${cell.dateStr}`}
            >
              <span className="font-semibold">{cell.dayNum}</span>
              {isEventDate && <span className="text-[8px] uppercase tracking-tighter">Evento</span>}
              {isReturnDate && <span className="text-[8px] uppercase tracking-tighter">Retorno</span>}
            </button>
          );
        })}
      </div>

      {/* Leyenda de Colores */}
      <div className="bg-[#101010] border border-neutral-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500 font-mono">---</span>
          <span className="text-neutral-400">Gris (Pasado)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-[#181818] border border-emerald-500/60 inline-block" />
          <span className="text-neutral-300">Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-rose-950 border border-rose-700 text-rose-300 font-bold text-[8px] flex items-center justify-center">
            XX
          </span>
          <span className="text-rose-400 font-semibold">Ocupado / Reservado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-[#C8A45C] inline-block" />
          <span className="text-[#E6C875] font-semibold">Evento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-600/80 inline-block" />
          <span className="text-amber-300 font-semibold">Retorno (+1 día)</span>
        </div>
      </div>

      {/* Alerta del Sistema si hay conflicto o fechas restringidas */}
      {blockedRangesText.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-3 text-xs flex items-start gap-2.5 text-rose-300">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-rose-300">⚠️ Notificación del Sistema: Fechas restringidas</p>
            <p className="text-[11px] text-neutral-400">
              El vestido <span className="text-white font-semibold">{itemCode}</span> ya se encuentra reservado en:{' '}
              <span className="text-rose-300 font-medium">{blockedRangesText.join(', ')}</span>. Por favor selecciona una fecha disponible.
            </p>
          </div>
        </div>
      )}

      {/* Resumen de Fechas Seleccionadas */}
      <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Fecha del Evento:</span>
            <span className="font-bold text-[#E6C875]">{selectedDate || 'No seleccionada'}</span>
          </div>
          <div className="text-neutral-600">➔</div>
          <div>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Fecha de Devolución (+1 día):</span>
            <span className="font-bold text-amber-300">{returnDate || 'No calculada'}</span>
          </div>
        </div>

        {selectedDate && !isCurrentSelectionConflict ? (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Fecha Confirmada</span>
          </div>
        ) : isCurrentSelectionConflict ? (
          <div className="px-3 py-1.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Conflicto con fechas ocupadas</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
