import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { useApp } from '../../context/AppContext';
import { Employee, EmployeeAttendance, UserRole } from '../../types';
import { AttendanceExitModal } from './AttendanceExitModal';
import { getLimaTimeString, getTodayDateString } from '../../data/initialData';
import {
  X,
  Camera,
  RefreshCw,
  Upload,
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
}

interface ScanResultState {
  success: boolean;
  message: string;
  employee?: Employee;
  type?: 'check_in' | 'check_out';
  record?: EmployeeAttendance;
  punctuality?: 'puntual' | 'tardanza' | 'horas_extra';
  minutes?: number;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, userRole }) => {
  const {
    employees,
    attendance,
    scanAttendanceQR,
    resolveEmployeeFromCode,
    registerAttendanceExit,
    currentRole,
    currentUser,
  } = useApp();

  // Control RBAC: rol del usuario actual (admin vs recepcionista)
  const effectiveRole: UserRole = userRole || currentRole || currentUser?.role || 'recepcionista';
  const isAdmin = effectiveRole === 'admin';
  const isRecepcionista = effectiveRole === 'recepcionista';

  // Por defecto, vista siempre en 'camera' para cualquier rol
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [scanResult, setScanResult] = useState<ScanResultState | null>(null);
  const [manualSearch, setManualSearch] = useState<string>('');
  const [pendingExit, setPendingExit] = useState<{
    employee: Employee;
    attendanceRecord: EmployeeAttendance;
  } | null>(null);

  // Asegurar que al abrir el modal la vista por defecto sea SIEMPRE 'camera'
  useEffect(() => {
    if (isOpen) {
      setActiveTab('camera');
      setScanResult(null);
      setPendingExit(null);
    }
  }, [isOpen]);

  // Si el usuario no es administrador (ej. recepcionista), asegurar que activeTab siempre sea 'camera'
  useEffect(() => {
    if (!isAdmin && activeTab !== 'camera') {
      setActiveTab('camera');
    }
  }, [isAdmin, activeTab]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<string | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Play subtle feedback chime using Web Audio API
  const playBeep = useCallback((isSuccess: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 880 : 330, ctx.currentTime); // A5 or E4
      if (isSuccess) {
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6
      }

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, [soundEnabled]);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Manejador de cierre del modal de salida
  const handleCloseExitModal = useCallback(() => {
    setPendingExit(null);
    setIsScanning(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      lastScannedCodeRef.current = null;
    }, 3000);
  }, []);

  // Manejador de confirmación de salida (Definitiva o Emergencia)
  const handleConfirmExitModal = useCallback(
    async ({
      exitType,
      exitReason,
    }: {
      exitType: 'definitiva' | 'emergencia';
      exitReason?: string;
    }) => {
      if (!pendingExit) return;
      const { employee, attendanceRecord } = pendingExit;

      const exitResult = await registerAttendanceExit({
        employeeId: employee.id,
        attendanceId: attendanceRecord.id,
        exitType,
        exitReason,
      });

      setScanResult({
        success: true,
        message: exitResult.message,
        employee,
        type: 'check_out',
        record: exitResult.record,
        punctuality: exitResult.overtimeMinutes > 0 ? 'horas_extra' : 'puntual',
        minutes: exitResult.overtimeMinutes,
      });

      playBeep(true);
      setPendingExit(null);
      setIsScanning(true);

      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = setTimeout(() => {
        lastScannedCodeRef.current = null;
      }, 4000);
    },
    [pendingExit, playBeep, registerAttendanceExit]
  );

  // Interceptación de lectura QR: evalúa entrada vs salida (Definitiva vs Emergencia)
  const handleDecodedQR = useCallback(
    (rawCode: string) => {
      if (!rawCode || rawCode === lastScannedCodeRef.current || pendingExit) {
        return;
      }
      lastScannedCodeRef.current = rawCode;

      // 1. Identificar colaborador
      const emp = resolveEmployeeFromCode(rawCode);
      if (!emp) {
        setScanResult({
          success: false,
          message: 'Credencial QR no reconocida en el sistema de colaboradores.',
        });
        playBeep(false);
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          lastScannedCodeRef.current = null;
        }, 4000);
        return;
      }

      // 2. Evaluar estado de asistencia para el día de hoy
      const today = getTodayDateString();
      const currentAtt = attendance.find(
        (a) => a.employee_id === emp.id && a.date === today
      );

      // CASO A: No tiene entrada hoy -> Ejecuta flujo de ingreso normal existente
      if (!currentAtt) {
        const result = scanAttendanceQR(rawCode);
        setScanResult(result);
        playBeep(result.success);

        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          lastScannedCodeRef.current = null;
        }, 4000);
        return;
      }

      // CASO B: Ya tiene entrada y le falta salida -> Detiene guardado automático y abre modal de salida
      if (!currentAtt.check_out) {
        setIsScanning(false);
        setPendingExit({
          employee: emp,
          attendanceRecord: currentAtt,
        });
        return;
      }

      // CASO C: Ya completó su jornada (entrada y salida)
      setScanResult({
        success: false,
        message: `${emp.full_name} ya completó su jornada de hoy (Entrada: ${currentAtt.check_in}, Salida: ${currentAtt.check_out}).`,
        employee: emp,
        record: currentAtt,
      });
      playBeep(false);

      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = setTimeout(() => {
        lastScannedCodeRef.current = null;
      }, 4000);
    },
    [attendance, pendingExit, playBeep, resolveEmployeeFromCode, scanAttendanceQR]
  );

  // QR Scanning Loop using canvas + jsQR
  const scanFrame = useCallback(() => {
    if (!isScanning || !!pendingExit) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleDecodedQR(code.data);
        }
      }
    }

    if (isScanning && !pendingExit && isOpen && activeTab === 'camera') {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [activeTab, handleDecodedQR, isOpen, isScanning, pendingExit]);

  // Reanudar loop de escaneo cuando se reactive isScanning y no haya modal de salida
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && isScanning && !pendingExit) {
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    }
  }, [isOpen, activeTab, isScanning, pendingExit, scanFrame]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Tu navegador o dispositivo no soporta acceso a la cámara.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(() => {});
      }

      setIsScanning(true);
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      console.error('Error al inicializar cámara para escaneo QR:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Permiso de cámara denegado. Permite el acceso en los ajustes de tu navegador o sube una foto.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No se encontró ninguna cámara disponible en tu dispositivo.');
      } else {
        setCameraError('No se pudo iniciar la cámara web. Intenta con otra cámara o sube una imagen del QR.');
      }
    }
  }, [facingMode, scanFrame, stopCamera]);

  // Effect to manage camera lifecycle
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [isOpen, activeTab, startCamera, stopCamera]);

  // Handle image upload fallback
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleDecodedQR(code.data);
          } else {
            setScanResult({
              success: false,
              message: 'No se detectó ningún código QR legible en la imagen seleccionada.',
            });
            playBeep(false);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Toggle camera direction (front / back)
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Filtered employees for manual tab
  const filteredEmployees = employees.filter((emp) => {
    const q = manualSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      emp.full_name.toLowerCase().includes(q) ||
      (emp.dni && emp.dni.includes(q)) ||
      emp.type.toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#C8A45C]/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#121212]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/40 flex items-center justify-center text-[#E6C875]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-luxury text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2 flex-wrap">
                <span>Escanear Asistencia QR</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/30">
                  En Vivo
                </span>
                {isAdmin ? (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30">
                    Modo Administrador
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-500/30">
                    Recepción
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-neutral-400">
                {isAdmin
                  ? 'Lectura biométrica por cámara, carga de imágenes y marcación asistida'
                  : 'Lectura biométrica instantánea de fotochecks digitales'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Silenciar confirmación' : 'Activar sonido'}
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-[#E6C875] transition"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs (Control RBAC: Solo Administrador tiene acceso a Subir Imagen y Marcación Rápida) */}
        <div className="px-5 pt-3 pb-2 border-b border-neutral-800/80 bg-[#161616] flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              setScanResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === 'camera'
                ? 'bg-[#C8A45C] text-black shadow-md'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Cámara Web / Móvil</span>
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upload');
                  setScanResult(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === 'upload'
                    ? 'bg-[#C8A45C] text-black shadow-md'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir Imagen</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('manual');
                  setScanResult(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === 'manual'
                    ? 'bg-[#C8A45C] text-black shadow-md'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Marcación Rápida</span>
              </button>
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* TAB 1: Camera Scanner */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative aspect-video sm:aspect-[4/3] w-full bg-black rounded-2xl overflow-hidden border border-[#C8A45C]/30 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Luxury Scanner Overlay (Gold Corners & Laser Line) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-[#C8A45C]/40 rounded-2xl">
                    {/* Top-left corner */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#E6C875] rounded-tl-lg" />
                    {/* Top-right corner */}
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#E6C875] rounded-tr-lg" />
                    {/* Bottom-left corner */}
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#E6C875] rounded-bl-lg" />
                    {/* Bottom-right corner */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#E6C875] rounded-br-lg" />

                    {/* Animated scanning laser line */}
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#E6C875] to-transparent shadow-[0_0_12px_#E6C875] animate-bounce duration-1000" />
                  </div>
                </div>

                {/* Camera error message */}
                {cameraError && (
                  <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
                    <AlertTriangle className="w-10 h-10 text-amber-400" />
                    <p className="text-xs text-neutral-300 max-w-sm">{cameraError}</p>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] text-black flex items-center gap-1.5 shadow"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('upload')}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 text-white hover:bg-neutral-700"
                      >
                        Subir Foto QR
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls Bar */}
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Enfoca el código QR del colaborador dentro del recuadro</span>
                </span>
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center gap-1.5 transition font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cambiar Cámara</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Image File Upload (Exclusivo Administrador) */}
          {isAdmin && activeTab === 'upload' && (
            <div className="space-y-4">
              <label
                htmlFor="qr-file-input"
                className="border-2 border-dashed border-[#C8A45C]/40 hover:border-[#C8A45C] rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-neutral-900/50 hover:bg-neutral-900 group"
              >
                <Upload className="w-10 h-10 text-[#C8A45C] group-hover:scale-110 transition mb-3" />
                <span className="text-sm font-bold text-white mb-1">
                  Seleccionar foto o captura del Fotocheck QR
                </span>
                <span className="text-xs text-neutral-400 max-w-xs">
                  Formatos soportados: JPG, PNG, WEBP. Se procesará automáticamente en segundos.
                </span>
                <input
                  id="qr-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* TAB 3: Fast Manual Employee Punch (Exclusivo Administrador) */}
          {isAdmin && activeTab === 'manual' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder="Buscar colaborador por nombre, rol o DNI..."
                  className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#C8A45C]"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="p-3 rounded-xl bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/50 flex items-center justify-between gap-3 text-xs transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={emp.avatar || emp.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
                        alt={emp.full_name}
                        className="w-9 h-9 rounded-lg object-cover border border-neutral-700"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <span className="font-semibold text-white block">{emp.full_name}</span>
                        <span className="text-[10px] text-neutral-400 capitalize">
                          {emp.type} • DNI: {emp.dni}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDecodedQR(emp.id)}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] text-black font-bold text-[11px] shadow hover:brightness-110 transition"
                    >
                      Marcar Asistencia
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Realtime Scan Result Feedback Card */}
          {scanResult && (
            <div
              className={`p-4 rounded-2xl border transition-all animate-in fade-in zoom-in-95 duration-200 ${
                scanResult.success
                  ? scanResult.punctuality === 'tardanza'
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    : scanResult.punctuality === 'horas_extra'
                    ? 'bg-[#2A2312] border-[#E6C875] text-[#F3E3B5]'
                    : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {scanResult.employee ? (
                  <img
                    src={scanResult.employee.avatar || scanResult.employee.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
                    alt={scanResult.employee.full_name}
                    className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    {scanResult.success ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-rose-400" />
                    )}
                  </div>
                )}

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">
                      {scanResult.employee?.full_name || 'Marcación de Asistencia'}
                    </span>
                    {scanResult.type && (
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          scanResult.type === 'check_in'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {scanResult.type === 'check_in' ? '🟢 ENTRADA' : '🔵 SALIDA'}
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed">{scanResult.message}</p>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                    {scanResult.punctuality === 'puntual' && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>A Tiempo / Puntual</span>
                      </span>
                    )}
                    {scanResult.punctuality === 'tardanza' && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Tardanza ({scanResult.minutes} min de retraso)</span>
                      </span>
                    )}
                    {scanResult.punctuality === 'horas_extra' && (
                      <span className="px-2 py-0.5 rounded-md bg-[#C8A45C]/30 text-[#E6C875] border border-[#C8A45C]/50 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Saldo Horas Extra (+{scanResult.minutes} min)</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-[#161616] flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            Zona Horaria: <strong className="text-neutral-200">America/Lima (UTC-5)</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition"
          >
            Cerrar Escáner
          </button>
        </div>
      </div>

      {/* MODAL: Confirmación de Salida (Definitiva vs. Emergencia) */}
      {pendingExit && (
        <AttendanceExitModal
          isOpen={!!pendingExit}
          onClose={handleCloseExitModal}
          employee={pendingExit.employee}
          attendanceRecord={pendingExit.attendanceRecord}
          currentLimaTime={getLimaTimeString()}
          onConfirmExit={handleConfirmExitModal}
        />
      )}
    </div>
  );
};
