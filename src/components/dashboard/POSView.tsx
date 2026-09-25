import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { DashboardSkeleton } from './DashboardSkeleton';
import { formatSoles, VentaMostrador, Product } from '../../types';
import { getTodayDateString } from '../../data/initialData';
import { supabase } from '../../lib/supabase/client';
import {
  Zap,
  User,
  Package,
  Plus,
  Minus,
  Banknote,
  Smartphone,
  Landmark,
  ArrowLeftRight,
  Calendar,
  Printer,
  Search,
  CheckCircle2,
  Trash2,
  Tag,
  AlertCircle,
  X,
  Clock,
  ChevronDown,
  Phone,
  FileText,
  Barcode as BarcodeIcon,
  ShoppingCart,
} from 'lucide-react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { BarcodeNotFoundModal } from './BarcodeNotFoundModal';
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

/** Extrae la fecha YYYY-MM-DD en la zona horaria oficial America/Lima */
function getLimaDateFromTimestamp(val?: string | null): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val.substring(0, 10);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  } catch {
    return val.substring(0, 10);
  }
}

/** Obtiene la fecha y hora actual en la zona horaria oficial de Perú (America/Lima) en formato YYYY-MM-DDTHH:mm */
function getLimaCurrentDateTimeString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatter.format(new Date()).replace(' ', 'T');
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}

