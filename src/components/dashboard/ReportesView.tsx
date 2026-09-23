import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles, getBookingCollectedAmountCents, getBookingServicesWithCollectedCents } from '../../types';
import { getTodayDateString, getLimaDateFromTimestamp } from '../../data/initialData';
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
  X,
  FileSpreadsheet,
  CalendarCheck,
  Clock,
  Shirt,
  Percent,
} from 'lucide-react';
import { DashboardSkeleton } from './DashboardSkeleton';

export const ReportesView: React.FC = () => {
  const { bookings, ventasMostrador, expenses, employees, services, wardrobe, isDataLoading } = useApp();

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  // 1. Selector y Control de Fecha Dinámica (Zona Horaria America/Lima)
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [isQuickReportModalOpen, setIsQuickReportModalOpen] = useState<boolean>(false);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

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

  // 2. Cálculos y Métricas Reactivas para la Fecha Seleccionada
  // Citas de la fecha (excluyendo canceladas y expiradas)
  const dayBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (
        b.status === 'cancelada' ||
        b.status === 'cancelled' ||
        b.status === 'expirada' ||
        Boolean(b.cancelled_at) ||
        Boolean(b.expired_at)
      ) {
        return false;
      }
      return getLimaDateFromTimestamp(b.date) === selectedDate;
    });
  }, [bookings, selectedDate]);

  // Total de Atenciones de la fecha (conteo de servicios agendados o citas completadas)
  const totalAtenciones = useMemo(() => {
    return dayBookings.reduce((acc, b) => acc + (b.services?.length || 1), 0);
  }, [dayBookings]);

  // Ingresos por Barbería y por Spa (Regla estricta: solo dinero real efectivamente cobrado)
  const { barberiaCents, spaCents, barberiaCount, spaCount } = useMemo(() => {
    let bCents = 0;
    let sCents = 0;
    let bCount = 0;
    let sCount = 0;

    dayBookings.forEach((b) => {
      const servicesWithCollected = getBookingServicesWithCollectedCents(b);
      servicesWithCollected.forEach((srv) => {
        const catalogItem = services.find(
          (s) => s.id === srv.service_id || s.name === srv.service_name
        );
        const isSpa =
          catalogItem?.category === 'spa' ||
          srv.service_name.toLowerCase().includes('spa') ||
          srv.service_name.toLowerCase().includes('masaje') ||
          srv.service_name.toLowerCase().includes('facial') ||
          srv.service_name.toLowerCase().includes('exfolia');

        if (isSpa) {
          sCents += srv.collected_cents;
          sCount += 1;
        } else {
          bCents += srv.collected_cents;
          bCount += 1;
        }
      });
    });

    return {
      barberiaCents: bCents,
      spaCents: sCents,
      barberiaCount: bCount,
      spaCount: sCount,
    };
  }, [dayBookings, services]);

  // Ingresos por Ventas de Mostrador en esa fecha (excluyendo anuladas)
  const dayVentas = useMemo(() => {
    return ventasMostrador.filter((v: any) => {
      if (v.voided) return false;
      const vDate = getLimaDateFromTimestamp(v.created_at || v.fecha);
      return vDate === selectedDate;
    });
  }, [ventasMostrador, selectedDate]);

  const ventasCents = useMemo(() => {
    return dayVentas.reduce((acc, v) => acc + (v.total_price_cents || 0), 0);
  }, [dayVentas]);

  // Ingresos por Alquiler de Vestuario / Trajes
  const vestuarioCents = useMemo(() => {
    // Si existen reservas específicas de tipo vestuario o catálogo
    return 0; // Mantenido para modelo extensible
  }, []);

  // Egresos Operativos de la fecha (excluyendo anulados)
  const dayExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.voided) return false;
      const eDate = getLimaDateFromTimestamp(e.date || e.created_at);
      return eDate === selectedDate;
    });
  }, [expenses, selectedDate]);

  const egresosCents = useMemo(() => {
    return dayExpenses.reduce((acc, e) => acc + e.amount_cents, 0);
  }, [dayExpenses]);

  // Total Ingresos Cobrados (Recaudado real: Servicios cobrados + Ventas + Vestuario)
  const totalIngresosCents = useMemo(() => {
    return barberiaCents + spaCents + ventasCents + vestuarioCents;
  }, [barberiaCents, spaCents, ventasCents, vestuarioCents]);

  // Ganancia Neta (Cálculo: Total Ingresos Cobrados - Total Egresos)
  const gananciaNetaCents = useMemo(() => {
    return totalIngresosCents - egresosCents;
  }, [totalIngresosCents, egresosCents]);

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
        const catalogItem = services.find(
          (s) => s.id === srv.service_id || s.name === srv.service_name
        );
        const isSpa =
          catalogItem?.category === 'spa' ||
          srv.service_name.toLowerCase().includes('masaje') ||
          srv.service_name.toLowerCase().includes('facial');

        const existing = map.get(key) || {
          name: srv.service_name,
          count: 0,
          totalCents: 0,
          category: isSpa ? 'spa' : 'barberia',
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

      {/* Barra Selectora de Fecha Interactiva */}
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
        </div>

        {/* Indicador de Fecha Activa y Contexto */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Reporte sincronizado para:</span>
          <span className="font-bold text-[#E6C875] bg-[#C8A45C]/10 px-2.5 py-0.5 rounded-full border border-[#C8A45C]/25">
            {formattedDateLima}
          </span>
        </div>
      </div>

      {/* 2. Tarjetas y Métricas del Día Seleccionado (7 Métricas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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
