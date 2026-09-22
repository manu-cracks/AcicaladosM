import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Scissors,
  Sparkles,
  Plus,
  Search,
  Edit2,
  Trash2,
  Clock,
  Check,
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DashboardSkeleton } from './DashboardSkeleton';
import { Service } from '../../types';
import { supabase } from '../../lib/supabase/client';

// ==========================================
// TIPOS Y CONSTANTES PARA DURACIONES INTELIGENTES
// ==========================================
export type DurationUnit = 'minutos' | 'horas' | 'dias' | 'semanas';

export function durationToMinutes(val: number, unit: DurationUnit): number {
  const v = Math.max(1, Math.round(val || 0));
  switch (unit) {
    case 'horas':
      return v * 60;
    case 'dias':
      return v * 1440;
    case 'semanas':
      return v * 10080;
    case 'minutos':
    default:
      return v;
  }
}

export function minutesToBestUnit(totalMinutes: number): { value: number; unit: DurationUnit } {
  const m = Math.max(1, Math.round(totalMinutes || 0));
  if (m % 10080 === 0 && m >= 10080) {
    return { value: m / 10080, unit: 'semanas' };
  }
  if (m % 1440 === 0 && m >= 1440) {
    return { value: m / 1440, unit: 'dias' };
  }
  if (m % 60 === 0 && m >= 60) {
    return { value: m / 60, unit: 'horas' };
  }
  return { value: m, unit: 'minutos' };
}

