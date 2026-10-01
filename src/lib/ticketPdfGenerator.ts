import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { formatSoles } from '../types';

export interface TicketPdfData {
  code: string;
  type: 'vestuario' | 'servicio' | string;
  clientName: string;
  clientDni?: string;
  clientPhone?: string;
  eventOrBookingDate: string;
  returnDate?: string | null;
  timeSlot?: string | null;
  itemOrServices: string | Array<{ name: string; price_cents?: number; duration?: number }>;
  totalPriceCents: number;
  advanceCents: number;
  pendingCents: number;
  guaranteeCents?: number;
  statusLabel: string;
  statusColor?: string;
  voucherUrl?: string | null;
  notes?: string | null;
  createdAt?: string;
}

/**
 * Genera el nombre del archivo del voucher asegurando unicidad y trazabilidad:
 * Formato: [DNI]_yape_[TIMESTAMP].[EXT]
 */
export const generateVoucherFilename = (dni: string, originalFileName: string): string => {
  const cleanDni = dni.replace(/\D/g, '') || 'invitado';
  const ext = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  return `${cleanDni}_yape_${timestamp}.${ext}`;
};

/**
 * Genera y descarga un comprobante / ticket de confirmación oficial en PDF con estética corporativa de lujo.
 */
export const downloadTicketPdf = async (data: TicketPdfData): Promise<void> => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 220], // Formato ticket térmico alargado de 80mm de ancho
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 8;

    // Header Bar de Lujo
    doc.setFillColor(18, 18, 18);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setDrawColor(200, 164, 92); // Dorado #C8A45C
    doc.setLineWidth(0.8);
    doc.line(0, 28, pageWidth, 28);

    // Título Principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(200, 164, 92);
    doc.text('ACICALADOS SPA & BOUTIQUE', pageWidth / 2, 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 180, 180);
    doc.text('DISEÑO · ESTILO · ALTA COSTURA', pageWidth / 2, 16, { align: 'center' });
    doc.text('Av. Javier Prado Este 2450, San Borja · Lima', pageWidth / 2, 20, { align: 'center' });
    doc.text('RUC: 20608941231 · Central: +51 987 654 321', pageWidth / 2, 24, { align: 'center' });

    y = 35;

    // Código de Orden / Ticket Prominente
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(6, y, pageWidth - 12, 14, 2, 2, 'F');
    doc.setDrawColor(200, 164, 92);
    doc.roundedRect(6, y, pageWidth - 12, 14, 2, 2, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text('TICKET DE CONFIRMACIÓN PROVISIONAL', pageWidth / 2, y + 4.5, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    const formattedCode = data.code.startsWith('#') ? data.code : `#${data.code}`;
    doc.text(formattedCode, pageWidth / 2, y + 10.5, { align: 'center' });

    y += 18;

    // Badge de Estado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    if (data.statusLabel.includes('APROBADA') || data.statusLabel.includes('CONFIRMADA')) {
      doc.setTextColor(22, 101, 52); // Verde oscuro
    } else if (data.statusLabel.includes('REVISIÓN') || data.statusLabel.includes('PROCESO')) {
      doc.setTextColor(180, 110, 10); // Ámbar / Dorado oscuro
    } else {
      doc.setTextColor(70, 70, 70);
    }
    doc.text(`ESTADO: ${data.statusLabel}`, pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setDrawColor(210, 210, 210);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(6, y, pageWidth - 6, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // Datos del Cliente
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text('DATOS DEL CLIENTE', 6, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);

    doc.text(`Titular: ${data.clientName}`, 6, y);
    y += 4;

    if (data.clientDni) {
      doc.text(`DNI / Doc: ${data.clientDni}`, 6, y);
      y += 4;
    }

    if (data.clientPhone) {
      doc.text(`Teléfono: ${data.clientPhone}`, 6, y);
      y += 4;
    }

    y += 2;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(6, y, pageWidth - 6, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // Detalles de la Reserva / Cita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text('DETALLES DE LA RESERVA', 6, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);

    const isVestuario = data.type === 'vestuario';
    if (isVestuario) {
      doc.text(`Fecha del Evento: ${data.eventOrBookingDate}`, 6, y);
      y += 4;
      if (data.returnDate) {
        doc.text(`Fecha de Devolución: ${data.returnDate}`, 6, y);
        y += 4;
      }
    } else {
      doc.text(`Fecha de Cita: ${data.eventOrBookingDate}`, 6, y);
      y += 4;
      if (data.timeSlot) {
        doc.text(`Horario: ${data.timeSlot}`, 6, y);
        y += 4;
      }
    }

    // Detalle de ítems / prendas o servicios
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text(isVestuario ? 'PRENDA RESERVADA:' : 'SERVICIOS:', 6, y);
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 30);

    if (typeof data.itemOrServices === 'string') {
      const splitText = doc.splitTextToSize(data.itemOrServices, pageWidth - 12);
      doc.text(splitText, 6, y);
      y += splitText.length * 3.5;
    } else if (Array.isArray(data.itemOrServices)) {
      data.itemOrServices.forEach((s) => {
        const itemLine = `• ${s.name}${s.price_cents ? ` (${formatSoles(s.price_cents)})` : ''}`;
        doc.text(itemLine, 6, y);
        y += 3.5;
      });
    }

    y += 2;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(6, y, pageWidth - 6, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // Resumen Financiero
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text('RESUMEN DE PAGOS', 6, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);

    const addFinanceRow = (label: string, value: string, isBold: boolean = false, color?: number[]) => {
      if (isBold) doc.setFont('helvetica', 'bold');
      else doc.setFont('helvetica', 'normal');

      if (color) doc.setTextColor(color[0], color[1], color[2]);
      else doc.setTextColor(40, 40, 40);

      doc.text(label, 6, y);
      doc.text(value, pageWidth - 6, y, { align: 'right' });
      y += 4;
    };

    addFinanceRow('Costo Total:', formatSoles(data.totalPriceCents));
    addFinanceRow('Adelanto Declarado (Yape):', formatSoles(data.advanceCents), true, [22, 101, 52]);
    addFinanceRow('Saldo Pendiente a Liquidar:', formatSoles(data.pendingCents), true, [180, 50, 50]);

    if (data.guaranteeCents && data.guaranteeCents > 0) {
      addFinanceRow('Garantía en Local (Devolución):', formatSoles(data.guaranteeCents));
    }

    y += 3;

    // Generar código QR para escaneo rápido en recepción
    try {
      const qrDataUrl = await QRCode.toDataURL(
        `ACICALADOS|CODE:${data.code}|DNI:${data.clientDni || ''}|TOTAL:${data.totalPriceCents}`,
        { margin: 1, width: 90 }
      );
      doc.addImage(qrDataUrl, 'PNG', (pageWidth - 24) / 2, y, 24, 24);
      y += 26;
    } catch {
      y += 2;
    }

    // Pie de página y advertencia legal / operativa
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(110, 110, 110);
    const disclaimer =
      'Este comprobante digital provisional certifica tu registro en el sistema. Los comprobantes adjuntos son auditados en caja antes del despacho o servicio. Para consultas o reagendamiento, comunícate al WhatsApp oficial.';
    const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 12);
    doc.text(splitDisclaimer, pageWidth / 2, y, { align: 'center' });

    // Guardar y descargar automáticamente
    const safeCode = data.code.replace(/[^a-zA-Z0-9_-]/g, '');
    doc.save(`Ticket_Reserva_${safeCode || 'Acicalados'}.pdf`);
  } catch (error) {
    console.error('Error generando ticket PDF:', error);
    alert('Hubo un error al generar el PDF del ticket. Intente nuevamente.');
  }
};
