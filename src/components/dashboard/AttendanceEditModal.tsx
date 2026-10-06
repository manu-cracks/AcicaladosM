import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { EmployeeAttendance } from '../../types';
import {
  recalculateAttendanceRecord,
  formatMinutesToHours,
  parseTimeToMinutes,
} from '../../lib/attendanceUtils';
import {
  X,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Sparkles,
  Info,
  Pencil,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface AttendanceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: EmployeeAttendance | null;
}

export const AttendanceEditModal: React.FC<AttendanceEditModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  const { attendanceSettings, updateEmployeeAttendance, employees } = useApp();

  const [date, setDate] = useState<string>('');
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inicializar estado cuando se abre con un registro
  useEffect(() => {
    if (record && isOpen) {
      setDate(record.date || '');
      setCheckIn(record.check_in ? record.check_in.substring(0, 5) : '09:00');
      setCheckOut(record.check_out ? record.check_out.substring(0, 5) : '');
      setNotes(record.notes || record.justification_note || '');
      setFormError(null);
      setIsSubmitting(false);
    }
  }, [record, isOpen]);

  // Colaborador asociado al registro
  const employee = useMemo(() => {
    if (!record) return null;
    return employees.find((e) => e.id === record.employee_id) || null;
  }, [record, employees]);

  // Recálculo inteligente reactivo en tiempo real sin selector manual de estado
  const liveRecalc = useMemo(() => {
    if (!date || !checkIn) return null;
    return recalculateAttendanceRecord({
      date,
      checkIn,
      checkOut: checkOut.trim() ? checkOut.trim() : null,
      absenceMinutes: record?.absence_minutes || 0,
      settings: attendanceSettings,
    });
  }, [date, checkIn, checkOut, record, attendanceSettings]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError('La fecha del registro es obligatoria.');
      return;
    }

    if (!checkIn) {
      setFormError('La hora de entrada es obligatoria.');
      return;
    }

    // Validación opcional si hay salida
    if (checkOut.trim()) {
      const inMin = parseTimeToMinutes(checkIn);
      const outMin = parseTimeToMinutes(checkOut);
      if (outMin <= inMin) {
        setFormError('La hora de salida debe ser posterior a la hora de entrada.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const ok = await updateEmployeeAttendance(record.id, {
        date,
        check_in: checkIn,
        check_out: checkOut.trim() ? checkOut.trim() : null,
        notes: notes.trim() || undefined,
      });

      if (ok) {
        onClose();
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error al actualizar el registro de asistencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-[#181818]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-luxury text-base sm:text-lg font-bold text-white">
                  Ajuste Manual de Asistencia
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40">
                  Admin
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                {record.employee_name} • DNI: {employee?.dni || '--------'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Campo 1: Fecha del Registro */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
                <span>Fecha del Registro</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-[#181818] border border-neutral-800 text-white font-mono rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-[#C8A45C] transition"
              />
            </div>

            {/* Campo 2: Hora de Entrada */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hora de Entrada</span>
              </label>
              <input
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
                className="w-full bg-[#181818] border border-neutral-800 text-white font-mono rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-[#C8A45C] transition"
              />
              <span className="text-[10px] text-neutral-500 block">
                Formato 24h (HH:mm)
              </span>
            </div>

            {/* Campo 3: Hora de Salida */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Hora de Salida</span>
                </label>
                {checkOut && (
                  <button
                    type="button"
                    onClick={() => setCheckOut('')}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Borrar (Dejar en curso)
                  </button>
                )}
              </div>
              <input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                placeholder="--:--"
                className="w-full bg-[#181818] border border-neutral-800 text-white font-mono rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-[#C8A45C] transition"
              />
              <span className="text-[10px] text-neutral-500 block">
                {checkOut ? 'Salida registrada' : 'Opcional (Vacío si el turno sigue abierto)'}
              </span>
            </div>

            {/* Campo 4: Observaciones */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#C8A45C]" />
                <span>Observaciones del Ajuste</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Motivo del ajuste manual o justificación administrativa..."
                className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-[#C8A45C] transition resize-none placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* PANEL DE AUDITORÍA Y RECÁLCULO EN VIVO (AUTOMÁTICO) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8A45C] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Recálculo Inteligente Automático</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {liveRecalc?.shiftConfig.dayTypeLabel} ({liveRecalc?.shiftConfig.entryTime} - {liveRecalc?.shiftConfig.exitTime})
              </span>
            </div>

            {liveRecalc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. Estado Deducido Automáticamente */}
                <div className="bg-[#181818] p-3 rounded-xl border border-neutral-800/80 space-y-1">
                  <span className="text-[10px] text-neutral-400 block font-medium">
                    1. Estado Deducido por Política
                  </span>
                  {liveRecalc.status === 'presente' ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Presente (Puntual)</span>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Tardanza (+{liveRecalc.tardyMinutes} min de deuda)</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Tolerancia de {liveRecalc.shiftConfig.entryTolerance} min agotada.
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Permisos y Pausas Auditadas (Preservados) */}
                <div className="bg-[#181818] p-3 rounded-xl border border-neutral-800/80 space-y-1">
                  <span className="text-[10px] text-neutral-400 block font-medium">
                    2. Permisos / Pausas del Día
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200 font-mono font-bold text-xs inline-flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>{record.absence_minutes || 0} min</span>
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      (Deducción obligatoria)
                    </span>
                  </div>
                </div>

                {/* 3. Jornada Neta */}
                <div className="bg-[#181818] p-3 rounded-xl border border-neutral-800/80 space-y-1">
                  <span className="text-[10px] text-neutral-400 block font-medium">
                    3. Jornada Neta Trabajada
                  </span>
                  {checkOut ? (
                    <div>
                      <span className="text-white font-mono font-bold text-sm block">
                        {formatMinutesToHours(liveRecalc.workedMinutes)}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        ({liveRecalc.workedMinutes} min netos computados)
                      </span>
                    </div>
                  ) : (
                    <span className="text-emerald-400 font-medium text-xs">
                      En curso (Salida pendiente)
                    </span>
                  )}
                </div>

                {/* 4. Horas Extra o Deuda */}
                <div className="bg-[#181818] p-3 rounded-xl border border-neutral-800/80 space-y-1">
                  <span className="text-[10px] text-neutral-400 block font-medium">
                    4. Saldo Horas Extra / Deuda
                  </span>
                  {checkOut ? (
                    liveRecalc.overtimeMinutes > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg bg-[#C8A45C]/20 border border-[#C8A45C]/40 text-[#E6C875] font-bold font-mono text-xs inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>+{liveRecalc.overtimeMinutes} min a favor</span>
                      </span>
                    ) : liveRecalc.owedMinutes > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold font-mono text-xs inline-flex items-center gap-1">
                        <span>-{liveRecalc.owedMinutes} min de deuda</span>
                      </span>
                    ) : (
                      <span className="text-neutral-400 font-mono text-xs">
                        0 min (Jornada exacta)
                      </span>
                    )
                  ) : (
                    <span className="text-neutral-500 text-xs">
                      Se definirá al marcar salida
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-1.5 text-[10px] text-neutral-400 pt-1">
              <Info className="w-3.5 h-3.5 shrink-0 text-[#C8A45C] mt-0.5" />
              <span>
                El sistema deduce automáticamente el estado y la jornada cruzando contra los horarios oficiales y la política de tolerancia. No se permite manipulación manual de estado.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] hover:brightness-110 text-black shadow-lg shadow-[#C8A45C]/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando y Recalculando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Guardar y Recalcular Asistencia</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
