import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee, EmployeeAttendance } from '../../types';
import { getLimaTimeString, getTodayDateString } from '../../data/initialData';
import {
  getShiftConfigForDate,
  calculatePayrollDateRange,
  formatMinutesToHours,
  calculateNetWorkedMinutes,
  parseTimeToMinutes,
} from '../../lib/attendanceUtils';
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
  DollarSign,
  Coffee,
  Sun,
  FileSpreadsheet,
  Award,
  ChevronRight,
  TrendingUp,
  User,
  Info,
} from 'lucide-react';
import { DashboardSkeleton } from './DashboardSkeleton';

export const AsistenciaView: React.FC = () => {
  const {
    currentRole,
    employees,
    attendance,
    attendanceRecords,
    attendanceSettings,
    isDataLoading,
  } = useApp();

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  const safeAttendance = attendanceRecords || attendance || [];

  // Vista principal: 'daily' (Control diario) o 'payroll' (Historial por colaborador para nómina)
  const [mainViewMode, setMainViewMode] = useState<'daily' | 'payroll'>('daily');

  // Reloj oficial en vivo America/Lima (UTC-5)
  const [currentLimaTime, setCurrentLimaTime] = useState(getLimaTimeString());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLimaTime(getLimaTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modales
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [badgeModalEmployee, setBadgeModalEmployee] = useState<Employee | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // -------------------------------------------------------------
  // ESTADO TAB 1: CONTROL DIARIO
  // -------------------------------------------------------------
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'barberia' | 'spa' | 'recepcion' | 'vestuario'>('all');

  // Parámetros de turno según la fecha seleccionada en el control diario
  const currentShiftConfig = useMemo(() => {
    return getShiftConfigForDate(attendanceSettings, selectedDate);
  }, [attendanceSettings, selectedDate]);

  // Generación del código QR para fotocheck modal
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

  // Registros filtrados para el día seleccionado
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

  // Estadísticas del día seleccionado
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
    const totalAbsenceMinutes = dayRecords.reduce(
      (acc, a) => acc + (a.absence_minutes || 0),
      0
    );

    return {
      totalPresentes,
      puntuales,
      tardanzas,
      totalOvertimeMinutes,
      totalOvertimeHours: (totalOvertimeMinutes / 60).toFixed(1),
      totalAbsenceMinutes,
      totalAbsenceDisplay: formatMinutesToHours(totalAbsenceMinutes),
    };
  }, [safeAttendance, selectedDate]);

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

  // -------------------------------------------------------------
  // ESTADO TAB 2: HISTORIAL POR EMPLEADO (NÓMINA & PAGOS)
  // -------------------------------------------------------------
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    employees[0]?.id || ''
  );

  // Garantizar empleado seleccionado por defecto
  useEffect(() => {
    if ((!selectedEmpId || !employees.some((e) => e.id === selectedEmpId)) && employees.length > 0) {
      setSelectedEmpId(employees[0].id);
    }
  }, [employees, selectedEmpId]);

  const [payrollPeriodMode, setPayrollPeriodMode] = useState<
    'diario' | 'quincenal' | 'mensual' | 'anual'
  >('quincenal');

  // Inicializar rango con la quincena actual
  const initialRange = useMemo(() => {
    return calculatePayrollDateRange('quincenal');
  }, []);

  const [payrollStartDate, setPayrollStartDate] = useState<string>(initialRange.startDate);
  const [payrollEndDate, setPayrollEndDate] = useState<string>(initialRange.endDate);
  const [periodLabel, setPeriodLabel] = useState<string>(initialRange.label);

  const handlePeriodPreset = (type: 'diario' | 'quincenal' | 'mensual' | 'anual') => {
    setPayrollPeriodMode(type);
    const res = calculatePayrollDateRange(type);
    setPayrollStartDate(res.startDate);
    setPayrollEndDate(res.endDate);
    setPeriodLabel(res.label);
  };

  // Empleado seleccionado para nómina
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Registros del empleado seleccionado en el rango de fechas
  const employeePayrollRecords = useMemo(() => {
    if (!selectedEmpId) return [];
    return safeAttendance
      .filter((a) => {
        if (a.employee_id !== selectedEmpId) return false;
        return a.date >= payrollStartDate && a.date <= payrollEndDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [safeAttendance, selectedEmpId, payrollStartDate, payrollEndDate]);

  // Resumen de liquidación del empleado en el período
  const payrollSummary = useMemo(() => {
    let totalWorkedMin = 0;
    let totalOvertimeMin = 0;
    let totalAbsenceMin = 0;
    let totalTardyMin = 0;
    let daysPresent = employeePayrollRecords.length;
    let tardyCount = 0;

    employeePayrollRecords.forEach((rec) => {
      // Jornada neta
      if (rec.worked_minutes && rec.worked_minutes > 0) {
        totalWorkedMin += rec.worked_minutes;
      } else if (rec.check_in && rec.check_out) {
        totalWorkedMin += calculateNetWorkedMinutes(
          rec.check_in,
          rec.check_out,
          rec.absence_minutes || 0
        );
      }

      totalOvertimeMin += rec.overtime_minutes || rec.bonus_minutes || 0;
      totalAbsenceMin += rec.absence_minutes || 0;

      if (rec.tardy_minutes && rec.tardy_minutes > 0) {
        totalTardyMin += rec.tardy_minutes;
        tardyCount++;
      } else if (rec.status === 'tardanza') {
        tardyCount++;
      }
    });

    return {
      daysPresent,
      totalWorkedMin,
      totalWorkedHours: (totalWorkedMin / 60).toFixed(1),
      totalOvertimeMin,
      totalOvertimeHours: (totalOvertimeMin / 60).toFixed(1),
      totalAbsenceMin,
      totalAbsenceDisplay: formatMinutesToHours(totalAbsenceMin),
      totalTardyMin,
      tardyCount,
    };
  }, [employeePayrollRecords]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
              Control de Asistencia, Puntualidad y Nómina
            </h1>
            <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/35">
              Inteligente
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Escaneo QR con auto-cierre de jornada, pausas auditadas y reportes de horas para liquidación salarial.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Lima Clock */}
          <div className="bg-[#141414] border border-[#C8A45C]/30 px-3.5 py-2 rounded-xl flex items-center gap-2.5 shadow-md">
            <Clock className="w-4 h-4 text-[#C8A45C] animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-mono">
                Hora Perú (UTC-5)
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider">
                {currentLimaTime}
              </span>
            </div>
          </div>

          {/* Scanner Button */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:from-[#DFCA8D] hover:to-[#D4AF37] text-black font-bold text-xs shadow-lg shadow-[#C8A45C]/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Scan className="w-4 h-4" />
            <span>Escanear QR de Asistencia</span>
          </button>

          {/* Settings Button (Admin Only) */}
          {currentRole === 'admin' && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl bg-[#181818] border border-neutral-800 text-neutral-300 hover:text-white hover:border-[#C8A45C]/60 transition cursor-pointer"
              title="Configurar Horarios Oficiales y Tolerancias (Lunes-Sábado y Domingos)"
            >
              <Sliders className="w-4 h-4 text-[#C8A45C]" />
            </button>
          )}
        </div>
      </div>

      {/* Main Switcher: Control Diario vs Reporte de Nómina */}
      <div className="flex border-b border-neutral-800 bg-[#141414] p-1.5 rounded-2xl gap-2 max-w-lg">
        <button
          type="button"
          onClick={() => setMainViewMode('daily')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
            mainViewMode === 'daily'
              ? 'bg-[#C8A45C] text-black font-bold shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Control Diario</span>
        </button>

        <button
          type="button"
          onClick={() => setMainViewMode('payroll')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
            mainViewMode === 'payroll'
              ? 'bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black font-bold shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Historial por Empleado (Nómina)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: CONTROL DIARIO */}
      {/* ========================================================================= */}
      {mainViewMode === 'daily' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Dynamic Shift Schedule Notice Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#181818] border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              {currentShiftConfig.isSunday ? (
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sun className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#E6C875]">
                  <Calendar className="w-4 h-4" />
                </div>
              )}
              <div>
                <span className="font-bold text-white block">
                  Régimen Activo: {currentShiftConfig.dayTypeLabel} ({selectedDate})
                </span>
                <span className="text-[11px] text-neutral-400">
                  Entrada Oficial: <strong className="text-emerald-400 font-mono">{currentShiftConfig.entryTime}</strong> (tolerancia: {currentShiftConfig.entryTolerance} min) • Salida Oficial: <strong className="text-blue-400 font-mono">{currentShiftConfig.exitTime}</strong> (auto-cierre automático)
                </span>
              </div>
            </div>

            {currentRole === 'admin' && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="text-[11px] text-[#C8A45C] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>Editar horarios dinámicos</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Daily KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Presentes */}
            <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block">Total Presentes</span>
                <span className="text-xl sm:text-2xl font-serif-luxury font-bold text-white block mt-0.5">
                  {stats.totalPresentes}
                </span>
                <span className="text-[10px] text-neutral-500">Colaboradores hoy</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Puntuales */}
            <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block">Puntuales</span>
                <span className="text-xl sm:text-2xl font-serif-luxury font-bold text-emerald-400 block mt-0.5">
                  {stats.puntuales}
                </span>
                <span className="text-[10px] text-emerald-500/80">Dentro de tolerancia</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Tardanzas */}
            <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block">Tardanzas</span>
                <span className="text-xl sm:text-2xl font-serif-luxury font-bold text-amber-400 block mt-0.5">
                  {stats.tardanzas}
                </span>
                <span className="text-[10px] text-amber-500/80">Minutos a auditar</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* Saldo Horas Extra */}
            <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block">Horas Extra</span>
                <span className="text-xl sm:text-2xl font-serif-luxury font-bold text-[#E6C875] block mt-0.5">
                  +{stats.totalOvertimeHours}h
                </span>
                <span className="text-[10px] text-[#C8A45C]">({stats.totalOvertimeMinutes} min a favor)</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/10 border border-[#C8A45C]/20 flex items-center justify-center text-[#E6C875]">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Daily Table Section */}
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5 sm:p-6">
            {/* Table Filters & Date Picker */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
              <div className="space-y-1">
                <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#C8A45C]" />
                  <span>Historial Diario de Asistencias</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Visualiza el flujo de entrada, auto-cierre, pausas auditadas y cálculo de jornada neta.
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
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
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
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
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      roleFilter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('barberia')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      roleFilter === 'barberia' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Barberos
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('spa')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      roleFilter === 'spa' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Spa
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('recepcion')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      roleFilter === 'recepcion' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Recepción
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('vestuario')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      roleFilter === 'vestuario' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Vestuario
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Attendance Records Table */}
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#181818] text-neutral-400 uppercase text-[10px] font-bold tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-3">Área / Rol</th>
                    <th className="py-3 px-3">Hora Entrada</th>
                    <th className="py-3 px-3">Hora Salida / Estado</th>
                    <th className="py-3 px-3">Permisos / Ausencias</th>
                    <th className="py-3 px-3">Jornada Neta</th>
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
                      const absenceMins = rec.absence_minutes || 0;

                      // Jornada neta trabajada
                      let workedDisplay = '--';
                      if (rec.worked_minutes && rec.worked_minutes > 0) {
                        workedDisplay = formatMinutesToHours(rec.worked_minutes);
                      } else if (rec.check_in && rec.check_out) {
                        const netMins = calculateNetWorkedMinutes(rec.check_in, rec.check_out, absenceMins);
                        workedDisplay = formatMinutesToHours(netMins);
                      } else if (rec.check_in && !rec.check_out && !rec.is_on_leave) {
                        workedDisplay = 'En curso...';
                      } else if (rec.is_on_leave) {
                        workedDisplay = 'Pausada';
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
                                  : (emp?.type || rec.employee_type) === 'vestuario'
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {(emp?.type || rec.employee_type) === 'barbero' ||
                              (emp?.type || rec.employee_type) === 'barberia'
                                ? 'Barbero'
                                : (emp?.type || rec.employee_type) === 'spa'
                                ? 'Spa'
                                : (emp?.type || rec.employee_type) === 'vestuario'
                                ? 'Vestuario'
                                : 'Recepción'}
                            </span>
                          </td>

                          {/* Hora Entrada */}
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

                          {/* Hora Salida / Estado */}
                          <td className="py-3.5 px-3">
                            {rec.is_on_leave || rec.status === 'en_permiso' ? (
                              <div className="space-y-1">
                                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold inline-flex items-center gap-1.5">
                                  <Coffee className="w-3 h-3 text-amber-400 animate-pulse" />
                                  <span>En Permiso: {rec.leave_reason || 'Pausa'}</span>
                                </span>
                                <span className="text-[10px] text-neutral-400 block font-mono">
                                  Jornada abierta
                                </span>
                              </div>
                            ) : rec.check_out ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
                                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                                  <span>{rec.check_out}</span>
                                </div>
                                {rec.exit_reason ? (
                                  <div
                                    title={`Motivo registrado: ${rec.exit_reason}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-semibold"
                                  >
                                    <Coffee className="w-2.5 h-2.5 text-purple-400" />
                                    <span>{rec.exit_reason}</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                                    <span>Salida Definitiva</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                <span>En turno activo</span>
                              </span>
                            )}
                          </td>

                          {/* Permisos / Ausencias (Fase 3) */}
                          <td className="py-3.5 px-3">
                            {rec.is_on_leave ? (
                              <span className="font-mono text-amber-400 font-bold text-xs flex items-center gap-1">
                                <Coffee className="w-3 h-3 text-amber-400" />
                                <span>Pausa en curso</span>
                              </span>
                            ) : absenceMins > 0 ? (
                              <div className="space-y-0.5">
                                <span className="font-mono text-neutral-200 font-bold text-xs bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-lg inline-block">
                                  {formatMinutesToHours(absenceMins)}
                                </span>
                                {rec.leave_reason && (
                                  <span className="text-[10px] text-neutral-500 block truncate max-w-[120px]">
                                    ({rec.leave_reason})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-500 font-mono text-xs">--</span>
                            )}
                          </td>

                          {/* Jornada Neta */}
                          <td className="py-3.5 px-3 font-mono font-semibold text-neutral-200">
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
                                  {(overtime / 60).toFixed(1)}h a favor
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
                                className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-[#C8A45C] text-neutral-300 hover:text-black border border-neutral-800 hover:border-[#C8A45C] transition inline-flex items-center gap-1.5 text-xs font-semibold shadow cursor-pointer"
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
                      <td colSpan={8} className="py-12 text-center text-neutral-500 space-y-2">
                        <UserX className="w-8 h-8 mx-auto text-neutral-600 mb-1" />
                        <p className="text-xs">No hay asistencias registradas para la fecha seleccionada ({selectedDate}).</p>
                        <button
                          type="button"
                          onClick={() => setIsScannerOpen(true)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40 hover:bg-[#C8A45C] hover:text-black transition inline-flex items-center gap-1.5 mt-2 cursor-pointer"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: FASE 4 - HISTORIAL POR EMPLEADO (NÓMINA & LIQUIDACIÓN) */}
      {/* ========================================================================= */}
      {mainViewMode === 'payroll' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Employee & Period Controls Header Card */}
          <div className="p-5 rounded-2xl bg-[#141414] border border-neutral-800 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
              {/* Employee Selector */}
              <div className="space-y-1.5 flex-1 max-w-md">
                <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Seleccionar Colaborador para Liquidación:</span>
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#C8A45C] cursor-pointer"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-[#181818] text-white">
                      {emp.full_name} ({emp.type}) • DNI: {emp.dni || 'Sin DNI'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Period Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 block">
                  Período de Liquidación:
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePeriodPreset('diario')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      payrollPeriodMode === 'diario'
                        ? 'bg-[#C8A45C] text-black font-bold shadow'
                        : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    Diario
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodPreset('quincenal')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      payrollPeriodMode === 'quincenal'
                        ? 'bg-[#C8A45C] text-black font-bold shadow'
                        : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    Quincenal (1-15 / 16-Fin)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodPreset('mensual')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      payrollPeriodMode === 'mensual'
                        ? 'bg-[#C8A45C] text-black font-bold shadow'
                        : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodPreset('anual')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      payrollPeriodMode === 'anual'
                        ? 'bg-[#C8A45C] text-black font-bold shadow'
                        : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    Anual
                  </button>
                </div>
              </div>
            </div>

            {/* Date Range Inputs & Period Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-medium">Desde:</span>
                <input
                  type="date"
                  value={payrollStartDate}
                  onChange={(e) => {
                    setPayrollStartDate(e.target.value);
                    setPeriodLabel(`Personalizado (${e.target.value} a ${payrollEndDate})`);
                  }}
                  className="bg-[#181818] border border-neutral-800 rounded-xl px-2.5 py-1.5 font-mono text-white text-xs outline-none focus:border-[#C8A45C]"
                />
                <span className="text-neutral-400 font-medium">Hasta:</span>
                <input
                  type="date"
                  value={payrollEndDate}
                  onChange={(e) => {
                    setPayrollEndDate(e.target.value);
                    setPeriodLabel(`Personalizado (${payrollStartDate} a ${e.target.value})`);
                  }}
                  className="bg-[#181818] border border-neutral-800 rounded-xl px-2.5 py-1.5 font-mono text-white text-xs outline-none focus:border-[#C8A45C]"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-[#C8A45C]/15 border border-[#C8A45C]/35 text-[#E6C875] font-semibold text-xs flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{periodLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-[#C8A45C] transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Imprimir Planilla</span>
                </button>
              </div>
            </div>
          </div>

          {/* Selected Employee Info & 4 Summary Payroll Cards */}
          {selectedEmployee && (
            <div className="space-y-4">
              {/* Employee Header Badge */}
              <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={
                      selectedEmployee.avatar ||
                      selectedEmployee.avatar_url ||
                      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
                    }
                    alt={selectedEmployee.full_name}
                    className="w-12 h-12 rounded-2xl object-cover border border-neutral-700 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="font-serif-luxury text-base sm:text-lg font-bold text-white">
                      {selectedEmployee.full_name}
                    </h3>
                    <p className="text-xs text-neutral-400 capitalize">
                      {selectedEmployee.type} • DNI: {selectedEmployee.dni || 'Sin registrar'} • Tel: {selectedEmployee.phone || '-'}
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest block font-bold">
                    Días Laborados en Rango
                  </span>
                  <span className="font-serif-luxury text-lg font-bold text-white">
                    {payrollSummary.daysPresent} días
                  </span>
                </div>
              </div>

              {/* 4 Summary Cards (Para Pagos / Nómina) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total Horas Trabajadas (Jornada Neta) */}
                <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl p-4 shadow-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 block uppercase tracking-wider">
                      Jornada Neta Trabajada
                    </span>
                    <span className="text-2xl font-serif-luxury font-bold text-white block mt-1">
                      {payrollSummary.totalWorkedHours} hrs
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {formatMinutesToHours(payrollSummary.totalWorkedMin)} productivas
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/35 flex items-center justify-center text-[#E6C875]">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>

                {/* 2. Total Horas Extra Acumuladas */}
                <div className="bg-[#141414] border border-amber-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 block uppercase tracking-wider">
                      Horas Extra Computables
                    </span>
                    <span className="text-2xl font-serif-luxury font-bold text-[#E6C875] block mt-1">
                      +{payrollSummary.totalOvertimeHours} hrs
                    </span>
                    <span className="text-[10px] text-[#C8A45C] font-mono">
                      +{payrollSummary.totalOvertimeMin} min a compensar/pagar
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                </div>

                {/* 3. Total Ausencias / Permisos */}
                <div className="bg-[#141414] border border-purple-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 block uppercase tracking-wider">
                      Tiempo en Permisos / Pausas
                    </span>
                    <span className="text-2xl font-serif-luxury font-bold text-purple-300 block mt-1">
                      {payrollSummary.totalAbsenceDisplay}
                    </span>
                    <span className="text-[10px] text-purple-400 font-mono">
                      {payrollSummary.totalAbsenceMin} min fuera descontados
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/35 flex items-center justify-center text-purple-400">
                    <Coffee className="w-6 h-6" />
                  </div>
                </div>

                {/* 4. Puntualidad & Tardanzas */}
                <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 block uppercase tracking-wider">
                      Tardanzas en Período
                    </span>
                    <span className="text-2xl font-serif-luxury font-bold text-amber-400 block mt-1">
                      {payrollSummary.tardyCount} días
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {payrollSummary.totalTardyMin} min de retraso total
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Table by Day */}
              <div className="bg-[#141414] border border-neutral-800 rounded-2xl shadow-xl overflow-hidden space-y-3 p-5 sm:p-6">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <h4 className="font-serif-luxury text-base font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#C8A45C]" />
                    <span>Desglose Diario de Asistencias para Pago</span>
                  </h4>
                  <span className="text-xs text-neutral-400 font-mono">
                    {employeePayrollRecords.length} registros encontrados
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-neutral-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181818] text-neutral-400 uppercase text-[10px] font-bold tracking-wider border-b border-neutral-800">
                      <tr>
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-3">Día</th>
                        <th className="py-3 px-3">Entrada</th>
                        <th className="py-3 px-3">Salida</th>
                        <th className="py-3 px-3">Tiempo de Permisos</th>
                        <th className="py-3 px-3">Jornada Neta</th>
                        <th className="py-3 px-3">Horas Extra</th>
                        <th className="py-3 px-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-medium">
                      {employeePayrollRecords.length > 0 ? (
                        employeePayrollRecords.map((rec) => {
                          const isLate = rec.status === 'tardanza' || (rec.tardy_minutes && rec.tardy_minutes > 0);
                          const overtime = rec.overtime_minutes || rec.bonus_minutes || 0;
                          const absenceMins = rec.absence_minutes || 0;

                          // Día de la semana en formato legible
                          const [y, m, d] = rec.date.split('-').map(Number);
                          const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
                          const dayName = dateObj.toLocaleDateString('es-PE', {
                            weekday: 'long',
                            timeZone: 'America/Lima',
                          });

                          // Cálculo de jornada neta
                          let netMins = 0;
                          if (rec.worked_minutes && rec.worked_minutes > 0) {
                            netMins = rec.worked_minutes;
                          } else if (rec.check_in && rec.check_out) {
                            netMins = calculateNetWorkedMinutes(rec.check_in, rec.check_out, absenceMins);
                          }

                          return (
                            <tr key={rec.id} className="hover:bg-neutral-900/40 transition">
                              {/* Fecha */}
                              <td className="py-3 px-4 font-mono font-bold text-white">
                                {rec.date}
                              </td>

                              {/* Día */}
                              <td className="py-3 px-3 capitalize text-neutral-300">
                                {dayName}
                              </td>

                              {/* Entrada */}
                              <td className="py-3 px-3 font-mono">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white font-bold">{rec.check_in || '--:--'}</span>
                                  {isLate && (
                                    <span className="text-[10px] text-amber-400 font-semibold">
                                      (+{rec.tardy_minutes}m)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Salida */}
                              <td className="py-3 px-3 font-mono">
                                <span className="text-white font-bold">
                                  {rec.check_out || (rec.is_on_leave ? 'En permiso' : 'En turno')}
                                </span>
                              </td>

                              {/* Permisos / Ausencias */}
                              <td className="py-3 px-3">
                                {absenceMins > 0 ? (
                                  <span className="font-mono text-purple-300 font-bold bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded-lg inline-block">
                                    {formatMinutesToHours(absenceMins)}
                                    {rec.leave_reason ? ` (${rec.leave_reason})` : ''}
                                  </span>
                                ) : (
                                  <span className="text-neutral-500 font-mono">0 min</span>
                                )}
                              </td>

                              {/* Jornada Neta */}
                              <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                                {netMins > 0 ? formatMinutesToHours(netMins) : '--'}
                              </td>

                              {/* Horas Extra */}
                              <td className="py-3 px-3 font-mono">
                                {overtime > 0 ? (
                                  <span className="text-[#E6C875] font-bold bg-[#C8A45C]/15 border border-[#C8A45C]/35 px-2 py-0.5 rounded-lg inline-block">
                                    +{overtime} min ({(overtime / 60).toFixed(1)}h)
                                  </span>
                                ) : (
                                  <span className="text-neutral-500">0 min</span>
                                )}
                              </td>

                              {/* Estado */}
                              <td className="py-3 px-4">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    rec.status === 'presente'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : rec.status === 'tardanza'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : rec.status === 'en_permiso'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : 'bg-neutral-800 text-neutral-300'
                                  }`}
                                >
                                  {rec.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-500 text-xs">
                            No se encontraron registros de asistencia para {selectedEmployee.full_name} en el período seleccionado.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Resumen al pie de la tabla */}
                    {employeePayrollRecords.length > 0 && (
                      <tfoot className="bg-[#181818] border-t border-neutral-700/80 font-bold text-white text-xs">
                        <tr>
                          <td colSpan={4} className="py-3 px-4 text-right uppercase text-[10px] text-neutral-400 tracking-wider">
                            Totales Computables del Período:
                          </td>
                          <td className="py-3 px-3 font-mono text-purple-300">
                            {payrollSummary.totalAbsenceDisplay}
                          </td>
                          <td className="py-3 px-3 font-mono text-emerald-400">
                            {payrollSummary.totalWorkedHours} hrs
                          </td>
                          <td className="py-3 px-3 font-mono text-[#E6C875]">
                            +{payrollSummary.totalOvertimeHours} hrs
                          </td>
                          <td className="py-3 px-4 text-[11px] text-neutral-400">
                            {payrollSummary.daysPresent} días
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALES DEL MÓDULO DE ASISTENCIA */}
      {/* ========================================================================= */}
      {/* MODAL 1: QR Scanner (Auto-cierre, pausas y re-ingreso) */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        userRole={currentRole}
      />

      {/* MODAL 2: Shift & Tolerances Configuration (Lunes-Sábado y Domingos) */}
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] hover:brightness-110 text-black shadow transition flex items-center gap-1.5 cursor-pointer"
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
