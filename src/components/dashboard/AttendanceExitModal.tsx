import React, { useState } from 'react';
import { Employee, EmployeeAttendance } from '../../types';
import {
  X,
  LogOut,
  Clock,
  CheckCircle2,
  Sparkles,
  PauseCircle,
  Utensils,
  Stethoscope,
  Users,
  User,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';

interface AttendanceExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  attendanceRecord: EmployeeAttendance;
  currentLimaTime: string;
  onConfirmExit: (params: {
    exitType: 'definitiva' | 'permiso';
    exitReason?: string;
  }) => Promise<void>;
}

const QUICK_LEAVE_REASONS = [
  { id: 'Almuerzo', label: 'Almuerzo', icon: Utensils, desc: 'Refrigerio habitual' },
  { id: 'Médico', label: 'Médico', icon: Stethoscope, desc: 'Cita o consulta de salud' },
  { id: 'Familiar', label: 'Familiar', icon: Users, desc: 'Urgencia o tema familiar' },
  { id: 'Personal', label: 'Personal', icon: User, desc: 'Diligencia personal' },
  { id: 'Otros', label: 'Otros', icon: HelpCircle, desc: 'Otro motivo autorizado' },
];

export const AttendanceExitModal: React.FC<AttendanceExitModalProps> = ({
  isOpen,
  onClose,
  employee,
  attendanceRecord,
  currentLimaTime,
  onConfirmExit,
}) => {
  const [exitType, setExitType] = useState<'permiso' | 'definitiva'>('permiso');
  const [selectedReason, setSelectedReason] = useState<string>('Almuerzo');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      setIsSaving(true);
      await onConfirmExit({
        exitType,
        exitReason: exitType === 'permiso' ? selectedReason : undefined,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la salida o pausa. Intenta nuevamente.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/40 flex items-center justify-center text-[#E6C875]">
              {exitType === 'permiso' ? (
                <PauseCircle className="w-5 h-5 text-amber-400" />
              ) : (
                <LogOut className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="font-serif-luxury text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Marcación Anticipada de Turno</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/35">
                  Lector QR
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Escaneo realizado antes del horario oficial de cierre
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Employee Info Header Card */}
          <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={
                  employee.avatar ||
                  employee.avatar_url ||
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
                }
                alt={employee.full_name}
                className="w-11 h-11 rounded-xl object-cover border border-neutral-700 shadow"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="font-semibold text-white block text-sm">
                  {employee.full_name}
                </span>
                <span className="text-[11px] text-neutral-400 capitalize">
                  {employee.type} • DNI: {employee.dni || '--------'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                Entrada Registrada
              </span>
              <span className="font-mono text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>{attendanceRecord.check_in || '09:00'}</span>
              </span>
            </div>
          </div>

          {/* Time Notice */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#161616] border border-neutral-800/80 text-xs">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C8A45C]" />
              <span>Hora de marcación actual:</span>
            </span>
            <span className="font-mono font-bold text-[#E6C875] text-sm">
              {currentLimaTime}
            </span>
          </div>

          {/* Exit Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-300 block">
              Modalidad de Salida:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Salida Temporal / Permiso (Default) */}
              <button
                type="button"
                onClick={() => {
                  setExitType('permiso');
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                  exitType === 'permiso'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                    : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <PauseCircle
                      className={`w-4 h-4 ${
                        exitType === 'permiso' ? 'text-amber-400' : 'text-neutral-500'
                      }`}
                    />
                    <span className="font-bold text-xs text-white">Salida Temporal / Permiso</span>
                  </div>
                  {exitType === 'permiso' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 leading-snug">
                  Pausa la jornada sin cerrarla. El tiempo fuera se auditará y descontará de la jornada neta.
                </p>
              </button>

              {/* Option 2: Salida Definitiva Anticipada */}
              <button
                type="button"
                onClick={() => {
                  setExitType('definitiva');
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                  exitType === 'definitiva'
                    ? 'bg-[#C8A45C]/15 border-[#C8A45C] text-white shadow-md'
                    : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        exitType === 'definitiva' ? 'text-[#E6C875]' : 'text-neutral-500'
                      }`}
                    />
                    <span className="font-bold text-xs text-white">Salida Definitiva</span>
                  </div>
                  {exitType === 'definitiva' && (
                    <span className="w-2 h-2 rounded-full bg-[#E6C875]" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 leading-snug">
                  Cierra la jornada laboral de hoy de forma final. No se permitirán reingresos posteriores.
                </p>
              </button>
            </div>
          </div>

          {/* Quick Buttons for Temporary Leave Reason */}
          {exitType === 'permiso' && (
            <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
              <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>Selecciona el motivo del permiso:</span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  (Clic para seleccionar)
                </span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {QUICK_LEAVE_REASONS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedReason === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedReason(item.id)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition text-left cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-black border-amber-400 shadow-md font-bold'
                          : 'bg-[#181818] text-neutral-300 border-neutral-800 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-black/15 text-black'
                            : 'bg-neutral-900 text-amber-400 border border-neutral-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="overflow-hidden">
                        <span className="block text-xs leading-none">{item.label}</span>
                        <span
                          className={`text-[9px] block truncate mt-0.5 ${
                            isSelected ? 'text-black/75' : 'text-neutral-500'
                          }`}
                        >
                          {item.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-200/90 leading-relaxed">
                ℹ️ Al elegir <span className="font-bold underline">{selectedReason}</span>, el estado del colaborador pasará a <span className="font-bold text-white">"En Permiso"</span>. Al regresar y escanear su carnet QR, el sistema calculará automáticamente el tiempo que estuvo ausente y reactivará su turno.
              </div>
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer ${
                exitType === 'permiso'
                  ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-950/40'
                  : 'bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:from-[#DFCA8D] hover:to-[#D4AF37] text-black shadow-[#C8A45C]/20'
              }`}
            >
              {exitType === 'permiso' ? (
                <>
                  <PauseCircle className="w-4 h-4" />
                  <span>{isSaving ? 'Pausando...' : `Iniciar Pausa (${selectedReason})`}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Cerrando...' : 'Cerrar Jornada Definitivamente'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
