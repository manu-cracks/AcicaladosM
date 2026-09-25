import { supabase } from './supabase/client';
import { validateVoucher, VOUCHER_BUCKET } from './businessRules';
import type { Booking } from '../types';

// New RPCs are deployed by migration_qa_booking_payment_consistency.sql.
export async function qaRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(error.message || 'No se pudo completar la operación. Inténtalo nuevamente.');
  if (data == null) throw new Error('El servidor no confirmó la operación.');
  return data as T;
}

export function mapBooking(b: any): Booking {
  return {
    id: b.id, code: b.booking_code, client_name: `${b.client_first_name || ''} ${b.client_last_name || ''}`.trim(),
    client_phone: b.client_phone || '', client_email: b.client_email || '', client_dni: b.client_dni || '',
    date: b.booking_date, start_time: b.start_time?.slice(0, 5), end_time: b.end_time?.slice(0, 5), type: b.service_type,
    services: (b.booking_services || []).map((s: any) => ({
      id: s.id, service_id: s.service_id, service_name: s.service_name, employee_id: s.assigned_employee_id || '',
      employee_name: s.employee_name || 'Especialista', price_cents: s.service_price_cents, duration_minutes: s.duration_minutes,
      hora_inicio: s.hora_inicio || s.start_time, hora_fin: s.hora_fin || s.end_time, liberado_at: s.liberado_at,
    })),
    total_price_cents: b.total_price_cents, advance_amount_cents: b.advance_amount_cents || 0,
    advance_percentage: b.advance_percentage, notes: b.notes, balance_cents: b.balance_cents, payment_status: b.payment_status, created_at: b.created_at,
    confirmed_at: b.confirmed_at, cancelled_at: b.cancelled_at, expired_at: b.expired_at, completed_at: b.completed_at,
    status: b.cancelled_at ? 'cancelada' : b.expired_at ? 'expirada' : b.completed_at ? 'completada' : b.confirmed_at ? 'confirmada' : 'pendiente',
  };
}

export async function uploadVoucher(file: File, kind: 'booking' | 'dress', reference: string, code = '', phone = ''): Promise<string> {
  const validation = validateVoucher(file);
  if (validation) throw new Error(validation);
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = await qaRpc<string>('qa_prepare_voucher', { p_kind: kind, p_reference: reference, p_code: code, p_phone: phone, p_extension: extension });
  const { data, error } = await supabase.storage.from(VOUCHER_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error || !data) throw new Error('No se pudo cargar el comprobante. Verifica tu conexión e inténtalo nuevamente.');
  return data.path;
}

export async function voucherPreview(path: string): Promise<string> {
  // Old records remain compatible; new records always store private paths.
  if (path.startsWith('https://')) return path;
  const { data, error } = await supabase.storage.from(VOUCHER_BUCKET).createSignedUrl(path, 300);
  if (error || !data) throw new Error('No se pudo abrir el comprobante.');
  return data.signedUrl;
}
