import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DashboardSkeleton } from './DashboardSkeleton';
import { Employee, Service, EmployeeBlock, EmployeeAppointmentItem } from '../../types';
import { timeToMinutes, minutesToTime } from '../../lib/bookingAvailability';
import {
  Users,
  Plus,
  QrCode,
  Phone,
  Mail,
  Clock,
  Check,
  X,
  Shield,
  ShieldAlert,
  Calendar,
  CalendarOff,
  Edit2,
  Trash2,
  FileText,
  Upload,
  AlertTriangle,
  Eye,
  CheckCircle,
  ExternalLink,
  Search,
  Sparkles,
  Lock,
  Scissors,
  Sparkle,
  Briefcase,
  AlertCircle,
  Info,
  Download,
  Loader2,
  Printer
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase/client';
import {
  sanitizePhone,
  sanitizeDni,
  isValidPhone,
  isValidDni,
  handleNumericKeyDown,
  PHONE_PLACEHOLDER,
  DNI_PLACEHOLDER,
  PHONE_ERROR_MESSAGE,
  DNI_ERROR_MESSAGE,
} from '../../lib/validators';

export type SalonRoleId = 'barbero' | 'spa' | 'recepcionista';

export interface SalonRoleConfig {
  id: SalonRoleId;
  name: string;
  badgeLabel: string;
  category: 'barberia' | 'spa' | null;
  description: string;
  skillsHeader: string;
  areaDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: {
    badge: string;
    borderActive: string;
    bgActive: string;
    iconColor: string;
  };
}

export const SALON_ROLES: SalonRoleConfig[] = [
  {
    id: 'barbero',
    name: 'Barbero',
    badgeLabel: 'Barbero',
    category: 'barberia',
    description: 'Enfocado a servicios de barbería, cortes clásicos, degradados y barba.',
    skillsHeader: 'Especialidades de Barbería (Cortes & Barba)',
    areaDesc: 'Área: Barbería & Peluquería',
    icon: Scissors,
    colorClasses: {
      badge: 'bg-[#C8A45C]/15 text-[#E6C875] border-[#C8A45C]/40',
      borderActive: 'border-[#C8A45C]',
      bgActive: 'bg-[#C8A45C]/15',
      iconColor: 'text-[#C8A45C]',
    },
  },
  {
    id: 'spa',
    name: 'Spa',
    badgeLabel: 'Spa',
    category: 'spa',
    description: 'Enfocado a estética, masajes relajantes/descontracturantes y cuidado facial/corporal.',
    skillsHeader: 'Especialidades de Spa & Estética (Faciales & Masajes)',
    areaDesc: 'Área: Spa, Masajes & Estética',
    icon: Sparkle,
    colorClasses: {
      badge: 'bg-purple-950/40 text-purple-300 border-purple-800/50',
      borderActive: 'border-purple-500',
      bgActive: 'bg-purple-950/30',
      iconColor: 'text-purple-400',
    },
  },
  {
    id: 'recepcionista',
    name: 'Recepcionista',
    badgeLabel: 'Recepcionista',
    category: null,
    description: 'Personal enfocado a caja, cobros, agenda y atención presencial al cliente.',
    skillsHeader: 'Atención en Mostrador y Caja',
    areaDesc: 'Área: Caja, Agenda & Recepción',
    icon: Briefcase,
    colorClasses: {
      badge: 'bg-blue-950/40 text-blue-300 border-blue-800/50',
      borderActive: 'border-blue-500',
      bgActive: 'bg-blue-950/30',
      iconColor: 'text-blue-400',
    },
  },
];

export const getRoleMeta = (rawType: string) => {
  const t = (rawType || '').toLowerCase();
  if (t === 'barbero' || t === 'barberia') {
    return SALON_ROLES[0];
  }
  if (t === 'spa' || t === 'terapeuta_spa' || t === 'masajista' || t === 'cosmiatra' || t === 'estilista') {
    return SALON_ROLES[1];
  }
  return SALON_ROLES[2];
};

const LEAVE_TYPES = [
  'Vacaciones',
  'Cita Médica',
  'Asunto Personal',
  'Capacitación',
  'Maternidad',
  'Otro Motivo',
] as const;

export const ColaboradoresView: React.FC = () => {
  const {
    employees,
    services,
    bookings,
    employeeBlocks,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeActive,
    addEmployeeLeave,
    deleteEmployeeBlock,
    currentRole,
    isDataLoading,
  } = useApp();

  const isAdmin = currentRole === 'admin';
  const isRecepcionista = currentRole === 'recepcionista';

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'todos' | 'barbero' | 'spa' | 'recepcionista'>('todos');

  // --- MODALS STATE ---
  // 1. Create Employee Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newDni, setNewDni] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState<SalonRoleId>('barbero');
  const [newHandlesReception, setNewHandlesReception] = useState(false);
  const [newShiftStart, setNewShiftStart] = useState('09:00');
  const [newShiftEnd, setNewShiftEnd] = useState('18:00');
  const [newCommissionPct, setNewCommissionPct] = useState(40);
  const [newSelectedSkills, setNewSelectedSkills] = useState<string[]>([]);
  const [isSavingNew, setIsSavingNew] = useState(false);

  // 2. Edit Employee Modal
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editDni, setEditDni] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editType, setEditType] = useState<SalonRoleId>('barbero');
  const [editHandlesReception, setEditHandlesReception] = useState(false);
  const [editShiftStart, setEditShiftStart] = useState('09:00');
  const [editShiftEnd, setEditShiftEnd] = useState('18:00');
  const [editCommissionPct, setEditCommissionPct] = useState(40);
  const [editSelectedSkills, setEditSelectedSkills] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 3. Delete Confirmation Modal
  const [deleteEmpTarget, setDeleteEmpTarget] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 4. QR Fotocheck Modal
  const fotocheckRef = useRef<HTMLDivElement | null>(null);
  const [badgeEmp, setBadgeEmp] = useState<Employee | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [isDownloadingBadge, setIsDownloadingBadge] = useState(false);

  // 5. Leave / Absence Modal
  const [leaveEmp, setLeaveEmp] = useState<Employee | null>(null);
  const [leaveType, setLeaveType] = useState<string>('Vacaciones');
  const [leaveDateMode, setLeaveDateMode] = useState<'puntual' | 'rango'>('puntual');
  const [leaveStartDate, setLeaveStartDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  });
  const [leaveEndDate, setLeaveEndDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  });
  const [leaveIsFullDay, setLeaveIsFullDay] = useState(true);
  const [leaveStartTime, setLeaveStartTime] = useState('09:00');
  const [leaveEndTime, setLeaveEndTime] = useState('18:00');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveVoucherFile, setLeaveVoucherFile] = useState<File | null>(null);
  const [leaveVoucherPreview, setLeaveVoucherPreview] = useState<string | null>(null);
  const [isSavingLeave, setIsSavingLeave] = useState(false);
  const [leaveActionFeedback, setLeaveActionFeedback] = useState<string | null>(null);

  // 6. Assigned Appointments Modal
  const [appointmentsEmp, setAppointmentsEmp] = useState<Employee | null>(null);
  const [appointmentsDateFilter, setAppointmentsDateFilter] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  });
  const [dbAppointments, setDbAppointments] = useState<EmployeeAppointmentItem[] | null>(null);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Cargar citas específicas a nivel de servicio desde RPC de Supabase
  useEffect(() => {
    if (!appointmentsEmp) {
      setDbAppointments(null);
      return;
    }

    let isMounted = true;
    const fetchAgenda = async () => {
      setIsLoadingAppointments(true);
      try {
        const { data, error } = await supabase.rpc('get_employee_agenda', {
          p_employee_id: appointmentsEmp.id,
          p_date: appointmentsDateFilter || null,
        });

        if (!error && data && isMounted) {
          setDbAppointments(data as EmployeeAppointmentItem[]);
        }
      } catch (err) {
        console.error('Error fetching employee agenda via RPC:', err);
      } finally {
        if (isMounted) {
          setIsLoadingAppointments(false);
        }
      }
    };

    fetchAgenda();

    return () => {
      isMounted = false;
    };
  }, [appointmentsEmp, appointmentsDateFilter]);

  // Today string America/Lima
  const todayLima = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  }, []);

  // Map of active leave for today per employee
  const activeLeavesToday = useMemo(() => {
    const map = new Map<string, EmployeeBlock>();
    (employeeBlocks || []).forEach((b) => {
      const bDate = b.block_date || b.date || b.start_date;
      const bEndDate = b.end_date || bDate;
      if (bDate && bEndDate && todayLima >= bDate && todayLima <= bEndDate) {
        map.set(b.employee_id, b);
      }
    });
    return map;
  }, [employeeBlocks, todayLima]);

  // Counts by role
  const roleCounts = useMemo(() => {
    let barberos = 0;
    let spas = 0;
    let recepcionistas = 0;
    employees.forEach((emp) => {
      const meta = getRoleMeta(emp.type);
      if (meta.id === 'barbero') barberos++;
      else if (meta.id === 'spa') spas++;
      else if (meta.id === 'recepcionista') recepcionistas++;
    });
    return { barberos, spas, recepcionistas };
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const meta = getRoleMeta(emp.type);
      const matchSearch =
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.dni && emp.dni.includes(searchTerm)) ||
        (emp.phone && emp.phone.includes(searchTerm));

      const matchRole = filterRole === 'todos' || meta.id === filterRole;

      return matchSearch && matchRole;
    });
  }, [employees, searchTerm, filterRole]);

  // Available services for the chosen create role
  const availableServicesForNew = useMemo(() => {
    if (newType === 'barbero') {
      return services.filter((s) => s.category === 'barberia');
    }
    if (newType === 'spa') {
      return services.filter((s) => s.category === 'spa');
    }
    return [];
  }, [services, newType]);

  // Available services for the chosen edit role
  const availableServicesForEdit = useMemo(() => {
    if (editType === 'barbero') {
      return services.filter((s) => s.category === 'barberia');
    }
    if (editType === 'spa') {
      return services.filter((s) => s.category === 'spa');
    }
    return [];
  }, [services, editType]);

  // --- HANDLERS ---

  // Handle select role in Create Modal
  const handleSelectNewRole = (roleId: SalonRoleId) => {
    setNewType(roleId);
    if (roleId === 'recepcionista') {
      setNewHandlesReception(true);
      setNewSelectedSkills([]);
    } else {
      // Filter existing skills to only those that match the category
      const targetCategory = roleId === 'barbero' ? 'barberia' : 'spa';
      const validSkillIds = services
        .filter((s) => s.category === targetCategory)
        .map((s) => s.id);
      setNewSelectedSkills((prev) => prev.filter((id) => validSkillIds.includes(id)));
    }
  };

  // Handle select role in Edit Modal
  const handleSelectEditRole = (roleId: SalonRoleId) => {
    setEditType(roleId);
    if (roleId === 'recepcionista') {
      setEditHandlesReception(true);
      setEditSelectedSkills([]);
    } else {
      const targetCategory = roleId === 'barbero' ? 'barberia' : 'spa';
      const validSkillIds = services
        .filter((s) => s.category === targetCategory)
        .map((s) => s.id);
      setEditSelectedSkills((prev) => prev.filter((id) => validSkillIds.includes(id)));
    }
  };

  // Open QR Fotocheck
  const handleOpenBadge = async (emp: Employee) => {
    if (!isAdmin) return;
    setBadgeEmp(emp);
    const qrData = emp.qr_code || `ACICALADOS-EMP-${emp.id}-${emp.dni || 'PASS'}`;
    try {
      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 260,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrUrl(dataUrl);
    } catch (err) {
      console.error('Error generating QR:', err);
    }
  };

  // Download Fotocheck as PNG Image using Native Canvas
  const handleDownloadBadge = async () => {
    if (!badgeEmp || !qrUrl || !isAdmin) return;
    setIsDownloadingBadge(true);

    const generateBadgeCanvas = async (allowExternalAvatar: boolean) => {
      const canvas = document.createElement('canvas');
      const scale = 2; // 2x Retina high-resolution
      const cardWidth = 420 * scale; // 840px
      const cardHeight = 650 * scale; // 1300px
      canvas.width = cardWidth;
      canvas.height = cardHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el contexto de canvas');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Recorte y esquinas redondeadas
      const cornerRadius = 32 * scale;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, cardWidth, cardHeight, cornerRadius);
      ctx.clip();

      // Fondo degradado oscuro de lujo (#161616 a #080808)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, cardHeight);
      bgGrad.addColorStop(0, '#161616');
      bgGrad.addColorStop(0.5, '#0e0e0e');
      bgGrad.addColorStop(1, '#080808');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cardWidth, cardHeight);

      // Resplandor radial dorado suave
      const radialGlow = ctx.createRadialGradient(
        cardWidth / 2,
        cardHeight * 0.3,
        10,
        cardWidth / 2,
        cardHeight * 0.3,
        cardWidth * 0.75
      );
      radialGlow.addColorStop(0, 'rgba(200, 164, 92, 0.14)');
      radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, cardWidth, cardHeight);

      // 2. Línea dorada superior
      const topBarGrad = ctx.createLinearGradient(0, 0, cardWidth, 0);
      topBarGrad.addColorStop(0, '#C8A45C');
      topBarGrad.addColorStop(0.5, '#F3E5AB');
      topBarGrad.addColorStop(1, '#C8A45C');
      ctx.fillStyle = topBarGrad;
      ctx.fillRect(0, 0, cardWidth, 7 * scale);

      // 3. Cabecera de Marca: ACICALADOS
      ctx.textAlign = 'center';
      ctx.font = `bold ${10 * scale}px "Inter", "system-ui", sans-serif`;
      ctx.fillStyle = '#C8A45C';
      ctx.fillText('ESTUDIO DE BELLEZA & SPA', cardWidth / 2, 40 * scale);

      ctx.font = `bold ${26 * scale}px "Cinzel", "Playfair Display", "Georgia", serif`;
      ctx.fillStyle = '#E6C875';
      ctx.fillText('ACICALADOS', cardWidth / 2, 68 * scale);

      ctx.font = `bold ${9.5 * scale}px "Inter", "system-ui", sans-serif`;
      ctx.fillStyle = '#A39268';
      ctx.fillText('VIP STAFF • CREDENCIAL OFICIAL', cardWidth / 2, 85 * scale);

      // Línea divisoria dorada
      ctx.strokeStyle = 'rgba(200, 164, 92, 0.4)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(50 * scale, 98 * scale);
      ctx.lineTo(cardWidth - 50 * scale, 98 * scale);
      ctx.stroke();

      // 4. Avatar / Monograma del colaborador
      let currentY = 138 * scale;
      const avatarRadius = 36 * scale;
      let avatarLoaded = false;
      const avatarSrc = badgeEmp.avatar || badgeEmp.avatar_url;

      if (allowExternalAvatar && avatarSrc) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = avatarSrc;
          });
          if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cardWidth / 2, currentY, avatarRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
              img,
              cardWidth / 2 - avatarRadius,
              currentY - avatarRadius,
              avatarRadius * 2,
              avatarRadius * 2
            );
            ctx.restore();

            ctx.strokeStyle = '#C8A45C';
            ctx.lineWidth = 2.5 * scale;
            ctx.beginPath();
            ctx.arc(cardWidth / 2, currentY, avatarRadius, 0, Math.PI * 2);
            ctx.stroke();
            avatarLoaded = true;
          }
        } catch {
          avatarLoaded = false;
        }
      }

      if (!avatarLoaded) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cardWidth / 2, currentY, avatarRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1c1c1c';
        ctx.fill();
        ctx.strokeStyle = '#C8A45C';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        ctx.fillStyle = '#E6C875';
        ctx.font = `bold ${22 * scale}px "Inter", sans-serif`;
        const initials = badgeEmp.full_name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        ctx.fillText(initials, cardWidth / 2, currentY + 7 * scale);
        ctx.restore();
      }

      currentY += avatarRadius + 26 * scale;

      // 5. Nombre Completo
      ctx.font = `bold ${20 * scale}px "Cinzel", "Playfair Display", "Georgia", serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(badgeEmp.full_name, cardWidth / 2, currentY);

      currentY += 23 * scale;

      // 6. Insignia de Rol / Ocupación y DNI
      const roleMeta = getRoleMeta(badgeEmp.type);
      const roleText = (roleMeta.badgeLabel || badgeEmp.type || 'COLABORADOR').toUpperCase();
      ctx.font = `bold ${10.5 * scale}px "Inter", sans-serif`;
      const roleMetrics = ctx.measureText(roleText);
      const badgeW = roleMetrics.width + 24 * scale;
      const badgeH = 22 * scale;

      ctx.fillStyle = 'rgba(200, 164, 92, 0.16)';
      ctx.strokeStyle = 'rgba(200, 164, 92, 0.6)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.roundRect(cardWidth / 2 - badgeW / 2, currentY - 15 * scale, badgeW, badgeH, 6 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E6C875';
      ctx.fillText(roleText, cardWidth / 2, currentY);

      currentY += 22 * scale;
      ctx.font = `${11 * scale}px "Courier New", monospace`;
      ctx.fillStyle = '#A3A3A3';
      ctx.fillText(`DNI: ${badgeEmp.dni || 'PASS'}`, cardWidth / 2, currentY);

      currentY += 25 * scale;

      // 7. Contenedor del Código QR (blanco nítido con marco dorado)
      const qrBoxSize = 195 * scale;
      const qrBoxX = cardWidth / 2 - qrBoxSize / 2;
      const qrBoxY = currentY;

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#C8A45C';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16 * scale);
      ctx.fill();
      ctx.stroke();

      // Dibujar imagen QR
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject(new Error('No se pudo cargar el QR generado'));
        qrImg.src = qrUrl;
      });

      const qrPadding = 12 * scale;
      ctx.drawImage(
        qrImg,
        qrBoxX + qrPadding,
        qrBoxY + qrPadding,
        qrBoxSize - qrPadding * 2,
        qrBoxSize - qrPadding * 2
      );

      currentY += qrBoxSize + 22 * scale;

      // 8. Código de Identificación y Leyenda
      const shortId = badgeEmp.id.length >= 8 ? badgeEmp.id.substring(0, 8).toUpperCase() : badgeEmp.id.toUpperCase();
      ctx.font = `bold ${10.5 * scale}px "Courier New", monospace`;
      ctx.fillStyle = '#D4AF37';
      ctx.fillText(`CÓDIGO: ACICALADOS-EMP-${shortId}`, cardWidth / 2, currentY);

      currentY += 17 * scale;
      ctx.font = `${9 * scale}px "Inter", sans-serif`;
      ctx.fillStyle = '#737373';
      ctx.fillText('Válido para lector biométrico de asistencia y turnos', cardWidth / 2, currentY);

      // 9. Borde dorado exterior perimetral
      ctx.restore();
      ctx.strokeStyle = '#C8A45C';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.roundRect(
        1.5 * scale,
        1.5 * scale,
        cardWidth - 3 * scale,
        cardHeight - 3 * scale,
        cornerRadius
      );
      ctx.stroke();

      return canvas;
    };

    try {
      let canvas: HTMLCanvasElement;
      let downloadUrl = '';

      try {
        canvas = await generateBadgeCanvas(true);
        downloadUrl = canvas.toDataURL('image/png');
      } catch {
        // En caso de bloqueo CORS por imagen externa, reintentar con monograma vectorial seguro
        canvas = await generateBadgeCanvas(false);
        downloadUrl = canvas.toDataURL('image/png');
      }

      const cleanName = (badgeEmp.full_name || 'Empleado')
        .trim()
        .replace(/\s+/g, '_')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const link = document.createElement('a');
      link.download = `Fotocheck_${cleanName}.png`;
      link.href = downloadUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error al descargar el fotocheck:', err);
    } finally {
      setIsDownloadingBadge(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (emp: Employee) => {
    if (!isAdmin) return;
    const roleMeta = getRoleMeta(emp.type);
    setEditEmp(emp);
    setEditFirstName(emp.first_name || emp.full_name.split(' ')[0] || '');
    setEditLastName(emp.last_name || emp.full_name.split(' ').slice(1).join(' ') || '');
    setEditDni(emp.dni || '');
    setEditPhone(emp.phone || '');
    setEditEmail(emp.email || '');
    setEditType(roleMeta.id);
    setEditHandlesReception(emp.handles_reception || roleMeta.id === 'recepcionista');
    setEditShiftStart(emp.shift_start || '09:00');
    setEditShiftEnd(emp.shift_end || '18:00');
    setEditCommissionPct(emp.commission_percentage ?? 40);
    setEditSelectedSkills(emp.skills || []);
  };

  // Open Leave Modal
  const handleOpenLeaveModal = (emp: Employee) => {
    if (!isAdmin) return;
    setLeaveEmp(emp);
    setLeaveType('Vacaciones');
    setLeaveDateMode('puntual');
    setLeaveStartDate(todayLima);
    setLeaveEndDate(todayLima);
    setLeaveIsFullDay(true);
    setLeaveStartTime('09:00');
    setLeaveEndTime('18:00');
    setLeaveReason('');
    setLeaveVoucherFile(null);
    setLeaveVoucherPreview(null);
    setLeaveActionFeedback(null);
  };

  // Open Appointments Modal
  const handleOpenAppointmentsModal = (emp: Employee) => {
    setAppointmentsEmp(emp);
    setAppointmentsDateFilter(todayLima);
  };

  // Submit Create Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newFirstName.trim() || !newLastName.trim() || !newDni.trim()) {
      alert('Por favor complete los nombres, apellidos y DNI.');
      return;
    }
    if (!isValidDni(newDni.trim())) {
      alert(DNI_ERROR_MESSAGE);
      return;
    }
    if (newPhone.trim() && !isValidPhone(newPhone.trim())) {
      alert(PHONE_ERROR_MESSAGE);
      return;
    }

    setIsSavingNew(true);
    try {
      const created = await addEmployee({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        full_name: `${newFirstName.trim()} ${newLastName.trim()}`,
        dni: newDni.trim(),
        phone: newPhone.trim() || '900000000',
        email: newEmail.trim() || `${newFirstName.toLowerCase().replace(/\s+/g, '')}@acicalados.pe`,
        type: newType,
        handles_reception: newType === 'recepcionista' ? true : newHandlesReception,
        shift_start: newShiftStart,
        shift_end: newShiftEnd,
        commission_percentage: Number(newCommissionPct),
        active: true,
        skills: newType === 'recepcionista' ? [] : newSelectedSkills,
        avatar:
          newType === 'barbero'
            ? 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'
            : newType === 'spa'
            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80'
            : 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80',
      });

      if (created) {
        setIsNewModalOpen(false);
        setNewFirstName('');
        setNewLastName('');
        setNewDni('');
        setNewPhone('');
        setNewEmail('');
        setNewSelectedSkills([]);
        setNewHandlesReception(false);
        setNewType('barbero');
      } else {
        alert('Hubo un error al guardar el colaborador.');
      }
    } finally {
      setIsSavingNew(false);
    }
  };

  // Submit Update Employee
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editEmp) return;
    if (!editFirstName.trim() || !editLastName.trim() || !editDni.trim()) {
      alert('Por favor complete los nombres, apellidos y DNI.');
      return;
    }
    if (!isValidDni(editDni.trim())) {
      alert(DNI_ERROR_MESSAGE);
      return;
    }
    if (editPhone.trim() && !isValidPhone(editPhone.trim())) {
      alert(PHONE_ERROR_MESSAGE);
      return;
    }

    setIsSavingEdit(true);
    try {
      const success = await updateEmployee({
        ...editEmp,
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        full_name: `${editFirstName.trim()} ${editLastName.trim()}`,
        dni: editDni.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        type: editType,
        handles_reception: editType === 'recepcionista' ? true : editHandlesReception,
        shift_start: editShiftStart,
        shift_end: editShiftEnd,
        commission_percentage: Number(editCommissionPct),
        skills: editType === 'recepcionista' ? [] : editSelectedSkills,
      });

      if (success) {
        setEditEmp(null);
      } else {
        alert('Error al actualizar el colaborador.');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Submit Delete Employee
  const handleDeleteEmployee = async () => {
    if (!isAdmin || !deleteEmpTarget) return;
    setIsDeleting(true);
    try {
      const ok = await deleteEmployee(deleteEmpTarget.id);
      if (ok) {
        setDeleteEmpTarget(null);
      } else {
        alert('No se pudo eliminar el colaborador.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit Register Leave
  const handleRegisterLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !leaveEmp) return;
    if (!leaveReason.trim()) {
      alert('Por favor ingrese el motivo o justificación de la ausencia.');
      return;
    }

    setIsSavingLeave(true);
    setLeaveActionFeedback(null);
    try {
      let uploadedVoucherUrl: string | undefined = undefined;

      // Upload voucher file if selected
      if (leaveVoucherFile) {
        const fileExt = leaveVoucherFile.name.split('.').pop() || 'jpg';
        const cleanName = leaveVoucherFile.name.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${Date.now()}_${cleanName}.${fileExt}`;
        const filePath = `comprobantes/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('employee-leaves')
          .upload(filePath, leaveVoucherFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (!uploadErr) {
          const { data: publicData } = supabase.storage
            .from('employee-leaves')
            .getPublicUrl(filePath);
          uploadedVoucherUrl = publicData.publicUrl;
        } else {
          console.error('Error uploading leave voucher:', uploadErr);
        }
      }

      const ok = await addEmployeeLeave({
        employee_id: leaveEmp.id,
        leave_type: leaveType,
        reason: leaveReason.trim(),
        start_date: leaveStartDate,
        end_date: leaveDateMode === 'rango' ? leaveEndDate : leaveStartDate,
        start_time: leaveIsFullDay ? '00:00' : leaveStartTime,
        end_time: leaveIsFullDay ? '23:59' : leaveEndTime,
        is_full_day: leaveIsFullDay,
        document_url: uploadedVoucherUrl,
      });

      if (ok) {
        setLeaveActionFeedback('¡Permiso registrado y horario bloqueado exitosamente!');
        setTimeout(() => {
          setLeaveEmp(null);
        }, 1200);
      } else {
        alert('Error al registrar el permiso de ausencia.');
      }
    } finally {
      setIsSavingLeave(false);
    }
  };

  // Toggle skills in multi-check
  const toggleSkill = (serviceId: string, currentList: string[], setList: (l: string[]) => void) => {
    if (currentList.includes(serviceId)) {
      setList(currentList.filter((id) => id !== serviceId));
    } else {
      setList([...currentList, serviceId]);
    }
  };

  // Citas y servicios asignados a nivel de ítem independiente para el colaborador
  const inMemoryAppointments = useMemo((): EmployeeAppointmentItem[] => {
    if (!appointmentsEmp) return [];
    const items: EmployeeAppointmentItem[] = [];

    (bookings || []).forEach((b) => {
      if (b.date !== appointmentsDateFilter) return;

      const matchingServices = (b.services || []).filter(
        (s) => s.employee_id === appointmentsEmp.id
      );

      // Si el colaborador tiene asignados servicios específicos dentro de la reserva
      if (matchingServices.length > 0) {
        matchingServices.forEach((s) => {
          const catalogSrv = services.find((cs) => cs.id === s.service_id || cs.name === s.service_name);
          const priceCents = s.price_cents || catalogSrv?.price_cents || 0;
          const durationMinutes = s.duration_minutes || catalogSrv?.duration_minutes || 30;
          const srvStart = (s.hora_inicio || s.start_time || b.start_time)?.substring(0, 5) || '10:00';
          const srvEnd = minutesToTime(timeToMinutes(srvStart) + durationMinutes);

          items.push({
            id: s.id || `${b.id}-${s.service_id || Math.random()}`,
            booking_id: b.id,
            booking_code: b.code,
            client_name: b.client_name,
            client_phone: b.client_phone,
            client_email: b.client_email,
            booking_date: b.date,
            service_id: s.service_id,
            service_name: s.service_name,
            service_price_cents: priceCents,
            duration_minutes: durationMinutes,
            start_time: srvStart,
            end_time: srvEnd,
            payment_status: b.payment_status,
          });
        });
      } else if ((b as any).assigned_employee_id === appointmentsEmp.id) {
        // Fallback cuando la reserva no detalló servicios y fue asignada a nivel global
        const primarySrv = b.services?.[0];
        const catalogSrv = primarySrv ? services.find((cs) => cs.id === primarySrv.service_id || cs.name === primarySrv.service_name) : null;
        const durationMinutes = primarySrv?.duration_minutes || catalogSrv?.duration_minutes || 30;
        const srvStart = b.start_time?.substring(0, 5) || '10:00';
        const srvEnd = minutesToTime(timeToMinutes(srvStart) + durationMinutes);

        items.push({
          id: `${b.id}-general`,
          booking_id: b.id,
          booking_code: b.code,
          client_name: b.client_name,
          client_phone: b.client_phone,
          client_email: b.client_email,
          booking_date: b.date,
          service_id: primarySrv?.service_id || '',
          service_name: primarySrv?.service_name || 'Servicio Programado',
          service_price_cents: primarySrv?.price_cents || catalogSrv?.price_cents || b.total_price_cents,
          duration_minutes: durationMinutes,
          start_time: srvStart,
          end_time: srvEnd,
          payment_status: b.payment_status,
        });
      }
    });

    return items.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, appointmentsEmp, appointmentsDateFilter, services]);

  // Selección de origen: datos de RPC de Supabase con fallback reactivo en memoria
  const assignedAppointmentsForDate = useMemo(() => {
    if (dbAppointments !== null) {
      return dbAppointments;
    }
    return inMemoryAppointments;
  }, [dbAppointments, inMemoryAppointments]);

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
              Gestión de Personal & Colaboradores
            </h1>
            {isAdmin ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40 flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#C8A45C]" />
                ADMINISTRADOR
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/40 text-blue-300 border border-blue-800/50 flex items-center gap-1">
                <Eye className="w-3 h-3 text-blue-400" />
                MODO RECEPCIONISTA (SOLO CONSULTA)
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            {isAdmin
              ? 'Organización del staff por áreas: Barbería, Spa y Recepción, con control biométrico QR y bloqueos de disponibilidad.'
              : 'Consulta operativa de colaboradores y monitoreo de citas asignadas por fecha.'}
          </p>
        </div>

        {/* Button: Nuevo Empleado (Admin Only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setNewType('barbero');
              setNewHandlesReception(false);
              setNewSelectedSkills([]);
              setIsNewModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow-lg shadow-[#C8A45C]/20 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Empleado</span>
          </button>
        )}
      </div>

      {/* RECEPTIONIST NOTICE BANNER */}
      {isRecepcionista && (
        <div className="bg-blue-950/30 border border-blue-800/40 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs text-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-900/40 border border-blue-700/50 flex items-center justify-center text-blue-300 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Vista Operativa de Consulta</p>
              <p className="text-blue-300/80 text-[11px]">
                Haz clic en cualquier colaborador o en &quot;Ver Citas Asignadas&quot; para inspeccionar las reservas programadas por fecha.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 bg-blue-900/50 rounded-lg text-[10px] font-mono font-semibold text-blue-300 border border-blue-700/50">
            Lectura exclusiva
          </span>
        </div>
      )}

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-neutral-400">Total Personal</span>
          <div className="text-2xl font-bold font-serif-luxury text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#C8A45C]" />
            {employees.length}
          </div>
          <span className="text-[10px] text-neutral-500">
            {employees.filter((e) => e.active).length} activos
          </span>
        </div>

        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-neutral-400">Barberos</span>
          <div className="text-2xl font-bold font-serif-luxury text-[#E6C875] flex items-center gap-2">
            <Scissors className="w-5 h-5 text-[#C8A45C]" />
            {roleCounts.barberos}
          </div>
          <span className="text-[10px] text-neutral-500">Área de Barbería</span>
        </div>

        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-neutral-400">Especialistas Spa</span>
          <div className="text-2xl font-bold font-serif-luxury text-purple-400 flex items-center gap-2">
            <Sparkle className="w-5 h-5 text-purple-400" />
            {roleCounts.spas}
          </div>
          <span className="text-[10px] text-neutral-500">Área de Estética & Relax</span>
        </div>

        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-neutral-400">Recepcionistas</span>
          <div className="text-2xl font-bold font-serif-luxury text-blue-400 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-400" />
            {roleCounts.recepcionistas}
          </div>
          <span className="text-[10px] text-neutral-500">Caja & Mostrador</span>
        </div>
      </div>

      {/* SEARCH AND ROLE FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#141414] border border-neutral-800 rounded-2xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#C8A45C]/50 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'todos' as const, label: 'Todos' },
            { id: 'barbero' as const, label: 'Barberos' },
            { id: 'spa' as const, label: 'Spa' },
            { id: 'recepcionista' as const, label: 'Recepcionistas' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterRole(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                filterRole === tab.id
                  ? 'bg-[#C8A45C] text-black shadow-md'
                  : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* GRID OF EMPLOYEES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((emp) => {
          const todayLeave = activeLeavesToday.get(emp.id);
          const roleMeta = getRoleMeta(emp.type);
          const RoleIcon = roleMeta.icon;

          return (
            <div
              key={emp.id}
              onClick={() => {
                if (isRecepcionista) {
                  handleOpenAppointmentsModal(emp);
                }
              }}
              className={`bg-[#141414] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl transition flex flex-col justify-between ${
                isRecepcionista ? 'cursor-pointer hover:border-blue-500/50 hover:bg-[#161616]' : 'hover:border-[#C8A45C]/40'
              }`}
            >
              <div className="space-y-4">
                {/* Active Leave Banner */}
                {todayLeave && (
                  <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-2.5 flex items-center justify-between gap-2 text-amber-200 text-xs">
                    <div className="flex items-center gap-2">
                      <CalendarOff className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white text-[11px] block">
                          EN AUSENCIA: {todayLeave.leave_type || 'Permiso'}
                        </span>
                        <span className="text-[10px] text-amber-300/80">
                          {todayLeave.reason || 'Horario bloqueado en reservas'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] bg-amber-900/60 border border-amber-700/60 text-amber-200 px-2 py-0.5 rounded font-mono">
                      Bloqueado
                    </span>
                  </div>
                )}

                {/* Card Header: Avatar & Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={emp.avatar || emp.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
                      alt={emp.full_name}
                      className="w-14 h-14 rounded-xl object-cover border border-[#C8A45C]/30 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h3 className="font-serif-luxury text-sm font-bold text-white leading-tight">
                        {emp.full_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {/* Unified 3-role badge */}
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${roleMeta.colorClasses.badge}`}>
                          <RoleIcon className="w-3 h-3" />
                          <span>{roleMeta.badgeLabel}</span>
                        </span>

                        {emp.handles_reception && roleMeta.id !== 'recepcionista' && (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                            Recepción de Apoyo
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono block mt-1">
                        DNI: {emp.dni || 'Sin registrar'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                      emp.active ? 'badge-success' : 'badge-neutral'
                    }`}
                  >
                    {emp.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Info Card Details */}
                <div className="space-y-2 text-xs bg-[#181818] p-3 rounded-xl border border-neutral-800">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      Turno:
                    </span>
                    <span className="font-medium text-white">
                      {emp.shift_start || '09:00'} - {emp.shift_end || '18:00'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-neutral-400" />
                      Teléfono:
                    </span>
                    <span className="font-medium text-white">{emp.phone || '-'}</span>
                  </div>
                  {emp.email && (
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-neutral-400" />
                        Correo:
                      </span>
                      <span className="font-medium text-white truncate max-w-[150px]">{emp.email}</span>
                    </div>
                  )}
                  {isAdmin && roleMeta.id !== 'recepcionista' && (
                    <div className="flex justify-between items-center pt-1 border-t border-neutral-800">
                      <span className="text-neutral-500">Comisión por servicio:</span>
                      <span className="font-bold text-[#E6C875]">{emp.commission_percentage || 40}%</span>
                    </div>
                  )}
                </div>

                {/* Specialties / Skills Tags according to Role */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                    {roleMeta.id === 'recepcionista' ? 'Área de Desempeño:' : `Especialidades (${emp.skills?.length || 0}):`}
                  </span>

                  {roleMeta.id === 'recepcionista' ? (
                    <div className="bg-[#181818] border border-neutral-800 rounded-lg p-2 text-[11px] text-neutral-300 flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Caja, Agenda & Atención al Cliente en Mostrador</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {emp.skills && emp.skills.length > 0 ? (
                        emp.skills.slice(0, 3).map((skillId) => {
                          const srv = services.find((s) => s.id === skillId);
                          return (
                            <span
                              key={skillId}
                              className="text-[9px] bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md truncate max-w-[140px]"
                            >
                              {srv ? srv.name : skillId}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-neutral-600 italic">Sin especialidades vinculadas</span>
                      )}
                      {emp.skills && emp.skills.length > 3 && (
                        <span className="text-[9px] bg-[#C8A45C]/10 border border-[#C8A45C]/30 text-[#E6C875] px-1.5 py-0.5 rounded-md font-bold">
                          +{emp.skills.length - 3} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BAR: STRICT RBAC DIFFERENTIATION */}
              <div className="pt-3 border-t border-neutral-800">
                {/* 1. RECEPCIONISTA: Solo "Ver Citas Asignadas" */}
                {isRecepcionista ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAppointmentsModal(emp);
                    }}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-blue-950/60 hover:bg-blue-900 text-blue-200 border border-blue-700/50 flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                  >
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>Ver Citas Asignadas</span>
                  </button>
                ) : (
                  /* 2. ADMINISTRADOR: Full actions */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Fotocheck con QR */}
                      <button
                        type="button"
                        onClick={() => handleOpenBadge(emp)}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-[#181818] hover:bg-[#222222] text-[#E6C875] border border-[#C8A45C]/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Ver Fotocheck y QR"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#C8A45C]" />
                        <span>Fotocheck QR</span>
                      </button>

                      {/* Citas Asignadas */}
                      <button
                        type="button"
                        onClick={() => handleOpenAppointmentsModal(emp)}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-[#181818] hover:bg-[#222222] text-neutral-200 border border-neutral-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Ver Citas Asignadas"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
                        <span>Ver Citas</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-850">
                      {/* Registrar Permiso / Ausencia */}
                      <button
                        type="button"
                        onClick={() => handleOpenLeaveModal(emp)}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50 flex items-center gap-1.5 transition cursor-pointer"
                        title="Registrar Permiso o Ausencia"
                      >
                        <CalendarOff className="w-3.5 h-3.5 text-amber-400" />
                        <span>Permiso / Ausencia</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {/* Editar Empleado */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer"
                          title="Editar Empleado"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#C8A45C]" />
                        </button>

                        {/* Activar/Desactivar */}
                        <button
                          type="button"
                          onClick={() => toggleEmployeeActive(emp.id)}
                          className={`p-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                            emp.active
                              ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                          }`}
                          title={emp.active ? 'Desactivar Colaborador' : 'Activar Colaborador'}
                        >
                          <Check className={`w-3.5 h-3.5 ${emp.active ? 'text-neutral-500' : 'text-emerald-400'}`} />
                        </button>

                        {/* Eliminar Empleado */}
                        <button
                          type="button"
                          onClick={() => setDeleteEmpTarget(emp)}
                          className="p-1.5 rounded-lg bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-900/40 transition cursor-pointer"
                          title="Eliminar Colaborador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-white font-serif-luxury">No se encontraron colaboradores</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Prueba ajustando los términos de búsqueda o el filtro de área.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: NUEVO EMPLEADO (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {isNewModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/20 border border-[#C8A45C]/40 flex items-center justify-center text-[#E6C875]">
                  <Plus className="w-5 h-5 text-[#C8A45C]" />
                </div>
                <div>
                  <h3 className="font-serif-luxury text-base font-bold text-white">
                    Registrar Nuevo Empleado
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Selecciona el área de trabajo (Barbero, Spa o Recepcionista) y vincula sus especialidades.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              {/* 1. Selector Simplificado de los 3 Roles Fijos */}
              <div className="space-y-2">
                <label className="text-neutral-200 font-semibold block text-xs">
                  Tipo de Personal / Rol en el Salón *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SALON_ROLES.map((role) => {
                    const isSelected = newType === role.id;
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => handleSelectNewRole(role.id)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? `${role.colorClasses.bgActive} ${role.colorClasses.borderActive} shadow-md`
                            : 'bg-[#181818] border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 ${isSelected ? role.colorClasses.iconColor : 'text-neutral-500'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white flex items-center gap-1">
                              <Check className="w-3 h-3 text-[#C8A45C]" />
                              Activo
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-white text-xs block font-serif-luxury">
                            {role.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 leading-tight block mt-0.5">
                            {role.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nombres & Apellidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Nombres *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Manuel"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C]/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Apellidos *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Valdivia Ramos"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C]/50"
                  />
                </div>
              </div>

              {/* Switch de Recepción (para Barbero/Spa, o bloqueado en true para Recepcionista) */}
              <div className="space-y-1">
                <label className="flex items-center justify-between gap-3 bg-[#181818] border border-neutral-800 rounded-xl p-3 cursor-pointer hover:border-neutral-700">
                  <div className="space-y-0.5">
                    <span className="text-white font-medium text-xs block">
                      {newType === 'recepcionista' ? 'Atención en Recepción & Mostrador (Habilitado por Rol)' : '¿Habilitar también para atención en recepción y caja?'}
                    </span>
                    <span className="text-[11px] text-neutral-400 block">
                      {newType === 'recepcionista'
                        ? 'Este colaborador atiende principalmente caja y recepción.'
                        : 'Permite que este especialista cubra turnos de recepción de ser necesario.'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newType === 'recepcionista' ? true : newHandlesReception}
                    disabled={newType === 'recepcionista'}
                    onChange={(e) => setNewHandlesReception(e.target.checked)}
                    className="w-4 h-4 accent-[#C8A45C] rounded cursor-pointer shrink-0"
                  />
                </label>
              </div>

              {/* DNI, Teléfono & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-neutral-300 font-medium">DNI / Documento *</label>
                    <span className="text-[10px] text-neutral-500 font-mono">8 dígitos</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    required
                    placeholder={DNI_PLACEHOLDER}
                    value={newDni}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => setNewDni(sanitizeDni(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none font-mono focus:border-[#C8A45C]/50"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-neutral-300 font-medium">Teléfono WhatsApp</label>
                    <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{9}"
                    maxLength={9}
                    placeholder={PHONE_PLACEHOLDER}
                    value={newPhone}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => setNewPhone(sanitizePhone(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none font-mono focus:border-[#C8A45C]/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="ejemplo@acicalados.pe"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C]/50"
                  />
                </div>
              </div>

              {/* Horario y Comisión */}
              <div className="grid grid-cols-3 gap-3 bg-[#181818] p-3 rounded-xl border border-neutral-800">
                <div className="space-y-1">
                  <label className="text-neutral-400">Inicio Jornada</label>
                  <input
                    type="time"
                    value={newShiftStart}
                    onChange={(e) => setNewShiftStart(e.target.value)}
                    className="w-full bg-[#141414] border border-neutral-700 text-white rounded-lg p-2 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-400">Fin Jornada</label>
                  <input
                    type="time"
                    value={newShiftEnd}
                    onChange={(e) => setNewShiftEnd(e.target.value)}
                    className="w-full bg-[#141414] border border-neutral-700 text-white rounded-lg p-2 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-400">Comisión (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newCommissionPct}
                    onChange={(e) => setNewCommissionPct(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-neutral-700 text-white rounded-lg p-2 outline-none font-bold text-[#E6C875]"
                  />
                </div>
              </div>

              {/* Selector de Especialidades FILTRADO según Barbero o Spa, o informativo para Recepcionista */}
              <div className="space-y-2">
                {newType === 'recepcionista' ? (
                  <div className="bg-blue-950/25 border border-blue-800/40 rounded-xl p-3.5 space-y-1 text-blue-200">
                    <div className="flex items-center gap-2 font-bold text-white text-xs">
                      <Briefcase className="w-4 h-4 text-blue-400" />
                      <span>Área Operativa: Recepción & Caja</span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      El personal con rol de Recepcionista está enfocado en atención presencial, caja, cobranzas y control de turnos en mostrador. No requiere vinculación a especialidades técnicas de corte o spa.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                        <span>{newType === 'barbero' ? 'Especialidades de Barbería' : 'Especialidades de Spa & Estética'}</span>
                        <span className="text-[10px] text-[#C8A45C] font-semibold">
                          ({newSelectedSkills.length} de {availableServicesForNew.length} seleccionadas)
                        </span>
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        Filtrado por área ({newType === 'barbero' ? 'Barbería' : 'Spa'})
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-neutral-800 rounded-xl p-3 bg-[#181818] grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableServicesForNew.length > 0 ? (
                        availableServicesForNew.map((srv) => {
                          const isChecked = newSelectedSkills.includes(srv.id);
                          return (
                            <label
                              key={srv.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                                isChecked
                                  ? 'bg-[#C8A45C]/15 border-[#C8A45C]/50 text-white'
                                  : 'bg-[#141414] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSkill(srv.id, newSelectedSkills, setNewSelectedSkills)}
                                className="w-4 h-4 accent-[#C8A45C] rounded mt-0.5 cursor-pointer"
                              />
                              <div className="text-[11px] leading-snug">
                                <span className="font-semibold block">{srv.name}</span>
                                <span className="text-[10px] text-neutral-500">
                                  {srv.duration_minutes} min • S/ {(srv.price_cents / 100).toFixed(2)}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      ) : (
                        <div className="col-span-2 text-center py-4 text-neutral-500 text-xs italic">
                          No hay servicios registrados para la categoría {newType === 'barbero' ? 'Barbería' : 'Spa'}.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  disabled={isSavingNew}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNew}
                  className="px-5 py-2 rounded-xl font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {isSavingNew ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar Empleado</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDITAR EMPLEADO (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {editEmp && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/20 border border-[#C8A45C]/40 flex items-center justify-center text-[#E6C875]">
                  <Edit2 className="w-5 h-5 text-[#C8A45C]" />
                </div>
                <div>
                  <h3 className="font-serif-luxury text-base font-bold text-white">
                    Editar Empleado: {editEmp.full_name}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Actualiza su rol en salón, horarios y especialidades vinculadas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditEmp(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4 text-xs">
              {/* 1. Selector de los 3 Roles Fijos */}
              <div className="space-y-2">
                <label className="text-neutral-200 font-semibold block text-xs">
                  Tipo de Personal / Rol en el Salón *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SALON_ROLES.map((role) => {
                    const isSelected = editType === role.id;
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => handleSelectEditRole(role.id)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? `${role.colorClasses.bgActive} ${role.colorClasses.borderActive} shadow-md`
                            : 'bg-[#181818] border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 ${isSelected ? role.colorClasses.iconColor : 'text-neutral-500'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white flex items-center gap-1">
                              <Check className="w-3 h-3 text-[#C8A45C]" />
                              Activo
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-white text-xs block font-serif-luxury">
                            {role.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 leading-tight block mt-0.5">
                            {role.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nombres & Apellidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Nombres *</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C]/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C]/50"
                  />
                </div>
              </div>

              {/* Switch de Recepción */}
              <div className="space-y-1">
                <label className="flex items-center justify-between gap-3 bg-[#181818] border border-neutral-800 rounded-xl p-3 cursor-pointer hover:border-neutral-700">
                  <div className="space-y-0.5">
                    <span className="text-white font-medium text-xs block">
                      {editType === 'recepcionista' ? 'Atención en Recepción & Mostrador (Habilitado por Rol)' : '¿Habilitar también para atención en recepción y caja?'}
                    </span>
                    <span className="text-[11px] text-neutral-400 block">
                      {editType === 'recepcionista'
                        ? 'Este colaborador atiende principalmente caja y recepción.'
                        : 'Permite que este especialista cubra turnos de recepción de ser necesario.'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editType === 'recepcionista' ? true : editHandlesReception}
                    disabled={editType === 'recepcionista'}
                    onChange={(e) => setEditHandlesReception(e.target.checked)}
                    className="w-4 h-4 accent-[#C8A45C] rounded cursor-pointer shrink-0"
                  />
                </label>
              </div>

              {/* DNI, Teléfono & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-neutral-300 font-medium">DNI / Documento *</label>
                    <span className="text-[10px] text-neutral-500 font-mono">8 dígitos</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    required
                    placeholder={DNI_PLACEHOLDER}
                    value={editDni}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => setEditDni(sanitizeDni(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none font-mono focus:border-[#C8A45C]/50"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-neutral-300 font-medium">Teléfono WhatsApp</label>
                    <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{9}"
                    maxLength={9}
                    placeholder={PHONE_PLACEHOLDER}
                    value={editPhone}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => setEditPhone(sanitizePhone(e.target.value))}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none font-mono focus:border-[#C8A45C]/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Correo Electrónico</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-2.5 outline-none focus:border-[#C8A45C]/50"
                  />
                </div>
              </div>

              {/* Horario y Comisión */}
              <div className="grid grid-cols-3 gap-3 bg-[#181818] p-3 rounded-xl border border-neutral-800">
                <div className="space-y-1">
                  <label className="text-neutral-400">Inicio Jornada</label>
                  <input
                    type="time"
                    value={editShiftStart}
                    onChange={(e) => setEditShiftStart(e.target.value)}
                    className="w-full bg-[#141414] border border-neutral-700 text-white rounded-lg p-2 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-400">Fin Jornada</label>
                  <input
                    type="time"
                    value={editShiftEnd}
                    onChange={(e) => setEditShiftEnd(e.target.value)}
                    className="w-full bg-[#141414] border border-neutral-700 text-white rounded-lg p-2 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-400">Comisión (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editCommissionPct}
                    onChange={(e) => setEditCommissionPct(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-neutral-700 text-white rounded-lg p-2 outline-none font-bold text-[#E6C875]"
                  />
                </div>
              </div>

              {/* Especialidades Filtradas según el Rol */}
              <div className="space-y-2">
                {editType === 'recepcionista' ? (
                  <div className="bg-blue-950/25 border border-blue-800/40 rounded-xl p-3.5 space-y-1 text-blue-200">
                    <div className="flex items-center gap-2 font-bold text-white text-xs">
                      <Briefcase className="w-4 h-4 text-blue-400" />
                      <span>Área Operativa: Recepción & Caja</span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      El personal con rol de Recepcionista está enfocado en atención presencial, caja, cobranzas y control de turnos en mostrador. No requiere vinculación a especialidades técnicas de corte o spa.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                        <span>{editType === 'barbero' ? 'Especialidades de Barbería' : 'Especialidades de Spa & Estética'}</span>
                        <span className="text-[10px] text-[#C8A45C] font-semibold">
                          ({editSelectedSkills.length} de {availableServicesForEdit.length} seleccionadas)
                        </span>
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        Filtrado por área ({editType === 'barbero' ? 'Barbería' : 'Spa'})
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-neutral-800 rounded-xl p-3 bg-[#181818] grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableServicesForEdit.length > 0 ? (
                        availableServicesForEdit.map((srv) => {
                          const isChecked = editSelectedSkills.includes(srv.id);
                          return (
                            <label
                              key={srv.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                                isChecked
                                  ? 'bg-[#C8A45C]/15 border-[#C8A45C]/50 text-white'
                                  : 'bg-[#141414] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSkill(srv.id, editSelectedSkills, setEditSelectedSkills)}
                                className="w-4 h-4 accent-[#C8A45C] rounded mt-0.5 cursor-pointer"
                              />
                              <div className="text-[11px] leading-snug">
                                <span className="font-semibold block">{srv.name}</span>
                                <span className="text-[10px] text-neutral-500">
                                  {srv.duration_minutes} min • S/ {(srv.price_cents / 100).toFixed(2)}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      ) : (
                        <div className="col-span-2 text-center py-4 text-neutral-500 text-xs italic">
                          No hay servicios registrados para la categoría {editType === 'barbero' ? 'Barbería' : 'Spa'}.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditEmp(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {isSavingEdit ? (
                    <span>Guardando cambios...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Actualizar Datos</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMACIÓN DE ELIMINAR (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {deleteEmpTarget && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#141414] border border-red-900/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-950/50 border border-red-800/60 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-serif-luxury text-lg font-bold text-white">
                ¿Eliminar colaborador?
              </h3>
              <p className="text-xs text-neutral-300">
                Estás a punto de remover a <span className="font-bold text-white">{deleteEmpTarget.full_name}</span> del sistema.
              </p>
              <p className="text-[11px] text-neutral-500 pt-2">
                Esta acción eliminará sus registros de habilidades y bloques de horario. Las reservas históricas mantendrán el registro del servicio.
              </p>
            </div>

            <div className="pt-3 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteEmpTarget(null)}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 cursor-pointer"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CARNET CON QR DE ASISTENCIA (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {badgeEmp && isAdmin && (() => {
        const roleMeta = getRoleMeta(badgeEmp.type);
        const RoleIcon = roleMeta.icon;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
            <div className="max-w-sm w-full my-6 space-y-4 text-center">
              {/* Contenedor Fotocheck con Referencia para Captura y Estética de Credencial */}
              <div
                ref={fotocheckRef}
                id="fotocheck-card"
                className="bg-gradient-to-b from-[#161616] via-[#0e0e0e] to-[#080808] border-2 border-[#C8A45C] rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden text-center"
              >
                {/* Top luxury badge line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#C8A45C] via-[#F3E5AB] to-[#C8A45C]" />

                <div className="space-y-1 pt-1">
                  <span className="text-[9px] uppercase font-bold tracking-[0.25em] text-[#C8A45C] block">
                    Estudio de Belleza & Spa
                  </span>
                  <h2 className="font-serif-luxury text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C8A45C]">
                    ACICALADOS
                  </h2>
                  <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-400 block">
                    VIP Staff • Credencial Oficial
                  </span>
                </div>

                {/* Golden Divider */}
                <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-[#C8A45C]/60 to-transparent mx-auto" />

                {/* Avatar o Monograma */}
                <div className="flex justify-center">
                  {badgeEmp.avatar || badgeEmp.avatar_url ? (
                    <img
                      src={badgeEmp.avatar || badgeEmp.avatar_url}
                      alt={badgeEmp.full_name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#C8A45C] shadow-lg"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#181818] border-2 border-[#C8A45C] flex items-center justify-center text-[#E6C875] text-xl font-bold font-serif-luxury shadow-lg">
                      {badgeEmp.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-serif-luxury text-xl font-bold text-white">
                    {badgeEmp.full_name}
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border flex items-center gap-1 ${roleMeta.colorClasses.badge}`}>
                      <RoleIcon className="w-3 h-3" />
                      <span>{roleMeta.badgeLabel}</span>
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      DNI: {badgeEmp.dni || 'PASS'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {roleMeta.areaDesc}
                  </p>
                </div>

                {/* QR Container */}
                <div className="relative mx-auto w-48 h-48 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center border-2 border-[#C8A45C]/60">
                  {qrUrl ? (
                    <img src={qrUrl} alt="QR Fotocheck" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-black font-mono">Generando QR...</span>
                  )}
                </div>

                <div className="text-[11px] text-neutral-400 bg-black/40 p-2.5 rounded-xl border border-neutral-800 space-y-0.5 font-mono">
                  <p className="text-[#E6C875] font-semibold tracking-wider">
                    CÓDIGO: ACICALADOS-EMP-{badgeEmp.id.length >= 8 ? badgeEmp.id.substring(0, 8).toUpperCase() : badgeEmp.id.toUpperCase()}
                  </p>
                  <p className="text-[9px] text-neutral-500 font-sans">
                    Válido para lector biométrico de asistencia y turnos
                  </p>
                </div>
              </div>

              {/* Botones de Acción (Admin Only) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBadgeEmp(null)}
                  disabled={isDownloadingBadge}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={isDownloadingBadge}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-[#E6C875] border border-[#C8A45C]/40 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Imprimir Carnet</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBadge}
                  disabled={isDownloadingBadge}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#D4AF37] via-[#E6C875] to-[#C8A45C] hover:brightness-110 text-black shadow-lg shadow-[#C8A45C]/20 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Descargar Fotocheck en formato PNG"
                >
                  {isDownloadingBadge ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-black" />
                      <span>Descargar Fotocheck</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 5: REGISTRAR PERMISO / AUSENCIA (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {leaveEmp && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-amber-400">
                  <CalendarOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-luxury text-base font-bold text-white">
                    Registrar Permiso / Ausencia
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Colaborador: <span className="font-bold text-white">{leaveEmp.full_name}</span> ({getRoleMeta(leaveEmp.type).badgeLabel})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeaveEmp(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {leaveActionFeedback ? (
              <div className="bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-6 text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">{leaveActionFeedback}</h4>
                <p className="text-xs text-emerald-200">
                  El horario ha sido bloqueado en el motor de reservas.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegisterLeave} className="space-y-4 text-xs">
                {/* 1. Selector de tipo de ausencia en chips/botones */}
                <div className="space-y-1.5">
                  <label className="text-neutral-300 font-medium block">
                    Tipo de Ausencia / Motivo *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {LEAVE_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLeaveType(type)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          leaveType === type
                            ? 'bg-[#C8A45C] text-black shadow-md border border-[#C8A45C]'
                            : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Modalidad de fecha */}
                <div className="space-y-2 bg-[#181818] p-3.5 rounded-xl border border-neutral-800">
                  <div className="flex items-center justify-between">
                    <label className="text-neutral-300 font-medium">Modalidad de Fecha *</label>
                    <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-lg border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setLeaveDateMode('puntual')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                          leaveDateMode === 'puntual'
                            ? 'bg-[#C8A45C] text-black font-bold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Fecha Puntual (1 día)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaveDateMode('rango')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                          leaveDateMode === 'rango'
                            ? 'bg-[#C8A45C] text-black font-bold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Rango de Fechas
                      </button>
                    </div>
                  </div>

                  {leaveDateMode === 'puntual' ? (
                    <div className="space-y-2 pt-2">
                      <div className="space-y-1">
                        <label className="text-neutral-400">Fecha del Permiso</label>
                        <input
                          type="date"
                          required
                          value={leaveStartDate}
                          onChange={(e) => setLeaveStartDate(e.target.value)}
                          className="w-full bg-[#141414] border border-neutral-700 text-white rounded-xl p-2.5 outline-none font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-neutral-400">Desde (Fecha Inicio)</label>
                        <input
                          type="date"
                          required
                          value={leaveStartDate}
                          onChange={(e) => setLeaveStartDate(e.target.value)}
                          className="w-full bg-[#141414] border border-neutral-700 text-white rounded-xl p-2.5 outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-neutral-400">Hasta (Fecha Fin)</label>
                        <input
                          type="date"
                          required
                          min={leaveStartDate}
                          value={leaveEndDate}
                          onChange={(e) => setLeaveEndDate(e.target.value)}
                          className="w-full bg-[#141414] border border-neutral-700 text-white rounded-xl p-2.5 outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Todo el día toggle or specific hours */}
                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={leaveIsFullDay}
                        onChange={(e) => setLeaveIsFullDay(e.target.checked)}
                        className="w-4 h-4 accent-[#C8A45C] rounded cursor-pointer"
                      />
                      <span className="text-white font-medium text-xs">
                        Bloquear Jornada Completa
                      </span>
                    </label>

                    {!leaveIsFullDay && (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={leaveStartTime}
                          onChange={(e) => setLeaveStartTime(e.target.value)}
                          className="bg-[#141414] border border-neutral-700 text-white rounded-lg p-1.5 text-xs outline-none"
                        />
                        <span className="text-neutral-500">a</span>
                        <input
                          type="time"
                          value={leaveEndTime}
                          onChange={(e) => setLeaveEndTime(e.target.value)}
                          className="bg-[#141414] border border-neutral-700 text-white rounded-lg p-1.5 text-xs outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Motivo / Justificación */}
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">
                    Motivo / Justificación Detallada *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detalla el motivo del permiso (ej. Cita médica con especialista en ESSALUD, reposo programado)..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 text-white rounded-xl p-3 outline-none focus:border-[#C8A45C]/50 text-xs resize-none"
                  />
                </div>

                {/* 4. Comprobante adjunto */}
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#C8A45C]" />
                    <span>Comprobante Adjunto (Opcional - Imagen o PDF)</span>
                  </label>
                  <div className="border border-dashed border-neutral-800 hover:border-[#C8A45C]/50 bg-[#181818] rounded-xl p-3 text-center transition">
                    <input
                      type="file"
                      id="leave-voucher"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setLeaveVoucherFile(file);
                        if (file) {
                          setLeaveVoucherPreview(file.name);
                        } else {
                          setLeaveVoucherPreview(null);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="leave-voucher" className="cursor-pointer block space-y-1">
                      {leaveVoucherPreview ? (
                        <div className="text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>Archivo seleccionado: {leaveVoucherPreview}</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-neutral-400 text-xs">
                            Haz clic para seleccionar o arrastra certificado médico / constancia
                          </p>
                          <p className="text-[10px] text-neutral-600">
                            Se almacenará en el bucket de seguridad de Supabase
                          </p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* 5. Impacto en Disponibilidad Notice */}
                <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3 flex items-start gap-2.5 text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <span className="font-bold text-white">Impacto en Disponibilidad:</span> Al registrar este permiso, el sistema bloqueará automáticamente los intervalos de tiempo en la base de datos para impedir citas cruzadas.
                  </p>
                </div>

                {/* Permisos previamente registrados */}
                {(() => {
                  const empBlocks = (employeeBlocks || []).filter((b) => b.employee_id === leaveEmp.id);
                  if (empBlocks.length === 0) return null;

                  return (
                    <div className="pt-2 border-t border-neutral-800 space-y-2">
                      <span className="text-[11px] font-bold text-neutral-400 block">
                        Permisos Registrados Anteriores ({empBlocks.length})
                      </span>
                      <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                        {empBlocks.map((b) => (
                          <div
                            key={b.id}
                            className="bg-[#181818] border border-neutral-800 rounded-lg p-2 flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <span className="font-semibold text-white">
                                {b.leave_type || 'Ausencia'}
                              </span>{' '}
                              <span className="text-neutral-500 font-mono">
                                ({b.block_date || b.start_date} {b.end_date && b.end_date !== b.block_date ? `al ${b.end_date}` : ''})
                              </span>
                              <p className="text-[10px] text-neutral-400 truncate max-w-[280px]">
                                {b.reason}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {b.document_url && (
                                <a
                                  href={b.document_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[#C8A45C]"
                                  title="Ver comprobante adjunto"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteEmployeeBlock(b.id)}
                                className="p-1 rounded bg-red-950/30 hover:bg-red-900/50 text-red-400"
                                title="Revocar permiso"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Botones de acción */}
                <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveEmp(null)}
                    disabled={isSavingLeave}
                    className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingLeave}
                    className="px-5 py-2 rounded-xl font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    {isSavingLeave ? (
                      <span>Procesando...</span>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        <span>Registrar y Bloquear Horario</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CITAS ASIGNADAS (DISPONIBLE TANTO PARA ADMIN COMO RECEPCIONISTA) */}
      {/* ========================================================================= */}
      {appointmentsEmp && (() => {
        const roleMeta = getRoleMeta(appointmentsEmp.type);
        const RoleIcon = roleMeta.icon;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={appointmentsEmp.avatar || appointmentsEmp.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
                    alt={appointmentsEmp.full_name}
                    className="w-12 h-12 rounded-xl object-cover border border-[#C8A45C]/40"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="font-serif-luxury text-base font-bold text-white">
                      Citas Asignadas: {appointmentsEmp.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${roleMeta.colorClasses.badge}`}>
                        <RoleIcon className="w-3 h-3" />
                        <span>{roleMeta.badgeLabel}</span>
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        Turno {appointmentsEmp.shift_start || '09:00'} a {appointmentsEmp.shift_end || '18:00'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAppointmentsEmp(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Date Filter & Quick Switch */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#181818] p-3 rounded-xl border border-neutral-800 text-xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Calendar className="w-4 h-4 text-[#C8A45C]" />
                  <span className="text-neutral-300 font-medium">Filtrar por fecha:</span>
                  <input
                    type="date"
                    value={appointmentsDateFilter}
                    onChange={(e) => setAppointmentsDateFilter(e.target.value)}
                    className="bg-[#141414] border border-neutral-700 text-white rounded-lg px-2.5 py-1.5 outline-none font-mono text-xs focus:border-[#C8A45C]/50"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setAppointmentsDateFilter(todayLima)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      appointmentsDateFilter === todayLima
                        ? 'bg-[#C8A45C] text-black font-bold'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setAppointmentsDateFilter(tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
                    }}
                    className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer"
                  >
                    Mañana
                  </button>
                </div>
              </div>

              {/* Daily summary badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-[#181818] border border-neutral-800 rounded-xl p-2.5">
                  <span className="text-[10px] text-neutral-500 block">Total Servicios</span>
                  <span className="font-bold text-white text-base font-serif-luxury">
                    {assignedAppointmentsForDate.length}
                  </span>
                </div>
                <div className="bg-[#181818] border border-neutral-800 rounded-xl p-2.5">
                  <span className="text-[10px] text-neutral-500 block">Confirmadas</span>
                  <span className="font-bold text-emerald-400 text-base font-serif-luxury">
                    {assignedAppointmentsForDate.filter((b) => b.payment_status === 'total' || b.payment_status === 'parcial').length}
                  </span>
                </div>
                <div className="bg-[#181818] border border-neutral-800 rounded-xl p-2.5">
                  <span className="text-[10px] text-neutral-500 block">Pendientes</span>
                  <span className="font-bold text-amber-400 text-base font-serif-luxury">
                    {assignedAppointmentsForDate.filter((b) => b.payment_status === 'sin_pago').length}
                  </span>
                </div>
                <div className="bg-[#181818] border border-neutral-800 rounded-xl p-2.5">
                  <span className="text-[10px] text-neutral-500 block">Producción Día</span>
                  <span className="font-bold text-[#E6C875] text-base font-serif-luxury">
                    S/ {(assignedAppointmentsForDate.reduce((acc, it) => acc + (it.service_price_cents || 0), 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Appointments List */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {assignedAppointmentsForDate.length > 0 ? (
                  assignedAppointmentsForDate.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#181818] border border-neutral-800 rounded-xl p-3.5 space-y-2 text-xs hover:border-[#C8A45C]/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#E6C875] bg-[#C8A45C]/10 border border-[#C8A45C]/20 px-2 py-0.5 rounded text-[11px]">
                            {item.start_time} - {item.end_time}
                          </span>
                          <span className="font-semibold text-white text-sm">
                            {item.client_name}
                          </span>
                          {item.booking_code && (
                            <span className="text-[10px] font-mono text-neutral-500 hidden sm:inline">
                              ({item.booking_code})
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            item.status === 'confirmada'
                              ? 'badge-success'
                              : item.status === 'pendiente'
                              ? 'badge-warning'
                              : item.status === 'completada'
                              ? 'badge-info'
                              : 'badge-neutral'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400 pt-1 border-t border-neutral-850">
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-500">Servicio: </span>
                          <span className="text-neutral-200 font-medium">
                            {item.service_name}
                          </span>
                          <span className="text-neutral-500 font-mono text-[10px]">
                            ({item.duration_minutes} min)
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {item.client_phone && (
                            <span className="text-neutral-400 flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-[#C8A45C]" />
                              {item.client_phone}
                            </span>
                          )}
                          <span className="font-bold text-white">
                            Monto: S/ {(item.service_price_cents / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#181818] border border-neutral-800 rounded-xl p-8 text-center space-y-2">
                    <Calendar className="w-8 h-8 text-neutral-600 mx-auto" />
                    <p className="font-medium text-white text-xs">
                      No tiene citas asignadas para la fecha seleccionada ({appointmentsDateFilter}).
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Cambia la fecha en el selector para revisar otros días del mes.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-neutral-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAppointmentsEmp(null)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                >
                  Cerrar Ventana
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
