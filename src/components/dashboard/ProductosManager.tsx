import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Boxes,
  DollarSign,
  AlertTriangle,
  Sparkles,
  Tag,
  Layers,
  Image as ImageIcon,
  Barcode as BarcodeIcon,
  Printer,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DashboardSkeleton } from './DashboardSkeleton';
import { Product, formatSoles } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { ProductBarcodeLabelModal } from './ProductBarcodeLabelModal';
import { ConsumoInternoModal } from './ConsumoInternoModal';
import { BarcodeNotFoundModal } from './BarcodeNotFoundModal';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

// Categorías oficiales del catálogo de productos
export const PRODUCT_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'ceras_pomadas', label: 'Ceras & Pomadas' },
  { id: 'barba_afeitado', label: 'Cuidado de Barba' },
  { id: 'shampoos', label: 'Shampoos' },
  { id: 'tratamientos', label: 'Tratamientos' },
  { id: 'accesorios', label: 'Accesorios' },
] as const;

export type ProductCategoryType = 'ceras_pomadas' | 'shampoos' | 'barba_afeitado' | 'tratamientos' | 'accesorios';

// Compresión de imagen a WebP en el navegador
async function compressImageToWebP(file: File, quality = 0.85, maxWidth = 1200): Promise<{ blob: Blob; sizeKb: number }> {
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

export const ProductosManager: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, openLightbox, currentRole, isDataLoading, employees } = useApp();

  const isAuthorized = currentRole === 'admin' || currentRole === 'recepcionista';

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedStockFilter, setSelectedStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Estado del Modal de Creación / Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Campos del Formulario
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategoryType>('ceras_pomadas');
  const [formPriceSoles, setFormPriceSoles] = useState<string>('45.00');
  const [formStock, setFormStock] = useState<string>('15');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formUnitMeasure, setFormUnitMeasure] = useState<string>('unidad');
  const [formUseType, setFormUseType] = useState<'venta' | 'consumo_interno' | 'mixto'>('venta');
  const [formMinStock, setFormMinStock] = useState<string>('5');

  // Modales adicionales
  const [selectedLabelProduct, setSelectedLabelProduct] = useState<Product | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState<boolean>(false);
  const [selectedConsumoProduct, setSelectedConsumoProduct] = useState<Product | null>(null);
  const [isConsumoModalOpen, setIsConsumoModalOpen] = useState<boolean>(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  // Estado de Carga de Imagen
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageCompressionInfo, setImageCompressionInfo] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de retroalimentación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de Confirmación de Eliminación
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // KPIs de Inventario
  const inventoryStats = useMemo(() => {
    const totalCount = products.length;
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalValuationCents = products.reduce((sum, p) => sum + (p.stock || 0) * (p.price_cents || 0), 0);
    const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= (p.min_stock ?? 5)).length;
    const outOfStockCount = products.filter((p) => p.stock === 0).length;

    return {
      totalCount,
      totalStock,
      totalValuationCents,
      lowStockCount,
      outOfStockCount,
    };
  }, [products]);

  // Lista Filtrada
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      // Filtro de Categoría
      if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) {
        return false;
      }

      // Filtro de Stock
      if (selectedStockFilter === 'in_stock' && item.stock <= 0) return false;
      if (selectedStockFilter === 'low_stock' && (item.stock <= 0 || item.stock > (item.min_stock ?? 5))) return false;
      if (selectedStockFilter === 'out_of_stock' && item.stock !== 0) return false;

      // Filtro de Búsqueda
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDesc = item.description ? item.description.toLowerCase().includes(query) : false;
        const matchesBarcode = item.barcode ? item.barcode.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesDesc && !matchesBarcode) return false;
      }

      return true;
    });
  }, [products, selectedCategoryFilter, selectedStockFilter, searchQuery]);

  // Apertura de modal con código de barras escaneado
  const handleOpenCreateModalWithBarcode = (barcode: string) => {
    setModalMode('create');
    setEditingProductId(null);
    setFormName('');
    setFormCategory('ceras_pomadas');
    setFormPriceSoles('45.00');
    setFormStock('10');
    setFormDescription('');
    setFormImageUrl('');
    setFormBarcode(barcode);
    setFormUnitMeasure('unidad');
    setFormUseType('venta');
    setFormMinStock('5');
    setImageCompressionInfo(null);
    setIsModalOpen(true);
  };

  const handleGenerateRandomBarcode = () => {
    const code = `775${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    setFormBarcode(code);
  };

  // Escáner de código de barras activo en la vista de productos
  useBarcodeScanner({
    enabled: isAuthorized && !isModalOpen && !isConsumoModalOpen && !isLabelModalOpen,
    onScan: (code) => {
      const clean = code.trim();
      if (!clean) return;

      const found = products.find((p) => p.barcode?.trim() === clean);
      if (found) {
        showToast('success', `Producto escaneado: "${found.name}" (Stock: ${found.stock})`);
        setSearchQuery(found.name);
      } else {
        if (currentRole === 'admin') {
          handleOpenCreateModalWithBarcode(clean);
        } else {
          setNotFoundBarcode(clean);
        }
      }
    },
  });

  // Si proviene de un escaneo en POS que no existía
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingBarcode');
    if (pending) {
      sessionStorage.removeItem('pendingBarcode');
      if (currentRole === 'admin') {
        handleOpenCreateModalWithBarcode(pending);
      }
    }
  }, [currentRole]);

  // Manejador de Apertura del Modal para Crear
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingProductId(null);
    setFormName('');
    setFormCategory('ceras_pomadas');
    setFormPriceSoles('45.00');
    setFormStock('15');
    setFormDescription('');
    setFormImageUrl('');
    setFormBarcode('');
    setFormUnitMeasure('unidad');
    setFormUseType('venta');
    setFormMinStock('5');
    setImageCompressionInfo(null);
    setIsModalOpen(true);
  };

  // Manejador de Apertura del Modal para Editar
  const handleOpenEditModal = (product: Product) => {
    setModalMode('edit');
    setEditingProductId(product.id);
    setFormName(product.name);
    setFormCategory((product.category as ProductCategoryType) || 'ceras_pomadas');
    setFormPriceSoles((product.price_cents / 100).toFixed(2));
    setFormStock(product.stock.toString());
    setFormDescription(product.description || '');
    setFormImageUrl(product.image_url || '');
    setFormBarcode(product.barcode || '');
    setFormUnitMeasure(product.unit_measure || 'unidad');
    setFormUseType(product.use_type || 'venta');
    setFormMinStock((product.min_stock ?? 5).toString());
    setImageCompressionInfo(null);
    setIsModalOpen(true);
  };

  // Procesamiento y Subida de Imagen a Supabase Storage: bucket 'products'
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Por favor selecciona un archivo de imagen válido (JPEG, PNG, WebP).');
      return;
    }

    try {
      setUploadingImage(true);
      const originalSizeKb = Math.round(file.size / 1024);

      // 1. Compresión WebP en cliente
      const { blob: webpBlob, sizeKb: compressedSizeKb } = await compressImageToWebP(file, 0.85, 1200);
      setImageCompressionInfo(`Optimizado: ${originalSizeKb} KB ➔ ${compressedSizeKb} KB (WebP)`);

      // 2. Subida a Supabase Storage: bucket 'products'
      const cleanName = (formName || 'producto')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');
      const fileName = `prod-${cleanName}-${Date.now()}.webp`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, webpBlob, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error al subir a Supabase Storage (bucket products):', uploadError);
        // Fallback: URL temporal local en caso de restricción temporal
        const localPreviewUrl = URL.createObjectURL(webpBlob);
        setFormImageUrl(localPreviewUrl);
        showToast('error', `Aviso de almacenamiento: ${uploadError.message}. Se asignó vista previa.`);
        return;
      }

      // 3. Obtener URL pública permanente
      const { data: publicUrlData } = supabase.storage
        .from('products')
        .getPublicUrl(uploadData?.path || fileName);

      if (publicUrlData?.publicUrl) {
        setFormImageUrl(publicUrlData.publicUrl);
        showToast('success', 'Fotografía WebP optimizada y almacenada exitosamente.');
      }
    } catch (err: any) {
      console.error('Error al optimizar y subir imagen:', err);
      showToast('error', `Error al procesar imagen: ${err.message || 'Error desconocido'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Guardar Producto (Crear o Actualizar)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      showToast('error', 'Por favor ingresa el nombre del producto.');
      return;
    }

    const parsedPrice = parseFloat(formPriceSoles);
    if ((formUseType === 'venta' || formUseType === 'mixto') && (isNaN(parsedPrice) || parsedPrice < 0)) {
      showToast('error', 'Por favor ingresa un precio válido en Soles para productos de venta.');
      return;
    }

    const parsedStock = parseInt(formStock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      showToast('error', 'Por favor ingresa una cantidad de stock válida (0 o mayor).');
      return;
    }

    const parsedMinStock = parseInt(formMinStock, 10);
    if (isNaN(parsedMinStock) || parsedMinStock < 0) {
      showToast('error', 'Por favor ingresa un stock mínimo válido (0 o mayor).');
      return;
    }

    const priceCents = Math.round(parsedPrice * 100) || 0;
    const finalImageUrl =
      formImageUrl.trim() ||
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80';

    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        const success = await addProduct({
          name: formName.trim(),
          slug: '',
          category: formCategory,
          price_cents: priceCents,
          stock: parsedStock,
          min_stock: parsedMinStock,
          barcode: formBarcode.trim() || undefined,
          unit_measure: formUnitMeasure,
          use_type: formUseType,
          image_url: finalImageUrl,
          description: formDescription.trim(),
          active: true,
        });

        if (success) {
          showToast('success', `Producto "${formName.trim()}" registrado con éxito.`);
          setIsModalOpen(false);
        } else {
          showToast('error', 'No se pudo registrar el producto en el catálogo.');
        }
      } else if (modalMode === 'edit' && editingProductId) {
        const existing = products.find((p) => p.id === editingProductId);
        const success = await updateProduct({
          id: editingProductId,
          slug: existing?.slug || '',
          name: formName.trim(),
          category: formCategory,
          price_cents: priceCents,
          stock: parsedStock,
          min_stock: parsedMinStock,
          barcode: formBarcode.trim() || undefined,
          unit_measure: formUnitMeasure,
          use_type: formUseType,
          image_url: finalImageUrl,
          description: formDescription.trim(),
          active: existing?.active !== undefined ? existing.active : true,
        });

        if (success) {
          showToast('success', `Producto "${formName.trim()}" actualizado con éxito.`);
          setIsModalOpen(false);
        } else {
          showToast('error', 'No se pudo actualizar el producto.');
        }
      }
    } catch (err: any) {
      console.error('Error al procesar producto:', err);
      showToast('error', `Ocurrió un error inesperado: ${err.message || 'Error al guardar'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar Eliminación
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteProduct(productToDelete.id);
      if (success) {
        showToast('success', `Producto "${productToDelete.name}" eliminado del catálogo.`);
        setProductToDelete(null);
      } else {
        showToast('error', 'No se pudo eliminar el producto.');
      }
    } catch (err: any) {
      console.error('Error deleting product:', err);
      showToast('error', `Error al eliminar: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-[#121E15]/95 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40'
              : 'bg-[#221214]/95 text-rose-300 border-rose-500/40 shadow-rose-950/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Administrativo: Sin Carrito, con Botón "+ Nuevo Producto" */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-800/80 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875] flex items-center gap-1.5">
              <Package className="w-3 h-3" />
              Gestión de Inventario & Almacén
            </span>
          </div>
          <h1 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Catálogo de Productos
          </h1>
          <p className="text-xs text-neutral-400 max-w-2xl">
            Control de existencias, precios de venta en mostrador y tienda, registro de nuevos insumos y subida de imágenes a Supabase Storage.
          </p>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedConsumoProduct(null);
              setIsConsumoModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-amber-400" />
            <span>Consumo Interno</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C8A45C] to-[#DFBE73] hover:from-[#DFBE73] hover:to-[#E6C875] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#C8A45C]/20 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
          <div className="w-11 h-11 rounded-xl bg-[#C8A45C]/10 border border-[#C8A45C]/25 flex items-center justify-center text-[#E6C875] flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Productos</p>
            <p className="text-xl font-bold text-white tracking-tight">{inventoryStats.totalCount}</p>
          </div>
        </div>

        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Stock Total</p>
            <p className="text-xl font-bold text-white tracking-tight">{inventoryStats.totalStock} <span className="text-xs text-neutral-500 font-normal">unid.</span></p>
          </div>
        </div>

        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Valor Inventario</p>
            <p className="text-xl font-bold text-emerald-400 tracking-tight">{formatSoles(inventoryStats.totalValuationCents)}</p>
          </div>
        </div>

        <div className="bg-[#141414] border border-neutral-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Bajo Stock / Agotado</p>
            <p className="text-xl font-bold text-amber-400 tracking-tight">
              {inventoryStats.lowStockCount + inventoryStats.outOfStockCount}{' '}
              <span className="text-[11px] text-neutral-500 font-normal">({inventoryStats.outOfStockCount} agt.)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Controles de Filtrado y Búsqueda */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#111111] p-3 rounded-2xl border border-neutral-800/80">
        {/* Categorías */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategoryFilter === cat.id
                  ? 'bg-[#C8A45C] text-black shadow-md shadow-[#C8A45C]/20'
                  : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Buscador y Estado de Stock */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={selectedStockFilter}
            onChange={(e: any) => setSelectedStockFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-neutral-300 outline-none cursor-pointer"
          >
            <option value="all">Todo el stock</option>
            <option value="in_stock">En existencia</option>
            <option value="low_stock">Bajo stock (≤ 5)</option>
            <option value="out_of_stock">Agotados (0)</option>
          </select>
        </div>
      </div>

      {/* Grid de Productos de Gestión */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[#141414] rounded-3xl border border-neutral-800/80 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
            <Package className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No se encontraron productos</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              No hay productos registrados que coincidan con el filtro o término de búsqueda aplicado.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black transition cursor-pointer shadow"
          >
            + Registrar Producto Ahora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const isOutOfStock = product.stock === 0;
            const isLowStock = product.stock > 0 && product.stock <= 5;
            const catLabel =
              PRODUCT_CATEGORIES.find((c) => c.id === product.category)?.label || product.category;

            return (
              <div
                key={product.id}
                className="bg-[#141414] border border-neutral-800/90 hover:border-[#C8A45C]/40 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between group transition-all duration-300 select-none"
              >
                {/* Imagen y Zoom Lightbox */}
                <div className="relative h-44 bg-neutral-900 overflow-hidden group/img">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    draggable={false}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80';
                    }}
                  />

                  {/* Overlay para ver foto ampliada */}
                  <button
                    type="button"
                    onClick={() =>
                      openLightbox({
                        url: product.image_url,
                        title: product.name,
                        description: product.description,
                        category: catLabel,
                        price: formatSoles(product.price_cents),
                        metadata: `Stock: ${product.stock} unidades`,
                      })
                    }
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-zoom-in"
                    title="Clic para ampliar imagen"
                  >
                    <span className="px-3 py-1.5 rounded-xl bg-black/80 border border-[#C8A45C]/60 text-[#E6C875] text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Ver imagen</span>
                    </span>
                  </button>

                  {/* Badge de Categoría */}
                  <div className="absolute top-2.5 left-2.5 pointer-events-none">
                    <span className="text-[10px] bg-black/75 backdrop-blur-sm text-neutral-300 px-2.5 py-0.5 rounded-lg border border-neutral-800 font-medium">
                      {catLabel}
                    </span>
                  </div>

                  {/* Badge de Stock Semántico */}
                  <div className="absolute top-2.5 right-2.5 pointer-events-none">
                    <span
                      className={`text-[10px] backdrop-blur-sm px-2.5 py-0.5 rounded-lg border font-bold ${
                        isOutOfStock
                          ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                          : isLowStock
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                      }`}
                    >
                      {isOutOfStock ? 'Agotado' : `${product.stock} un.`}
                    </span>
                  </div>
                </div>

                {/* Contenido de la Tarjeta */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white group-hover:text-[#E6C875] transition line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                      {product.description || 'Sin descripción disponible.'}
                    </p>
                  </div>

                  {/* Precio e Inventario */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Precio Venta</p>
                      <span className="text-sm font-bold text-[#E6C875]">
                        {formatSoles(product.price_cents)}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Valor Stock</p>
                      <span className="text-xs font-semibold text-neutral-300">
                        {formatSoles(product.stock * product.price_cents)}
                      </span>
                    </div>
                  </div>

                  {/* Código de barras y tipo de uso */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <BarcodeIcon className="w-3 h-3 text-[#C8A45C]" />
                      {product.barcode || 'Sin código'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 uppercase">
                      {product.use_type || 'venta'}
                    </span>
                  </div>

                  {/* Botones de Operación y Gestión */}
                  <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConsumoProduct(product);
                        setIsConsumoModalOpen(true);
                      }}
                      className="py-1 px-2 rounded-lg text-[11px] font-medium bg-[#161616] hover:bg-[#222222] border border-neutral-800 text-amber-300 hover:text-amber-200 transition flex items-center justify-center gap-1"
                      title="Registrar salida para consumo interno"
                    >
                      <Boxes className="w-3 h-3 text-amber-400" />
                      <span>Consumo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLabelProduct(product);
                        setIsLabelModalOpen(true);
                      }}
                      className="py-1 px-2 rounded-lg text-[11px] font-medium bg-[#161616] hover:bg-[#222222] border border-neutral-800 text-neutral-300 hover:text-white transition flex items-center justify-center gap-1"
                      title="Generar e imprimir etiqueta de código de barras"
                    >
                      <Printer className="w-3 h-3 text-[#C8A45C]" />
                      <span>Etiqueta</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(product)}
                      className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-neutral-700/80 hover:border-[#C8A45C]/50 text-neutral-200 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Editar datos del producto"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#C8A45C]" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductToDelete(product)}
                      className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-rose-950/25 hover:bg-rose-950/50 border border-rose-900/40 hover:border-rose-700 text-rose-400 hover:text-rose-200 transition flex items-center justify-center cursor-pointer"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Registro / Edición de Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141414] border border-[#C8A45C]/40 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A45C] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  {modalMode === 'create' ? 'Nuevo Registro' : 'Edición de Producto'}
                </span>
                <h2 className="text-xl font-bold text-white">
                  {modalMode === 'create' ? 'Registrar Nuevo Producto' : 'Editar Producto del Catálogo'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitForm} className="space-y-5">
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  Nombre del Producto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Cera Fijación Mate Extra Fuerte (100g)"
                  className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                />
              </div>

              {/* Código de Barras */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <BarcodeIcon className="w-3.5 h-3.5 text-[#C8A45C]" />
                    Código de Barras (Escáner / EAN-13 / Code128)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomBarcode}
                    className="text-[10px] text-[#C8A45C] hover:text-[#E6C875] underline font-mono cursor-pointer"
                  >
                    Generar aleatorio
                  </button>
                </div>
                <input
                  type="text"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value.trim())}
                  placeholder="Ej. 7751234000012 (o escanee con el lector USB)"
                  className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 font-mono outline-none transition"
                />
              </div>

              {/* Categoría y Unidad de Medida */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Categoría <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e: any) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="ceras_pomadas">Ceras & Pomadas</option>
                    <option value="barba_afeitado">Cuidado de Barba</option>
                    <option value="shampoos">Shampoos</option>
                    <option value="tratamientos">Tratamientos</option>
                    <option value="accesorios">Accesorios</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Unidad de Medida <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formUnitMeasure}
                    onChange={(e) => setFormUnitMeasure(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="unidad">Unidades (uds.)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="litro">Litros (L)</option>
                    <option value="frasco">Frasco</option>
                    <option value="paquete">Paquete</option>
                    <option value="caja">Caja</option>
                  </select>
                </div>
              </div>

              {/* Tipo de Uso y Precio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Tipo de Uso <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formUseType}
                    onChange={(e: any) => setFormUseType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="venta">Venta al Público (Mostrador)</option>
                    <option value="consumo_interno">Consumo Interno (Insumo Sillón)</option>
                    <option value="mixto">Mixto (Venta & Consumo)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Precio de Venta (S/.) {formUseType !== 'consumo_interno' && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E6C875]">
                      S/
                    </span>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      required={formUseType !== 'consumo_interno'}
                      value={formPriceSoles}
                      onChange={(e) => setFormPriceSoles(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Stock Inicial y Stock Mínimo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Stock en Inventario <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="15"
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Stock Mínimo de Alerta <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    placeholder="5"
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Descripción del Producto</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalles sobre beneficios, forma de aplicación o contenido..."
                  className="w-full px-3.5 py-2 bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition resize-none"
                />
              </div>

              {/* Subida de Imagen a Supabase Storage (bucket 'products') */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                  <span>Fotografía del Producto (Supabase Storage)</span>
                  {imageCompressionInfo && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {imageCompressionInfo}
                    </span>
                  )}
                </label>

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    isDragOver
                      ? 'border-[#C8A45C] bg-[#C8A45C]/5'
                      : 'border-neutral-800 hover:border-neutral-700 bg-[#171717]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageFile(e.target.files[0]);
                      }
                    }}
                  />

                  {uploadingImage ? (
                    <div className="py-4 space-y-2 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full border-2 border-[#C8A45C] border-t-transparent animate-spin" />
                      <p className="text-xs text-[#E6C875] font-semibold">
                        Comprimiendo y subiendo al bucket 'products'...
                      </p>
                    </div>
                  ) : formImageUrl ? (
                    <div className="relative w-full flex items-center gap-3">
                      <img
                        src={formImageUrl}
                        alt="Vista previa"
                        className="w-16 h-16 rounded-xl object-cover border border-neutral-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-xs text-white font-semibold truncate">Imagen asignada</p>
                        <p className="text-[10px] text-neutral-400 truncate">{formImageUrl}</p>
                        <span className="text-[10px] text-[#C8A45C] hover:underline">
                          Clic para cambiar foto
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 space-y-1">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-neutral-300 font-medium">
                        Arrastra una imagen o <span className="text-[#C8A45C]">haz clic para explorar</span>
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        Formatos: WebP, PNG o JPEG. Se optimizará automáticamente.
                      </p>
                    </div>
                  )}
                </div>

                {/* Input alternativo para ingresar URL directa */}
                <div className="pt-1">
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="O ingresa una URL de imagen externa (https://...)"
                    className="w-full px-3 py-1.5 bg-[#171717] border border-neutral-800 focus:border-[#C8A45C] rounded-xl text-[11px] text-neutral-300 placeholder-neutral-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-[#1A1A1A] hover:bg-[#222222] border border-neutral-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingImage}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow-lg shadow-[#C8A45C]/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{modalMode === 'create' ? 'Guardar Producto' : 'Actualizar Producto'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161616] border border-rose-900/60 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">¿Eliminar producto del catálogo?</h3>
              <p className="text-xs text-neutral-400">
                Estás a punto de eliminar <span className="text-white font-semibold">"{productToDelete.name}"</span>. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-[#202020] hover:bg-[#282828] border border-neutral-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/30 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modales de Operaciones Complementarias */}
      <ProductBarcodeLabelModal
        product={selectedLabelProduct}
        isOpen={isLabelModalOpen}
        onClose={() => {
          setIsLabelModalOpen(false);
          setSelectedLabelProduct(null);
        }}
      />

      <ConsumoInternoModal
        isOpen={isConsumoModalOpen}
        initialProduct={selectedConsumoProduct}
        products={products}
        employees={employees}
        onClose={() => {
          setIsConsumoModalOpen(false);
          setSelectedConsumoProduct(null);
        }}
        onSuccess={(info) => {
          showToast(
            'success',
            `Consumo interno registrado: ${info.quantity} unid. de "${info.productName}" para "${info.area}".`
          );
        }}
      />

      <BarcodeNotFoundModal
        isOpen={!!notFoundBarcode}
        scannedBarcode={notFoundBarcode || ''}
        userRole={currentRole as any}
        onClose={() => setNotFoundBarcode(null)}
        onRegisterNew={(barcode) => {
          setNotFoundBarcode(null);
          handleOpenCreateModalWithBarcode(barcode);
        }}
      />
    </div>
  );
};
