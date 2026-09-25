import type { CartItem, Product, WardrobeItem } from '../types';

export const CART_KEY = 'acicalados_cart';
export const VOUCHER_BUCKET = 'payment-vouchers';
export const MAX_VOUCHER_BYTES = 5 * 1024 * 1024;
// Existing contact published in the footer/location page; configuration has priority.
export const DEFAULT_WHATSAPP_PHONE = '51997766828';

export function advancePercentage(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 25;
}

export function whatsappPhone(value: string | null | undefined): string {
  if (!value) return '';
  let candidate = value.trim();
  if (/^https?:/i.test(candidate)) {
    try {
      const url = new URL(candidate);
      candidate = url.searchParams.get('phone') || (url.hostname === 'wa.me' ? url.pathname : '');
    } catch { return ''; }
  }
  const digits = candidate.replace(/\D/g, '');
  return /^9\d{8}$/.test(digits) ? `51${digits}` : /^51\d{9}$/.test(digits) ? digits : '';
}

export function isWardrobeReservable(item: WardrobeItem): boolean {
  return item.active === true && item.status === 'disponible';
}

export function validateVoucher(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Solo se aceptan imágenes JPG, PNG o WebP.';
  if (file.size <= 0 || file.size > MAX_VOUCHER_BYTES) return 'El comprobante debe contener datos y pesar como máximo 5 MB.';
  return null;
}

export function reconcileCart(raw: unknown, products: Product[]): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const quantities = new Map<string, number>();
  for (const entry of raw) {
    const id = entry?.productId ?? entry?.product?.id;
    if (typeof id !== 'string' || !Number.isSafeInteger(entry?.quantity) || entry.quantity <= 0) continue;
    quantities.set(id, Math.min(Number.MAX_SAFE_INTEGER, (quantities.get(id) || 0) + entry.quantity));
  }
  return products.flatMap(product => {
    const quantity = Math.min(quantities.get(product.id) || 0, Math.max(0, Math.floor(product.stock || 0)));
    return product.active !== false && product.use_type !== 'consumo_interno' && quantity > 0 ? [{ product, quantity }] : [];
  });
}

export function readStoredCart(): unknown {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}

export function saveCart(cart: CartItem[]): void {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart.map(({ product, quantity }) => ({ productId: product.id, quantity })))); } catch { /* Storage may be disabled. */ }
}
