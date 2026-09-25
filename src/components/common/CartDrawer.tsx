import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles } from '../../types';
import { ShoppingBag, X, Plus, Minus, Trash2, MessageSquare, ArrowRight } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  // QA-010: usar paymentSettings para número de WhatsApp (fuente única)
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateCartQuantity, clearCart, paymentSettings, whatsappNumber, revalidateCart } = useApp();

  const [checkoutError, setCheckoutError] = useState('');
  const [checking, setChecking] = useState(false);
  if (!isCartOpen) return null;

  const totalCents = cart.reduce(
    (acc, item) => acc + item.product.price_cents * item.quantity,
    0
  );

  const handleWhatsAppCheckout = async () => {
    if (checking) return;
    setChecking(true);
    setCheckoutError('');
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      if (!await revalidateCart()) { popup?.close(); setCheckoutError('Actualizamos cantidades o precios según el catálogo. Revisa tu carrito y vuelve a continuar.'); return; }
    const lines = cart.map(
      (item) => `• ${item.quantity}x ${item.product.name} (${formatSoles(item.product.price_cents * item.quantity)})`
    );
    const text = encodeURIComponent(
      `¡Hola Acicalados! Quisiera realizar un pedido de la tienda online:\n\n${lines.join('\n')}\n\n*Total a pagar:* ${formatSoles(totalCents)}\n\n¿Tienen disponibilidad para envío o recojo en el local?`
    );
    // QA-010: número dinámico desde paymentSettings
    const whatsappPhone = whatsappNumber;
    if (popup) popup.location.href = `https://wa.me/${whatsappPhone}?text=${text}`;
    else setCheckoutError('Permite ventanas emergentes y vuelve a continuar.');
    } catch (err) { popup?.close(); setCheckoutError(err instanceof Error ? err.message : 'No se pudo verificar el stock.'); }
    finally { setChecking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-[#141414] border-l border-[#C8A45C]/20 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-[#1A1A1A]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-base">Carrito de Compras</h2>
                <p className="text-xs text-neutral-400">
                  {cart.length} {cart.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                </p>
              </div>
            </div>

            <button
              id="close-cart-btn"
              type="button"
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {checkoutError && <p role="alert" className="px-5 pt-3 text-xs text-amber-300">{checkoutError}</p>}
          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-300">Tu carrito está vacío</h3>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  Explora nuestra tienda de productos capilares, pomadas artesanales y tratamientos para el cuidado personal.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-[#1A1A1A] border border-neutral-800 rounded-xl p-3 flex gap-3 items-center group hover:border-[#C8A45C]/30 transition"
                >
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-16 h-16 rounded-lg object-cover bg-neutral-900 border border-neutral-800 flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate group-hover:text-[#E6C875] transition">
                      {item.product.name}
                    </h4>
                    <p className="text-xs font-bold text-[#C8A45C] mt-0.5">
                      {formatSoles(item.product.price_cents)}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5 bg-black/40 border border-neutral-800 rounded-md p-0.5">
                        <button
                          type="button"
                          disabled={checking}
                          aria-label={`Disminuir ${item.product.name}`}
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold px-2 text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={checking || item.quantity >= item.product.stock}
                          aria-label={`Aumentar ${item.product.name}`}
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={checking}
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-neutral-500 hover:text-rose-400 p-1 rounded transition"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with totals and WhatsApp CTA */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-neutral-800 bg-[#1A1A1A] space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal:</span>
                  <span>{formatSoles(totalCents)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Envío / Retiro:</span>
                  <span className="text-emerald-400 font-medium">A coordinar por WhatsApp</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white border-t border-neutral-800 pt-2">
                  <span>Total Estimado:</span>
                  <span className="text-[#E6C875] text-base">{formatSoles(totalCents)}</span>
                </div>
              </div>

              <p className="text-xs text-neutral-400">Consulta sujeta a confirmación de stock por recepción.</p>
              <button
                id="checkout-whatsapp-btn"
                type="button"
                disabled={checking}
                onClick={handleWhatsAppCheckout}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Consultar Pedido por WhatsApp</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <button
                type="button"
                disabled={checking}
                onClick={clearCart}
                className="w-full text-center text-[11px] text-neutral-500 hover:text-neutral-300 transition"
              >
                Vaciar carrito
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
