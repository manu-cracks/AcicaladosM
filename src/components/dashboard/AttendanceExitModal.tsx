import React, { useState } from 'react';
import { Employee, EmployeeAttendance } from '../../types';
import {
  X,
  LogOut,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  UserCheck,
  FileText,
  Loader2,
} from 'lucide-react';

interface AttendanceExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  attendanceRecord: EmployeeAttendance;
  currentLimaTime: string;
  onConfirmExit: (params: {
    exitType: 'definitiva' | 'emergencia';
    exitReason?: string;
  }) => Promise<void>;
}

export const AttendanceExitModal: React.FC<AttendanceExitModalProps> = ({
  isOpen,
  onClose,
  employee,
  attendanceRecord,
  currentLimaTime,
  onConfirmExit,
}) => {
  const [exitType, setExitType] = useState<'definitiva' | 'emergencia'>('definitiva');
  const [exitReason, setExitReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (exitType === 'emergencia') {
      const trimmed = exitReason.trim();
      if (!trimmed || trimmed.length < 4) {
        setErrorMsg('Por favor especifica un motivo detallado para la salida de emergencia (mínimo 4 caracteres).');
        return;
      }
    }

    try {
      setIsSaving(true);
      await onConfirmExit({
        exitType,
        exitReason: exitType === 'emergencia' ? exitReason.trim() : undefined,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la salida. Intenta nuevamente.');
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
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-luxury text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Confirmación de Salida</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/35">
                  Marcación
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Selecciona la modalidad de salida para registrar el término de turno
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition disabled:opacity-50"
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

          {/* Time notice */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#161616] border border-neutral-800/80 text-xs">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C8A45C]" />
              <span>Hora de salida propuesta:</span>
            </span>
            <span className="font-mono font-bold text-[#E6C875] text-sm">
              {currentLimaTime}
            </span>
          </div>

          {/* Exit Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-300 block">
              Tipo de Salida:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Salida Definitiva */}
              <button
                type="button"
                onClick={() => {
                  setExitType('definitiva');
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
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
                  Cierra la jornada normal y calcula el tiempo total trabajado.
                </p>
              </button>

              {/* Option 2: Salida de Emergencia */}
              <button
                type="button"
                onClick={() => {
                  setExitType('emergencia');
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                  exitType === 'emergencia'
                    ? 'bg-rose-950/30 border-rose-500/80 text-white shadow-md'
                    : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`w-4 h-4 ${
                        exitType === 'emergencia' ? 'text-rose-400' : 'text-neutral-500'
                      }`}
                    />
                    <span className="font-bold text-xs text-white">Salida de Emergencia</span>
                  </div>
                  {exitType === 'emergencia' && (
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 leading-snug">
                  Retiro anticipado por causa médica, fuerza mayor o urgencia.
                </p>
              </button>
            </div>
          </div>

          {/* Conditional Textarea for Emergency Justification */}
          {exitType === 'emergencia' && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <label
                htmlFor="exit-reason-input"
                className="text-xs font-bold text-rose-300 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span>Motivo de la Emergencia (Obligatorio):</span>
              </label>
              <textarea
                id="exit-reason-input"
                rows={3}
                value={exitReason}
                onChange={(e) => {
                  setExitReason(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Describe el motivo de la salida anticipada (ej: cita médica imprevista, emergencia familiar, malestar)..."
                className="w-full bg-[#181818] border border-rose-500/40 focus:border-rose-400 text-white rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-rose-500/40 transition placeholder:text-neutral-500 resize-none"
                autoFocus
              />
              <span className="text-[10px] text-neutral-400 block">
                Este motivo quedará auditado en el historial de asistencia del colaborador.
              </span>
            </div>
          )}

          {/* Error notice */}
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
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg ${
                exitType === 'emergencia'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:brightness-110 shadow-rose-900/30'
                  : 'bg-gradient-to-r from-[#D4AF37] via-[#E6C875] to-[#C8A45C] text-black hover:brightness-110 shadow-[#C8A45C]/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando salida...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Confirmar {exitType === 'emergencia' ? 'Salida de Emergencia' : 'Salida Definitiva'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
