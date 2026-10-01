import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Clock,
  Save,
  CheckCircle2,
  Sliders,
  Sparkles,
  Info,
  Calendar,
  Sun,
  AlertCircle,
} from 'lucide-react';

interface AttendanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AttendanceSettingsModal: React.FC<AttendanceSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentRole, attendanceSettings, updateAttendanceSettings } = useApp();

  // Active sub-tab in settings modal
  const [activeTab, setActiveTab] = useState<'weekday' | 'sunday'>('weekday');

  // Lunes a Sábado
  const [entryTime, setEntryTime] = useState<string>(attendanceSettings.shift_entry_time || '09:00');
  const [exitTime, setExitTime] = useState<string>(attendanceSettings.shift_exit_time || '21:00');
  const [entryTolerance, setEntryTolerance] = useState<number>(attendanceSettings.entry_tolerance_minutes ?? 15);
  const [exitTolerance, setExitTolerance] = useState<number>(attendanceSettings.exit_tolerance_minutes ?? 15);

  // Domingos
  const [sundayEntryTime, setSundayEntryTime] = useState<string>(attendanceSettings.sunday_entry_time || '09:00');
  const [sundayExitTime, setSundayExitTime] = useState<string>(attendanceSettings.sunday_exit_time || '19:00');
  const [sundayEntryTolerance, setSundayEntryTolerance] = useState<number>(attendanceSettings.sunday_entry_tolerance_minutes ?? 15);
  const [sundayExitTolerance, setSundayExitTolerance] = useState<number>(attendanceSettings.sunday_exit_tolerance_minutes ?? 15);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setEntryTime(attendanceSettings.shift_entry_time || '09:00');
      setExitTime(attendanceSettings.shift_exit_time || '21:00');
      setEntryTolerance(attendanceSettings.entry_tolerance_minutes ?? 15);
      setExitTolerance(attendanceSettings.exit_tolerance_minutes ?? 15);

      setSundayEntryTime(attendanceSettings.sunday_entry_time || '09:00');
      setSundayExitTime(attendanceSettings.sunday_exit_time || '19:00');
      setSundayEntryTolerance(attendanceSettings.sunday_entry_tolerance_minutes ?? 15);
      setSundayExitTolerance(attendanceSettings.sunday_exit_tolerance_minutes ?? 15);

      setSaveSuccess(false);
    }
  }, [isOpen, attendanceSettings]);

  // Exclusive guard: Only admin can view or interact with this modal
  if (!isOpen || currentRole !== 'admin') {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const success = await updateAttendanceSettings({
      shift_entry_time: entryTime,
      shift_exit_time: exitTime,
      entry_tolerance_minutes: Math.max(0, Number(entryTolerance) || 0),
      exit_tolerance_minutes: Math.max(0, Number(exitTolerance) || 0),
      sunday_entry_time: sundayEntryTime,
      sunday_exit_time: sundayExitTime,
      sunday_entry_tolerance_minutes: Math.max(0, Number(sundayEntryTolerance) || 0),
      sunday_exit_tolerance_minutes: Math.max(0, Number(sundayExitTolerance) || 0),
    });

    setIsSaving(false);
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/40 flex items-center justify-center text-[#E6C875]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-luxury text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Configuración Global de Horarios y Tolerancias</span>
              </h2>
              <span className="text-[11px] text-[#C8A45C] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Parámetros Dinámicos • Lunes a Sábado y Domingos</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-neutral-800 bg-[#161616] p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('weekday')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition ${
              activeTab === 'weekday'
                ? 'bg-[#C8A45C] text-black font-bold shadow-md'
                : 'text-neutral-400 hover:text-white bg-[#181818] border border-neutral-800/80'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Bloque Lunes a Sábado</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sunday')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition ${
              activeTab === 'sunday'
                ? 'bg-amber-400 text-black font-bold shadow-md'
                : 'text-neutral-400 hover:text-white bg-[#181818] border border-neutral-800/80'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Bloque Domingos</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#C8A45C] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              El escáner QR de asistencias lee estos parámetros en tiempo real. La máquina de auto-cierre
              finaliza la jornada automáticamente al detectar escaneos a la hora oficial de salida o posterior.
            </p>
          </div>

          {/* TAB 1: LUNES A SÁBADO */}
          {activeTab === 'weekday' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
                  Jornada Semanal (Lunes a Sábado)
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Turno habitual de 6 días
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hora oficial de entrada L-S */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hora Oficial de Entrada</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-[#C8A45C]"
                  />
                  <span className="text-[10px] text-neutral-500 block">Ejemplo habitual: 09:00</span>
                </div>

                {/* Tolerancia de entrada L-S */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tolerancia de Entrada (minutos)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    required
                    value={entryTolerance}
                    onChange={(e) => setEntryTolerance(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-[#C8A45C]"
                  />
                  <span className="text-[10px] text-neutral-500 block">
                    Hasta {entryTime} + {entryTolerance} min = Puntual
                  </span>
                </div>

                {/* Hora oficial de salida L-S */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Hora Oficial de Salida</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-[#C8A45C]"
                  />
                  <span className="text-[10px] text-neutral-500 block">Ejemplo: 21:00 (09:00 PM)</span>
                </div>

                {/* Tolerancia de salida L-S */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>Tolerancia de Salida (minutos)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    required
                    value={exitTolerance}
                    onChange={(e) => setExitTolerance(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-[#C8A45C]"
                  />
                  <span className="text-[10px] text-neutral-500 block">
                    Excedente tras {exitTime} + {exitTolerance} min = Horas extra
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOMINGOS */}
          {activeTab === 'sunday' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Jornada Dominical (Domingos)
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Horario especial de fin de semana
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hora oficial de entrada Domingo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hora de Entrada Dominical</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={sundayEntryTime}
                    onChange={(e) => setSundayEntryTime(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-neutral-500 block">Ejemplo: 09:00 AM</span>
                </div>

                {/* Tolerancia de entrada Domingo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tolerancia de Entrada (minutos)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    required
                    value={sundayEntryTolerance}
                    onChange={(e) => setSundayEntryTolerance(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-neutral-500 block">
                    Hasta {sundayEntryTime} + {sundayEntryTolerance} min = Puntual
                  </span>
                </div>

                {/* Hora oficial de salida Domingo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Hora de Salida Dominical</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={sundayExitTime}
                    onChange={(e) => setSundayExitTime(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-neutral-500 block">Ejemplo: 19:00 (07:00 PM)</span>
                </div>

                {/* Tolerancia de salida Domingo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>Tolerancia de Salida (minutos)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    required
                    value={sundayExitTolerance}
                    onChange={(e) => setSundayExitTolerance(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-sm font-mono outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-neutral-500 block">
                    Excedente tras {sundayExitTime} + {sundayExitTolerance} min = Horas extra
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Feedback message */}
          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">
                ¡Parámetros globales sincronizados exitosamente con la Base de Datos!
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:from-[#DFCA8D] hover:to-[#D4AF37] text-black shadow-lg transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Todos los Parámetros'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
