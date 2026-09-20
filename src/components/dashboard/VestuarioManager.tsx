import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Shirt,
  Sparkles,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  DollarSign,
  Layers,
  Tag,
  Info,
  Maximize2,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  FileText,
  Printer,
  Ban,
  Package,
  RotateCcw,
  CheckCircle,
  Globe,
  Store,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  WardrobeItem,
  WardrobeCategory,
  formatSoles,
  DressRental,
  DressRentalStatus,
  DressRentalOrigin,
} from '../../types';
import { supabase } from '../../lib/supabase/client';

// Modales del flujo de alquileres
import { NewDressRentalModal } from './vestuario/NewDressRentalModal';
import { ValidateVoucherModal } from './vestuario/ValidateVoucherModal';
import { ProcessDeliveryModal } from './vestuario/ProcessDeliveryModal';
import { ProcessReturnModal } from './vestuario/ProcessReturnModal';
import { DressRentalTicketModal } from './vestuario/DressRentalTicketModal';

// ==========================================
// LAS 5 CATEGORÍAS OFICIALES EXACTAS
// ==========================================
export const EVENT_CATEGORIES: WardrobeCategory[] = [
  'Bodas y Matrimonio',
  'Quinceañeras',
  'Gala y Noche',
  'Trajes Típicos y Costumbristas',
  'Casual y Sesiones de Fotos',
];

// ==========================================
// COMPRESIÓN DE IMAGEN A WEBP EN CLIENTE
// ==========================================
async function compressImageToWebP(
  file: File,
  quality = 0.85,
  maxWidth = 1200
): Promise<{ blob: Blob; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el lienzo para compresión'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const sizeKb = Math.round(blob.size / 1024);
              resolve({ blob, sizeKb });
            } else {
              reject(new Error('Falló la conversión de la imagen a WebP'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Error al procesar la imagen seleccionada'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen'));
    reader.readAsDataURL(file);
  });
}

