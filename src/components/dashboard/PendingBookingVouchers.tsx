import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { qaRpc, voucherPreview } from '../../lib/qaApi';
import { formatSoles, PaymentLog } from '../../types';

export function PendingBookingVouchers() {
  const { paymentLogs, refreshData, openLightbox } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = paymentLogs.filter(p => p.status === 'pending' && p.voucher_url);
  async function review(payment: PaymentLog, approved: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await qaRpc('qa_review_payment', { p_id: payment.id, p_approved: approved });
      await refreshData();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo validar el comprobante.'); }
    finally { setBusy(false); }
  }
  async function preview(payment: PaymentLog) {
    try { openLightbox({ url: await voucherPreview(payment.voucher_url!), title: 'Comprobante pendiente' }); }
    catch { setError('No se pudo abrir el comprobante. Inténtalo nuevamente.'); }
  }
  if (!pending.length && !error) return null;
  return <section className="rounded-xl border border-amber-800 bg-amber-950/20 p-4 space-y-3">
    <h2 className="font-semibold text-amber-200">Comprobantes pendientes de validación</h2>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {pending.map(p => <div key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
      <span>{formatSoles(p.amount_cents)} · Reserva {p.booking_id}</span>
      <button disabled={busy} onClick={() => preview(p)} className="underline">Ver comprobante</button>
      <button disabled={busy} onClick={() => review(p, true)} className="text-emerald-300">Aprobar pago</button>
      <button disabled={busy} onClick={() => review(p, false)} className="text-rose-300">Rechazar</button>
    </div>)}
  </section>;
}
