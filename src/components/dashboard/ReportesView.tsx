import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles, getBookingCollectedAmountCents, getBookingServicesWithCollectedCents, ServiceAuditItem } from '../../types';
import { getTodayDateString, getLimaDateFromTimestamp } from '../../data/initialData';
import { useFinancialSSOT, getServiceCategory } from '../../services/financialSSOT';
import { supabase } from '../../lib/supabase/client';
import { jsPDF } from 'jspdf';
import {
  Calendar,
  Download,
  Share2,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scissors,
  Sparkles,
  ShoppingBag,
  Users,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  FileSpreadsheet,
  CalendarCheck,
  Clock,
  Shirt,
  Percent,
  User,
  Search,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { DashboardSkeleton } from './DashboardSkeleton';

export const ReportesView: React.FC = () => {
  const {
    bookings,
    ventasMostrador,
    expenses,
    employees,
    services,
    wardrobe,
    isDataLoading,
    currentRole,
    currentUser,
    lastSyncTimestamp,
  } = useApp();

  const isAdmin = currentRole === 'admin' || currentUser?.role === 'admin';

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  // 1. Selector y Control de Fecha Dinámica (Zona Horaria America/Lima) y Filtro de Especialista
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [isQuickReportModalOpen, setIsQuickReportModalOpen] = useState<boolean>(false);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Estados para Tabla de Auditoría (Exclusivo ADMIN)
  const [auditServices, setAuditServices] = useState<ServiceAuditItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [auditAreaFilter, setAuditAreaFilter] = useState<'TODOS' | 'SPA' | 'BARBERÍA'>('TODOS');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Regla de Negocio: Menú desplegable DEBE mostrar únicamente a empleados de Spa o Barbería.
  // Prohibido incluir recepcionistas o administrativos.
  const eligibleSpecialists = useMemo(() => {
    return employees.filter((emp) => {
      if (!emp.active) return false;
      const roleStr = (emp.role || '').toLowerCase().trim();
      const typeStr = (emp.type || '').toLowerCase().trim();

      // Prohibición estricta de recepcionistas y administrativos
      if (
        roleStr === 'recepcionista' ||
        roleStr === 'recepcion' ||
        roleStr === 'admin' ||
        roleStr === 'administrador' ||
        typeStr === 'recepcionista' ||
        typeStr === 'recepcion' ||
        typeStr === 'admin' ||
        typeStr === 'administrador'
      ) {
        return false;
      }

      // Debe ser de área Spa o Barbería
      const isSpa =
        typeStr === 'spa' ||
        typeStr === 'terapeuta_spa' ||
        typeStr === 'cosmiatra' ||
        typeStr === 'masajista' ||
        typeStr === 'estilista';

      const isBarberia =
        typeStr === 'barberia' ||
        typeStr === 'barbero';

      return isSpa || isBarberia;
    });
  }, [employees]);

  // Especialista seleccionado actualmente
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return eligibleSpecialists.find((e) => e.id === selectedEmployeeId) || null;
  }, [eligibleSpecialists, selectedEmployeeId]);

  // Área del especialista ('spa' o 'barberia')
  const selectedEmployeeArea = useMemo<'spa' | 'barberia' | null>(() => {
    if (!selectedEmployee) return null;
    const typeStr = (selectedEmployee.type || '').toLowerCase().trim();
    if (
      typeStr === 'spa' ||
      typeStr === 'terapeuta_spa' ||
      typeStr === 'cosmiatra' ||
      typeStr === 'masajista' ||
      typeStr === 'estilista'
    ) {
      return 'spa';
    }
    return 'barberia';
  }, [selectedEmployee]);

  // Formateador dd/mm/aaaa
  const formattedDateLima = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-');
    return `${d}/${m}/${y}`;
  }, [selectedDate]);

  // Cambiadores de fecha rápidos
  const todayStr = getTodayDateString();
  const isToday = selectedDate === todayStr;

  const handleSetToday = () => setSelectedDate(todayStr);

  const handleSetYesterday = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  };

  const handleStepDay = (step: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + step);
    setSelectedDate(d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  };

  // 2. Cálculos y Métricas Reactivas Centralizadas (SSOT)
  const financialMetrics = useFinancialSSOT(selectedDate, {
    employeeId: selectedEmployee?.id,
    employeeArea: selectedEmployeeArea || undefined,
  });

  const {
    barberiaCents,
    spaCents,
    barberiaCount,
    spaCount,
    ventasMostradorCents: ventasCents,
    vestuarioCents,
    totalEgresosCents: egresosCents,
    totalIngresosCents,
    balanceNetoCents: gananciaNetaCents,
    filteredBookings: dayBookings,
    filteredVentas: dayVentas,
    filteredExpenses: dayExpenses,
  } = financialMetrics;

  // Total de Atenciones de la fecha (conteo de servicios agendados o citas)
  const totalAtenciones = useMemo(() => {
    return dayBookings.reduce((acc, b) => acc + (b.services?.length || 1), 0);
  }, [dayBookings]);

  // 3. Top de Servicios Más Reservados del Día (suma recaudación real por servicio)
  const topServices = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; totalCents: number; category: 'barberia' | 'spa' }
    >();

    dayBookings.forEach((b) => {
      const servicesWithCollected = getBookingServicesWithCollectedCents(b);
      servicesWithCollected.forEach((srv) => {
        const key = srv.service_name;
        const itemCategory = getServiceCategory(
          { service_id: srv.service_id, service_name: srv.service_name },
          services
        );

        const existing = map.get(key) || {
          name: srv.service_name,
          count: 0,
          totalCents: 0,
          category: itemCategory,
        };
        existing.count += 1;
        existing.totalCents += srv.collected_cents;
        map.set(key, existing);
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || b.totalCents - a.totalCents
    );
  }, [dayBookings, services]);

  // Producción detallada por colaborador (computa únicamente lo efectivamente cobrado)
  const specialistProduction = useMemo(() => {
    const dayServicesWithCollected = dayBookings.flatMap((b) =>
      getBookingServicesWithCollectedCents(b)
    );

    return employees
      .filter((emp) => emp.active)
      .map((emp) => {
        const empServices = dayServicesWithCollected.filter(
          (srv) =>
            srv.employee_id === emp.id ||
            srv.employee_name?.toLowerCase() === emp.full_name?.toLowerCase()
        );

        const totalCents = empServices.reduce(
          (acc, s) => acc + (s.collected_cents || 0),
          0
        );

        return {
          id: emp.id,
          name: emp.full_name,
          type: emp.type,
          servicesCount: empServices.length,
          totalCents,
        };
      })
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [employees, dayBookings]);

  // Consulta RPC a Supabase get_services_audit_breakdown con fallback local reactivo
  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;
    const fetchAudit = async () => {
      setIsLoadingAudit(true);
      try {
        const { data, error } = await supabase.rpc('get_services_audit_breakdown', {
          p_date: selectedDate,
          p_employee_id: selectedEmployeeId || null,
        });

        if (!error && data && isMounted) {
          setAuditServices(data as ServiceAuditItem[]);
          setIsLoadingAudit(false);
          return;
        }
      } catch (err) {
        console.warn('[ReportesView] Fallback local para auditoría de servicios:', err);
      }

      // Fallback local desde dayBookings si RPC no responde
      if (isMounted) {
        let fallbackItems: ServiceAuditItem[] = dayBookings.flatMap((b) => {
          return (b.services || []).map((srv) => {
            const itemCat = getServiceCategory(
              { service_id: srv.service_id, service_name: srv.service_name },
              services
            );
            const isSpa = itemCat === 'spa';

            const assignedEmp = employees.find(
              (e) =>
                e.id === srv.employee_id ||
                e.full_name?.toLowerCase() === srv.employee_name?.toLowerCase()
            );
            const empName = assignedEmp?.full_name || srv.employee_name || 'Especialista';

            const srvStart = srv.start_time || srv.hora_inicio || b.start_time || '10:00';
            const srvEnd = srv.end_time || srv.hora_fin || b.end_time || '11:00';

            return {
              service_item_id: srv.id,
              service_id: srv.service_id || null,
              service_name: srv.service_name,
              area: isSpa ? 'SPA' : 'BARBERÍA',
              booking_id: b.id,
              booking_code: b.code,
              client_name: b.client_name,
              price_cents: srv.price_cents,
              employee_id: srv.employee_id || null,
              employee_name: empName,
              booking_date: b.date,
              start_time: srvStart,
              end_time: srvEnd,
              hora_rango: `${srvStart} - ${srvEnd}`,
              completed_timestamp: b.completed_at || b.confirmed_at || b.created_at,
              payment_method: (b as any).payment_method || 'efectivo',
              payment_status: b.payment_status,
            };
          });
        });

        if (selectedEmployee) {
          fallbackItems = fallbackItems.filter(
            (item) =>
              item.employee_id === selectedEmployee.id ||
              (item.employee_name &&
                item.employee_name.toLowerCase().trim() === selectedEmployee.full_name.toLowerCase().trim())
          );
        }

        setAuditServices(fallbackItems);
        setIsLoadingAudit(false);
      }
    };

    fetchAudit();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, selectedEmployeeId, isAdmin, lastSyncTimestamp, dayBookings, services, employees, selectedEmployee]);

  // Filtrado reactivo de auditoría por área y buscador de texto
  const filteredAuditServices = useMemo(() => {
    return auditServices.filter((item) => {
      // 1. Filtro de área
      if (auditAreaFilter !== 'TODOS') {
        const areaUpper = item.area.toUpperCase();
        if (auditAreaFilter === 'SPA' && !areaUpper.includes('SPA')) return false;
        if (auditAreaFilter === 'BARBERÍA' && !areaUpper.includes('BARBER')) return false;
      }

      // 2. Buscador de texto
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase().trim();
        const matchName = item.service_name.toLowerCase().includes(q);
        const matchEmp = item.employee_name.toLowerCase().includes(q);
        const matchClient = item.client_name.toLowerCase().includes(q);
        const matchCode = item.booking_code.toLowerCase().includes(q);
        if (!matchName && !matchEmp && !matchClient && !matchCode) return false;
      }

      return true;
    });
  }, [auditServices, auditAreaFilter, auditSearchQuery]);

  // 4. Generación del Texto Estructurado "Reporte del Día"
  const formatSolesText = (cents: number): string => `S/ ${(cents / 100).toFixed(2)}`;

  const quickReportText = useMemo(() => {
    const specialistsLines = specialistProduction
      .map((sp) => `- ${sp.name}: ${formatSolesText(sp.totalCents)}`)
      .join('\n');

    return `Reportes Acicalados - ${formattedDateLima}

Producción por Especialista:
${specialistsLines}

Otros Ingresos:
- Ventas de Productos: ${formatSolesText(ventasCents)}
- Vestuario / Trajes: ${formatSolesText(vestuarioCents)}

Total Atenciones: ${totalAtenciones}
Total Ingresos del Día: ${formatSolesText(totalIngresosCents)}
Total Egresos: ${formatSolesText(egresosCents)}
Ganancia Neta: ${formatSolesText(gananciaNetaCents)}`;
  }, [
    formattedDateLima,
    specialistProduction,
    ventasCents,
    vestuarioCents,
    totalAtenciones,
    totalIngresosCents,
    egresosCents,
    gananciaNetaCents,
  ]);

  // Copiar al portapapeles
  const handleCopyQuickReport = async () => {
    try {
      await navigator.clipboard.writeText(quickReportText);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  // Compartir por WhatsApp
  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(quickReportText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // 5. Exportación en PDF Corporativo Oficial con jsPDF
  const handleExportPDF = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 14;

      // Header Bar Corporativa (Fondo oscuro de lujo)
      doc.setFillColor(15, 15, 15);
      doc.rect(0, 0, pageWidth, 32, 'F');

      // Línea dorada inferior en el banner
      doc.setDrawColor(200, 164, 92);
      doc.setLineWidth(1.2);
      doc.line(0, 32, pageWidth, 32);

      // Logo / Nombre Corporativo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(200, 164, 92); // Dorado #C8A45C
      doc.text('ACICALADOS SPA & BARBER SHOP', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(180, 180, 180);
      doc.text('DISEÑO & CALIDAD  ·  Av. Javier Prado Este 2450, San Borja, Lima', 14, 21);
      doc.text('RUC: 20608941231  ·  Tel: +51 987 654 321  ·  soporte@acicalados.pe', 14, 26);

      // Bloque derecho de fecha de reporte
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(230, 200, 117);
      doc.text(`Reporte Diario - ${formattedDateLima}`, pageWidth - 14, 16, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      const timeLima = new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' });
      doc.text(`Generado: ${formattedDateLima} ${timeLima} (Lima)`, pageWidth - 14, 22, {
        align: 'right',
      });
      doc.text('Estado: Verificado y Sincronizado', pageWidth - 14, 26, { align: 'right' });

      y = 40;

      // Título de Sección: Resumen Financiero
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text('1. RESUMEN FINANCIERO Y OPERATIVO DEL DÍA', 14, y);
      y += 5;

      // Cuadrícula de Métricas Financieras (2 filas x 3 columnas)
      const metricsData = [
        { label: 'Total Ingresos Cobrados', value: formatSolesText(totalIngresosCents), highlight: true },
        { label: 'Ingresos por Spa', value: formatSolesText(spaCents) },
        { label: 'Ingresos por Barbería', value: formatSolesText(barberiaCents) },
        { label: 'Ventas de Mostrador', value: formatSolesText(ventasCents) },
        { label: 'Egresos Operativos', value: formatSolesText(egresosCents), isExpense: true },
        { label: 'Ganancia Neta', value: formatSolesText(gananciaNetaCents), isNet: true },
      ];

      const boxWidth = (pageWidth - 28 - 8) / 3;
      const boxHeight = 16;

      metricsData.forEach((m, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = 14 + col * (boxWidth + 4);
        const by = y + row * (boxHeight + 3);

        if (m.highlight) {
          doc.setFillColor(247, 243, 232);
          doc.setDrawColor(200, 164, 92);
        } else if (m.isNet) {
          doc.setFillColor(240, 249, 244);
          doc.setDrawColor(34, 197, 94);
        } else if (m.isExpense) {
          doc.setFillColor(254, 242, 242);
          doc.setDrawColor(239, 68, 68);
        } else {
          doc.setFillColor(249, 249, 249);
          doc.setDrawColor(225, 225, 225);
        }

        doc.setLineWidth(0.3);
        doc.roundedRect(bx, by, boxWidth, boxHeight, 2, 2, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(90, 90, 90);
        doc.text(m.label, bx + 3, by + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        if (m.highlight) {
          doc.setTextColor(160, 120, 40);
        } else if (m.isNet) {
          doc.setTextColor(22, 101, 52);
        } else if (m.isExpense) {
          doc.setTextColor(185, 28, 28);
        } else {
          doc.setTextColor(20, 20, 20);
        }
        doc.text(m.value, bx + 3, by + 12);
      });

      y += boxHeight * 2 + 10;

      // Indicadores Operativos Rápidos
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(
        `Total de Atenciones del Día: ${totalAtenciones} servicio(s)  |  Citas Registradas: ${dayBookings.length}  |  Ventas POS: ${dayVentas.length}`,
        14,
        y
      );
      y += 8;

      // Tabla: Top de Servicios Más Solicitados
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text('2. TOP DE SERVICIOS MÁS REALIZADOS DEL DÍA', 14, y);
      y += 5;

      // Encabezado de tabla
      doc.setFillColor(25, 25, 25);
      doc.rect(14, y, pageWidth - 28, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('#', 17, y + 5);
      doc.text('Servicio Realizado', 25, y + 5);
      doc.text('Categoría', 105, y + 5);
      doc.text('Atenciones', 140, y + 5, { align: 'right' });
      doc.text('Monto Total', pageWidth - 18, y + 5, { align: 'right' });
      y += 7;

      if (topServices.length === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(14, y, pageWidth - 28, 8, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('No se registraron atenciones de servicios en esta fecha.', 25, y + 5.5);
        y += 10;
      } else {
        topServices.slice(0, 6).forEach((s, idx) => {
          doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 248);
          doc.rect(14, y, pageWidth - 28, 6.5, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          doc.text(`${idx + 1}`, 17, y + 4.5);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(20, 20, 20);
          const truncatedName = s.name.length > 44 ? s.name.substring(0, 42) + '...' : s.name;
          doc.text(truncatedName, 25, y + 4.5);

          doc.setTextColor(100, 100, 100);
          doc.text(s.category.toUpperCase(), 105, y + 4.5);

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 40, 40);
          doc.text(`${s.count}`, 140, y + 4.5, { align: 'right' });
          doc.text(formatSolesText(s.totalCents), pageWidth - 18, y + 4.5, { align: 'right' });

          doc.setDrawColor(235, 235, 235);
          doc.setLineWidth(0.2);
          doc.line(14, y + 6.5, pageWidth - 14, y + 6.5);

          y += 6.5;
        });
        y += 4;
      }

      // Tabla: Producción Detallada por Especialista / Colaborador
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text('3. PRODUCCIÓN DETALLADA POR ESPECIALISTA', 14, y);
      y += 5;

      // Encabezado de tabla colaboradores
      doc.setFillColor(25, 25, 25);
      doc.rect(14, y, pageWidth - 28, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('Especialista / Colaborador', 17, y + 5);
      doc.text('Área', 90, y + 5);
      doc.text('Servicios Atendidos', 135, y + 5, { align: 'right' });
      doc.text('Total Facturado', pageWidth - 18, y + 5, { align: 'right' });
      y += 7;

      specialistProduction.forEach((emp, idx) => {
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 248);
        doc.rect(14, y, pageWidth - 28, 6.5, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        doc.text(emp.name, 17, y + 4.5);

        doc.setTextColor(100, 100, 100);
        doc.text(emp.type.toUpperCase(), 90, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(`${emp.servicesCount}`, 135, y + 4.5, { align: 'right' });
        doc.text(formatSolesText(emp.totalCents), pageWidth - 18, y + 4.5, { align: 'right' });

        doc.setDrawColor(235, 235, 235);
        doc.setLineWidth(0.2);
        doc.line(14, y + 6.5, pageWidth - 14, y + 6.5);

        y += 6.5;
      });

      // Pie de Página Oficial
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 282, pageWidth, 15, 'F');
      doc.setDrawColor(200, 164, 92);
      doc.setLineWidth(0.5);
      doc.line(0, 282, pageWidth, 282);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      doc.text(
        'Documento oficial generado para Administración y Recepción de Acicalados Spa & Barber Shop.',
        14,
        288
      );
      doc.text(`Página 1 de 1  ·  Fecha: ${formattedDateLima}`, pageWidth - 14, 288, { align: 'right' });

      // Descargar archivo
      const cleanFileName = `Reporte_Diario_Acicalados_${selectedDate.replace(/-/g, '_')}.pdf`;
      doc.save(cleanFileName);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Ocurrió un error al generar el documento PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Exportar datos crudos en CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Modulo,Fecha,Detalle,Monto Soles\n';

    dayBookings.forEach((b) => {
      const collected = getBookingCollectedAmountCents(b);
      csvContent += `Reserva,${b.date},Cita #${b.code} - ${b.client_name},${(collected / 100).toFixed(2)}\n`;
    });

    dayVentas.forEach((v) => {
      csvContent += `POS,${selectedDate},Ticket #${v.ticket_number} - ${v.product_name},${(v.total_price_cents / 100).toFixed(2)}\n`;
    });

    dayExpenses.forEach((e) => {
      csvContent += `Egreso,${selectedDate},${e.description},-${(e.amount_cents / 100).toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_acicalados_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* 1. Encabezado y Control de Fecha Dinámica */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-neutral-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/35 flex items-center justify-center text-[#C8A45C]">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
                Panel Analítico Diario
              </h1>
              <p className="text-xs text-neutral-400">
                Sincronización en tiempo real con la fecha activa (Zona horaria: Perú / America/Lima)
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales: Reporte del Día, PDF, CSV */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsQuickReportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#181818] hover:bg-[#222222] text-[#E6C875] border border-[#C8A45C]/35 shadow transition flex items-center gap-2 cursor-pointer"
            title="Abrir resumen rápido para copiar o enviar por WhatsApp"
          >
            <Share2 className="w-4 h-4 text-[#C8A45C]" />
            <span>Reporte del Día</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isGeneratingPdf}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#C8A45C] to-[#B08D45] hover:from-[#D4AF37] hover:to-[#C8A45C] text-black shadow-lg shadow-[#C8A45C]/20 transition flex items-center gap-2 cursor-pointer font-bold disabled:opacity-50"
            title="Descargar documento PDF con membrete corporativo"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Generando PDF...' : 'Exportar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="p-2 rounded-xl text-xs font-medium bg-[#141414] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
            title="Exportar datos crudos en CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra Selectora de Fecha Interactiva y Filtro por Empleado */}
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#C8A45C]" />
            <span>Consultar Fecha:</span>
          </span>

          {/* Selector interactivo nativo con estilo oscuro de lujo */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#1C1C1C] border border-[#C8A45C]/40 text-white font-medium text-xs sm:text-sm rounded-xl px-3.5 py-1.5 outline-none focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C] transition cursor-pointer shadow-inner"
            />
          </div>

          {/* Botones de salto rápido */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleStepDay(-1)}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer"
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStepDay(1)}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer"
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSetToday}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isToday
                  ? 'bg-[#C8A45C] text-black shadow'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleSetYesterday}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer"
            >
              Ayer
            </button>
          </div>

          {/* Separador estético */}
          <div className="h-6 w-px bg-neutral-800 hidden md:block" />

          {/* Filtro por Empleado (Exclusivo Spa y Barbería) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#C8A45C]" />
              <span className="hidden sm:inline">Filtrar por Empleado:</span>
            </span>
            <div className="relative">
              <select
                id="filter-employee-select"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="bg-[#1C1C1C] border border-[#C8A45C]/40 hover:border-[#C8A45C] text-white font-medium text-xs sm:text-sm rounded-xl pl-3.5 pr-8 py-1.5 outline-none focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C] transition cursor-pointer shadow-inner appearance-none"
              >
                <option value="" className="bg-[#1C1C1C] text-neutral-300">
                  Todos los especialistas
                </option>
                {eligibleSpecialists.map((emp) => {
                  const areaLabel =
                    emp.type?.toLowerCase() === 'spa' ||
                    emp.type?.toLowerCase() === 'terapeuta_spa' ||
                    emp.type?.toLowerCase() === 'cosmiatra'
                      ? 'Spa'
                      : 'Barbería';
                  return (
                    <option key={emp.id} value={emp.id} className="bg-[#1C1C1C] text-white">
                      [{areaLabel}] {emp.full_name}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#C8A45C] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedEmployeeId && (
              <button
                type="button"
                onClick={() => setSelectedEmployeeId('')}
                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
                title="Limpiar filtro de especialista"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Indicador de Fecha Activa y Contexto */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Reporte:</span>
          <span className="font-bold text-[#E6C875] bg-[#C8A45C]/10 px-2.5 py-0.5 rounded-full border border-[#C8A45C]/25">
            {formattedDateLima}
          </span>
          {selectedEmployee && (
            <span className="font-semibold text-purple-300 bg-purple-950/50 px-2.5 py-0.5 rounded-full border border-purple-800/40">
              {selectedEmployee.full_name} ({selectedEmployeeArea === 'spa' ? 'Spa' : 'Barbería'})
            </span>
          )}
        </div>
      </div>

      {/* 2. Tarjetas y Métricas del Día Seleccionado (Renderizado Condicional Dinámico) */}
      {selectedEmployee ? (
        <div className="max-w-md mx-auto w-full space-y-3 transition-all duration-300 animate-fadeIn">
          {/* Indicador de filtro activo con botón de restablecer */}
          <div className="flex items-center justify-between text-xs text-neutral-400 bg-[#161616] border border-[#C8A45C]/25 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#C8A45C]" />
              <span>
                Métricas filtradas para:{' '}
                <strong className="text-white font-semibold">{selectedEmployee.full_name}</strong>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedEmployeeId('')}
              className="text-[#C8A45C] hover:text-[#E6C875] text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ver todas</span>
            </button>
          </div>

          {/* Caso B: Empleado de Spa seleccionado -> Única tarjeta visible: Ingresos por Spa */}
          {selectedEmployeeArea === 'spa' && (
            <div className="bg-gradient-to-br from-[#1C1528] to-[#121212] border-2 border-purple-500/60 rounded-2xl p-6 space-y-3 shadow-2xl relative overflow-hidden transition group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                    Ingresos por Spa
                  </span>
                  <span className="text-xs text-neutral-400">
                    Especialista: <span className="text-white font-medium">{selectedEmployee.full_name}</span>
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-800/60 flex items-center justify-center shadow">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <span className="font-serif-luxury text-3xl sm:text-4xl font-bold text-purple-200 block">
                {formatSoles(spaCents)}
              </span>
              <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-purple-900/30 pt-3 mt-1">
                <span>{spaCount} servicio(s) atendido(s) en la fecha</span>
                <span className="text-[11px] text-emerald-400 font-medium">Recaudación real cobrada</span>
              </div>
            </div>
          )}

          {/* Caso C: Empleado de Barbería seleccionado -> Única tarjeta visible: Ingresos por Barbería */}
          {selectedEmployeeArea === 'barberia' && (
            <div className="bg-gradient-to-br from-[#1E1B15] to-[#121212] border-2 border-[#C8A45C]/60 rounded-2xl p-6 space-y-3 shadow-2xl relative overflow-hidden transition group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#C8A45C]/15 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[#E6C875] uppercase tracking-wider block">
                    Ingresos por Barbería
                  </span>
                  <span className="text-xs text-neutral-400">
                    Especialista: <span className="text-white font-medium">{selectedEmployee.full_name}</span>
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-950/60 text-blue-400 border border-blue-800/60 flex items-center justify-center shadow">
                  <Scissors className="w-5 h-5" />
                </div>
              </div>
              <span className="font-serif-luxury text-3xl sm:text-4xl font-bold text-blue-200 block">
                {formatSoles(barberiaCents)}
              </span>
              <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-3 mt-1">
                <span>{barberiaCount} corte(s) y perfilado(s) en la fecha</span>
                <span className="text-[11px] text-emerald-400 font-medium">Recaudación real cobrada</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Caso A: Sin selección / "Todos": Muestra todas las 7 tarjetas tal y como están actualmente */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 transition-all duration-300">
          {/* Métrica 1: Total Ingresos Cobrados */}
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#121212] border border-[#C8A45C]/45 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#C8A45C]/10 rounded-full blur-2xl group-hover:bg-[#C8A45C]/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Total Ingresos Cobrados
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/20 text-[#C8A45C] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#E6C875] block">
              {formatSoles(totalIngresosCents)}
            </span>
            <span className="text-[11px] text-neutral-400 block">
              Recaudado real (Servicios + Ventas)
            </span>
          </div>

          {/* Métrica 2: Ingresos por Spa */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/30 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xl transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Ingresos por Spa
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-950/40 text-purple-400 border border-purple-800/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-purple-300 block">
              {formatSoles(spaCents)}
            </span>
            <span className="text-[11px] text-neutral-500 block">
              {spaCount} servicio(s) de estética y spa
            </span>
          </div>

          {/* Métrica 3: Ingresos por Barbería */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/30 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xl transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Ingresos por Barbería
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-800/40 flex items-center justify-center">
                <Scissors className="w-4 h-4" />
              </div>
            </div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-blue-300 block">
              {formatSoles(barberiaCents)}
            </span>
            <span className="text-[11px] text-neutral-500 block">
              {barberiaCount} corte(s) y perfilado(s)
            </span>
          </div>

          {/* Métrica 4: Ingresos por Ventas de Mostrador */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/30 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xl transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Ingresos por Ventas
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-800/40 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-amber-300 block">
              {formatSoles(ventasCents)}
            </span>
            <span className="text-[11px] text-neutral-500 block">
              {dayVentas.length} venta(s) de productos en mostrador
            </span>
          </div>

          {/* Métrica 5: Egresos Operativos */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-red-900/40 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xl transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Egresos Operativos
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-950/40 text-red-400 border border-red-800/40 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-red-400 block">
              {formatSoles(egresosCents)}
            </span>
            <span className="text-[11px] text-neutral-500 block">
              {dayExpenses.length} compras / gastos de caja chica
            </span>
          </div>

          {/* Métrica 6: Ganancia Neta */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-emerald-900/40 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xl transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Ganancia Neta
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <span
              className={`font-serif-luxury text-2xl sm:text-3xl font-bold block ${
                gananciaNetaCents >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {formatSoles(gananciaNetaCents)}
            </span>
            <span className="text-[11px] text-neutral-500 block">
              Cálculo: Total Ingresos - Total Egresos
            </span>
          </div>

          {/* Métrica 7: Total de Atenciones */}
          <div className="bg-[#141414] border border-neutral-800 hover:border-[#C8A45C]/30 rounded-2xl p-4 sm:p-5 space-y-2 shadow-xl transition sm:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Total de Atenciones del Día
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/20 text-[#C8A45C] flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white block">
                {totalAtenciones}
              </span>
              <span className="text-xs text-neutral-400">
                servicio(s) en {dayBookings.length} cita(s) del día
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 block">
              Atenciones confirmadas y concluidas durante la jornada
            </span>
          </div>
        </div>
      )}

      {/* 3. Tablas Analíticas: Top de Servicios y Producción por Especialista */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Top de Servicios Más Reservados del Día */}
        <div className="lg:col-span-6 bg-[#141414] border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="font-serif-luxury text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-[#C8A45C]" />
              <span>Top Servicios Más Reservados</span>
            </h3>
            <span className="text-[11px] text-neutral-400">Día: {formattedDateLima}</span>
          </div>

          <div className="space-y-3">
            {topServices.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 space-y-2 bg-[#181818] rounded-xl border border-neutral-800/80">
                <Scissors className="w-7 h-7 mx-auto opacity-30 text-[#C8A45C]" />
                <p className="text-xs">No se registraron atenciones en esta fecha.</p>
                <p className="text-[10px] text-neutral-600">
                  Prueba cambiando el selector de fecha para ver registros de otros días.
                </p>
              </div>
            ) : (
              topServices.map((srv, idx) => {
                const maxCount = topServices[0]?.count || 1;
                const pct = Math.round((srv.count / maxCount) * 100);

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/30 transition space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                            idx === 0
                              ? 'bg-[#C8A45C] text-black'
                              : idx === 1
                              ? 'bg-neutral-300 text-black'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-white block">{srv.name}</span>
                          <span className="text-[10px] text-neutral-400 capitalize">
                            Área: {srv.category}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#E6C875] block">
                          {formatSoles(srv.totalCents)}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {srv.count} atención(es)
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso visual */}
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#C8A45C] to-[#E6C875] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Producción Detallada por Especialista */}
        <div className="lg:col-span-6 bg-[#141414] border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="font-serif-luxury text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C8A45C]" />
              <span>Producción por Colaborador</span>
            </h3>
            <span className="text-[11px] text-neutral-400">Día: {formattedDateLima}</span>
          </div>

          <div className="space-y-3">
            {specialistProduction.map((emp) => (
              <div
                key={emp.id}
                className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/30 flex items-center justify-between gap-3 text-xs transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 text-[#C8A45C] flex items-center justify-center font-bold text-xs uppercase">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-semibold text-white block">{emp.name}</span>
                    <span className="text-[10px] text-neutral-400 capitalize">
                      {emp.type} • {emp.servicesCount} servicio(s) atendidos
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold text-[#E6C875] text-sm block">
                    {formatSoles(emp.totalCents)}
                  </span>
                  <span className="text-[10px] text-neutral-400">Total facturado</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Tabla: Desglose de Servicios por Módulo (Auditoría) - Exclusivo ADMIN */}
      {isAdmin && (
        <div className="bg-[#141414] border border-neutral-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl">
          {/* Cabecera y Controles */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#C8A45C] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="font-serif-luxury text-lg sm:text-xl font-bold text-white tracking-wide">
                  Desglose de Servicios por Módulo (Auditoría)
                </h3>
              </div>
              <p className="text-xs text-neutral-400">
                Historial detallado de cada servicio atendido, precio cobrado, especialista y canal de pago.
              </p>
            </div>

            {/* Filtros de Área (Pills) y Buscador */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Selector de Área */}
              <div className="flex items-center bg-[#181818] border border-neutral-800 rounded-xl p-1 text-xs">
                {(['TODOS', 'SPA', 'BARBERÍA'] as const).map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAuditAreaFilter(area)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                      auditAreaFilter === area
                        ? 'bg-[#C8A45C] text-black shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>

              {/* Input Buscador */}
              <div className="relative min-w-[260px] sm:min-w-[320px]">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  placeholder="Filtrar servicios por nombre, especialista, cliente o código..."
                  className="w-full bg-[#181818] border border-neutral-800 text-white placeholder-neutral-500 text-xs rounded-xl pl-9 pr-8 py-2 outline-none focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C] transition shadow-inner"
                />
                {auditSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAuditSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs p-0.5 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabla con Scroll Vertical y Cabecera Fija */}
          <div className="rounded-2xl border border-neutral-800/80 overflow-hidden bg-[#101010]/80 backdrop-blur-sm">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#181818] text-neutral-400 font-semibold border-b border-neutral-800 uppercase text-[10px] tracking-wider z-10 shadow-sm">
                  <tr>
                    <th className="py-3 px-4 sm:px-5">Nombre del Servicio</th>
                    <th className="py-3 px-4 sm:px-5 text-right">Precio Cobrado</th>
                    <th className="py-3 px-4 sm:px-5">Personal Asignado</th>
                    <th className="py-3 px-4 sm:px-5">Fecha Exacta</th>
                    <th className="py-3 px-4 sm:px-5 text-center">Método(s) de Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {isLoadingAudit ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-neutral-400 space-y-2">
                        <div className="w-6 h-6 border-2 border-[#C8A45C] border-t-transparent rounded-full animate-spin mx-auto" />
                        <span className="text-xs">Cargando desglose de auditoría...</span>
                      </td>
                    </tr>
                  ) : filteredAuditServices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-neutral-500 space-y-2">
                        <FileText className="w-8 h-8 mx-auto opacity-30 text-[#C8A45C]" />
                        <p className="text-xs font-medium">No se encontraron servicios atendidos para los filtros seleccionados.</p>
                        <p className="text-[10px] text-neutral-600">
                          Intenta cambiando la fecha de consulta o el criterio de búsqueda.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditServices.map((item) => {
                      const isSpa = item.area === 'SPA' || item.area.toLowerCase().includes('spa');
                      const methodLower = (item.payment_method || '').toLowerCase();

                      return (
                        <tr
                          key={item.service_item_id}
                          className="hover:bg-[#161616] transition-colors duration-150"
                        >
                          {/* 1. Nombre del Servicio */}
                          <td className="py-3.5 px-4 sm:px-5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                    isSpa
                                      ? 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                                      : 'bg-[#C8A45C]/15 text-[#E6C875] border-[#C8A45C]/35'
                                  }`}
                                >
                                  {isSpa ? 'SPA' : 'BARBERÍA'}
                                </span>
                                <span className="font-bold text-white text-xs sm:text-sm">
                                  {item.service_name}
                                </span>
                              </div>
                              <span className="text-[11px] text-neutral-400 block pl-0.5">
                                Cita: #{item.booking_code} - {item.client_name}
                              </span>
                            </div>
                          </td>

                          {/* 2. Precio Cobrado */}
                          <td className="py-3.5 px-4 sm:px-5 text-right whitespace-nowrap">
                            <span className="font-bold text-emerald-400 text-sm block">
                              {formatSoles(item.price_cents)}
                            </span>
                            <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                              {item.payment_status === 'total' ? 'Pagado Total' : 'Adelanto / Parcial'}
                            </span>
                          </td>

                          {/* 3. Personal Asignado */}
                          <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-[#C8A45C] flex items-center justify-center">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-white font-medium text-xs">
                                {item.employee_name}
                              </span>
                            </div>
                          </td>

                          {/* 4. Fecha Exacta */}
                          <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span className="text-neutral-300 font-medium block">
                                {item.booking_date}
                              </span>
                              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#C8A45C]" />
                                <span>{item.hora_rango}</span>
                              </span>
                            </div>
                          </td>

                          {/* 5. Método(s) de Pago */}
                          <td className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">
                            {methodLower.includes('yape') ? (
                              <span className="px-2.5 py-1 rounded-full bg-purple-950/70 text-purple-300 border border-purple-800/50 text-[10px] font-bold uppercase tracking-wider">
                                YAPE
                              </span>
                            ) : methodLower.includes('efectivo') || methodLower.includes('cash') ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/50 text-[10px] font-bold uppercase tracking-wider">
                                EFECTIVO
                              </span>
                            ) : methodLower.includes('transf') ? (
                              <span className="px-2.5 py-1 rounded-full bg-blue-950/70 text-blue-300 border border-blue-800/50 text-[10px] font-bold uppercase tracking-wider">
                                TRANSFERENCIA
                              </span>
                            ) : methodLower.includes('mixto') ? (
                              <span className="px-2.5 py-1 rounded-full bg-orange-950/70 text-orange-300 border border-orange-800/50 text-[10px] font-bold uppercase tracking-wider">
                                MIXTO
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/50 text-[10px] font-bold uppercase tracking-wider">
                                {item.payment_method.toUpperCase()}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer de Resumen del DataGrid */}
            <div className="bg-[#141414] border-t border-neutral-800/80 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Auditoría de servicios para la fecha seleccionada ({formattedDateLima})</span>
              </span>
              <span className="font-semibold text-white">
                Total de servicios listados: <span className="text-[#E6C875] font-bold">{filteredAuditServices.length}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: "Reporte del Día" (Resumen Rápido para WhatsApp o Copiar) */}
      {isQuickReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#C8A45C] flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif-luxury text-base font-bold text-white">
                    Reporte del Día - {formattedDateLima}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Resumen estructurado listo para compartir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickReportModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vista Previa del Texto Estructurado */}
            <div className="relative">
              <pre className="p-4 rounded-2xl bg-[#0D0D0D] border border-neutral-800 text-neutral-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto selection:bg-[#C8A45C] selection:text-black">
                {quickReportText}
              </pre>
            </div>

            {/* Acciones del Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsQuickReportModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-800 transition cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyQuickReport}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow ${
                    copiedSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#1F1F1F] hover:bg-[#2A2A2A] text-neutral-200 border border-neutral-700'
                  }`}
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#C8A45C]" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer font-bold"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartir por WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