export function formatDurationSmart(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';

  // 1. Menor a 60 minutos: se muestra en minutos (ej. "45 min")
  if (minutes < 60) {
    return `${minutes} min`;
  }

  // 2. Si alcanza o supera 60 minutos pero es menor a 24 horas: se expresa en horas (ej. 60 min -> "1 h", 90 min -> "1h 30m")
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} h`;
  }

  // 3. Si alcanza múltiplos de 7 días (10080 min): se expresa en semanas (ej. 7 días -> "1 semana", 14 días -> "2 semanas")
  if (minutes % 10080 === 0) {
    const w = minutes / 10080;
    return `${w} ${w === 1 ? 'semana' : 'semanas'}`;
  }

  // 4. Si supera semanas con días restantes
  if (minutes >= 10080) {
    const w = Math.floor(minutes / 10080);
    const remD = Math.floor((minutes % 10080) / 1440);
    if (remD > 0) {
      return `${w} sem ${remD} ${remD === 1 ? 'día' : 'días'}`;
    }
    return `${w} ${w === 1 ? 'semana' : 'semanas'}`;
  }

  // 5. Si alcanza o supera las 24 horas (1440 min): se expresa en días (ej. 1440 min -> "1 día", 48 h -> "2 días")
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return `${d} ${d === 1 ? 'día' : 'días'}`;
  }

  // Días con horas restantes
  const d = Math.floor(minutes / 1440);
  const remH = Math.floor((minutes % 1440) / 60);
  return remH > 0 ? `${d}d ${remH}h` : `${d} ${d === 1 ? 'día' : 'días'}`;
}

// ==========================================
// PLANTILLAS PREDEFINIDAS BASE
// ==========================================
interface PredefinedTemplate {
  name: string;
  category: 'barberia' | 'spa';
  durationValue: number;
  durationUnit: DurationUnit;
  priceSoles: number;
  description: string;
  imageUrl: string;
}

const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  // Barbería
  {
    name: 'Corte Tradicional & Degradado Fade',
    category: 'barberia',
    durationValue: 40,
    durationUnit: 'minutos',
    priceSoles: 35.0,
    description: 'Corte artesanal con asesoría de visagismo, degradado al ras (Skin/Fade) y acabado con navaja y fijador premium.',
    imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Ritual Barba Spa Toalla Caliente',
    category: 'barberia',
    durationValue: 35,
    durationUnit: 'minutos',
    priceSoles: 30.0,
    description: 'Perfilado y recorte de barba con vapor ozono, toalla caliente perfumada, aceites esenciales nutritivos y bálsamo calmante.',
    imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Combo Ejecutivo: Corte + Barba + Exfoliación',
    category: 'barberia',
    durationValue: 65,
    durationUnit: 'minutos',
    priceSoles: 60.0,
    description: 'Servicio insignia: Corte de autor, perfilado de barba al vapor, exfoliación facial purificante y tónico refrescante.',
    imageUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Afeitado Clásico a Navaja Libre',
    category: 'barberia',
    durationValue: 30,
    durationUnit: 'minutos',
    priceSoles: 25.0,
    description: 'Afeitado al estilo tradicional con espuma caliente aplicada a brocha de tejón y doble pase de navaja artesanal.',
    imageUrl: 'https://images.unsplash.com/photo-1517832606589-7629c3397143?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Perfilado y Tinte Orgánico de Barba',
    category: 'barberia',
    durationValue: 45,
    durationUnit: 'minutos',
    priceSoles: 45.0,
    description: 'Matización natural de canas en barba con pigmentos orgánicos hipoalergénicos sin amoníaco.',
    imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Tratamiento Anticaída y Cuero Cabelludo',
    category: 'barberia',
    durationValue: 50,
    durationUnit: 'minutos',
    priceSoles: 55.0,
    description: 'Terapia capilar con microcorriente galvánica, loción bioactiva de romero y masaje circulatorio craneal.',
    imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Membresía Mensual Grooming VIP (4 semanas)',
    category: 'barberia',
    durationValue: 4,
    durationUnit: 'semanas',
    priceSoles: 180.0,
    description: 'Paquete de mantenimiento mensual integral con cortes semanales ilimitados, perfilado de barba y bebidas de cortesía en cada sesión.',
    imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
  },

  // Spa
  {
    name: 'Masaje Descontracturante & Piedras Calientes',
    category: 'spa',
    durationValue: 60,
    durationUnit: 'minutos',
    priceSoles: 90.0,
    description: 'Terapia de presión profunda combinada con piedras volcánicas a temperatura ideal para aliviar nudos musculares crónicos.',
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Limpieza Facial Profunda con Hidrodermoabrasión',
    category: 'spa',
    durationValue: 50,
    durationUnit: 'minutos',
    priceSoles: 80.0,
    description: 'Extracción ultrasónica de impurezas, succión hidrofacial con infusión de vitaminas antioxidantes y máscara LED fotónica.',
    imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Manicura & Pedicura Spa Imperial',
    category: 'spa',
    durationValue: 55,
    durationUnit: 'minutos',
    priceSoles: 55.0,
    description: 'Exfoliación con sales del Himalaya, tina de hidromasaje, limado clínico de uñas y mascarilla de parafina caliente.',
    imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Masaje Relajante con Aromaterapia y Velas',
    category: 'spa',
    durationValue: 75,
    durationUnit: 'minutos',
    priceSoles: 110.0,
    description: 'Masaje holístico sueco corporal completo con cera de soja tibia y aceites puros de lavanda y eucalipto.',
    imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Retiro y Terapia Spa de Fin de Semana',
    category: 'spa',
    durationValue: 2,
    durationUnit: 'dias',
    priceSoles: 320.0,
    description: 'Jornada intensiva de dos días de relajación: circuito hidrotermal, sauna seco, masajes corporales continuos y faciales revitalizantes.',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Programa Integral de Desintoxicación y Spa',
    category: 'spa',
    durationValue: 1,
    durationUnit: 'semanas',
    priceSoles: 750.0,
    description: 'Tratamiento holístico distribuido a lo largo de 7 días: drenaje linfático diario, hidroterapia, sauna y nutrición dérmica de alta gama.',
    imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=600&q=80',
  },
];

// ==========================================
// COMPRESIÓN DE IMAGEN A WEBP EN CLIENTE
// ==========================================
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
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export const ServiciosManager: React.FC = () => {
  const { services, currentRole, addService, updateService, deleteService, toggleServiceActive, openLightbox, isDataLoading } = useApp();

  // Permisos: Administrador o Recepcionista
  const isAuthorized = currentRole === 'admin' || currentRole === 'recepcionista';

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | 'barberia' | 'spa'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Estado del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Campos del Formulario
  const [formCategory, setFormCategory] = useState<'barberia' | 'spa'>('barberia');
  const [formSelectedTemplate, setFormSelectedTemplate] = useState<string>('manual');
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriceSoles, setFormPriceSoles] = useState<string>('35.00');
  const [formDurationValue, setFormDurationValue] = useState<number>(40);
  const [formDurationUnit, setFormDurationUnit] = useState<DurationUnit>('minutos');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formImageUrl, setFormImageUrl] = useState<string>('');

  // Estado de Carga de Imagen
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageCompressionInfo, setImageCompressionInfo] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de retroalimentación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de Confirmación de Eliminación
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-cálculo de minutos y formateo inteligente en el formulario
  const computedDurationMinutes = useMemo(() => {
    return durationToMinutes(formDurationValue, formDurationUnit);
  }, [formDurationValue, formDurationUnit]);

  const computedSmartPreview = useMemo(() => {
    return formatDurationSmart(computedDurationMinutes);
  }, [computedDurationMinutes]);

  // Mostrar Toast con desvanecimiento automático
  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Abrir Modal para Crear
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingServiceId(null);
    setFormCategory('barberia');
    setFormSelectedTemplate('manual');
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormPriceSoles('35.00');
    setFormDurationValue(40);
    setFormDurationUnit('minutos');
    setFormIsActive(true);
    setFormImageUrl('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80');
    setImageCompressionInfo(null);
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar
  const handleOpenEditModal = (srv: Service) => {
    setModalMode('edit');
    setEditingServiceId(srv.id);
    setFormCategory(srv.category || 'barberia');
    setFormSelectedTemplate('manual');
    setFormName(srv.name);
    setFormSlug(srv.slug || '');
    setFormDescription(srv.description || '');
    setFormPriceSoles((srv.price_cents / 100).toFixed(2));

    const bestUnit = minutesToBestUnit(srv.duration_minutes || 45);
    setFormDurationValue(bestUnit.value);
    setFormDurationUnit(bestUnit.unit);

    setFormIsActive(srv.active);
    setFormImageUrl(srv.image_url || '');
    setImageCompressionInfo(null);
    setIsModalOpen(true);
  };

  // Selección de Plantilla Predefinida
  const handleSelectTemplate = (templateName: string) => {
    setFormSelectedTemplate(templateName);
    if (templateName === 'manual') return;

    const tpl = PREDEFINED_TEMPLATES.find((t) => t.name === templateName);
    if (tpl) {
      setFormCategory(tpl.category);
      setFormName(tpl.name);
      setFormSlug(tpl.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
      setFormDescription(tpl.description);
      setFormPriceSoles(tpl.priceSoles.toFixed(2));
      setFormDurationValue(tpl.durationValue);
      setFormDurationUnit(tpl.durationUnit);
      if (tpl.imageUrl) {
        setFormImageUrl(tpl.imageUrl);
      }
    }
  };

  // Procesamiento y Carga de Archivo de Imagen con Compresión WebP
  const handleProcessAndUploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    try {
      setUploadingImage(true);
      setImageCompressionInfo('Comprimiendo imagen a WebP...');

      // 1. Compresión en frontend a WebP
      const originalSizeKb = Math.round(file.size / 1024);
      const { blob: webpBlob, sizeKb: webpSizeKb } = await compressImageToWebP(file, 0.85, 1200);

      setImageCompressionInfo(`WebP optimizado: ${webpSizeKb} KB (original: ${originalSizeKb} KB)`);

      // 2. Subida a Supabase Storage: bucket services-images
      const cleanSlug = (formSlug || formName || 'servicio')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-');
      const fileName = `service-${cleanSlug}-${Date.now()}.webp`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('services-images')
        .upload(fileName, webpBlob, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error al subir a Supabase Storage:', uploadError);
        // Generar URL temporal local en caso de restricción de red
        const localPreviewUrl = URL.createObjectURL(webpBlob);
        setFormImageUrl(localPreviewUrl);
        showToast('error', `Aviso de almacenamiento: ${uploadError.message}. Se asignó vista previa local.`);
        return;
      }

      // 3. Obtener URL pública permanente
      const { data: publicUrlData } = supabase.storage
        .from('services-images')
        .getPublicUrl(uploadData.path || fileName);

      if (publicUrlData?.publicUrl) {
        setFormImageUrl(publicUrlData.publicUrl);
        showToast('success', 'Imagen optimizada a WebP y subida con éxito.');
      }
    } catch (err: any) {
      console.error('Error en procesamiento de imagen:', err);
      showToast('error', `Error al optimizar imagen: ${err.message || 'Error desconocido'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessAndUploadImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessAndUploadImage(e.target.files[0]);
    }
  };

  // Envío del Formulario
  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones obligatorias
    if (!formName.trim()) {
      showToast('error', 'El nombre o título del servicio es obligatorio.');
      return;
    }
    const priceNum = parseFloat(formPriceSoles);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast('error', 'Ingresa un precio válido en Soles (S/).');
      return;
    }
    if (computedDurationMinutes <= 0) {
      showToast('error', 'La duración del servicio debe ser mayor a 0 minutos.');
      return;
    }

    const priceCents = Math.round(priceNum * 100);
    const finalSlug = formSlug.trim() || formName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    const finalImageUrl =
      formImageUrl.trim() ||
      (formCategory === 'barberia'
        ? 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80'
        : 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80');

    try {
      setIsSubmitting(true);

      if (modalMode === 'create') {
        const success = await addService({
          name: formName.trim(),
          slug: finalSlug,
          category: formCategory,
          price_cents: priceCents,
          duration_minutes: computedDurationMinutes,
          capacity: 1,
          active: formIsActive,
          image_url: finalImageUrl,
          description: formDescription.trim(),
        });

        if (success) {
          showToast('success', `¡Servicio "${formName.trim()}" creado exitosamente!`);
          setIsModalOpen(false);
        } else {
          showToast('error', 'No se pudo guardar el servicio en la base de datos.');
        }
      } else if (modalMode === 'edit' && editingServiceId) {
        const success = await updateService({
          id: editingServiceId,
          name: formName.trim(),
          slug: finalSlug,
          category: formCategory,
          price_cents: priceCents,
          duration_minutes: computedDurationMinutes,
          capacity: 1,
          active: formIsActive,
          image_url: finalImageUrl,
          description: formDescription.trim(),
        });

        if (success) {
          showToast('success', `¡Servicio "${formName.trim()}" actualizado correctamente!`);
          setIsModalOpen(false);
        } else {
          showToast('error', 'No se pudo actualizar el servicio en la base de datos.');
        }
      }
    } catch (err: any) {
      console.error('Error al guardar servicio:', err);
      showToast('error', `Error al procesar: ${err.message || 'Error del sistema'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar Estado Activo / Inactivo Directo desde la Grilla
  const handleToggleActive = async (srv: Service) => {
    try {
      const ok = await toggleServiceActive(srv.id, srv.active);
      if (ok) {
        showToast(
          'success',
          `Servicio "${srv.name}" ${!srv.active ? 'activado' : 'desactivado'} con éxito.`
        );
      }
    } catch (err) {
      showToast('error', 'Error al cambiar estado del servicio.');
    }
  };

  // Confirmar y Ejecutar Eliminación
  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
      setIsDeleting(true);
      const ok = await deleteService(serviceToDelete.id);
      if (ok) {
        showToast('success', `Servicio "${serviceToDelete.name}" eliminado correctamente.`);
        setServiceToDelete(null);
      } else {
        showToast('error', 'No se pudo eliminar el servicio de la base de datos.');
      }
    } catch (err) {
      showToast('error', 'Error al eliminar el servicio.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrado reactivo de servicios
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      // Filtro por texto
      const matchesText =
        srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (srv.description && srv.description.toLowerCase().includes(searchQuery.toLowerCase()));

      // Filtro por categoría
      const matchesCategory =
        selectedCategoryFilter === 'all' || srv.category === selectedCategoryFilter;

      // Filtro por estado
      const matchesStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'active' && srv.active) ||
        (selectedStatusFilter === 'inactive' && !srv.active);

      return matchesText && matchesCategory && matchesStatus;
    });
  }, [services, searchQuery, selectedCategoryFilter, selectedStatusFilter]);

  // Contadores para métricas superiores
  const stats = useMemo(() => {
    const total = services.length;
    const barberiaCount = services.filter((s) => s.category === 'barberia').length;
    const spaCount = services.filter((s) => s.category === 'spa').length;
    const activeCount = services.filter((s) => s.active).length;
    return { total, barberiaCount, spaCount, activeCount };
  }, [services]);

  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-[#141414] border border-amber-900/50 rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-serif-luxury font-bold text-white">Acceso Restringido</h2>
          <p className="text-sm text-neutral-400">
            La gestión del Catálogo de Servicios está habilitada exclusivamente para el rol de
            Administrador y Recepción.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* ========================================== */}
      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      {/* ========================================== */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300 transform translate-y-0">
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
              onClick={() => setToastMessage(null)}
              className="ml-2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* CABECERA PRINCIPAL */}
      {/* ========================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8A45C] to-[#997328] text-black flex items-center justify-center shadow-lg shadow-[#C8A45C]/20">
              <Scissors className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif-luxury font-bold text-white tracking-wide">
              Catálogo de Servicios
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 flex items-center gap-2">
            <span>Gestión integral de cartas de barbería, spa y duraciones inteligentes</span>
            <span className="inline-block w-1 h-1 rounded-full bg-[#C8A45C]" />
            <span className="text-[#C8A45C] font-medium capitalize">Rol: {currentRole}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#C8A45C] via-[#E2C37D] to-[#C8A45C] text-black font-bold text-xs sm:text-sm shadow-xl shadow-[#C8A45C]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nuevo Servicio</span>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* RESUMEN DE MÉTRICAS */}
      {/* ========================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#121212] border border-neutral-800/80 rounded-xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-neutral-800/60 flex items-center justify-center text-[#C8A45C]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-[11px] text-neutral-400 font-medium">Servicios Totales</div>
          </div>
        </div>

        <div className="bg-[#121212] border border-neutral-800/80 rounded-xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.barberiaCount}</div>
            <div className="text-[11px] text-neutral-400 font-medium">Línea Barbería</div>
          </div>
        </div>

        <div className="bg-[#121212] border border-neutral-800/80 rounded-xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.spaCount}</div>
            <div className="text-[11px] text-neutral-400 font-medium">Línea Spa</div>
          </div>
        </div>

        <div className="bg-[#121212] border border-neutral-800/80 rounded-xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#C8A45C]/10 flex items-center justify-center text-[#C8A45C]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-[#C8A45C]">{stats.activeCount}</div>
            <div className="text-[11px] text-neutral-400 font-medium">Servicios Activos</div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      {/* ========================================== */}
      <div className="bg-[#121212] border border-neutral-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Buscador de texto */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, tratamiento o palabra clave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtros por Categoría */}
        <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-neutral-700/70 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCategoryFilter === 'all'
                ? 'bg-[#C8A45C] text-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('barberia')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCategoryFilter === 'barberia'
                ? 'bg-blue-600 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Barbería
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('spa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCategoryFilter === 'spa'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Spa
          </button>
        </div>

        {/* Filtros por Estado */}
        <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-neutral-700/70 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedStatusFilter === 'all'
                ? 'bg-neutral-700 text-white shadow'
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
                ? 'bg-emerald-600/90 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedStatusFilter === 'inactive'
                ? 'bg-rose-900/80 text-rose-200 shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Inactivos
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* GRILLA DE SERVICIOS */}
      {/* ========================================== */}
      {filteredServices.length === 0 ? (
        <div className="bg-[#121212] border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
          <Scissors className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">No se encontraron servicios</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            {searchQuery
              ? `No hay coincidencias para la búsqueda "${searchQuery}". Intenta con otros términos.`
              : 'No hay servicios registrados en este filtro. Agrega uno nuevo con el botón superior.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C8A45C] text-black hover:brightness-110 cursor-pointer"
          >
            + Crear Primer Servicio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((srv) => {
            const formattedDuration = formatDurationSmart(srv.duration_minutes);
            const priceFormatted = (srv.price_cents / 100).toFixed(2);

            return (
              <div
                key={srv.id}
                className="group bg-[#121212] border border-neutral-800/90 hover:border-[#C8A45C]/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-[#C8A45C]/5"
              >
                {/* Imagen y Badges */}
                <div
                  onClick={() =>
                    openLightbox({
                      url: srv.image_url,
                      title: srv.name,
                      description: srv.description,
                      category: srv.category === 'barberia' ? 'Barbería' : 'Spa',
                      price: `S/ ${priceFormatted}`,
                      metadata: `${formattedDuration} (${srv.duration_minutes} min)`,
                    })
                  }
                  className="relative aspect-video w-full bg-neutral-900 overflow-hidden cursor-zoom-in group/img"
                  title="Clic para ampliar imagen"
                >
                  <img
                    src={srv.image_url}
                    alt={srv.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  {/* Indicador de Zoom al Hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 pointer-events-none">
                    <span className="px-3 py-1.5 rounded-xl bg-black/80 border border-[#C8A45C]/60 text-[#E6C875] text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Ver imagen</span>
                    </span>
                  </div>

                  {/* Badge de Categoría */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md shadow ${
                        srv.category === 'barberia'
                          ? 'bg-blue-500/80 text-white border border-blue-400/40'
                          : 'bg-emerald-500/80 text-white border border-emerald-400/40'
                      }`}
                    >
                      {srv.category === 'barberia' ? 'Barbería' : 'Spa'}
                    </span>

                    {/* Badge de Estado Activo/Inactivo */}
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md shadow flex items-center gap-1 ${
                        srv.active
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : 'bg-neutral-900/80 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          srv.active ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                        }`}
                      />
                      {srv.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Badge Inteligente de Duración */}
                  <div className="absolute top-3 right-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/75 text-neutral-200 border border-neutral-700/80 backdrop-blur-md flex items-center gap-1.5 shadow">
                      <Clock className="w-3 h-3 text-[#C8A45C]" />
                      <span>{formattedDuration}</span>
                    </span>
                  </div>

                  {/* Precio en Soles sobre la imagen */}
                  <div className="absolute bottom-3 right-3">
                    <div className="px-3 py-1 rounded-xl bg-black/85 border border-[#C8A45C]/40 backdrop-blur-md shadow flex items-baseline gap-1">
                      <span className="text-[10px] text-[#C8A45C] font-semibold">S/</span>
                      <span className="text-base font-bold text-white tracking-tight">
                        {priceFormatted}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contenido de la Tarjeta */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-serif-luxury font-bold text-base text-white group-hover:text-[#C8A45C] transition-colors leading-snug">
                      {srv.name}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {srv.description || 'Sin descripción especificada.'}
                    </p>
                  </div>

                  {/* Fila de Datos Secundarios y Duración Exacta */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{srv.duration_minutes} min estándar</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      Cap: {srv.capacity || 1}
                    </span>
                  </div>

                  {/* Acciones de Edición, Toggle y Eliminación */}
                  <div className="flex items-center gap-2 pt-1">
                    {/* Botón Alternar Estado */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(srv)}
                      title={srv.active ? 'Desactivar del catálogo' : 'Activar en el catálogo'}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        srv.active
                          ? 'bg-neutral-800/60 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                          : 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50'
                      }`}
                    >
                      {srv.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{srv.active ? 'Ocultar' : 'Activar'}</span>
                    </button>

                    {/* Botón Editar */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(srv)}
                      title="Editar servicio"
                      className="p-2 rounded-xl bg-[#1A1A1A] border border-neutral-700/70 hover:border-[#C8A45C] text-neutral-300 hover:text-[#C8A45C] transition-all cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Botón Eliminar (Admin y Recepcionista con confirmación) */}
                    <button
                      type="button"
                      onClick={() => setServiceToDelete(srv)}
                      title="Eliminar servicio"
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

      {/* ========================================== */}
      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-[#121212] border border-[#C8A45C]/40 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header del Modal */}
            <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[#181818] to-[#121212]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C8A45C] text-black flex items-center justify-center shadow">
                  {modalMode === 'create' ? <Plus className="w-5 h-5" /> : <Edit2 className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-serif-luxury font-bold text-white">
                    {modalMode === 'create' ? 'Nuevo Servicio' : 'Editar Servicio'}
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Configuración de parámetros, tarifas en Soles y duraciones prolongadas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Formulario con scroll */}
            <form onSubmit={handleSubmitService} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* 1. Selector de Categoría [ Barbería ] / [ Spa ] */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Categoría del Negocio <span className="text-[#C8A45C]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormCategory('barberia');
                      setFormSelectedTemplate('manual');
                    }}
                    className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formCategory === 'barberia'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Scissors className="w-4 h-4" />
                    <span>Barbería</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormCategory('spa');
                      setFormSelectedTemplate('manual');
                    }}
                    className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formCategory === 'spa'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                        : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Spa</span>
                  </button>
                </div>
              </div>

              {/* 2. Selector de Plantillas Predefinidas o Redacción Manual */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300">
                    Autocompletado Rápido o Redacción Libre
                  </label>
                  <span className="text-[11px] text-neutral-500">Opcional</span>
                </div>
                <select
                  value={formSelectedTemplate}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#C8A45C] transition-colors"
                >
                  <option value="manual">Personalizado / Redacción Manual</option>
                  <optgroup label="Plantillas Disponibles">
                    {PREDEFINED_TEMPLATES.filter((t) => t.category === formCategory).map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.durationValue} {t.durationUnit} - S/ {t.priceSoles.toFixed(2)})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* 3. Nombre y Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Título / Nombre del Servicio <span className="text-[#C8A45C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Corte Fade Platinum / Terapia Spa 2 Días"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (modalMode === 'create') {
                        setFormSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
                      }
                    }}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-400 block">
                    Identificador (Slug)
                  </label>
                  <input
                    type="text"
                    placeholder="corte-fade-platinum"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-neutral-300 font-mono focus:outline-none focus:border-[#C8A45C] transition-colors"
                  />
                </div>
              </div>

              {/* 4. Descripción */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="service-form-description" className="text-xs font-semibold text-neutral-300 block">
                    Descripción Detallada
                  </label>
                  <span className="text-[10px] text-neutral-500 font-normal">Opcional</span>
                </div>
                <textarea
                  id="service-form-description"
                  rows={2}
                  placeholder="Describe los beneficios, pasos del procedimiento y productos utilizados (opcional)..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#C8A45C] transition-colors resize-none"
                />
              </div>

              {/* 5. Precio en Soles (S/) y Duración Inteligente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#181818]/60 p-4 rounded-2xl border border-neutral-800">
                {/* Precio en Soles */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>Precio en Soles (S/) <span className="text-[#C8A45C]">*</span></span>
                    <span className="text-[10px] text-neutral-400">En BD: centavos</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C8A45C]">
                      S/
                    </span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      required
                      placeholder="35.00"
                      value={formPriceSoles}
                      onChange={(e) => setFormPriceSoles(e.target.value)}
                      className="w-full bg-[#141414] border border-neutral-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#C8A45C] transition-colors"
                    />
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Equivalente en centavos: <span className="text-white font-mono">{Math.round((parseFloat(formPriceSoles) || 0) * 100)} cents</span>
                  </div>
                </div>

                {/* Duración Inteligente con Unidad */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Duración del Tratamiento <span className="text-[#C8A45C]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      required
                      value={formDurationValue}
                      onChange={(e) => setFormDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 bg-[#141414] border border-neutral-700/80 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-white text-center focus:outline-none focus:border-[#C8A45C] transition-colors"
                    />
                    <select
                      value={formDurationUnit}
                      onChange={(e) => setFormDurationUnit(e.target.value as DurationUnit)}
                      className="flex-1 bg-[#141414] border border-neutral-700/80 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-[#C8A45C] transition-colors"
                    >
                      <option value="minutos">Minutos</option>
                      <option value="horas">Horas</option>
                      <option value="dias">Días</option>
                      <option value="semanas">Semanas</option>
                    </select>
                  </div>

                  {/* Vista previa inteligente */}
                  <div className="p-2 rounded-lg bg-black/40 border border-neutral-800 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">En base de datos:</span>
                    <span className="text-[#C8A45C] font-mono font-bold">
                      {computedDurationMinutes} min ({computedSmartPreview})
                    </span>
                  </div>
                </div>
              </div>

              {/* 6. Carga y Optimización de Imágenes con WebP */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-[#C8A45C]" />
                    <span>Foto del Servicio (Conversión a WebP)</span>
                  </label>
                  {imageCompressionInfo && (
                    <span className="text-[11px] text-emerald-400 font-medium">
                      ✓ {imageCompressionInfo}
                    </span>
                  )}
                </div>

                {/* Zona Drag and Drop */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
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
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Vista Previa */}
                  <div
                    onClick={(e) => {
                      if (formImageUrl) {
                        e.stopPropagation();
                        openLightbox({
                          url: formImageUrl,
                          title: formName || 'Vista Previa del Servicio',
                          description: formDescription,
                          category: formCategory === 'barberia' ? 'Barbería' : 'Spa',
                          price: formPriceSoles ? `S/ ${formPriceSoles}` : undefined,
                          metadata: `${computedSmartPreview} (${computedDurationMinutes} min)`,
                        });
                      }
                    }}
                    className={`w-24 h-20 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center relative ${
                      formImageUrl ? 'cursor-zoom-in hover:border-[#C8A45C]' : ''
                    }`}
                    title={formImageUrl ? 'Clic para ampliar vista previa' : undefined}
                  >
                    {formImageUrl ? (
                      <img
                        src={formImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
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
                      {uploadingImage
                        ? 'Procesando y subiendo WebP...'
                        : 'Haz clic o arrastra una imagen aquí'}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Se comprime automáticamente en frontend a formato WebP optimizado y se guarda en el bucket <code className="text-[#C8A45C]">services-images</code>.
                    </p>
                  </div>
                </div>

                {/* Input opcional directo para URL */}
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500">O ingresa una URL directa:</span>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-300 font-mono focus:outline-none focus:border-[#C8A45C]"
                  />
                </div>
              </div>

              {/* 7. Estado Público y Activo */}
              <div className="p-3.5 bg-[#181818] rounded-xl border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Estado Activo / Público</div>
                  <div className="text-[11px] text-neutral-400">
                    Visible en el flujo de reservas y en el catálogo público
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

              {/* Botones del Footer del Modal */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingImage}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#C8A45C] to-[#A5823E] text-black shadow-lg shadow-[#C8A45C]/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Guardando en Base de Datos...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>{modalMode === 'create' ? 'Guardar Servicio' : 'Actualizar Servicio'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {/* ========================================== */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Eliminar Servicio</h3>
                <p className="text-xs text-neutral-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente el servicio{' '}
              <strong className="text-white">"{serviceToDelete.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