export const VestuarioManager: React.FC = () => {
  const {
    wardrobe,
    dressRentals,
    currentRole,
    addWardrobeItem,
    updateWardrobeItem,
    deleteWardrobeItem,
    toggleWardrobeActive,
    cancelDressRental,
    deleteDressRental,
    openLightbox,
  } = useApp();

  // Permisos: Administrador o Recepcionista
  const isAdmin = currentRole === 'admin';
  const isRecepcionista = currentRole === 'recepcionista';
  const isAuthorized = isAdmin || isRecepcionista;

  // Pestaña activa: Alquileres (por defecto) vs Catálogo de Prendas
  const [activeTab, setActiveTab] = useState<'rentals' | 'catalog'>('rentals');

  // ==========================================
  // ESTADOS DEL FLUJO DE ALQUILERES & RESERVAS
  // ==========================================
  const [rentalsSearch, setRentalsSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');

  // Modales de Alquiler
  const [isNewRentalModalOpen, setIsNewRentalModalOpen] = useState(false);
  const [voucherModalRental, setVoucherModalRental] = useState<DressRental | null>(null);
  const [deliveryModalRental, setDeliveryModalRental] = useState<DressRental | null>(null);
  const [returnModalRental, setReturnModalRental] = useState<DressRental | null>(null);
  const [ticketModalRental, setTicketModalRental] = useState<DressRental | null>(null);

  // Modal para Anular Orden (con motivo obligatorio para Recepcionista)
  const [annulRentalTarget, setAnnulRentalTarget] = useState<DressRental | null>(null);
  const [annulReason, setAnnulReason] = useState('');
  const [isAnnulling, setIsAnnulling] = useState(false);

  // Modal para Eliminar Orden (exclusivo Administrador)
  const [deleteRentalTarget, setDeleteRentalTarget] = useState<DressRental | null>(null);
  const [isDeletingRental, setIsDeletingRental] = useState(false);

  // ==========================================
  // ESTADOS DEL CATÁLOGO DE PRENDAS (INVENTARIO)
  // ==========================================
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogModalMode, setCatalogModalMode] = useState<'create' | 'edit'>('create');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Formulario Prenda
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<WardrobeCategory>('Bodas y Matrimonio');
  const [formCode, setFormCode] = useState('A');
  const [formDescription, setFormDescription] = useState('');
  const [formPriceSoles, setFormPriceSoles] = useState<string>('180.00');
  const [formDepositSoles, setFormDepositSoles] = useState<string>('50.00');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formImageUrl, setFormImageUrl] = useState<string>('');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageCompressionInfo, setImageCompressionInfo] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WardrobeItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // ==========================================
  // MÉTRICAS EN TIEMPO REAL
  // ==========================================
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const todayDisplay = useMemo(() => {
    return new Date().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const rentalKpis = useMemo(() => {
    const porValidar = dressRentals.filter((r) => r.status === 'por_validar').length;
    // Entregas para hoy: órdenes reservadas cuya fecha de evento o entrega es hoy
    const entregasHoy = dressRentals.filter(
      (r) => r.status === 'reservado' && r.event_date === todayStr
    ).length;
    // Reservas activas totales pendientes de entrega
    const reservadasTotal = dressRentals.filter((r) => r.status === 'reservado').length;
    // Prendas actualmente en poder del cliente
    const enUsoEntregados = dressRentals.filter((r) => r.status === 'entregado').length;
    // Total garantías en custodia (Solo para Admin)
    const garantiasEnCustodia = dressRentals
      .filter((r) => r.status === 'entregado')
      .reduce((acc, r) => acc + (r.guarantee_cents || 0), 0);

    return {
      porValidar,
      entregasHoy: entregasHoy || reservadasTotal,
      enUsoEntregados,
      garantiasEnCustodia,
    };
  }, [dressRentals, todayStr]);

  // ==========================================
  // FILTRADO DE ALQUILERES
  // ==========================================
  const filteredRentals = useMemo(() => {
    const q = rentalsSearch.trim().toLowerCase();

    return dressRentals.filter((r) => {
      // 1. Texto de búsqueda
      let matchesText = true;
      if (q) {
        const clientFull = `${r.client_first_name} ${r.client_last_name}`.toLowerCase();
        const dni = (r.client_dni || '').toLowerCase();
        const phone = (r.client_phone || '').toLowerCase();
        const ticket = (r.ticket_code || '').toLowerCase();
        const code = (r.item_code || '').toLowerCase();
        const name = (r.item_name || '').toLowerCase();

        matchesText =
          clientFull.includes(q) ||
          dni.includes(q) ||
          phone.includes(q) ||
          ticket.includes(q) ||
          code.includes(q) ||
          name.includes(q);
      }

      // 2. Filtro por Estado
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

      // 3. Filtro por Origen
      const matchesOrigin = originFilter === 'all' || r.origin === originFilter;

      return matchesText && matchesStatus && matchesOrigin;
    });
  }, [dressRentals, rentalsSearch, statusFilter, originFilter]);

  // ==========================================
  // GESTIÓN DE ACCIONES DE ALQUILER
  // ==========================================
  const handleOpenAnnulModal = (rental: DressRental) => {
    setAnnulRentalTarget(rental);
    setAnnulReason('');
  };

  const handleConfirmAnnul = async () => {
    if (!annulRentalTarget) return;

    if (isRecepcionista && !annulReason.trim()) {
      showToast('error', 'El motivo de anulación es obligatorio para el rol Recepcionista.');
      return;
    }

    try {
      setIsAnnulling(true);
      const ok = await cancelDressRental(
        annulRentalTarget.id,
        annulReason.trim() || 'Anulado desde el panel de control'
      );
      if (ok) {
        showToast('success', `Orden [${annulRentalTarget.ticket_code}] anulada correctamente.`);
        setAnnulRentalTarget(null);
      } else {
        showToast('error', 'No se pudo anular la orden en la base de datos.');
      }
    } catch (err: any) {
      showToast('error', `Error: ${err?.message || 'Fallo al anular'}`);
    } finally {
      setIsAnnulling(false);
    }
  };

  const handleConfirmDeleteRental = async () => {
    if (!deleteRentalTarget) return;
    try {
      setIsDeletingRental(true);
      const ok = await deleteDressRental(deleteRentalTarget.id);
      if (ok) {
        showToast('success', `Orden [${deleteRentalTarget.ticket_code}] eliminada permanentemente.`);
        setDeleteRentalTarget(null);
      } else {
        showToast('error', 'No se pudo eliminar el registro.');
      }
    } catch (err: any) {
      showToast('error', `Error: ${err?.message || 'Fallo al eliminar'}`);
    } finally {
      setIsDeletingRental(false);
    }
  };

  // ==========================================
  // GESTIÓN DE PRENDAS (CATÁLOGO CRUD)
  // ==========================================
  const getNextAvailableCode = useCallback(() => {
    const existingCodes = new Set(
      wardrobe
        .map((w) => (w.code || '').trim().toUpperCase())
        .filter((c) => /^[A-Z]$/.test(c))
    );
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!existingCodes.has(letter)) return letter;
    }
    return 'A';
  }, [wardrobe]);

  const handleOpenCreateItemModal = () => {
    setCatalogModalMode('create');
    setEditingItemId(null);
    setFormName('');
    setFormCategory('Bodas y Matrimonio');
    setFormCode(getNextAvailableCode());
    setFormDescription('');
    setFormPriceSoles('180.00');
    setFormDepositSoles('50.00');
    setFormIsActive(true);
    setFormImageUrl('https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80');
    setImageCompressionInfo(null);
    setIsCatalogModalOpen(true);
  };

  const handleOpenEditItemModal = (item: WardrobeItem) => {
    setCatalogModalMode('edit');
    setEditingItemId(item.id);
    setFormName(item.name);
    const matchedCategory = EVENT_CATEGORIES.find((c) => c.toLowerCase() === item.category.toLowerCase());
    setFormCategory(matchedCategory || 'Bodas y Matrimonio');
    setFormCode((item.code || 'A').toUpperCase().trim());
    setFormDescription(item.description || '');
    setFormPriceSoles((item.rental_price_cents / 100).toFixed(2));
    setFormDepositSoles(((item.deposit_cents || 0) / 100).toFixed(2));
    setFormIsActive(item.active !== false);
    setFormImageUrl(item.image_url || '');
    setImageCompressionInfo(null);
    setIsCatalogModalOpen(true);
  };

  const handleProcessAndUploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    try {
      setUploadingImage(true);
      setImageCompressionInfo('Comprimiendo imagen a WebP...');

      const originalSizeKb = Math.round(file.size / 1024);
      const { blob: webpBlob, sizeKb: webpSizeKb } = await compressImageToWebP(file, 0.85, 1200);

      setImageCompressionInfo(`WebP optimizado: ${webpSizeKb} KB (original: ${originalSizeKb} KB)`);

      const cleanCode = (formCode || 'A').toUpperCase().trim();
      const cleanName = (formName || 'vestuario')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-');
      const fileName = `wardrobe-${cleanCode}-${cleanName}-${Date.now()}.webp`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('wardrobe-images')
        .upload(fileName, webpBlob, { contentType: 'image/webp', upsert: true });

      if (uploadError) {
        const localPreviewUrl = URL.createObjectURL(webpBlob);
        setFormImageUrl(localPreviewUrl);
        showToast('error', `Aviso: ${uploadError.message}. Se asignó vista previa.`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('wardrobe-images')
        .getPublicUrl(uploadData.path || fileName);

      if (publicUrlData?.publicUrl) {
        setFormImageUrl(publicUrlData.publicUrl);
        showToast('success', 'Fotografía WebP optimizada y almacenada exitosamente.');
      }
    } catch (err: any) {
      showToast('error', `Error al optimizar imagen: ${err.message || 'Error desconocido'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitWardrobe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      showToast('error', 'El título de la prenda es obligatorio.');
      return;
    }
    if (!formCode.trim()) {
      showToast('error', 'El código interno es obligatorio.');
      return;
    }

    const priceNum = parseFloat(formPriceSoles);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast('error', 'Ingresa un precio de alquiler válido en Soles (S/).');
      return;
    }

    const depositNum = parseFloat(formDepositSoles) || 0;
    const priceCents = Math.round(priceNum * 100);
    const depositCents = Math.round(depositNum * 100);
    const codeNormalized = formCode.trim().toUpperCase();

    const finalImageUrl =
      formImageUrl.trim() ||
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80';

    try {
      setIsSubmittingItem(true);

      if (catalogModalMode === 'create') {
        const success = await addWardrobeItem({
          name: formName.trim(),
          code: codeNormalized,
          category: formCategory,
          rental_price_cents: priceCents,
          deposit_cents: depositCents,
          status: 'disponible',
          active: formIsActive,
          image_url: finalImageUrl,
          description: formDescription.trim(),
        });

        if (success) {
          showToast('success', `¡Prenda [Código ${codeNormalized}] creada con éxito!`);
          setIsCatalogModalOpen(false);
        } else {
          showToast('error', 'No se pudo guardar la prenda en la base de datos.');
        }
      } else if (catalogModalMode === 'edit' && editingItemId) {
        const success = await updateWardrobeItem({
          id: editingItemId,
          name: formName.trim(),
          code: codeNormalized,
          category: formCategory,
          rental_price_cents: priceCents,
          deposit_cents: depositCents,
          status: 'disponible',
          active: formIsActive,
          image_url: finalImageUrl,
          description: formDescription.trim(),
        });

        if (success) {
          showToast('success', `¡Prenda [Código ${codeNormalized}] actualizada correctamente!`);
          setIsCatalogModalOpen(false);
        } else {
          showToast('error', 'No se pudo actualizar la prenda.');
        }
      }
    } catch (err: any) {
      showToast('error', `Error al procesar: ${err.message || 'Error'}`);
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleToggleActiveDirect = async (item: WardrobeItem) => {
    try {
      const currentActive = item.active !== false;
      const ok = await toggleWardrobeActive(item.id, currentActive);
      if (ok) {
        showToast(
          'success',
          `Prenda [${item.code || 'A'}] marcada como "${!currentActive ? 'Activo' : 'Oculto'}".`
        );
      }
    } catch (err) {
      showToast('error', 'Error al cambiar la visibilidad de la prenda.');
    }
  };

  const handleConfirmDeleteWardrobeItem = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeletingItem(true);
      const ok = await deleteWardrobeItem(itemToDelete.id);
      if (ok) {
        showToast('success', `Prenda [Código ${itemToDelete.code || 'A'}] eliminada.`);
        setItemToDelete(null);
      } else {
        showToast('error', 'No se pudo eliminar la prenda.');
      }
    } catch (err) {
      showToast('error', 'Error al eliminar la prenda.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Filtrado de prendas del catálogo
  const filteredCatalogItems = useMemo(() => {
    const rawSearch = catalogSearch.trim();
    const q = rawSearch.toLowerCase();
    const isSingleChar = rawSearch.length === 1;

    return wardrobe.filter((w) => {
      let matchesText = true;
      if (isSingleChar) {
        const itemCode = (w.code || '').trim().toLowerCase();
        matchesText = itemCode === q;
      } else if (q.length > 1) {
        const itemCode = (w.code || '').trim().toLowerCase();
        const itemName = (w.name || '').toLowerCase();
        const itemCategory = (w.category || '').toLowerCase();
        const itemDesc = (w.description || '').toLowerCase();

        matchesText =
          itemCode.includes(q) ||
          itemName.includes(q) ||
          itemCategory.includes(q) ||
          itemDesc.includes(q);
      }

      const matchesCategory =
        selectedCategoryFilter === 'all' ||
        (w.category || '').toLowerCase() === selectedCategoryFilter.toLowerCase();

      const isItemActive = w.active !== false;
      const matchesStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'active' && isItemActive) ||
        (selectedStatusFilter === 'hidden' && !isItemActive);

      return matchesText && matchesCategory && matchesStatus;
    });
  }, [wardrobe, catalogSearch, selectedCategoryFilter, selectedStatusFilter]);

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-[#141414] border border-amber-900/50 rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-serif-luxury font-bold text-white">Acceso Restringido</h2>
          <p className="text-sm text-neutral-400">
            La gestión del Catálogo y Alquiler de Vestuario está habilitada exclusivamente para los roles
            de Administrador y Recepción.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-[#121A14]/95 border-emerald-500/40 text-emerald-300'
                : 'bg-[#1E1212]/95 border-rose-500/40 text-rose-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-medium">{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="ml-2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8A45C] to-[#997328] text-black flex items-center justify-center shadow-lg shadow-[#C8A45C]/20">
              <Shirt className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif-luxury font-bold text-white tracking-wide">
              Control de Vestuario & Alquiler
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 flex items-center gap-2">
            <span>Flujo operativo de alquileres, reservas presenciales y web, entregas y devoluciones</span>
            <span className="inline-block w-1 h-1 rounded-full bg-[#C8A45C]" />
            <span className="text-[#C8A45C] font-semibold capitalize">Rol: {currentRole}</span>
          </p>
        </div>

        {/* Botón Principal: Reservar Vestidos (Requisito 1 de la lógica de negocio) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsNewRentalModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#C8A45C] via-[#E2C37D] to-[#C8A45C] text-black font-bold text-xs sm:text-sm shadow-xl shadow-[#C8A45C]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4 stroke-[2.5]" />
            <span>+ Reservar Vestidos</span>
          </button>

          {activeTab === 'catalog' && (
            <button
              type="button"
              onClick={handleOpenCreateItemModal}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs sm:text-sm border border-neutral-700 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5] text-[#C8A45C]" />
              <span>Nueva Prenda</span>
            </button>
          )}
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('rentals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'rentals'
              ? 'bg-[#1C1C1C] text-[#E6C875] border border-[#C8A45C]/50 shadow-md'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-[#C8A45C]" />
          <span>Gestión de Reservas & Alquileres</span>
          <span className="px-2 py-0.5 rounded-full bg-[#C8A45C]/20 text-[#E6C875] text-[11px] font-mono">
            {dressRentals.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-[#1C1C1C] text-[#E6C875] border border-[#C8A45C]/50 shadow-md'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Shirt className="w-4 h-4 text-[#C8A45C]" />
          <span>Catálogo de Prendas</span>
          <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-mono">
            {wardrobe.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: GESTIÓN DE RESERVAS & ALQUILERES (DASHBOARD) */}
      {/* ========================================================= */}
      {activeTab === 'rentals' && (
        <div className="space-y-6">
          {/* CAMPO 1: MÉTRICAS RÁPIDAS (KPIs) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <span>📊 Resumen de Hoy: {todayDisplay}</span>
              </span>
              {isRecepcionista && (
                <span className="text-[11px] text-amber-400/90 italic">
                  🔒 Enfoque Operativo (Reportes financieros globales restringidos)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Tarjeta 1: Por Validar Yape */}
              <div
                onClick={() => setStatusFilter(statusFilter === 'por_validar' ? 'all' : 'por_validar')}
                className={`bg-[#121212] border rounded-2xl p-4 flex items-center gap-3.5 cursor-pointer transition-all ${
                  statusFilter === 'por_validar'
                    ? 'border-amber-400/80 bg-amber-950/20'
                    : 'border-neutral-800/90 hover:border-amber-500/40'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  🟡
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
                    {rentalKpis.porValidar}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-medium">Por Validar Yape</div>
                </div>
              </div>

              {/* Tarjeta 2: Entregas para Hoy */}
              <div
                onClick={() => setStatusFilter(statusFilter === 'reservado' ? 'all' : 'reservado')}
                className={`bg-[#121212] border rounded-2xl p-4 flex items-center gap-3.5 cursor-pointer transition-all ${
                  statusFilter === 'reservado'
                    ? 'border-blue-400/80 bg-blue-950/20'
                    : 'border-neutral-800/90 hover:border-blue-500/40'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                  📦
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-400 font-mono">
                    {rentalKpis.entregasHoy}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-medium">Entregas para Hoy</div>
                </div>
              </div>

              {/* Tarjeta 3: Vestidos en Uso / Entregados */}
              <div
                onClick={() => setStatusFilter(statusFilter === 'entregado' ? 'all' : 'entregado')}
                className={`bg-[#121212] border rounded-2xl p-4 flex items-center gap-3.5 cursor-pointer transition-all ${
                  statusFilter === 'entregado'
                    ? 'border-emerald-400/80 bg-emerald-950/20'
                    : 'border-neutral-800/90 hover:border-emerald-500/40'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                  🟢
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                    {rentalKpis.enUsoEntregados}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-medium">Vestidos en Uso</div>
                </div>
              </div>

              {/* Tarjeta 4: Solo para Administrador (Garantías en Custodia) */}
              {isAdmin && (
                <div className="bg-[#121212] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center text-[#E6C875] font-bold">
                    <ShieldCheck className="w-5 h-5 text-[#C8A45C]" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-[#E6C875] font-mono">
                      {formatSoles(rentalKpis.garantiasEnCustodia)}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-medium">Garantías en Custodia</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CAMPO 2: FILTROS DE BÚSQUEDA */}
          <div className="bg-[#121212] border border-neutral-800/90 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Cliente, DNI, Teléfono, Ticket o Código de Vestido..."
                value={rentalsSearch}
                onChange={(e) => setRentalsSearch(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] transition-colors"
              />
              {rentalsSearch && (
                <button
                  type="button"
                  onClick={() => setRentalsSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtro Estado */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#181818] border border-neutral-700/80 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-[#C8A45C]"
              >
                <option value="all">Todos los Estados</option>
                <option value="por_validar">🟡 Por Validar Yape</option>
                <option value="reservado">🔵 Reservado</option>
                <option value="entregado">🟢 Entregado</option>
                <option value="finalizado">⚫ Finalizado</option>
                <option value="anulado">🔴 Anulado</option>
              </select>

              {/* Filtro Origen */}
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="bg-[#181818] border border-neutral-700/80 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-[#C8A45C]"
              >
                <option value="all">Origen: Todos</option>
                <option value="web">🌐 Web</option>
                <option value="local">🏪 Presencial Local</option>
              </select>
            </div>
          </div>

          {/* CAMPO 3: GRILLA / LISTA DE ÓRDENES EN TIEMPO REAL */}
          {filteredRentals.length === 0 ? (
            <div className="bg-[#121212] border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
              <Calendar className="w-12 h-12 text-neutral-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">No se encontraron órdenes de alquiler</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                {rentalsSearch || statusFilter !== 'all' || originFilter !== 'all'
                  ? 'No hay registros que coincidan con los filtros aplicados.'
                  : 'Aún no hay reservas registradas. Utiliza el botón "+ Reservar Vestidos" para iniciar una nueva reserva.'}
              </p>
              <button
                type="button"
                onClick={() => setIsNewRentalModalOpen(true)}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] text-black hover:brightness-110 cursor-pointer"
              >
                + Reservar Vestidos
              </button>
            </div>
          ) : (
            <div className="bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#181818] border-b border-neutral-800 text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-3.5 px-4">#Orden</th>
                      <th className="py-3.5 px-4">Cliente y Evento</th>
                      <th className="py-3.5 px-4">Prenda / Vestido</th>
                      <th className="py-3.5 px-4">Origen</th>
                      <th className="py-3.5 px-4">Estado & Finanzas</th>
                      <th className="py-3.5 px-4 text-right">Acción Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {filteredRentals.map((rental) => {
                      const isWeb = rental.origin === 'web';
                      const isPendingValidate = rental.status === 'por_validar';
                      const isReservado = rental.status === 'reservado';
                      const isEntregado = rental.status === 'entregado';
                      const isFinalizado = rental.status === 'finalizado';
                      const isAnulado = rental.status === 'anulado';

                      return (
                        <tr
                          key={rental.id}
                          className="hover:bg-neutral-900/50 transition-colors group"
                        >
                          {/* #Orden */}
                          <td className="py-4 px-4 align-top">
                            <div className="font-mono font-bold text-sm text-white flex items-center gap-1.5">
                              <span>{rental.ticket_code}</span>
                            </div>
                            <span className="text-[10px] text-neutral-500 block">
                              {new Date(rental.created_at).toLocaleDateString('es-PE')}
                            </span>
                          </td>

                          {/* Cliente y Evento */}
                          <td className="py-4 px-4 align-top">
                            <div className="font-bold text-white text-xs">
                              {rental.client_first_name} {rental.client_last_name}
                            </div>
                            <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                              <span>DNI: <strong className="text-neutral-300 font-mono">{rental.client_dni}</strong></span>
                              <span>•</span>
                              <span>Cel: <strong className="text-neutral-300 font-mono">{rental.client_phone}</strong></span>
                            </div>
                            <div className="text-[11px] text-[#E6C875]/90 mt-1 flex items-center gap-1">
                              <span>🎉 {rental.event_name}</span>
                              {rental.destination && (
                                <span className="text-neutral-500 font-normal">
                                  ({rental.destination})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Prenda y Fechas */}
                          <td className="py-4 px-4 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-[#C8A45C]/20 border border-[#C8A45C]/40 text-[#E6C875] font-bold text-[10px]">
                                {rental.item_code}
                              </span>
                              <span className="font-semibold text-white truncate max-w-[170px]" title={rental.item_name}>
                                {rental.item_name}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-2">
                              <span>Evento: <strong className="text-neutral-300 font-mono">{rental.event_date}</strong></span>
                              <span>→</span>
                              <span>Dev: <strong className="text-neutral-300 font-mono">{rental.return_date}</strong></span>
                            </div>
                          </td>

                          {/* Origen */}
                          <td className="py-4 px-4 align-top">
                            {isWeb ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#6B2D82]/20 border border-[#8B3D9D]/50 text-[#C96DE8]">
                                <Globe className="w-3 h-3" />
                                <span>WEB</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875]">
                                <Store className="w-3 h-3" />
                                <span>LOCAL</span>
                              </span>
                            )}
                          </td>

                          {/* Estado & Finanzas */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-1">
                              {/* Badge Estado */}
                              <div>
                                {isPendingValidate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    <span>🟡 POR VALIDAR</span>
                                  </span>
                                )}
                                {isReservado && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                    <span>🔵 RESERVADO</span>
                                  </span>
                                )}
                                {isEntregado && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    <span>🟢 ENTREGADO</span>
                                  </span>
                                )}
                                {isFinalizado && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                                    <span>⚫ FINALIZADO</span>
                                  </span>
                                )}
                                {isAnulado && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    <span>🔴 ANULADO</span>
                                  </span>
                                )}
                              </div>

                              {/* Resumen financiero dinámico */}
                              <div className="text-[11px] text-neutral-400">
                                {isPendingValidate && (
                                  <span>Yape: <strong className="text-amber-300">{formatSoles(rental.advance_cents)}</strong></span>
                                )}
                                {isReservado && (
                                  <span>Saldo: <strong className="text-blue-300">{formatSoles(rental.pending_cents)}</strong></span>
                                )}
                                {isEntregado && (
                                  <span>Garantía: <strong className="text-emerald-300">{formatSoles(rental.guarantee_cents)}</strong></span>
                                )}
                                {isFinalizado && (
                                  <span className="text-neutral-500">Devolución cerrada</span>
                                )}
                                {isAnulado && rental.rejection_reason && (
                                  <span className="text-rose-400 line-clamp-1" title={rental.rejection_reason}>
                                    Motivo: {rental.rejection_reason}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Acción Disponible (Botón Contextual) */}
                          <td className="py-4 px-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. Acción contextual según estado */}
                              {isPendingValidate && (
                                <button
                                  type="button"
                                  onClick={() => setVoucherModalRental(rental)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Validar Voucher</span>
                                </button>
                              )}

                              {isReservado && (
                                <button
                                  type="button"
                                  onClick={() => setDeliveryModalRental(rental)}
                                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/20"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  <span>Procesar Entrega</span>
                                </button>
                              )}

                              {isEntregado && (
                                <button
                                  type="button"
                                  onClick={() => setReturnModalRental(rental)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Procesar Devolución</span>
                                </button>
                              )}

                              {isFinalizado && (
                                <button
                                  type="button"
                                  onClick={() => setTicketModalRental(rental)}
                                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-[#C8A45C]" />
                                  <span>Ver Ticket Cierre</span>
                                </button>
                              )}

                              {/* Botón Ver Ticket Comprobante (disponible para cualquier orden) */}
                              <button
                                type="button"
                                onClick={() => setTicketModalRental(rental)}
                                title="Ver ticket de comprobante"
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/60 cursor-pointer transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* Botón Anular (Para Recepcionista o Admin) */}
                              {!isFinalizado && !isAnulado && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAnnulModal(rental)}
                                  title="Anular orden de alquiler"
                                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-400 border border-neutral-700/60 transition-colors cursor-pointer"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Botón Eliminar Físico: EXCLUSIVO Administrador */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteRentalTarget(rental)}
                                  title="Eliminar permanentemente de la base de datos (Solo Admin)"
                                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-900 text-neutral-400 hover:text-white border border-neutral-700/60 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: CATÁLOGO DE PRENDAS (INVENTARIO CRUD) */}
      {/* ========================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Barra de Filtros del Catálogo */}
          <div className="bg-[#121212] border border-neutral-800/80 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código (ej. A-101), título, evento o descripción..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl pl-10 pr-28 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {catalogSearch.trim().length === 1 && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875] text-[10px] font-bold uppercase tracking-wider">
                    <Tag className="w-2.5 h-2.5" />
                    Cód: {catalogSearch.trim().toUpperCase()}
                  </span>
                )}
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-[#C8A45C]"
              >
                <option value="all">Todas las Categorías</option>
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-xl border border-neutral-700/70 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedStatusFilter === 'all'
                    ? 'bg-[#C8A45C] text-black shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedStatusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Activos
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('hidden')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedStatusFilter === 'hidden'
                    ? 'bg-neutral-700 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Ocultos
              </button>
            </div>
          </div>

          {/* Grilla de Prendas */}
          {filteredCatalogItems.length === 0 ? (
            <div className="bg-[#121212] border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
              <Shirt className="w-12 h-12 text-neutral-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">No se encontraron prendas de vestuario</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                No hay prendas registradas con los filtros seleccionados.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateItemModal}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] text-black hover:brightness-110 cursor-pointer"
              >
                + Nueva Prenda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCatalogItems.map((item) => {
                const isItemActive = item.active !== false;
                const priceFormatted = (item.rental_price_cents / 100).toFixed(2);
                const codeDisplay = (item.code || 'A').toUpperCase().trim();

                return (
                  <div
                    key={item.id}
                    className="group bg-[#121212] border border-neutral-800/90 hover:border-[#C8A45C]/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-[#C8A45C]/5"
                  >
                    <div
                      onClick={() =>
                        openLightbox({
                          url: item.image_url,
                          title: item.name,
                          description: item.description,
                          category: item.category,
                          code: `Código: ${codeDisplay}`,
                          price: `S/ ${priceFormatted}`,
                          metadata: item.deposit_cents
                            ? `Garantía: ${formatSoles(item.deposit_cents)}`
                            : undefined,
                        })
                      }
                      className="relative aspect-[4/3] w-full bg-neutral-900 overflow-hidden cursor-zoom-in group/img"
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#C8A45C] to-[#A27F38] text-black font-extrabold text-xs tracking-wider shadow-lg shadow-[#C8A45C]/30 flex items-center gap-1.5 border border-[#FFE7A8]">
                          <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Código: {codeDisplay}</span>
                        </div>

                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md shadow flex items-center gap-1 ${
                            isItemActive
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                              : 'bg-neutral-900/80 text-neutral-400 border border-neutral-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isItemActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                            }`}
                          />
                          {isItemActive ? 'Activo' : 'Oculto'}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/75 text-neutral-200 border border-neutral-700/80 backdrop-blur-md shadow">
                          {item.category}
                        </span>
                      </div>

                      <div className="absolute bottom-3 right-3">
                        <div className="px-3 py-1.5 rounded-xl bg-black/85 border border-[#C8A45C]/50 backdrop-blur-md shadow flex items-baseline gap-1">
                          <span className="text-[10px] text-[#C8A45C] font-semibold">S/</span>
                          <span className="text-base font-bold text-white tracking-tight">
                            {priceFormatted}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="font-serif-luxury font-bold text-base text-white group-hover:text-[#C8A45C] transition-colors leading-snug">
                          {item.name}
                        </h3>
                        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                          {item.description || 'Prenda de alta costura sin detalles adicionales.'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
                        <span>
                          Categoría: <strong className="text-neutral-200">{item.category}</strong>
                        </span>
                        {item.deposit_cents ? (
                          <span>
                            Garantía: <span className="text-neutral-300 font-mono">{formatSoles(item.deposit_cents)}</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-neutral-800/60">
                        <button
                          type="button"
                          onClick={() => handleToggleActiveDirect(item)}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            isItemActive
                              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                              : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          {isItemActive ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-400" />}
                          <span>{isItemActive ? 'Público (Activo)' : 'Oculto (Admin)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditItemModal(item)}
                          title="Editar prenda de vestuario"
                          className="p-2 rounded-xl bg-[#1A1A1A] border border-neutral-700/70 hover:border-[#C8A45C] text-neutral-300 hover:text-[#C8A45C] transition-all cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          title="Eliminar prenda de vestuario"
                          className="p-2 rounded-xl bg-[#1A1A1A] border border-neutral-700/70 hover:border-rose-500/70 text-neutral-400 hover:text-rose-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALES DEL FLUJO DE ALQUILERES & RESERVAS */}
      {/* ========================================================= */}

      {/* 1. Modal Nueva Reserva de Vestidos (Flujo 4 Campos) */}
      <NewDressRentalModal
        isOpen={isNewRentalModalOpen}
        onClose={() => setIsNewRentalModalOpen(false)}
        onSuccess={(createdRental) => {
          setIsNewRentalModalOpen(false);
          showToast('success', `¡Reserva [${createdRental.ticket_code}] registrada exitosamente!`);
          // Requisito 3: Apertura automática del ticket tras guardar
          setTicketModalRental(createdRental);
        }}
      />

      {/* 2. Modal Validar Voucher de Yape */}
      <ValidateVoucherModal
        rental={voucherModalRental}
        isOpen={!!voucherModalRental}
        onClose={() => setVoucherModalRental(null)}
        onSuccess={() => {
          setVoucherModalRental(null);
          showToast('success', 'Comprobante de Yape validado correctamente.');
        }}
      />

      {/* 3. Modal Procesar Entrega (Cobro de saldo + garantía) */}
      <ProcessDeliveryModal
        rental={deliveryModalRental}
        isOpen={!!deliveryModalRental}
        onClose={() => setDeliveryModalRental(null)}
        onSuccess={() => {
          setDeliveryModalRental(null);
          showToast('success', 'Entrega registrada correctamente. Prenda entregada al cliente.');
        }}
      />

      {/* 4. Modal Procesar Devolución (Reembolso de garantía con justificación) */}
      <ProcessReturnModal
        rental={returnModalRental}
        isOpen={!!returnModalRental}
        onClose={() => setReturnModalRental(null)}
        onSuccess={() => {
          const finalRental = returnModalRental;
          setReturnModalRental(null);
          showToast('success', 'Devolución procesada con éxito. Orden finalizada.');
          if (finalRental) {
            setTicketModalRental({ ...finalRental, status: 'finalizado' });
          }
        }}
      />

      {/* 5. Modal Ticket de Comprobante Térmico / WhatsApp */}
      {ticketModalRental && (
        <DressRentalTicketModal
          rental={ticketModalRental}
          onClose={() => setTicketModalRental(null)}
        />
      )}

      {/* 6. Modal Anular Orden con Justificación Obligatoria */}
      {annulRentalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Anular Orden de Alquiler</h3>
                <p className="text-xs text-neutral-400">Orden Nro: {annulRentalTarget.ticket_code}</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300">
              Esta acción pasará la orden a estado <strong>ANULADO</strong> y liberará el vestido en el
              calendario de reservas. El registro se conservará para auditoría contable.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                <span>
                  Motivo de Anulación {isRecepcionista ? <span className="text-[#C8A45C]">* (Obligatorio)</span> : '(Opcional)'}
                </span>
              </label>
              <textarea
                rows={2}
                required={isRecepcionista}
                placeholder="Ej. Solicitud cancelada por el cliente / Comprobante no válido..."
                value={annulReason}
                onChange={(e) => setAnnulReason(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAnnulRentalTarget(null)}
                disabled={isAnnulling}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAnnul}
                disabled={isAnnulling || (isRecepcionista && !annulReason.trim())}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all cursor-pointer disabled:opacity-40"
              >
                {isAnnulling ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Eliminar Orden (Exclusivo Administrador) */}
      {deleteRentalTarget && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Eliminar Registro de Alquiler</h3>
                <p className="text-xs text-neutral-400">Acción permanente de Administrador</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300">
              ¿Estás seguro de eliminar permanentemente la orden{' '}
              <strong className="text-white">[{deleteRentalTarget.ticket_code}]</strong> de{' '}
              <strong className="text-white">{deleteRentalTarget.client_first_name} {deleteRentalTarget.client_last_name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteRentalTarget(null)}
                disabled={isDeletingRental}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRental}
                disabled={isDeletingRental}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
              >
                {isDeletingRental ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CREAR / EDITAR PRENDA DEL CATÁLOGO */}
      {/* ========================================================= */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-[#121212] border border-[#C8A45C]/40 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#121212]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C8A45C] text-black flex items-center justify-center shadow">
                  {catalogModalMode === 'create' ? <Plus className="w-5 h-5" /> : <Edit2 className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-serif-luxury font-bold text-white">
                    {catalogModalMode === 'create' ? 'Nueva Prenda de Vestuario' : 'Editar Prenda de Vestuario'}
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Registro de trajes con código alfabético, categorías y compresión WebP
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWardrobe} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Título de la Prenda <span className="text-[#C8A45C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Vestido Gala con Lentejuelas / Smoking Italiano"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>Código <span className="text-[#C8A45C]">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="A-101"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#181818] border border-[#C8A45C]/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-center font-extrabold text-[#C8A45C] uppercase focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Categoría del Evento <span className="text-[#C8A45C]">*</span>
                </label>
                <select
                  required
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as WardrobeCategory)}
                  className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-[#C8A45C]"
                >
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles del corte, tipo de tela, accesorios incluidos..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#181818]/60 p-4 rounded-2xl border border-neutral-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Precio Alquiler (S/) <span className="text-[#C8A45C]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C8A45C]">
                      S/
                    </span>
                    <input
                      type="number"
                      step="1.00"
                      min="0"
                      required
                      placeholder="180.00"
                      value={formPriceSoles}
                      onChange={(e) => setFormPriceSoles(e.target.value)}
                      className="w-full bg-[#141414] border border-neutral-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#C8A45C]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Garantía Reembolsable (S/)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                      S/
                    </span>
                    <input
                      type="number"
                      step="1.00"
                      min="0"
                      placeholder="50.00"
                      value={formDepositSoles}
                      onChange={(e) => setFormDepositSoles(e.target.value)}
                      className="w-full bg-[#141414] border border-neutral-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-[#C8A45C]"
                    />
                  </div>
                </div>
              </div>

              {/* Carga y optimización de fotos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-[#C8A45C]" />
                    <span>Fotografía de la Prenda (WebP)</span>
                  </label>
                  {imageCompressionInfo && (
                    <span className="text-[11px] text-emerald-400 font-medium">
                      ✓ {imageCompressionInfo}
                    </span>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.[0]) handleProcessAndUploadImage(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col sm:flex-row items-center gap-4 ${
                    isDragOver
                      ? 'border-[#C8A45C] bg-[#C8A45C]/10'
                      : 'border-neutral-700/80 bg-[#161616] hover:border-neutral-500'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleProcessAndUploadImage(e.target.files[0]);
                    }}
                    className="hidden"
                  />

                  <div className="w-24 h-24 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center relative">
                    {formImageUrl ? (
                      <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <UploadCloud className="w-6 h-6 text-neutral-600" />
                    )}
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#C8A45C] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="text-left space-y-1 flex-1">
                    <p className="text-xs font-semibold text-white">
                      {uploadingImage ? 'Procesando y subiendo WebP...' : 'Haz clic o arrastra la foto aquí'}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Compresión automática a WebP ligero y almacenamiento en bucket Supabase.
                    </p>
                  </div>
                </div>

                <input
                  type="url"
                  placeholder="O ingresa una URL directa de imagen..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-300 font-mono focus:outline-none focus:border-[#C8A45C]"
                />
              </div>

              {/* Estado Activo / Visible */}
              <div className="p-3.5 bg-[#181818] rounded-xl border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Estado: Activo / Visible al Público</div>
                  <div className="text-[11px] text-neutral-400">
                    Si está inactivo (Oculto), no se muestra en el catálogo web público (/vestuario)
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C8A45C]" />
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  disabled={isSubmittingItem}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingItem || uploadingImage}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#C8A45C] to-[#A5823E] text-black shadow-lg shadow-[#C8A45C]/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingItem ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>{catalogModalMode === 'create' ? 'Guardar Prenda' : 'Actualizar Prenda'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación de Prenda de Inventario */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Eliminar Prenda de Vestuario</h3>
                <p className="text-xs text-neutral-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300">
              ¿Estás seguro de que deseas eliminar permanentemente la prenda{' '}
              <strong className="text-white">
                [Código {itemToDelete.code || 'A'}] "{itemToDelete.name}"
              </strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeletingItem}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWardrobeItem}
                disabled={isDeletingItem}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all cursor-pointer"
              >
                {isDeletingItem ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