/** Formatea una fecha/hora ISO en cadena legible para Perú */
function formatDateTimeLima(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export const POSView: React.FC = () => {
  const {
    products,
    ventasMostrador,
    deleteVentaMostrador,
    openTicketModal,
    currentRole,
    currentUser,
    lastSyncTimestamp,
    isDataLoading,
    processPosSaleWithStock,
    setActiveView,
  } = useApp();

  const isAdmin = currentRole === 'admin' || currentUser?.role === 'admin';
  const todayStr = getTodayDateString();

  // Estados del Historial de Ventas (Selector exclusivo para ADMIN)
  const [historyDate, setHistoryDate] = useState<string>(todayStr);
  const effectiveHistoryDate = isAdmin ? historyDate : todayStr;
  const [historySales, setHistorySales] = useState<VentaMostrador[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Consulta de ventas en Supabase para la fecha seleccionada (00:00:00 a 23:59:59 America/Lima UTC-5)
  const fetchHistoryVentas = useCallback(async (targetDate: string) => {
    setIsLoadingHistory(true);
    try {
      const startOfDay = `${targetDate}T00:00:00-05:00`;
      const endOfDay = `${targetDate}T23:59:59.999-05:00`;

      const { data: dbVentas, error } = await supabase
        .from('ventas_mostrador')
        .select('*')
        .gte('fecha', startOfDay)
        .lte('fecha', endOfDay)
        .order('fecha', { ascending: false });

      if (!error && dbVentas) {
        const mapped: VentaMostrador[] = dbVentas.map((v: any) => {
          const isMixto = v.metodo_pago?.toLowerCase() === 'mixto';
          const mEfectivo = v.monto_efectivo != null ? Number(v.monto_efectivo) : undefined;
          const mYape = v.monto_yape != null ? Number(v.monto_yape) : undefined;
          const mTransf = v.monto_transferencia != null ? Number(v.monto_transferencia) : undefined;
          const mDesc = v.monto_descuento != null ? Number(v.monto_descuento) : 0;
          const mSub = v.subtotal != null ? Number(v.subtotal) : Number(v.total || 0) + mDesc;
          return {
            id: v.id,
            ticket_number: v.ticket_number || `TK-${v.id.substring(0, 5).toUpperCase()}`,
            client_name: v.cliente_nombre,
            product_name: v.producto_nombre,
            quantity: v.cantidad,
            unit_price_cents: Math.round(Number(v.precio_unitario) * 100),
            total_price_cents: Math.round(Number(v.total) * 100),
            subtotal: mSub,
            subtotal_cents: Math.round(mSub * 100),
            monto_descuento: mDesc,
            discount_cents: Math.round(mDesc * 100),
            detalles_items: Array.isArray(v.detalles_items) ? v.detalles_items : undefined,
            payment_method: isMixto ? 'MIXTO' : (v.metodo_pago?.toLowerCase() || 'efectivo') as any,
            notes: v.notas || undefined,
            created_at: v.fecha || v.created_at,
            monto_efectivo: mEfectivo,
            monto_yape: mYape,
            monto_transferencia: mTransf,
            cash_cents: mEfectivo != null ? Math.round(mEfectivo * 100) : undefined,
            yape_cents: mYape != null ? Math.round(mYape * 100) : undefined,
            transfer_cents: mTransf != null ? Math.round(mTransf * 100) : undefined,
            detalles_pago: v.detalles_pago || undefined,
          };
        });
        setHistorySales(mapped);
      } else {
        // Fallback en caso de desconexión: filtrar desde ventasMostrador de contexto
        const filtered = ventasMostrador.filter(
          (v) => getLimaDateFromTimestamp(v.created_at) === targetDate
        );
        setHistorySales(filtered);
      }
    } catch (err) {
      console.error('[POSView] Error al consultar historial de ventas:', err);
      const filtered = ventasMostrador.filter(
        (v) => getLimaDateFromTimestamp(v.created_at) === targetDate
      );
      setHistorySales(filtered);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [ventasMostrador]);

  useEffect(() => {
    fetchHistoryVentas(effectiveHistoryDate);
  }, [effectiveHistoryDate, fetchHistoryVentas, lastSyncTimestamp]);

  // Interfaz de cada fila de producto en la lista dinámica de la venta
  interface POSSaleItemRow {
    id: string;
    product_id?: string;
    barcode?: string;
    name: string;
    stock?: number;
    image_url?: string;
    quantity: number;
    unit_price: string;
  }

  // Estados del Formulario de Venta
  const [clientName, setClientName] = useState<string>('');
  const [clientDni, setClientDni] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [saleItems, setSaleItems] = useState<POSSaleItemRow[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'yape' | 'transferencia' | 'mixto'>('efectivo');
  const [saleDateTime, setSaleDateTime] = useState<string>(getLimaCurrentDateTimeString());

  // Estados del Modo Mixto (Selección múltiple de exactamente 2 métodos)
  type BasePaymentMethod = 'efectivo' | 'yape' | 'transferencia';
  const [isMixtoMode, setIsMixtoMode] = useState<boolean>(false);
  const [selectedSubMethods, setSelectedSubMethods] = useState<BasePaymentMethod[]>([]);
  const [mixtoAmounts, setMixtoAmounts] = useState<Record<BasePaymentMethod, string>>({
    efectivo: '',
    yape: '',
    transferencia: '',
  });

  // Estados de interfaz y feedback
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastRegisteredTicket, setLastRegisteredTicket] = useState<{ number: string; total: string } | null>(null);
  const [historySearch, setHistorySearch] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Productos sugeridos filtrados según lo que escriba el usuario en el buscador
  const suggestedProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 8);
    const query = productSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  const [manualBarcodeInput, setManualBarcodeInput] = useState<string>('');
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [stockAlert, setStockAlert] = useState<{ productName: string; availableStock: number } | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [isSubmittingSale, setIsSubmittingSale] = useState<boolean>(false);

  // Escaneo o ingreso de código de barras:
  // - Si es un producto DIFERENTE a los que ya están en la venta actual, agrégalo como nueva fila.
  // - Si es un producto que YA EXISTE en la lista actual, simplemente suma +1 a su cantidad en la fila correspondiente.
  const handleScanProduct = useCallback(
    (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      const found = products.find(
        (p) =>
          p.barcode?.trim() === cleanCode ||
          p.barcode?.replace(/\s+/g, '') === cleanCode
      );

      if (!found) {
        setNotFoundBarcode(cleanCode);
        return;
      }

      if (found.stock <= 0) {
        setStockAlert({
          productName: found.name,
          availableStock: found.stock,
        });
        setTimeout(() => setStockAlert(null), 4500);
        return;
      }

      setSaleItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.product_id === found.id);
        if (existingIndex >= 0) {
          const currentQty = prev[existingIndex].quantity;
          if (currentQty + 1 > found.stock) {
            setStockAlert({
              productName: found.name,
              availableStock: found.stock,
            });
            setTimeout(() => setStockAlert(null), 4500);
            return prev;
          }
          const updated = [...prev];
          const newQty = currentQty + 1;
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: newQty,
          };
          setScanFeedback(`¡"${found.name}" (Cantidad: ${newQty}) actualizado en la venta!`);
          setTimeout(() => setScanFeedback(null), 2500);
          return updated;
        } else {
          // Agregar nueva fila a la lista de venta
          const newItem: POSSaleItemRow = {
            id: `prod-${found.id}-${Date.now()}`,
            product_id: found.id,
            barcode: found.barcode,
            name: found.name,
            stock: found.stock,
            image_url: found.image_url,
            quantity: 1,
            unit_price: (found.price_cents / 100).toFixed(2),
          };
          setScanFeedback(`¡"${found.name}" agregado a la lista de venta!`);
          setTimeout(() => setScanFeedback(null), 2500);
          return [...prev, newItem];
        }
      });
      setValidationError(null);
    },
    [products]
  );

  // Hook global del lector de código de barras
  useBarcodeScanner({
    enabled: !notFoundBarcode,
    onScan: handleScanProduct,
  });

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcodeInput.trim()) return;
    handleScanProduct(manualBarcodeInput.trim());
    setManualBarcodeInput('');
  };

  // Selección de una sugerencia del catálogo
  const handleSelectProductSuggestion = (product: Product) => {
    if (product.stock <= 0) {
      setStockAlert({
        productName: product.name,
        availableStock: product.stock,
      });
      setTimeout(() => setStockAlert(null), 4000);
      return;
    }

    setSaleItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.id);
      if (existingIndex >= 0) {
        const currentQty = prev[existingIndex].quantity;
        if (currentQty + 1 > product.stock) {
          setStockAlert({
            productName: product.name,
            availableStock: product.stock,
          });
          setTimeout(() => setStockAlert(null), 4000);
          return prev;
        }
        const updated = [...prev];
        const newQty = currentQty + 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };
        setScanFeedback(`¡"${product.name}" (Cantidad: ${newQty}) actualizado!`);
        setTimeout(() => setScanFeedback(null), 2500);
        return updated;
      } else {
        const newItem: POSSaleItemRow = {
          id: `prod-${product.id}-${Date.now()}`,
          product_id: product.id,
          barcode: product.barcode,
          name: product.name,
          stock: product.stock,
          image_url: product.image_url,
          quantity: 1,
          unit_price: (product.price_cents / 100).toFixed(2),
        };
        setScanFeedback(`¡"${product.name}" agregado a la venta!`);
        setTimeout(() => setScanFeedback(null), 2500);
        return [...prev, newItem];
      }
    });

    setProductSearch('');
    setIsDropdownOpen(false);
    setValidationError(null);
  };

  // Agregar un producto o servicio libre no catalogado
  const handleAddCustomConcept = () => {
    const text = productSearch.trim();
    if (!text) return;

    const newItem: POSSaleItemRow = {
      id: `custom-${Date.now()}`,
      name: text,
      quantity: 1,
      unit_price: '0.00',
    };
    setSaleItems((prev) => [...prev, newItem]);
    setProductSearch('');
    setIsDropdownOpen(false);
    setValidationError(null);
    setScanFeedback(`¡Concepto "${text}" agregado a la venta!`);
    setTimeout(() => setScanFeedback(null), 2500);
  };

  // Modificar cantidad de una fila específica
  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const target = saleItems[index];
    if (target && target.stock != null && newQty > target.stock) {
      setStockAlert({
        productName: target.name,
        availableStock: target.stock,
      });
      setTimeout(() => setStockAlert(null), 4000);
      return;
    }
    setSaleItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  // Modificar precio unitario de una fila específica
  const handleUpdateItemPrice = (index: number, newPrice: string) => {
    setSaleItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], unit_price: newPrice };
      return updated;
    });
  };

  // Eliminar una fila específica de la lista
  const handleRemoveItem = (index: number) => {
    setSaleItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Cálculo Matemático Estricto del Total en Vivo:
  // 1. Subtotal = Suma total de (Cantidad × Precio Unitario de cada fila)
  // 2. Descuento Global (S/) = No altera los precios unitarios individuales
  // 3. Total Calculado = Max(0, Subtotal - Descuento Global)
  const subtotalCents = useMemo(() => {
    return saleItems.reduce((acc, item) => {
      const p = parseFloat(item.unit_price) || 0;
      const q = item.quantity || 0;
      return acc + Math.round(q * p * 100);
    }, 0);
  }, [saleItems]);

  const parsedDiscount = parseFloat(globalDiscount) || 0;
  const discountCents = Math.max(0, Math.round(parsedDiscount * 100));

  const totalCents = Math.max(0, subtotalCents - discountCents);
  const formattedTotal = formatSoles(totalCents);

  // Cálculos y Validación para Modo Mixto
  const currentMixtoSumCents = useMemo(() => {
    if (!isMixtoMode) return totalCents;
    return selectedSubMethods.reduce((acc, m) => {
      const val = parseFloat(mixtoAmounts[m]) || 0;
      return acc + Math.round(val * 100);
    }, 0);
  }, [isMixtoMode, selectedSubMethods, mixtoAmounts, totalCents]);

  const isMixtoBalanced = useMemo(() => {
    if (!isMixtoMode) return true;
    if (selectedSubMethods.length !== 2) return false;
    if (totalCents <= 0) return false;
    const cents1 = Math.round((parseFloat(mixtoAmounts[selectedSubMethods[0]]) || 0) * 100);
    const cents2 = Math.round((parseFloat(mixtoAmounts[selectedSubMethods[1]]) || 0) * 100);
    return cents1 > 0 && cents2 > 0 && cents1 + cents2 === totalCents;
  }, [isMixtoMode, selectedSubMethods, mixtoAmounts, totalCents]);

  const mixtoDiffCents = totalCents - currentMixtoSumCents;

  const isSubmitDisabled =
    isSubmittingSale ||
    !clientName.trim() ||
    saleItems.length === 0 ||
    subtotalCents <= 0 ||
    saleItems.some(
      (it) =>
        it.quantity < 1 ||
        isNaN(parseFloat(it.unit_price)) ||
        parseFloat(it.unit_price) < 0
    ) ||
    (isMixtoMode && (!isMixtoBalanced || selectedSubMethods.length !== 2));

  // Toggle del Modo Mixto
  const handleToggleMixto = () => {
    if (isMixtoMode) {
      // Desactivar: regresa al modo de selección única tradicional con Efectivo por defecto
      setIsMixtoMode(false);
      setSelectedSubMethods([]);
      setMixtoAmounts({ efectivo: '', yape: '', transferencia: '' });
      setPaymentMethod('efectivo');
    } else {
      // Activar: modo combinado
      setIsMixtoMode(true);
      setPaymentMethod('mixto');
      const baseSub1: BasePaymentMethod = paymentMethod === 'mixto' ? 'efectivo' : paymentMethod;
      const baseSub2: BasePaymentMethod = baseSub1 === 'efectivo' ? 'yape' : 'efectivo';
      const initialSubs: BasePaymentMethod[] = [baseSub1, baseSub2];
      setSelectedSubMethods(initialSubs);

      const totalSoles = totalCents / 100;
      if (totalSoles > 0) {
        const half = Number((totalSoles / 2).toFixed(2));
        const rest = Number((totalSoles - half).toFixed(2));
        setMixtoAmounts({
          efectivo: initialSubs.includes('efectivo') ? (initialSubs[0] === 'efectivo' ? half.toFixed(2) : rest.toFixed(2)) : '',
          yape: initialSubs.includes('yape') ? (initialSubs[0] === 'yape' ? half.toFixed(2) : rest.toFixed(2)) : '',
          transferencia: initialSubs.includes('transferencia') ? (initialSubs[0] === 'transferencia' ? half.toFixed(2) : rest.toFixed(2)) : '',
        });
      } else {
        setMixtoAmounts({ efectivo: '', yape: '', transferencia: '' });
      }
    }
  };

  // Selección de Submétodos en Modo Mixto o Método Único Tradicional
  const handleSelectPaymentMethod = (method: BasePaymentMethod) => {
    if (!isMixtoMode) {
      setPaymentMethod(method);
      return;
    }

    const totalSoles = totalCents / 100;
    if (selectedSubMethods.includes(method)) {
      // Deseleccionar este método
      const updated = selectedSubMethods.filter((m) => m !== method);
      setSelectedSubMethods(updated);
      setMixtoAmounts((prev) => ({ ...prev, [method]: '' }));
    } else {
      if (selectedSubMethods.length < 2) {
        const updated = [...selectedSubMethods, method];
        setSelectedSubMethods(updated);
        // Si ahora son 2, autocompletar la diferencia con el primero
        if (updated.length === 2) {
          const firstMethod = updated[0];
          const firstVal = parseFloat(mixtoAmounts[firstMethod]) || 0;
          const diff = Math.max(0, Number((totalSoles - firstVal).toFixed(2)));
          setMixtoAmounts((prev) => ({
            ...prev,
            [method]: diff.toFixed(2),
          }));
        }
      } else {
        // Exactamente 2 a la vez: sustituir el segundo seleccionado
        const keptMethod = selectedSubMethods[0];
        const removedMethod = selectedSubMethods[1];
        const updated = [keptMethod, method];
        setSelectedSubMethods(updated);

        const keptVal = parseFloat(mixtoAmounts[keptMethod]) || 0;
        const diff = Math.max(0, Number((totalSoles - keptVal).toFixed(2)));
        setMixtoAmounts((prev) => ({
          ...prev,
          [removedMethod]: '',
          [method]: diff.toFixed(2),
        }));
      }
    }
  };

  // Cambio en los campos de desglose de montos con autocompletado de diferencia
  const handleMixtoAmountChange = (method: BasePaymentMethod, rawVal: string) => {
    const sanitized = rawVal.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;

    const totalSoles = totalCents / 100;
    const numVal = parseFloat(cleanVal);

    if (selectedSubMethods.length === 2) {
      const otherMethod = selectedSubMethods.find((m) => m !== method);
      if (otherMethod) {
        if (cleanVal === '') {
          setMixtoAmounts((prev) => ({
            ...prev,
            [method]: '',
          }));
          return;
        }

        if (!isNaN(numVal) && numVal >= 0 && numVal <= totalSoles) {
          const diff = Number((totalSoles - numVal).toFixed(2));
          setMixtoAmounts((prev) => ({
            ...prev,
            [method]: cleanVal,
            [otherMethod]: diff >= 0 ? diff.toFixed(2) : '0.00',
          }));
          return;
        }
      }
    }

    setMixtoAmounts((prev) => ({
      ...prev,
      [method]: cleanVal,
    }));
  };

  // Auto-ajustar diferencia en caso de descuadre
  const handleAutoBalance = () => {
    if (selectedSubMethods.length !== 2 || totalCents <= 0) return;
    const m1 = selectedSubMethods[0];
    const m2 = selectedSubMethods[1];
    const val1 = parseFloat(mixtoAmounts[m1]) || 0;
    const totalSoles = totalCents / 100;
    if (val1 < totalSoles) {
      const diff = Number((totalSoles - val1).toFixed(2));
      setMixtoAmounts((prev) => ({
        ...prev,
        [m2]: diff.toFixed(2),
      }));
    } else {
      const half = Number((totalSoles / 2).toFixed(2));
      const rest = Number((totalSoles - half).toFixed(2));
      setMixtoAmounts((prev) => ({
        ...prev,
        [m1]: half.toFixed(2),
        [m2]: rest.toFixed(2),
      }));
    }
  };

  // Sincronizar autocompletado en Mixto cuando cambia el total
  useEffect(() => {
    if (!isMixtoMode || selectedSubMethods.length !== 2) return;
    const totalSoles = totalCents / 100;
    const m1 = selectedSubMethods[0];
    const m2 = selectedSubMethods[1];
    const val1 = parseFloat(mixtoAmounts[m1]);

    if (!isNaN(val1) && val1 >= 0 && val1 <= totalSoles) {
      const diff = Number((totalSoles - val1).toFixed(2));
      setMixtoAmounts((prev) => ({
        ...prev,
        [m2]: diff.toFixed(2),
      }));
    } else if (totalSoles > 0 && !mixtoAmounts[m1] && !mixtoAmounts[m2]) {
      const half = Number((totalSoles / 2).toFixed(2));
      const rest = Number((totalSoles - half).toFixed(2));
      setMixtoAmounts((prev) => ({
        ...prev,
        [m1]: half.toFixed(2),
        [m2]: rest.toFixed(2),
      }));
    }
  }, [totalCents, isMixtoMode, selectedSubMethods]);

  // Procesamiento del Registro de Venta mediante Transacción Atómica RPC
  const handleSubmitSale = async (andPrint: boolean) => {
    setValidationError(null);

    if (!clientName.trim()) {
      setValidationError('Por favor, ingresa el nombre del cliente.');
      return;
    }

    if (clientDni.trim() && !isValidDni(clientDni.trim())) {
      setValidationError(DNI_ERROR_MESSAGE);
      return;
    }

    if (clientPhone.trim() && !isValidPhone(clientPhone.trim())) {
      setValidationError(PHONE_ERROR_MESSAGE);
      return;
    }

    if (saleItems.length === 0) {
      setValidationError('Debe agregar al menos un producto a la lista de venta.');
      return;
    }

    for (const item of saleItems) {
      if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
        setValidationError(`La cantidad del producto "${item.name}" debe ser un número entero mayor o igual a 1.`);
        return;
      }
      const priceVal = parseFloat(item.unit_price);
      if (isNaN(priceVal) || priceVal < 0) {
        setValidationError(`Por favor, ingresa un precio unitario válido para "${item.name}".`);
        return;
      }
      if (item.stock != null && item.quantity > item.stock) {
        setValidationError(`Stock insuficiente. Solo quedan ${item.stock} unidades de "${item.name}".`);
        return;
      }
    }

    if (subtotalCents <= 0) {
      setValidationError('El subtotal de los productos debe ser mayor a cero.');
      return;
    }

    if (isMixtoMode) {
      if (selectedSubMethods.length !== 2) {
        setValidationError('En modo Mixto debes seleccionar exactamente 2 métodos de pago.');
        return;
      }
      if (!isMixtoBalanced) {
        setValidationError(`En modo Mixto la suma de los montos (${formatSoles(currentMixtoSumCents)}) debe ser exactamente igual al total calculado (${formattedTotal}).`);
        return;
      }
    }

    let isoDateTimeString = new Date().toISOString();
    try {
      if (saleDateTime) {
        isoDateTimeString = new Date(saleDateTime).toISOString();
      }
    } catch {
      // Fallback
    }

    const mEfectivo = isMixtoMode && selectedSubMethods.includes('efectivo')
      ? parseFloat(mixtoAmounts.efectivo) || 0
      : undefined;
    const mYape = isMixtoMode && selectedSubMethods.includes('yape')
      ? parseFloat(mixtoAmounts.yape) || 0
      : undefined;
    const mTransferencia = isMixtoMode && selectedSubMethods.includes('transferencia')
      ? parseFloat(mixtoAmounts.transferencia) || 0
      : undefined;

    const cashCents = mEfectivo != null ? Math.round(mEfectivo * 100) : (paymentMethod === 'efectivo' ? totalCents : undefined);
    const yapeCents = mYape != null ? Math.round(mYape * 100) : (paymentMethod === 'yape' ? totalCents : undefined);
    const transferCents = mTransferencia != null ? Math.round(mTransferencia * 100) : (paymentMethod === 'transferencia' ? totalCents : undefined);

    const detallesPago = isMixtoMode
      ? {
          metodos: selectedSubMethods,
          efectivo: mEfectivo,
          yape: mYape,
          transferencia: mTransferencia,
        }
      : undefined;

    const totalQuantity = saleItems.reduce((acc, it) => acc + it.quantity, 0);
    const saleProductName =
      saleItems.length === 1
        ? saleItems[0].name
        : `${saleItems.length} productos (${saleItems.map((i) => i.name).slice(0, 2).join(', ')}${saleItems.length > 2 ? '...' : ''})`;

    const avgUnitPriceCents = Math.round(subtotalCents / Math.max(1, totalQuantity));

    const baseNotes =
      saleItems.length === 1
        ? (saleItems[0].barcode ? `Producto escaneado [Código: ${saleItems[0].barcode}]` : (saleItems[0].product_id ? 'Producto de catálogo' : 'Venta libre'))
        : `Venta múltiple (${saleItems.length} productos)`;
    const discountNote = discountCents > 0 ? ` [Descuento global: S/ ${(discountCents / 100).toFixed(2)}]` : '';
    const finalNotes = isMixtoMode
      ? `${baseNotes}${discountNote} [Mixto: ${selectedSubMethods.map((m) => `${m.toUpperCase()}: S/ ${mixtoAmounts[m]}`).join(' + ')}]`
      : `${baseNotes}${discountNote}`;

    const salePayload = {
      client_name: clientName.trim(),
      client_dni: clientDni.trim() || undefined,
      client_phone: clientPhone.trim() || undefined,
      payment_method: isMixtoMode ? ('MIXTO' as const) : paymentMethod,
      cash_cents: cashCents,
      yape_cents: yapeCents,
      transfer_cents: transferCents,
      monto_efectivo: mEfectivo,
      monto_yape: mYape,
      monto_transferencia: mTransferencia,
      detalles_pago: detallesPago,
      created_at: isoDateTimeString,
      notes: finalNotes,
      product_name: saleProductName,
      quantity: totalQuantity,
      unit_price_cents: avgUnitPriceCents,
      total_price_cents: totalCents,
      subtotal: subtotalCents / 100,
      subtotal_cents: subtotalCents,
      monto_descuento: discountCents / 100,
      discount_cents: discountCents,
    };

    const items = saleItems.map((it) => {
      const price = parseFloat(it.unit_price) || 0;
      return {
        product_id: it.product_id,
        product_name: it.name,
        quantity: it.quantity,
        unit_price: price,
        total: Math.round(it.quantity * price * 100) / 100,
      };
    });

    setIsSubmittingSale(true);
    try {
      // Invocación a transacción en Supabase
      const res = await processPosSaleWithStock(salePayload, items);

      // Sincronizar de inmediato el historial en pantalla si corresponde a la fecha visualizada
      if (getLimaDateFromTimestamp(isoDateTimeString) === effectiveHistoryDate) {
        setHistorySales((prev) => [...res.sales, ...prev]);
      }

      // Feedback visual
      setLastRegisteredTicket({
        number: res.ticket_number,
        total: formattedTotal,
      });

      // Limpiar formulario para la siguiente venta
      setSaleItems([]);
      setGlobalDiscount('');
      setClientName('');
      setClientDni('');
      setClientPhone('');
      setProductSearch('');
      setSaleDateTime(getLimaCurrentDateTimeString());
      setIsMixtoMode(false);
      setSelectedSubMethods([]);
      setMixtoAmounts({ efectivo: '', yape: '', transferencia: '' });
      setPaymentMethod('efectivo');

      // Si se solicitó imprimir, abrir el diálogo del ticket térmico
      if (andPrint && res.sales.length > 0) {
        openTicketModal('pos', res.sales[0]);
      }
    } catch (err: any) {
      console.error('Error al procesar la venta POS:', err);
      setValidationError(err.message || 'Error al procesar la venta en el servidor.');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Filtrar historial de ventas de la fecha seleccionada
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return historySales;
    const q = historySearch.toLowerCase().trim();
    return historySales.filter(
      (v) =>
        v.ticket_number?.toLowerCase().includes(q) ||
        v.client_name?.toLowerCase().includes(q) ||
        v.product_name?.toLowerCase().includes(q) ||
        v.payment_method?.toLowerCase().includes(q)
    );
  }, [historySales, historySearch]);

  // Resumen del turno recalculado exclusivamente para la fecha seleccionada
  const turnoTotalCents = useMemo(() => {
    return historySales.reduce((acc, v) => acc + (v.total_price_cents || 0), 0);
  }, [historySales]);
  const turnoTotalCount = historySales.length;

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. CABECERA DEL FORMULARIO */}
      <div className="bg-[#141414] border border-[#C8A45C]/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#C8A45C]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1C1A14] to-[#121212] border border-[#C8A45C]/60 flex items-center justify-center text-[#E6C875] shadow-lg shadow-[#C8A45C]/10 shrink-0">
              <Zap className="w-6 h-6 fill-[#C8A45C] text-[#C8A45C]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Nueva Venta en Mostrador
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#C8A45C]/15 border border-[#C8A45C]/30 text-[#E6C875]">
                  POS Express
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Despacho rápido y directo sin restricciones de inventario. Venta ágil de productos, accesorios y acuerdos especiales.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-center shrink-0">
            <span className="text-[11px] font-medium text-neutral-400 bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 rounded-lg shadow-sm">
              Campos obligatorios marcados con <span className="text-[#E6C875] font-bold">*</span>
            </span>
          </div>
        </div>

        {/* Mensaje de éxito tras registrar una venta */}
        {lastRegisteredTicket && (
          <div className="mt-5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                ¡Venta registrada con éxito! Comprobante{' '}
                <strong className="text-white font-mono">#{lastRegisteredTicket.number}</strong> por un monto de{' '}
                <strong className="text-[#E6C875]">{lastRegisteredTicket.total}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLastRegisteredTicket(null)}
              className="text-neutral-400 hover:text-white p-1"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Mensaje de error de validación */}
        {validationError && (
          <div className="mt-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="text-neutral-400 hover:text-white p-1"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Barra Inteligente del Escáner de Código de Barras */}
        <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-[#171612] via-[#121212] to-[#171612] border border-[#C8A45C]/40 shadow-inner flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-9 h-9 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/40 flex items-center justify-center text-[#E6C875] shrink-0">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white tracking-wide">
                  Lector de Código de Barras Activo
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Escanee productos con su lector USB/Bluetooth para agregarlos a la venta:
              </p>
            </div>
          </div>

          <form onSubmit={handleManualBarcodeSubmit} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                value={manualBarcodeInput}
                onChange={(e) => setManualBarcodeInput(e.target.value)}
                placeholder="Código de barras..."
                className="w-full bg-black/60 border border-neutral-700 focus:border-[#C8A45C] text-white rounded-lg pl-3 pr-8 py-1.5 text-xs font-mono outline-none transition"
              />
              {manualBarcodeInput && (
                <button
                  type="button"
                  onClick={() => setManualBarcodeInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#C8A45C] hover:bg-[#DFBE73] text-black font-bold text-xs rounded-lg transition shrink-0 cursor-pointer"
            >
              Escanear
            </button>
          </form>
        </div>

        {/* Notificación de escaneo exitoso */}
        {scanFeedback && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{scanFeedback}</span>
          </div>
        )}

        {/* Alerta de stock insuficiente */}
        {stockAlert && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-2 animate-shake">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                Stock insuficiente para <strong>"{stockAlert.productName}"</strong>. Stock disponible:{' '}
                <strong className="text-white underline">{stockAlert.availableStock} unidades</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStockAlert(null)}
              className="text-neutral-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* FORMULARIO DIRECTO DE VENTA */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitSale(true);
          }}
          className="mt-6 space-y-6 text-xs"
        >
          {/* 2. CAMPOS DEL FORMULARIO (FILA SUPERIOR FLEXIBLE) */}
          <div className="space-y-4">
            {/* Fila 1: Datos del Cliente (Nombre, DNI facturación, Teléfono WhatsApp) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Nombre del Cliente */}
              <div className="md:col-span-6 space-y-1.5">
                <label htmlFor="pos-client-name" className="block text-neutral-300 font-semibold tracking-wide">
                  Nombre del Cliente <span className="text-[#E6C875]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                  <input
                    id="pos-client-name"
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez / Mario Vargas"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C]/40 text-white rounded-xl pl-9 pr-3 py-2.5 outline-none transition placeholder:text-neutral-600 text-xs"
                  />
                </div>
              </div>

              {/* DNI / Documento de Facturación */}
              <div className="md:col-span-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="pos-client-dni" className="block text-neutral-300 font-semibold tracking-wide">
                    DNI / Documento
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">8 dígitos</span>
                </div>
                <div className="relative">
                  <FileText className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                  <input
                    id="pos-client-dni"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    placeholder={DNI_PLACEHOLDER}
                    value={clientDni}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => {
                      setClientDni(sanitizeDni(e.target.value));
                      if (validationError) setValidationError(null);
                    }}
                    className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C]/40 text-white rounded-xl pl-9 pr-3 py-2.5 outline-none transition placeholder:text-neutral-600 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Teléfono WhatsApp */}
              <div className="md:col-span-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="pos-client-phone" className="block text-neutral-300 font-semibold tracking-wide">
                    Teléfono WhatsApp
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                  <input
                    id="pos-client-phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{9}"
                    maxLength={9}
                    placeholder={PHONE_PLACEHOLDER}
                    value={clientPhone}
                    onKeyDown={handleNumericKeyDown}
                    onChange={(e) => {
                      setClientPhone(sanitizePhone(e.target.value));
                      if (validationError) setValidationError(null);
                    }}
                    className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C]/40 text-white rounded-xl pl-9 pr-3 py-2.5 outline-none transition placeholder:text-neutral-600 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Fila 2: Búsqueda y Lista Dinámica de Productos Acumulados */}
            <div className="space-y-4 pt-1">
              {/* Buscador y Selector para Agregar al Ticket */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label htmlFor="pos-search-product-input" className="block text-neutral-300 font-semibold tracking-wide">
                  Buscar Producto en Catálogo o Agregar Concepto <span className="text-[#E6C875]">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                    <input
                      id="pos-search-product-input"
                      ref={inputSearchRef}
                      type="text"
                      placeholder="Escriba el nombre, código de barras o concepto libre..."
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setIsDropdownOpen(true);
                        if (validationError) setValidationError(null);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (suggestedProducts.length > 0 && productSearch.trim()) {
                            handleSelectProductSuggestion(suggestedProducts[0]);
                          } else if (productSearch.trim()) {
                            handleAddCustomConcept();
                          }
                        }
                      }}
                      className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C]/40 text-white rounded-xl pl-9 pr-8 py-2.5 outline-none transition placeholder:text-neutral-600 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="absolute right-2.5 top-2.5 p-1 text-neutral-500 hover:text-[#C8A45C] transition cursor-pointer"
                      title="Ver sugerencias del catálogo"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {productSearch.trim() && (
                    <button
                      type="button"
                      id="pos-add-concept-btn"
                      onClick={handleAddCustomConcept}
                      className="px-3.5 py-2.5 bg-neutral-800 hover:bg-[#C8A45C] text-neutral-300 hover:text-black font-semibold text-xs rounded-xl border border-neutral-700 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                      title="Agregar como concepto libre"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Concepto</span>
                    </button>
                  )}
                </div>

                {/* Nota explicativa */}
                <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-1">
                  <Tag className="w-3 h-3 text-[#C8A45C]/70 shrink-0" />
                  <span>Escanee con el lector de barras o seleccione del catálogo para acumular productos en la venta.</span>
                </p>

                {/* Menú Flotante de Sugerencias */}
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#181818] border border-neutral-700/80 rounded-xl shadow-2xl z-40 overflow-hidden max-h-60 overflow-y-auto divide-y divide-neutral-800/80 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 bg-[#121212] text-[10px] uppercase font-bold text-[#C8A45C] tracking-wider flex items-center justify-between">
                      <span>Sugerencias del Catálogo ({suggestedProducts.length})</span>
                      <span className="text-neutral-500 text-[9px] lowercase font-normal">clic para agregar al ticket</span>
                    </div>

                    {suggestedProducts.length > 0 ? (
                      suggestedProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProductSuggestion(p)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-[#222018] flex items-center justify-between gap-3 transition group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-medium group-hover:text-[#E6C875] truncate transition-colors">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {p.barcode && (
                                <span className="text-[9px] font-mono text-[#E6C875] bg-[#C8A45C]/15 px-1 rounded border border-[#C8A45C]/30">
                                  {p.barcode}
                                </span>
                              )}
                              <span className="text-[10px] text-neutral-400">
                                Stock: {p.stock} un.
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-[#E6C875] block font-mono text-xs">
                              {formatSoles(p.price_cents)}
                            </span>
                            <span className="text-[9px] text-[#C8A45C] opacity-0 group-hover:opacity-100 transition">
                              + Agregar ↗
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-neutral-400 text-[11px]">
                        No hay coincidencias en el catálogo. Puedes agregarlo como concepto libre.
                      </div>
                    )}

                    {productSearch.trim() && (
                      <div
                        onClick={handleAddCustomConcept}
                        className="px-3 py-2.5 bg-neutral-900 text-[#E6C875] hover:bg-neutral-800 text-[11px] font-semibold cursor-pointer text-center border-t border-neutral-800 flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar concepto libre: &ldquo;{productSearch.trim()}&rdquo;</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lista Dinámica de Productos Acumulados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[#C8A45C]" />
                    <span>Lista de Productos en la Venta ({saleItems.length})</span>
                    {saleItems.length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/30">
                        {saleItems.reduce((acc, it) => acc + it.quantity, 0)} unidades
                      </span>
                    )}
                  </div>
                  {saleItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSaleItems([])}
                      className="text-[11px] text-neutral-400 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
                      title="Vaciar toda la lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vaciar lista</span>
                    </button>
                  )}
                </div>

                {saleItems.length === 0 ? (
                  <div className="bg-[#181818]/60 border border-dashed border-neutral-800 rounded-xl p-7 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-neutral-800/60 border border-neutral-700/80 flex items-center justify-center mx-auto text-neutral-500">
                      <Package className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-neutral-300 font-medium">
                      No hay productos agregados a la venta actual
                    </p>
                    <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                      Pase el código de barras por el escáner o busque en el catálogo para acumular los productos en el ticket.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {saleItems.map((item, index) => {
                      const itemSubtotalCents = Math.round(
                        item.quantity * (parseFloat(item.unit_price) || 0) * 100
                      );
                      return (
                        <div
                          key={item.id}
                          className="bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/40 rounded-xl p-3 sm:p-3.5 transition shadow-sm space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4 animate-in fade-in duration-150"
                        >
                          {/* 1. Nombre e Info (Solo Lectura) */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-9 h-9 rounded-lg object-cover border border-neutral-700/80 bg-neutral-900 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center shrink-0 text-[#C8A45C]">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-white font-semibold text-xs truncate" title={item.name}>
                                {item.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {item.barcode && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#E6C875] bg-[#C8A45C]/15 px-1.5 py-0.2 rounded border border-[#C8A45C]/30">
                                    <BarcodeIcon className="w-2.5 h-2.5" />
                                    {item.barcode}
                                  </span>
                                )}
                                {item.stock != null ? (
                                  <span className="text-[10px] text-neutral-400">
                                    Stock: <strong className={item.stock <= 3 ? 'text-amber-400' : 'text-emerald-400'}>{item.stock} un.</strong>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-neutral-500 italic">Concepto libre</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. Controles: Cantidad, Precio Unitario, Subtotal y Eliminar */}
                          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0">
                            {/* Cantidad Stepper */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-neutral-400 md:hidden">Cant:</span>
                              <div className="flex items-center rounded-lg bg-black/50 border border-neutral-700/80 p-0.5">
                                <button
                                  type="button"
                                  disabled={item.quantity <= 1}
                                  onClick={() => handleUpdateItemQuantity(index, item.quantity - 1)}
                                  className="w-7 h-7 rounded-md bg-neutral-800 hover:bg-[#C8A45C] hover:text-black text-neutral-300 flex items-center justify-center transition disabled:opacity-20 cursor-pointer"
                                  title="Disminuir cantidad"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    handleUpdateItemQuantity(index, isNaN(v) || v < 1 ? 1 : v);
                                  }}
                                  className="w-10 text-center bg-transparent text-white font-bold text-xs outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                                  className="w-7 h-7 rounded-md bg-neutral-800 hover:bg-[#C8A45C] hover:text-black text-neutral-300 flex items-center justify-center transition cursor-pointer"
                                  title="Incrementar cantidad"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Precio Unitario Editable */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-neutral-400 md:hidden">P. Unit:</span>
                              <div className="relative w-24">
                                <span className="absolute left-2.5 top-1.5 font-bold text-[#E6C875] text-xs">S/</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.10"
                                  value={item.unit_price}
                                  onChange={(e) => handleUpdateItemPrice(index, e.target.value)}
                                  placeholder="0.00"
                                  className="w-full bg-black/50 border border-neutral-700/80 focus:border-[#C8A45C] text-white font-bold font-mono rounded-lg pl-7 pr-2 py-1 outline-none text-xs"
                                  title="Precio Unitario (S/)"
                                />
                              </div>
                            </div>

                            {/* Subtotal Fila */}
                            <div className="w-24 text-right">
                              <span className="text-[10px] text-neutral-400 block md:hidden">Subtotal:</span>
                              <span className="font-bold text-[#E6C875] font-mono text-xs block">
                                {formatSoles(itemSubtotalCents)}
                              </span>
                            </div>

                            {/* Botón Eliminar Fila */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-300 border border-transparent hover:border-rose-500/40 transition cursor-pointer"
                              title="Eliminar este producto de la venta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Nuevo Campo de Descuento Global (S/) */}
              <div className="bg-[#181818]/90 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-0.5">
                  <label htmlFor="pos-global-discount-input" className="block text-neutral-200 font-semibold tracking-wide text-xs">
                    Descuento Global (S/)
                  </label>
                  <p className="text-[11px] text-neutral-400">
                    Se deduce directamente del total de la compra sin alterar los precios unitarios individuales.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 sm:w-64 shrink-0">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 font-bold text-[#E6C875] text-xs">S/</span>
                    <input
                      id="pos-global-discount-input"
                      type="number"
                      min="0"
                      step="0.50"
                      placeholder="0.00"
                      value={globalDiscount}
                      onChange={(e) => {
                        setGlobalDiscount(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      className="w-full bg-black/60 border border-neutral-700 focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C]/40 text-white font-bold font-mono rounded-xl pl-8 pr-3 py-2 outline-none transition text-xs"
                    />
                  </div>
                  {discountCents > 0 && (
                    <button
                      type="button"
                      onClick={() => setGlobalDiscount('')}
                      className="px-2.5 py-2 text-[11px] rounded-xl bg-neutral-800 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-300 transition border border-neutral-700 cursor-pointer shrink-0"
                      title="Limpiar descuento"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. FILA INTERMEDIA */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2 border-t border-neutral-800/70">
            {/* Método de Pago (4 Botones tipo Pill / Tarjeta) */}
            <div className="md:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="block text-neutral-300 font-semibold tracking-wide">
                  Método de Pago
                </span>
                {isMixtoMode ? (
                  <span className="text-[10px] text-[#E6C875] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-[#C8A45C]/15 border border-[#C8A45C]/35 animate-pulse">
                    Modo Mixto Activo (Marca 2 opciones)
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-500">
                    Selección única
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Efectivo */}
                <button
                  type="button"
                  id="pos-payment-efectivo"
                  onClick={() => handleSelectPaymentMethod('efectivo')}
                  className={`py-2.5 px-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer border ${
                    (!isMixtoMode && paymentMethod === 'efectivo') || (isMixtoMode && selectedSubMethods.includes('efectivo'))
                      ? 'bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black border-[#C8A45C] shadow-lg shadow-[#C8A45C]/20 font-bold'
                      : 'bg-[#181818] text-neutral-400 hover:text-white border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Efectivo</span>
                  {isMixtoMode && selectedSubMethods.includes('efectivo') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                  )}
                </button>

                {/* Yape */}
                <button
                  type="button"
                  id="pos-payment-yape"
                  onClick={() => handleSelectPaymentMethod('yape')}
                  className={`py-2.5 px-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer border ${
                    (!isMixtoMode && paymentMethod === 'yape') || (isMixtoMode && selectedSubMethods.includes('yape'))
                      ? 'bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black border-[#C8A45C] shadow-lg shadow-[#C8A45C]/20 font-bold'
                      : 'bg-[#181818] text-neutral-400 hover:text-white border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Yape</span>
                  {isMixtoMode && selectedSubMethods.includes('yape') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                  )}
                </button>

                {/* Transferencia */}
                <button
                  type="button"
                  id="pos-payment-transferencia"
                  onClick={() => handleSelectPaymentMethod('transferencia')}
                  className={`py-2.5 px-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer border ${
                    (!isMixtoMode && paymentMethod === 'transferencia') || (isMixtoMode && selectedSubMethods.includes('transferencia'))
                      ? 'bg-gradient-to-r from-[#C8A45C] to-[#E6C875] text-black border-[#C8A45C] shadow-lg shadow-[#C8A45C]/20 font-bold'
                      : 'bg-[#181818] text-neutral-400 hover:text-white border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  <span>Transferencia</span>
                  {isMixtoMode && selectedSubMethods.includes('transferencia') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                  )}
                </button>

                {/* Mixto (Toggle / Switch de Modo Combinado) */}
                <button
                  type="button"
                  id="pos-payment-mixto"
                  onClick={handleToggleMixto}
                  className={`py-2.5 px-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer border ${
                    isMixtoMode
                      ? 'bg-[#C8A45C]/20 text-[#E6C875] border-2 border-[#C8A45C] shadow-lg shadow-[#C8A45C]/25 ring-2 ring-[#C8A45C]/40 font-bold'
                      : 'bg-[#181818] text-neutral-400 hover:text-white border-neutral-800 hover:border-neutral-700'
                  }`}
                  title={isMixtoMode ? 'Desactivar modo Mixto y volver a Efectivo' : 'Activar modo Mixto combinado'}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Mixto</span>
                  {isMixtoMode && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#C8A45C] text-black font-mono font-bold leading-tight uppercase">
                      ON
                    </span>
                  )}
                </button>
              </div>

              {/* Desglose Dinámico de Montos en Modo Mixto */}
              {isMixtoMode && (
                <div className="mt-3 p-4 rounded-xl bg-[#171612] border border-[#C8A45C]/35 space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#C8A45C]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4 text-[#C8A45C]" />
                      <span className="text-xs font-bold text-white tracking-wide uppercase">
                        Desglose de Pago Mixto
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#C8A45C]/20 text-[#E6C875] font-mono font-medium border border-[#C8A45C]/30">
                        {selectedSubMethods.length}/2 métodos activos
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-400">
                      Total a cuadrar: <strong className="text-[#E6C875] font-mono">{formattedTotal}</strong>
                    </span>
                  </div>

                  {selectedSubMethods.length < 2 ? (
                    <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        Selecciona <strong>{2 - selectedSubMethods.length} método(s) más</strong> arriba para activar los 2 campos de importe.
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedSubMethods.map((m) => {
                        const label = m === 'efectivo' ? 'Efectivo' : m === 'yape' ? 'Yape' : 'Transferencia';
                        const Icon = m === 'efectivo' ? Banknote : m === 'yape' ? Smartphone : Landmark;
                        return (
                          <div key={m} className="space-y-1.5">
                            <label htmlFor={`pos-mixto-${m}`} className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                              <span className="flex items-center gap-1.5">
                                <Icon className="w-3.5 h-3.5 text-[#C8A45C]" />
                                <span>Monto {label} (S/)</span>
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">Autocompleta</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 font-bold text-[#E6C875] text-xs">S/</span>
                              <input
                                id={`pos-mixto-${m}`}
                                type="number"
                                min="0"
                                step="0.10"
                                placeholder="0.00"
                                value={mixtoAmounts[m]}
                                onChange={(e) => handleMixtoAmountChange(m, e.target.value)}
                                className="w-full bg-[#1F1E19] border border-[#C8A45C]/40 focus:border-[#C8A45C] focus:ring-1 focus:ring-[#C8A45C]/40 text-white font-bold font-mono rounded-xl pl-8 pr-3 py-2 outline-none transition text-xs"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Barra de Estado de Cuadre */}
                  {selectedSubMethods.length === 2 && (
                    <div className="pt-2 border-t border-[#C8A45C]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {isMixtoBalanced ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Cuadre exacto: S/ {(currentMixtoSumCents / 100).toFixed(2)} de {formattedTotal}</span>
                          </span>
                        ) : mixtoDiffCents > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            <span>Faltan S/ {(mixtoDiffCents / 100).toFixed(2)} para completar el total</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span>Excede por S/ {(Math.abs(mixtoDiffCents) / 100).toFixed(2)} del total</span>
                          </span>
                        )}
                      </div>

                      {!isMixtoBalanced && totalCents > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoBalance}
                          className="self-end sm:self-auto text-[11px] font-semibold text-[#E6C875] hover:text-white underline underline-offset-2 transition cursor-pointer"
                        >
                          Cuadrar diferencia
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fecha / Hora de Venta (Nativo, inicializado en America/Lima) */}
            <div className="md:col-span-5 space-y-2">
              <label htmlFor="pos-datetime-input" className="block text-neutral-300 font-semibold tracking-wide">
                Fecha / Hora de Venta (Hora Oficial Perú)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#C8A45C] absolute left-3 top-3" />
                <input
                  id="pos-datetime-input"
                  type="datetime-local"
                  required
                  value={saleDateTime}
                  onChange={(e) => setSaleDateTime(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl pl-9 pr-3 py-2.5 outline-none transition [color-scheme:dark] text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* 4. PIE DEL FORMULARIO Y ACCIONES */}
          <div className="bg-[#1C1A14] border border-[#C8A45C]/45 rounded-2xl p-5 flex flex-col lg:flex-row items-center justify-between gap-5 shadow-xl">
            {/* Total Calculado Destacado en Oro */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left w-full lg:w-auto">
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400 block">
                  TOTAL CALCULADO
                </span>
                <div className="text-[11px] text-neutral-400 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <span>
                    Subtotal: <strong className="text-white font-mono">{formatSoles(subtotalCents)}</strong>
                  </span>
                  {discountCents > 0 && (
                    <span className="text-amber-400 font-semibold font-mono">
                      | Descuento: -{formatSoles(discountCents)}
                    </span>
                  )}
                  <span className="text-neutral-500">
                    ({saleItems.reduce((acc, it) => acc + it.quantity, 0)} un. en {saleItems.length} prod.)
                  </span>
                </div>
              </div>
              <div className="font-serif-luxury text-3xl sm:text-4xl font-bold text-[#E6C875] tracking-tight bg-black/40 px-4 py-1.5 rounded-xl border border-[#C8A45C]/30 shadow-inner">
                {formattedTotal}
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Botón Secundario: Registrar Venta */}
              <button
                type="button"
                id="btn-save-sale"
                disabled={isSubmitDisabled}
                onClick={() => handleSubmitSale(false)}
                className={`px-6 py-3 rounded-xl font-bold text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 transition flex items-center justify-center gap-2 shadow cursor-pointer active:scale-[0.98] ${
                  isSubmitDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-[#C8A45C]" />
                <span>Registrar Venta</span>
              </button>

              {/* Botón Primario Dorado: Registrar e Imprimir Ticket */}
              <button
                type="button"
                id="btn-save-print-sale"
                disabled={isSubmitDisabled}
                onClick={() => handleSubmitSale(true)}
                className={`px-6 py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-[#D4AF37] via-[#E6C875] to-[#C8A45C] hover:from-[#DFCA8D] hover:to-[#D4AF37] text-black transition flex items-center justify-center gap-2.5 shadow-xl shadow-[#C8A45C]/25 cursor-pointer active:scale-[0.98] ${
                  isSubmitDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                }`}
              >
                <Printer className="w-4 h-4 text-black" />
                <span>Registrar e Imprimir Ticket</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 5. HISTORIAL INFERIOR DE VENTAS */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-xl">
        {/* Cabecera del Historial con Métricas y Buscador */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C8A45C]" />
              <span>Historial de Ventas del Turno</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Visualización en tiempo real y reimpresión de comprobantes térmicos para arqueo de caja.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Resumen de Métricas */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              <span className="text-neutral-400">Turno:</span>
              <span className="font-bold text-white">{turnoTotalCount} ventas</span>
              <span className="text-neutral-600">|</span>
              <span className="text-[#E6C875] font-bold">{formatSoles(turnoTotalCents)}</span>
            </div>

            {/* Selector de Fecha Personalizado (Exclusivo para ADMIN) */}
            {isAdmin && (
              <div className="flex items-center gap-2 bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/50 focus-within:border-[#C8A45C] rounded-xl px-3 py-1.5 transition">
                <Calendar className="w-3.5 h-3.5 text-[#C8A45C] shrink-0" />
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer [color-scheme:dark]"
                  title="Seleccionar fecha para consultar historial"
                />
                {historyDate !== todayStr && (
                  <button
                    type="button"
                    onClick={() => setHistoryDate(todayStr)}
                    className="text-[10px] bg-[#C8A45C]/15 hover:bg-[#C8A45C]/30 text-[#E6C875] border border-[#C8A45C]/30 font-medium px-1.5 py-0.5 rounded transition cursor-pointer"
                    title="Restablecer a Hoy"
                  >
                    Hoy
                  </button>
                )}
              </div>
            )}

            {/* Buscador Rápido */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar ticket, cliente, producto..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-xs text-white rounded-xl pl-8 pr-3 py-2 outline-none transition placeholder:text-neutral-600"
              />
            </div>
          </div>
        </div>

        {/* Tabla de Ventas */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181818] text-neutral-400 font-semibold border-b border-neutral-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Producto / Concepto</th>
                <th className="py-3 px-4 text-center">Cant.</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Método</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((v) => (
                  <tr key={v.id} className="hover:bg-[#181818]/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#E6C875]">
                      #{v.ticket_number}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400 whitespace-nowrap">
                      {formatDateTimeLima(v.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-white font-medium">
                      <div>{v.product_name}</div>
                      {v.detalles_items && v.detalles_items.length > 1 && (
                        <div className="text-[10px] text-neutral-400 font-normal mt-0.5 space-y-0.5">
                          {v.detalles_items.map((it, idx) => (
                            <span key={idx} className="inline-block mr-2">
                              • {it.quantity}x {it.product_name}
                            </span>
                          ))}
                        </div>
                      )}
                      {((v.discount_cents && v.discount_cents > 0) || (v.monto_descuento && v.monto_descuento > 0)) && (
                        <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Desc: -{formatSoles(v.discount_cents ?? Math.round((v.monto_descuento || 0) * 100))}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-neutral-300 font-semibold">
                      {v.quantity} un.
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      {v.client_name}
                    </td>
                    <td className="py-3.5 px-4">
                      {v.payment_method?.toLowerCase() === 'mixto' ? (
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-950/60 text-amber-300 border border-amber-800/50">
                            MIXTO
                          </span>
                          <div className="text-[10px] font-mono text-neutral-400 space-y-0.5">
                            {((v.monto_efectivo != null && v.monto_efectivo > 0) || (v.cash_cents != null && v.cash_cents > 0)) && (
                              <div className="text-emerald-400/90">Efec: {formatSoles(v.cash_cents ?? Math.round((v.monto_efectivo || 0) * 100))}</div>
                            )}
                            {((v.monto_yape != null && v.monto_yape > 0) || (v.yape_cents != null && v.yape_cents > 0)) && (
                              <div className="text-purple-400/90">Yape: {formatSoles(v.yape_cents ?? Math.round((v.monto_yape || 0) * 100))}</div>
                            )}
                            {((v.monto_transferencia != null && v.monto_transferencia > 0) || (v.transfer_cents != null && v.transfer_cents > 0)) && (
                              <div className="text-blue-400/90">Transf: {formatSoles(v.transfer_cents ?? Math.round((v.monto_transferencia || 0) * 100))}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            v.payment_method === 'efectivo'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                              : v.payment_method === 'yape'
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                              : 'bg-blue-950/60 text-blue-300 border border-blue-800/50'
                          }`}
                        >
                          {v.payment_method}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-bold text-[#E6C875] font-mono text-sm block">
                        {formatSoles(v.total_price_cents)}
                      </span>
                      {((v.discount_cents && v.discount_cents > 0) || (v.monto_descuento && v.monto_descuento > 0)) && (
                        <span className="text-[10px] text-neutral-500 block font-mono">
                          Subt: {formatSoles(v.subtotal_cents ?? Math.round((v.subtotal || 0) * 100))}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openTicketModal('pos', v)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-[#C8A45C] text-neutral-300 hover:text-black transition cursor-pointer"
                          title="Reimprimir Ticket Térmico"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {currentRole === 'admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`¿Deseas eliminar la venta #${v.ticket_number}?`)) {
                                if (!await deleteVentaMostrador(v.id)) return;
                                setHistorySales((prev) => prev.filter((item) => item.id !== v.id));
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-950/20 hover:bg-red-950/50 text-red-400 hover:text-red-300 border border-red-900/30 transition cursor-pointer"
                            title="Anular venta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-500">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
                        <Clock className="w-4 h-4 animate-spin text-[#C8A45C]" />
                        <span>Cargando historial de ventas...</span>
                      </div>
                    ) : (
                      <span>No se encontraron ventas registradas para esta fecha o criterio de búsqueda.</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal de Producto No Encontrado */}
      <BarcodeNotFoundModal
        isOpen={!!notFoundBarcode}
        scannedBarcode={notFoundBarcode || ''}
        userRole={currentRole as any}
        onClose={() => setNotFoundBarcode(null)}
        onRegisterNew={(barcode) => {
          setNotFoundBarcode(null);
          sessionStorage.setItem('pendingBarcode', barcode);
          setActiveView('/dashboard/productos');
        }}
      />
    </div>
  );
};
