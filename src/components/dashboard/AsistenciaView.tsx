import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee, formatLimaDate } from '../../types';
import { getLimaTimeString, getTodayDateString } from '../../data/initialData';
import { QRScannerModal } from './QRScannerModal';
import { AttendanceSettingsModal } from './AttendanceSettingsModal';
import QRCode from 'qrcode';
import {
  QrCode,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Scan,
  Printer,
  Calendar,
  Sparkles,
  Sliders,
  Search,
  Filter,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

import { DashboardSkeleton } from './DashboardSkeleton';

export const AsistenciaView: React.FC = () => {
  const {
    currentRole,
    employees,
    attendance,
    attendanceRecords,
    attendanceSettings,
    registerAttendancePunch,
    isDataLoading,
  } = useApp();

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  const safeAttendance = attendanceRecords || attendance || [];

  // Live Lima Time Clock (America/Lima)
  const [currentLimaTime, setCurrentLimaTime] = useState(getLimaTimeString());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLimaTime(getLimaTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [badgeModalEmployee, setBadgeModalEmployee] = useState<Employee | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Date picker filter (defaults to today in Peru)
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'barberia' | 'spa' | 'recepcion'>('all');

  // Generate QR for badge modal
  useEffect(() => {
    if (badgeModalEmployee) {
      const qrPayload = `ACICALADOS-EMP-${badgeModalEmployee.id}-${badgeModalEmployee.dni || '00000000'}`;
      QRCode.toDataURL(qrPayload, {
        width: 260,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }).then(setQrCodeDataUrl);
    }
  }, [badgeModalEmployee]);

  // Attendance records for selected date
  const filteredRecords = useMemo(() => {
    return safeAttendance.filter((rec) => {
      if (rec.date !== selectedDate) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesName = rec.employee_name.toLowerCase().includes(q);
        const emp = employees.find((e) => e.id === rec.employee_id);
        const matchesDni = emp?.dni && emp.dni.includes(q);
        if (!matchesName && !matchesDni) return false;
      }

      if (roleFilter !== 'all') {
        const emp = employees.find((e) => e.id === rec.employee_id);
        const empType = emp?.type || rec.employee_type;
        if (empType !== roleFilter) return false;
      }

      return true;
    });
  }, [safeAttendance, selectedDate, searchTerm, roleFilter, employees]);

  // Daily statistics for selected date
  const stats = useMemo(() => {
    const dayRecords = safeAttendance.filter((a) => a.date === selectedDate);
    const totalPresentes = dayRecords.length;
    const puntuales = dayRecords.filter(
      (a) => a.status === 'presente' && (!a.tardy_minutes || a.tardy_minutes === 0)
    ).length;
    const tardanzas = dayRecords.filter(
      (a) => a.status === 'tardanza' || (a.tardy_minutes && a.tardy_minutes > 0)
    ).length;
    const totalOvertimeMinutes = dayRecords.reduce(
      (acc, a) => acc + (a.overtime_minutes || a.bonus_minutes || 0),
      0
    );

    return {
      totalPresentes,
      puntuales,
      tardanzas,
      totalOvertimeMinutes,
      totalOvertimeHours: (totalOvertimeMinutes / 60).toFixed(1),
    };
  }, [safeAttendance, selectedDate]);

  // Quick date navigation buttons
  const setQuickDate = (type: 'today' | 'yesterday') => {
    if (type === 'today') {
      setSelectedDate(todayStr);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      setSelectedDate(yStr);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
              Control de Asistencia y Puntualidad
            </h1>
            <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/35">
              QR Biométrico
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Escaneo instantáneo de carnets QR, control automático de puntualidad y saldo de horas extra.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Lima Clock */}
          <div className="bg-[#141414] border border-[#C8A45C]/30 px-3.5 py-2 rounded-xl flex items-center gap-2.5 shadow-md">
            <Clock className="w-4 h-4 text-[#C8A45C] animate-pulse" />
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-400 block tracking-wider leading-none">
                Hora Lima (UTC-5)
              </span>
              <span className="font-mono text-base font-bold text-[#E6C875] tracking-widest leading-none">
                {currentLimaTime}
              </span>
            </div>
          </div>

          {/* Configuration Button (EXCLUSIVE for Role Admin) */}
          {currentRole === 'admin' && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#181818] hover:bg-neutral-800 text-neutral-200 hover:text-white border border-[#C8A45C]/40 hover:border-[#C8A45C] shadow transition flex items-center gap-2"
              title="Configurar turnos oficiales y tolerancias"
            >
              <Sliders className="w-4 h-4 text-[#C8A45C]" />
              <span className="hidden sm:inline">Configuración de</span> Horarios y Tolerancias
            </button>
          )}

          {/* Prominent QR Scanner Button (Admin and Receptionist) */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#D4AF37] via-[#E6C875] to-[#C8A45C] hover:brightness-110 text-black shadow-lg shadow-[#C8A45C]/20 transition flex items-center gap-2 active:scale-95"
          >
            <Scan className="w-4 h-4 text-black" />
            <span>Escanear Asistencia QR</span>
          </button>
        </div>
      </div>

      {/* Active Shift & Tolerances Banner */}
      <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex items-center gap-2.5 text-neutral-300">
          <ShieldCheck className="w-4 h-4 text-[#C8A45C] shrink-0" />
          <span>
            <strong className="text-white">Reglas del Turno Activo:</strong> Entrada oficial:{' '}
            <strong className="text-[#E6C875] font-mono">{attendanceSettings.shift_entry_time}</strong>{' '}
            (Tolerancia: {attendanceSettings.entry_tolerance_minutes} min) • Salida oficial:{' '}
            <strong className="text-[#E6C875] font-mono">{attendanceSettings.shift_exit_time}</strong>{' '}
            (Tolerancia: {attendanceSettings.exit_tolerance_minutes} min)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <span>Puntual hasta {attendanceSettings.shift_entry_time} + {attendanceSettings.entry_tolerance_minutes}m</span>
          <span className="inline-block w-2 h-2 rounded-full bg-[#E6C875] ml-2" />
          <span>Horas extra tras {attendanceSettings.shift_exit_time} + {attendanceSettings.exit_tolerance_minutes}m</span>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Presentes Hoy */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Colaboradores Presentes</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {stats.totalPresentes}
            </span>
            <span className="text-xs text-neutral-500">/ {employees.length} activos</span>
          </div>
          <span className="text-[10px] text-neutral-400 block pt-1">
            Marcaciones registradas ({selectedDate === todayStr ? 'Hoy' : selectedDate})
          </span>
        </div>

        {/* Marcaciones Puntuales */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Llegadas Puntuales</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
              {stats.puntuales}
            </span>
            {stats.totalPresentes > 0 && (
              <span className="text-xs text-emerald-500 font-medium">
                ({Math.round((stats.puntuales / stats.totalPresentes) * 100)}%)
              </span>
            )}
          </div>
          <span className="text-[10px] text-neutral-400 block pt-1">
            Dentro de tolerancia de {attendanceSettings.entry_tolerance_minutes} min
          </span>
        </div>

        {/* Tardanzas */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Tardanzas Detectadas</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
              {stats.tardanzas}
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 block pt-1">
            Retraso registrado en entrada
          </span>
        </div>

        {/* Total Horas Extra */}
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Horas Extra a Favor</span>
            <Sparkles className="w-4 h-4 text-[#C8A45C]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-[#E6C875]">
              +{stats.totalOvertimeHours}h
            </span>
            <span className="text-xs text-[#C8A45C]">({stats.totalOvertimeMinutes} min)</span>
          </div>
          <span className="text-[10px] text-neutral-400 block pt-1">
            Saldo acumulado para liquidar
          </span>
        </div>
      </div>

      {/* Attendance History Section */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Table Filters & Date Picker */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
          <div className="space-y-1">
            <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#C8A45C]" />
              <span>Historial Diario de Asistencias</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Consulta el registro de entrada, salida, puntualidad y excedente de horas extra por fecha.
            </p>
          </div>

          {/* Date Picker & Quick Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#181818] border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-300">
              <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => setQuickDate('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedDate === todayStr
                  ? 'bg-[#C8A45C] text-black shadow'
                  : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setQuickDate('yesterday')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800 transition"
            >
              Ayer
            </button>
          </div>
        </div>

        {/* Filter controls: Search & Category */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por nombre o DNI de colaborador..."
              className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#C8A45C]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-neutral-500" />
            <div className="flex rounded-xl bg-[#181818] p-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  roleFilter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('barberia')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  roleFilter === 'barberia' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Barberos
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('spa')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  roleFilter === 'spa' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Spa
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('recepcion')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  roleFilter === 'recepcion' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Recepción
              </button>
            </div>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181818] text-neutral-400 uppercase text-[10px] font-bold tracking-wider border-b border-neutral-800">
              <tr>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-3">Rol / Especialidad</th>
                <th className="py-3 px-3">Hora de Entrada</th>
                <th className="py-3 px-3">Hora de Salida</th>
                <th className="py-3 px-3">Jornada Cumplida</th>
                <th className="py-3 px-3">Saldo Horas Extra</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-medium">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((rec) => {
                  const emp = employees.find((e) => e.id === rec.employee_id);
                  const isLate = rec.status === 'tardanza' || (rec.tardy_minutes && rec.tardy_minutes > 0);
                  const overtime = rec.overtime_minutes || rec.bonus_minutes || 0;

                  // Calculation of worked time
                  let workedDisplay = '--';
                  if (rec.worked_minutes && rec.worked_minutes > 0) {
                    const hours = Math.floor(rec.worked_minutes / 60);
                    const mins = rec.worked_minutes % 60;
                    workedDisplay = `${hours}h ${mins}m`;
                  } else if (rec.check_in && rec.check_out) {
                    const [inH, inM] = rec.check_in.split(':').map(Number);
                    const [outH, outM] = rec.check_out.split(':').map(Number);
                    const diff = Math.max(0, outH * 60 + outM - (inH * 60 + inM));
                    workedDisplay = `${Math.floor(diff / 60)}h ${diff % 60}m`;
                  }

                  return (
                    <tr key={rec.id} className="hover:bg-neutral-900/40 transition">
                      {/* Colaborador */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              emp?.avatar ||
                              emp?.avatar_url ||
                              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
                            }
                            alt={rec.employee_name}
                            className="w-10 h-10 rounded-xl object-cover border border-neutral-700 shadow"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-semibold text-white block text-sm">
                              {rec.employee_name}
                            </span>
                            <span className="text-[11px] text-neutral-400 font-mono">
                              DNI: {emp?.dni || '--------'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg inline-block ${
                            (emp?.type || rec.employee_type) === 'barbero' ||
                            (emp?.type || rec.employee_type) === 'barberia'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : (emp?.type || rec.employee_type) === 'spa'
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {(emp?.type || rec.employee_type) === 'barbero' ||
                          (emp?.type || rec.employee_type) === 'barberia'
                            ? 'Barbero'
                            : (emp?.type || rec.employee_type) === 'spa'
                            ? 'Spa'
                            : 'Recepción'}
                        </span>
                      </td>

                      {/* Hora de Entrada y Estado */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{rec.check_in || '--:--'}</span>
                          </div>
                          {isLate ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Tardanza (+{rec.tardy_minutes || 1} min)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Puntual</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Hora de Salida */}
                      <td className="py-3.5 px-3">
                        {rec.check_out ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
                              <Clock className="w-3.5 h-3.5 text-blue-400" />
                              <span>{rec.check_out}</span>
                            </div>
                            {rec.exit_type === 'emergencia' ? (
                              <div
                                title={rec.exit_reason ? `Motivo: ${rec.exit_reason}` : 'Salida de emergencia justificada'}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold cursor-help"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-rose-400" />
                                <span>Emergencia</span>
                              </div>
                            ) : rec.exit_type === 'definitiva' ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                                <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-blue-400" />
                                <span>Definitiva</span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>En turno activo</span>
                          </span>
                        )}
                      </td>

                      {/* Jornada Cumplida */}
                      <td className="py-3.5 px-3 font-mono text-neutral-300">
                        {workedDisplay}
                      </td>

                      {/* Saldo de Horas Extra */}
                      <td className="py-3.5 px-3">
                        {overtime > 0 ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-1 rounded-lg bg-[#C8A45C]/20 border border-[#C8A45C]/50 text-[#E6C875] font-bold font-mono text-xs inline-flex items-center gap-1 shadow-sm">
                              <Sparkles className="w-3 h-3 text-[#E6C875]" />
                              <span>+{overtime} min</span>
                            </span>
                            <span className="text-[10px] text-neutral-400 block font-mono pl-1">
                              {(overtime / 60).toFixed(1)} hrs a favor
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-500 font-mono">0 min</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        {emp && (
                          <button
                            type="button"
                            onClick={() => setBadgeModalEmployee(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-[#C8A45C] text-neutral-300 hover:text-black border border-neutral-800 hover:border-[#C8A45C] transition inline-flex items-center gap-1.5 text-xs font-semibold shadow"
                            title="Ver e imprimir carnet digital QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Fotocheck QR</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500 space-y-2">
                    <UserX className="w-8 h-8 mx-auto text-neutral-600 mb-1" />
                    <p className="text-xs">No hay asistencias registradas para la fecha seleccionada ({selectedDate}).</p>
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40 hover:bg-[#C8A45C] hover:text-black transition inline-flex items-center gap-1.5 mt-2"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>Escanear Primera Asistencia</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: QR Scanner (Webcam, mobile camera, image upload, fast punch - Control RBAC) */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        userRole={currentRole}
      />

      {/* MODAL 2: Shift & Tolerances Configuration (Exclusively for Admin) */}
      <AttendanceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* MODAL 3: Employee QR Credential Badge Modal */}
      {badgeModalEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl text-center">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#C8A45C]">
                Carnet Digital Oficial
              </span>
              <h3 className="font-serif-luxury text-lg font-bold text-white">
                {badgeModalEmployee.full_name}
              </h3>
              <p className="text-xs text-neutral-400 capitalize">
                {badgeModalEmployee.type} • DNI: {badgeModalEmployee.dni}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-xl mx-auto border-2 border-[#C8A45C]">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Fotocheck" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-black font-mono text-xs">
                  Generando QR...
                </div>
              )}
            </div>

            <div className="space-y-1 text-[11px] text-neutral-400">
              <p>Código Único: <strong className="text-neutral-200 font-mono">ACICALADOS-EMP-{badgeModalEmployee.id}</strong></p>
              <p>Muestra este carnet frente a la cámara marcadora al ingresar y salir del local.</p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBadgeModalEmployee(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] hover:brightness-110 text-black shadow transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Carnet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
