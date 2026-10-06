import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EmployeeAttendance } from '../../types';
import {
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  Calendar,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';

interface AttendanceDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: EmployeeAttendance | null;
}

export const AttendanceDeleteModal: React.FC<AttendanceDeleteModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  const { deleteEmployeeAttendance } = useApp();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setErrorMsg(null);
      const ok = await deleteEmployeeAttendance(record.id);
      if (ok) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al eliminar el registro de asistencia.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-rose-500/30 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-luxury text-base sm:text-lg font-bold text-white">
                Eliminar Registro de Asistencia
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400">
                Acción Administrativa Irreversible
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de confirmación y advertencia */}
        <p className="text-xs text-neutral-300 leading-relaxed">
          ¿Estás seguro de que deseas eliminar permanentemente este registro de asistencia? Se borrarán de la base de datos de Supabase los cómputos de entrada, salida y pausas asociadas a este día.
        </p>

        {/* Resumen del registro a borrar */}
        <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-white font-medium">
            <User className="w-3.5 h-3.5 text-[#C8A45C]" />
            <span>{record.employee_name}</span>
          </div>
          <div className="flex items-center justify-between text-neutral-400 text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              {record.date}
            </span>
            <span className="flex items-center gap-1.5 text-neutral-300">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              Entrada: {record.check_in || '--:--'} • Salida: {record.check_out || 'En curso'}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Registro</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
