import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  UserRole,
  Service,
  Product,
  ProductUseType,
  WardrobeItem,
  Employee,
  EmployeeBlock,
  Booking,
  PaymentLog,
  VentaMostrador,
  Expense,
  EmployeeAttendance,
  PaymentSettings,
  BonusSettings,
  AttendanceSettings,
  CartItem,
  WardrobeStatus,
  DressRental,
  DressRentalStatus,
  DressRentalOrigin,
  LightboxData,
  PaymentStatus,
  getBookingCollectedAmountCents,
} from '../types';
import {
  INITIAL_PAYMENT_SETTINGS,
  INITIAL_BONUS_SETTINGS,
  INITIAL_ATTENDANCE_SETTINGS,
  getTodayDateString,
  getLimaDateFromTimestamp,
} from '../data/initialData';
import { DEFAULT_WHATSAPP_PHONE, advancePercentage, whatsappPhone, reconcileCart, readStoredCart, saveCart } from '../lib/businessRules';
import { qaRpc, mapBooking } from '../lib/qaApi';
import { sanitizePhone, sanitizeDni } from '../lib/validators';
import { supabase } from '../lib/supabase/client';
import { timeToMinutes, minutesToTime } from '../lib/bookingAvailability';

interface AppContextType {
  // Navigation & Role
  currentRole: UserRole;
  isAuthLoading: boolean;
  isDataLoading: boolean;
  isLoading: boolean;
  activeView: string;
  setActiveView: (view: string) => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: UserRole;
    phone?: string;
    dni?: string;
  };
  signOut: () => Promise<void>;

  // Data Collections
  services: Service[];
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  wardrobe: WardrobeItem[];
  dressRentals: DressRental[];
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  employeeBlocks: EmployeeBlock[];
  setEmployeeBlocks: React.Dispatch<React.SetStateAction<EmployeeBlock[]>>;
  bookings: Booking[];
  paymentLogs: PaymentLog[];
  ventasMostrador: VentaMostrador[];
  expenses: Expense[];
  attendance: EmployeeAttendance[];
  attendanceRecords: EmployeeAttendance[];
  paymentSettings: PaymentSettings;
  bonusSettings: BonusSettings;
  attendanceSettings: AttendanceSettings;

  // Cart
  cart: CartItem[];
  whatsappNumber: string;
  revalidateCart: () => Promise<boolean>;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Thermal Ticket State
  activeTicket: { type: 'booking' | 'venta'; data: Booking | VentaMostrador } | null;
  openTicketModal: (type: 'booking' | 'venta' | 'pos', data: Booking | VentaMostrador) => void;
  closeTicketModal: () => void;

  // Image Lightbox State
  lightboxImage: LightboxData | null;
  openLightbox: (data: LightboxData) => void;
  closeLightbox: () => void;

  // Realtime Simulation / Supabase Realtime
  realtimeConnected: boolean;
  pulseRealtime: () => void;
  lastSyncTimestamp: Date;
  refreshData: () => Promise<void>;

  // Business Action Handlers
  // QA-002: addBooking es ahora async y retorna Promise<Booking | null>.
  // null indica que el INSERT falló y NO se debe mostrar éxito al usuario.
  addBooking: (booking: Omit<Booking, 'id' | 'code' | 'created_at'>) => Promise<Booking | null>;
  registerBookingPayment: (
    bookingId: string,
    amountCents: number,
    method: 'yape' | 'efectivo' | 'transferencia' | 'mixto' | string,
    cashCents?: number,
    yapeCents?: number,
    voucherUrl?: string,
    notes?: string
  ) => Promise<boolean>;
  voidPayment: (paymentId: string, reason: string) => Promise<boolean>;
  liberateServiceEarly: (bookingId: string, serviceIndex: number) => void;
  reassignBookingService: (bookingId: string, serviceIndex: number, newEmployeeId: string, newEmployeeName: string) => Promise<void>;
  updateBookingServicePrice: (bookingId: string, serviceIndex: number, newPriceCents: number) => Promise<void>;
  deleteBooking: (bookingId: string) => Promise<boolean>;
  editBooking: (bookingId: string, updates: Partial<Booking>) => Promise<boolean>;

  // POS
  processPosSaleWithStock: (
    saleData: Omit<VentaMostrador, 'id' | 'ticket_number' | 'created_at'> & { created_at?: string },
    items: Array<{ product_id?: string; product_name: string; quantity: number; unit_price: number; total: number }>
  ) => Promise<{ success: boolean; ticket_number: string; sales: VentaMostrador[] }>;
  deleteVentaMostrador: (id: string) => Promise<boolean>;

  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'created_at' | 'voided'>) => void;
  voidExpense: (expenseId: string, reason: string) => void;

  // Employees & Attendance
  addEmployee: (emp: Omit<Employee, 'id' | 'qr_code_uuid'> & { skills?: string[] }) => Promise<Employee | null>;
  updateEmployee: (emp: Employee) => Promise<boolean>;
  deleteEmployee: (empId: string) => Promise<boolean>;
  toggleEmployeeActive: (empId: string) => void;
  addEmployeeLeave: (leave: {
    employee_id: string;
    leave_type: string;
    reason: string;
    start_date: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    is_full_day: boolean;
    document_url?: string;
  }) => Promise<boolean>;
  deleteEmployeeBlock: (blockId: string) => Promise<boolean>;
  scanAttendanceQR: (qrCode: string) => {
    success: boolean;
    message: string;
    employee?: Employee;
    type?: 'check_in' | 'check_out';
    record?: EmployeeAttendance;
    punctuality?: 'puntual' | 'tardanza' | 'horas_extra';
    minutes?: number;
    requiresExitModal?: boolean;
  };
  resolveEmployeeFromCode: (rawCode: string) => Employee | undefined;
  registerAttendanceExit: (params: {
    employeeId: string;
    attendanceId: string;
    exitType: 'definitiva' | 'emergencia';
    exitReason?: string;
  }) => Promise<{
    success: boolean;
    message: string;
    overtimeMinutes: number;
    workedMinutes: number;
    workedDisplay: string;
    record?: EmployeeAttendance;
  }>;
  registerAttendancePunch: (employeeId: string, punchType: 'check_in' | 'check_out') => void;
  manualAdjustBonus: (attendanceId: string, newBonusMinutes: number, reason: string) => void;
  submitJustification: (attendanceId: string, note: string, docUrl?: string) => void;

  // Settings
  updatePaymentSettings: (settings: Partial<PaymentSettings>) => Promise<boolean>;
  updateBonusSettings: (settings: Partial<BonusSettings>) => void;
  updateAttendanceSettings: (settings: Partial<AttendanceSettings>) => Promise<boolean>;

  // Catalog CRUD
  addService: (srv: Omit<Service, 'id'>) => Promise<boolean>;
  updateService: (srv: Service) => Promise<boolean>;
  deleteService: (serviceId: string) => Promise<boolean>;
  toggleServiceActive: (serviceId: string, currentActive: boolean) => Promise<boolean>;
  addProduct: (prod: Omit<Product, 'id'>) => Promise<boolean>;
  updateProduct: (prod: Product) => Promise<boolean>;
  deleteProduct: (productId: string) => Promise<boolean>;
  addWardrobeItem: (item: Omit<WardrobeItem, 'id'>) => Promise<boolean>;
  updateWardrobeItem: (item: WardrobeItem) => Promise<boolean>;
  deleteWardrobeItem: (id: string) => Promise<boolean>;
  toggleWardrobeActive: (id: string, currentActive: boolean) => Promise<boolean>;
  updateWardrobeStatus: (id: string, status: WardrobeStatus) => void;
  addDressRental: (data: Omit<DressRental, 'id' | 'ticket_code' | 'created_at' | 'updated_at'>) => Promise<DressRental | null>;
  validateYapeVoucher: (rentalId: string, approved: boolean, reason?: string) => Promise<boolean>;
  confirmDressDelivery: (rentalId: string, balanceCollectedCents: number, guaranteeCollectedCents: number) => Promise<boolean>;
  processDressReturn: (rentalId: string, guaranteeReturnedCents: number, penaltyReason?: string) => Promise<boolean>;
  cancelDressRental: (rentalId: string, reason?: string) => Promise<boolean>;
  deleteDressRental: (rentalId: string) => Promise<boolean>;

  // KPI Calculations
  kpis: {
    totalIngresosCents: number;
    ingresosServiciosCents: number;
    ventasMostradorCents: number;
    totalEgresosCents: number;
    balanceNetoCents: number;
    citasHoyCount: number;
    citasConfirmadasCount: number;
    saldosPorCobrarCents: number;
  };
}

const getCachedRole = (): UserRole => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('acicalados_cached_role');
      if (
        cached === 'admin' ||
        cached === 'recepcionista' ||
        cached === 'empleado' ||
        cached === 'cliente'
      ) {
        return cached as UserRole;
      }
    } catch {}
  }
  return 'anon';
};

const getCachedUser = () => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('acicalados_cached_user');
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return null;
};

const getInitialView = (): string => {
  if (typeof window !== 'undefined' && window.location && window.location.pathname) {
    let path = window.location.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const cachedRole = getCachedRole();
    const cachedUser = getCachedUser();
    const isVestuarioAdmin =
      cachedRole === 'VESTUARIO_ADMIN' ||
      cachedUser?.role === 'VESTUARIO_ADMIN' ||
      cachedUser?.email?.toLowerCase() === 'vepeja4602@bullbaby.com';

    if (isVestuarioAdmin && path.startsWith('/dashboard') && path !== '/dashboard/vestuario') {
      return '/dashboard/vestuario';
    }

    if (
      path === '/auth/login' ||
      path === '/auth/callback' ||
      path.startsWith('/dashboard') ||
      path === '/mi-cuenta' ||
      path === '/servicios' ||
      path === '/reservar' ||
      path === '/tienda' ||
      path === '/productos' ||
      path === '/vestuario' ||
      path === '/ubicacion'
    ) {
      return path;
    }
  }
  return '/';
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [currentRole, setCurrentRoleState] = useState<UserRole>(getCachedRole);
  const [activeViewState, setActiveViewState] = useState<string>(getInitialView);
  const [currentUserOverride, setCurrentUserOverride] = useState<{
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: UserRole;
    phone?: string;
    dni?: string;
  } | null>(getCachedUser);

  const activeView = activeViewState;
  const setActiveView = useCallback((view: string) => {
    const isVestuarioAdmin =
      currentRole === 'VESTUARIO_ADMIN' ||
      currentUserOverride?.role === 'VESTUARIO_ADMIN' ||
      currentUserOverride?.email?.toLowerCase() === 'vepeja4602@bullbaby.com';

    let targetView = view;
    if (isVestuarioAdmin && targetView.startsWith('/dashboard') && targetView !== '/dashboard/vestuario') {
      targetView = '/dashboard/vestuario';
    }

    setActiveViewState(targetView);
    if (typeof window !== 'undefined' && window.location.pathname !== targetView) {
      window.history.pushState(null, '', targetView);
    }
  }, [currentRole, currentUserOverride]);

  // Sincronizar navegación con el historial del navegador
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        let path = window.location.pathname || '/';
        const isVestuarioAdmin =
          currentRole === 'VESTUARIO_ADMIN' ||
          currentUserOverride?.role === 'VESTUARIO_ADMIN' ||
          currentUserOverride?.email?.toLowerCase() === 'vepeja4602@bullbaby.com';

        if (isVestuarioAdmin && path.startsWith('/dashboard') && path !== '/dashboard/vestuario') {
          path = '/dashboard/vestuario';
          window.history.replaceState(null, '', path);
        }
        setActiveViewState(path);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentRole, currentUserOverride]);

  // Protección de rutas: redirigir a clientes y no autenticados fuera de /dashboard SOLO cuando la autenticación no esté cargando
  useEffect(() => {
    if (isAuthLoading) return;

    if (
      activeViewState.startsWith('/dashboard') &&
      (currentRole === 'cliente' || currentRole === 'anonimo' || currentRole === 'anon')
    ) {
      setActiveView('/mi-cuenta');
      return;
    }

    // Protección estricta para VESTUARIO_ADMIN: único acceso permitido dentro del dashboard es /dashboard/vestuario
    const isVestuarioAdmin =
      currentRole === 'VESTUARIO_ADMIN' ||
      currentUserOverride?.role === 'VESTUARIO_ADMIN' ||
      currentUserOverride?.email?.toLowerCase() === 'vepeja4602@bullbaby.com';

    if (
      isVestuarioAdmin &&
      activeViewState.startsWith('/dashboard') &&
      activeViewState !== '/dashboard/vestuario'
    ) {
      setActiveView('/dashboard/vestuario');
    }
  }, [activeViewState, currentRole, currentUserOverride, isAuthLoading, setActiveView]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [dressRentals, setDressRentals] = useState<DressRental[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeBlocks, setEmployeeBlocks] = useState<EmployeeBlock[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [ventasMostrador, setVentasMostrador] = useState<VentaMostrador[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(INITIAL_PAYMENT_SETTINGS);
  const [bonusSettings, setBonusSettings] = useState<BonusSettings>(INITIAL_BONUS_SETTINGS);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>(INITIAL_ATTENDANCE_SETTINGS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(() => whatsappPhone(import.meta.env.VITE_WHATSAPP_PHONE) || DEFAULT_WHATSAPP_PHONE);
  const [operationError, setOperationError] = useState<string | null>(null);
  const cartRestored = useRef(false);
  const requests = useRef(new Map<string, string>());
  const pendingOperations = useRef(new Set<string>());
  const requestId = (key: string) => {
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    return requests.current.get(key)!;
  };
  useEffect(() => {
    if (!catalogLoaded) return;
    setCart(prev => reconcileCart(cartRestored.current ? prev : readStoredCart(), products));
    cartRestored.current = true;
  }, [products, catalogLoaded]);
  useEffect(() => { if (catalogLoaded && cartRestored.current) saveCart(cart); }, [cart]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeTicket, setActiveTicket] = useState<{ type: 'booking' | 'venta'; data: Booking | VentaMostrador } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<LightboxData | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(true);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<Date>(new Date());

  // --- CARGA INICIAL DESDE SUPABASE ---
  const fetchAllFromSupabase = useCallback(async () => {
    try {
      // 1. Servicios
      const { data: dbServices } = await supabase.from('services').select('*').order('sort_order');
      if (dbServices) {
        setServices(
          dbServices.map((s: any) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            category: s.type as 'barberia' | 'spa',
            price_cents: s.price_cents,
            duration_minutes: s.duration_minutes,
            capacity: s.capacity,
            active: s.is_active,
            image_url: s.images && s.images.length > 0 ? s.images[0] : 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
            description: s.description || '',
          }))
        );
      }

      // 2. Productos (Carga únicamente productos activos en el catálogo)
      const { data: dbProducts } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (dbProducts) {
        setCatalogLoaded(true);
        setProducts(
          dbProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: (p.category || 'ceras_pomadas') as any,
            price_cents: p.price_cents,
            stock: p.stock ?? 0,
            min_stock: p.min_stock ?? 5,
            barcode: p.barcode || undefined,
            unit_measure: p.unit_measure || 'unidad',
            use_type: (p.use_type as ProductUseType) || 'venta',
            image_url: p.images && p.images.length > 0 ? p.images[0] : 'https://images.unsplash.com/photo-1585232351009-aa87416fca90?auto=format&fit=crop&w=600&q=80',
            description: p.description || '',
            active: p.is_active !== undefined ? p.is_active : true,
          }))
        );
      }

      // 3. Vestuario
      const { data: dbWardrobe } = await supabase.from('wardrobe_items').select('*').order('code');
      if (dbWardrobe) {
        setWardrobe(
          dbWardrobe.map((w: any) => ({
            id: w.id,
            code: (w.code || 'A').toUpperCase().trim(),
            name: w.name,
            category: w.category || 'Bodas y Matrimonio',
            rental_price_cents: w.price_cents,
            deposit_cents: w.deposit_cents || 0,
            status: (w.availability_status === 'en_mantenimiento' ? 'mantenimiento' : w.availability_status || 'disponible') as WardrobeStatus,
            active: w.is_active !== undefined ? w.is_active : true,
            size: w.size || 'M',
            color: w.color || 'Variado',
            image_url: w.images && w.images.length > 0 ? w.images[0] : 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80',
            description: w.description || '',
          }))
        );
      }

      // 3.1 Alquileres y Reservas de Vestuario (dress_rentals)
      const { data: dbRentals } = await (supabase as any)
        .from('dress_rentals')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbRentals) {
        setDressRentals(
          dbRentals.map((r: any) => ({
            id: r.id,
            ticket_code: r.ticket_code,
            origin: (r.origin || 'local') as DressRentalOrigin,
            wardrobe_item_id: r.wardrobe_item_id,
            item_code: r.item_code,
            item_name: r.item_name,
            item_size: r.item_size || 'M',
            item_color: r.item_color || 'Variado',
            client_first_name: r.client_first_name,
            client_last_name: r.client_last_name,
            client_dni: r.client_dni,
            client_phone: r.client_phone,
            event_name: r.event_name,
            destination: r.destination,
            event_date: r.event_date,
            return_date: r.return_date,
            status: (r.status || 'reservado') as DressRentalStatus,
            rental_price_cents: r.rental_price_cents || 0,
            advance_cents: r.advance_cents || 0,
            pending_cents: r.pending_cents || 0,
            guarantee_cents: r.guarantee_cents || 0,
            guarantee_returned_cents: r.guarantee_returned_cents,
            penalty_cents: r.penalty_cents || 0,
            penalty_reason: r.penalty_reason,
            is_immediate_delivery: r.is_immediate_delivery === true,
            delivery_date: r.delivery_date,
            actual_return_date: r.actual_return_date,
            voucher_url: r.voucher_url,
            voucher_declared_amount_cents: r.voucher_declared_amount_cents,
            rejection_reason: r.rejection_reason,
            notes: r.notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
          }))
        );
      }

      // 4. Empleados y Habilidades
      const { data: dbEmployees } = await supabase
        .from('employees')
        .select('*, employee_skills(service_id)')
        .order('rotation_order');
      
      const empMap = new Map<string, string>();
      if (dbEmployees) {
        dbEmployees.forEach((e: any) => {
          empMap.set(e.id, `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.first_name || 'Colaborador');
        });
        setEmployees(
          dbEmployees.map((e: any) => ({
            id: e.id,
            first_name: e.first_name || '',
            last_name: e.last_name || '',
            full_name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.first_name || 'Colaborador',
            type: e.type,
            skills: e.employee_skills ? e.employee_skills.map((sk: any) => sk.service_id) : [],
            active: e.is_active,
            avatar: e.foto_url || e.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
            avatar_url: e.foto_url || e.avatar_url,
            foto_url: e.foto_url || e.avatar_url,
            phone: sanitizePhone(e.phone) || '987654321',
            email: e.email || '',
            dni: sanitizeDni(e.dni) || '',
            handles_reception: e.handles_reception || false,
            shift_start: e.shift_start || '09:00',
            shift_end: e.shift_end || '18:00',
            commission_percentage: e.commission_percentage || 40,
            qr_code_uuid: e.id,
            qr_code: e.qr_code || `ACICALADOS-EMP-${e.id}-${e.dni || 'PASS'}`,
            rotation_order: e.rotation_order,
          }))
        );
      }

      // 4.1 Bloqueos y permisos de colaboradores
      const { data: dbBlocks } = await supabase
        .from('employee_blocks')
        .select('*')
        .order('block_date', { ascending: false });
      if (dbBlocks) {
        setEmployeeBlocks(
          dbBlocks.map((b: any) => ({
            id: b.id,
            employee_id: b.employee_id,
            employee_name: empMap.get(b.employee_id) || 'Colaborador',
            date: b.block_date,
            block_date: b.block_date,
            start_date: b.block_date,
            end_date: b.end_date || b.block_date,
            start_time: b.start_time?.substring(0, 5) || '00:00',
            end_time: b.end_time?.substring(0, 5) || '23:59',
            reason: b.reason || '',
            leave_type: b.leave_type || 'Otro Motivo',
            document_url: b.document_url || '',
            is_full_day: b.is_full_day ?? true,
            status: b.status || 'aprobado',
            created_at: b.created_at,
          }))
        );
      }

      // Public RPC exposes only customer-facing configuration, without broadening table RLS.
      const { data: dbConfig } = await (supabase as any).rpc('qa_public_config');
      if (dbConfig) {
        setWhatsappNumber(whatsappPhone(dbConfig.whatsapp_url) || whatsappPhone(import.meta.env.VITE_WHATSAPP_PHONE) || DEFAULT_WHATSAPP_PHONE);
        setPaymentSettings(prev => ({ ...prev, advance_percentage: advancePercentage(dbConfig.advance_percentage),
          yape_phone: dbConfig.yape_phone || prev.yape_phone, yape_holder: dbConfig.yape_holder || prev.yape_holder,
          yape_qr_url: dbConfig.yape_qr_url || prev.yape_qr_url }));
      }

      // 6. Reservas
      let bookingsQuery = supabase
        .from('bookings')
        .select('*, booking_services(*)')
        .order('created_at', { ascending: false });

      const { data: sessionData } = await supabase.auth.getSession();
      const currentAuthUser = sessionData?.session?.user;

      const cachedRole = getCachedRole();
      let effectiveRole: string = currentRole || cachedRole;

      if (currentAuthUser) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentAuthUser.id)
          .maybeSingle();
        const role = userProfile?.role || 'cliente';
        effectiveRole = role;
        if (role === 'VESTUARIO_ADMIN') {
          // VESTUARIO_ADMIN no tiene acceso a reservas generales de barbería/spa
          bookingsQuery = bookingsQuery.eq('user_id', '00000000-0000-0000-0000-000000000000');
        } else if (role === 'cliente') {
          if (currentAuthUser.email) {
            bookingsQuery = bookingsQuery.or(`user_id.eq.${currentAuthUser.id},client_email.eq.${currentAuthUser.email}`);
          } else {
            bookingsQuery = bookingsQuery.eq('user_id', currentAuthUser.id);
          }
        }
      } else {
        if (effectiveRole !== 'admin' && effectiveRole !== 'recepcionista') {
          // Usuario no autenticado que no es personal: no exponer reservas ajenas
          bookingsQuery = bookingsQuery.eq('user_id', '00000000-0000-0000-0000-000000000000');
        }
      }

      // Restricción estricta de seguridad para Recepcionista: Solo consultar reservas del día de Hoy
      if (effectiveRole === 'recepcionista') {
        const todayStr = getTodayDateString();
        bookingsQuery = bookingsQuery.eq('booking_date', todayStr);
      }

      const { data: dbBookings, error: bookingsError } = await bookingsQuery;
      if (!bookingsError && dbBookings) {
        setBookings(
          dbBookings.map((b: any) => ({
            id: b.id,
            code: b.booking_code,
            client_name: `${b.client_first_name} ${b.client_last_name}`.trim(),
            client_phone: sanitizePhone(b.client_phone) || '',
            client_email: b.client_email || '',
            client_dni: sanitizeDni(b.client_dni) || '',
            date: b.booking_date,
            start_time: b.start_time?.substring(0, 5) || '10:00',
            end_time: b.end_time?.substring(0, 5) || '11:00',
            type: b.service_type as any,
            services: b.booking_services ? b.booking_services.map((bs: any) => {
              const assignedEmpId = bs.assigned_employee_id || b.assigned_employee_id || '';
              const assignedEmpName = empMap.get(assignedEmpId) || 'Especialista';
              const srvStart = (bs.hora_inicio || bs.start_time || b.start_time)?.substring(0, 5) || '10:00';
              const srvDuration = bs.duration_minutes || 30;
              const calcEnd = minutesToTime(timeToMinutes(srvStart) + srvDuration);
              const rawEnd = (bs.hora_fin || bs.end_time)?.substring(0, 5) || calcEnd;
              // Si el fin guardado excede la duración del servicio (arrastró fin global de la reserva), usar duración real
              const effectiveEnd = (timeToMinutes(rawEnd) - timeToMinutes(srvStart) > srvDuration + 5) ? calcEnd : rawEnd;
              return {
                id: bs.id,
                service_id: bs.service_id || '',
                service_name: bs.service_name,
                employee_id: assignedEmpId,
                employee_name: assignedEmpName,
                price_cents: bs.service_price_cents,
                duration_minutes: srvDuration,
                hora_inicio: srvStart,
                hora_fin: effectiveEnd,
                start_time: srvStart,
                end_time: effectiveEnd,
                liberado_at: bs.liberado_at || undefined,
              };
            }) : [],
            total_price_cents: b.total_price_cents,
            advance_amount_cents: b.advance_amount_cents || 0,
            balance_cents: b.balance_cents != null ? b.balance_cents : Math.max(0, (b.total_price_cents || 0) - (b.advance_amount_cents || 0)),
            payment_status: b.payment_status as any,
            created_at: b.created_at,
            confirmed_at: b.confirmed_at || undefined,
            completed_at: b.completed_at || undefined,
            cancelled_at: b.cancelled_at || undefined,
            expired_at: b.expired_at || undefined,
            status: b.cancelled_at
              ? 'cancelada'
              : b.expired_at
              ? 'expirada'
              : b.completed_at
              ? 'completada'
              : b.confirmed_at
              ? 'confirmada'
              : 'pendiente',
          }))
        );
      }

      // 7. Pagos
      const { data: dbPayments } = await supabase
        .from('payment_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbPayments) {
        setPaymentLogs(
          dbPayments.map((p: any) => ({
            id: p.id,
            booking_id: p.booking_id || '',
            booking_code: 'AC-PAGO',
            amount_cents: p.amount_cents || 0,
            payment_method: (p.payment_method === 'cash' ? 'efectivo' : p.payment_method) as any,
            cash_cents: p.cash_amount_cents || 0,
            yape_cents: p.yape_amount_cents || 0,
            voucher_url: p.proof_url || undefined,
            created_at: p.created_at,
            status: p.status,
            voided: p.status === 'voided',
            voided_reason: p.void_reason || undefined,
            voided_by: p.voided_by || undefined,
          }))
        );
      }

      // 8. Ventas de Mostrador (Exclusivo para admin y recepcionista; denegado para VESTUARIO_ADMIN y clientes)
      if (effectiveRole === 'admin' || effectiveRole === 'recepcionista') {
        let ventasQuery = supabase
          .from('ventas_mostrador')
          .select('*')
          .order('fecha', { ascending: false });

        // Restricción para Recepcionista: Solo consultar ventas del día de Hoy (00:00:00 a 23:59:59 America/Lima)
        if (effectiveRole === 'recepcionista') {
          const todayStr = getTodayDateString();
          const startOfDay = `${todayStr}T00:00:00-05:00`;
          const endOfDay = `${todayStr}T23:59:59.999-05:00`;
          ventasQuery = ventasQuery.gte('fecha', startOfDay).lte('fecha', endOfDay);
        }

        const { data: dbVentas, error: dbVentasErr } = await ventasQuery;
        if (!dbVentasErr && dbVentas) {
          setVentasMostrador(
            dbVentas.map((v: any) => {
              const isMixto = v.metodo_pago?.toLowerCase() === 'mixto';
              const mEfectivo = v.monto_efectivo != null ? Number(v.monto_efectivo) : undefined;
              const mYape = v.monto_yape != null ? Number(v.monto_yape) : undefined;
              const mTransf = v.monto_transferencia != null ? Number(v.monto_transferencia) : undefined;
              return {
                id: v.id,
                ticket_number: v.ticket_number || `TK-${v.id.substring(0, 5).toUpperCase()}`,
                client_name: v.cliente_nombre,
                product_name: v.producto_nombre,
                quantity: v.cantidad,
                unit_price_cents: Math.round(Number(v.precio_unitario) * 100),
                total_price_cents: Math.round(Number(v.total) * 100),
                subtotal: v.subtotal != null ? Number(v.subtotal) : undefined,
                subtotal_cents: v.subtotal != null ? Math.round(Number(v.subtotal) * 100) : undefined,
                monto_descuento: v.monto_descuento != null ? Number(v.monto_descuento) : 0,
                discount_cents: v.monto_descuento != null ? Math.round(Number(v.monto_descuento) * 100) : 0,
                detalles_items: v.detalles_items || undefined,
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
            })
          );
        }
      }

      // 9. Egresos (Exclusivo para admin y recepcionista; denegado para VESTUARIO_ADMIN)
      if (effectiveRole === 'admin' || effectiveRole === 'recepcionista') {
        const { data: dbExpenses } = await supabase
          .from('expenses')
          .select('*')
          .order('expense_date', { ascending: false });
        if (dbExpenses) {
          setExpenses(
            dbExpenses.map((e: any) => ({
              id: e.id,
              description: e.description,
              category: e.category,
              amount_cents: e.amount_cents,
              payment_method: e.payment_method === 'cash' ? 'efectivo' : e.payment_method,
              beneficiary: e.supplier || '',
              voucher_url: e.receipt_url || undefined,
              date: e.expense_date,
              voided: e.status === 'voided',
              voided_reason: e.void_reason || undefined,
              voided_by: e.voided_by || undefined,
              created_at: e.created_at || e.expense_date,
            }))
          );
        }
      }

      // 10. Configuración de Asistencia & 11. Registros de Asistencia (Solo admin, recepcionista, empleado)
      if (effectiveRole === 'admin' || effectiveRole === 'recepcionista' || effectiveRole === 'empleado') {
        const { data: dbAttSettings } = await supabase
          .from('attendance_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (dbAttSettings) {
          setAttendanceSettings({
            id: dbAttSettings.id,
            shift_entry_time: dbAttSettings.shift_entry_time || '09:00',
            shift_exit_time: dbAttSettings.shift_exit_time || '19:00',
            entry_tolerance_minutes: Number(dbAttSettings.entry_tolerance_minutes ?? 15),
            exit_tolerance_minutes: Number(dbAttSettings.exit_tolerance_minutes ?? 15),
          });
        }

        const { data: dbAttendances } = await supabase
          .from('employee_attendances')
          .select('*')
          .order('date', { ascending: false });
        if (dbAttendances) {
          setAttendance(
            dbAttendances.map((a: any) => {
              const empName = empMap.get(a.employee_id) || 'Colaborador';
              const rawIn = a.check_in || '';
              const rawOut = a.check_out || '';
              const checkInFormatted = rawIn.includes('T')
                ? new Date(rawIn).toLocaleTimeString('es-PE', {
                    timeZone: 'America/Lima',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })
                : rawIn.substring(0, 5) || '09:00';
              const checkOutFormatted = rawOut
                ? (rawOut.includes('T')
                    ? new Date(rawOut).toLocaleTimeString('es-PE', {
                        timeZone: 'America/Lima',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })
                    : rawOut.substring(0, 5))
                : null;

              return {
                id: a.id,
                employee_id: a.employee_id,
                employee_name: empName,
                employee_type: (a.employee_type || 'barberia') as any,
                date: a.date,
                check_in: checkInFormatted,
                check_out: checkOutFormatted,
                worked_minutes: Number(a.worked_minutes || 0),
                bonus_minutes: Number(a.bonus_minutes || 0),
                bonus_calculation_type: a.bonus_calculation_type || 'auto',
                status: (a.status || 'presente') as any,
                tardy_minutes: Number(a.tardy_minutes || 0),
                overtime_minutes: Number(a.overtime_minutes || a.bonus_minutes || 0),
                justification_note: a.justification_note || undefined,
                justification_document_url: a.justification_document_url || undefined,
                exit_time: a.exit_time || a.check_out || null,
                exit_type: a.exit_type || null,
                exit_reason: a.exit_reason || a.exit_justification || null,
              };
            })
          );
        }
      }

      setLastSyncTimestamp(new Date());
    } catch (err) {
      console.warn('Conexión en línea con Supabase completada con fallbacks:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentRole]);

  const pulseRealtime = useCallback(() => {
    setLastSyncTimestamp(new Date());
    fetchAllFromSupabase();
  }, [fetchAllFromSupabase]);

  // Suscripción a Supabase Realtime
  useEffect(() => {
    fetchAllFromSupabase();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          setLastSyncTimestamp(new Date());
          if (
            payload.table === 'bookings' ||
            payload.table === 'booking_services' ||
            payload.table === 'payment_logs' ||
            payload.table === 'employee_blocks' ||
            payload.table === 'employees' ||
            payload.table === 'employee_skills' ||
            payload.table === 'services' ||
            payload.table === 'products' ||
            payload.table === 'ventas_mostrador' ||
            payload.table === 'expenses' ||
            payload.table === 'wardrobe_items' ||
            payload.table === 'dress_rentals' ||
            payload.table === 'business_config' ||
            payload.table === 'employee_attendances' ||
            payload.table === 'attendance_settings'
          ) {
            fetchAllFromSupabase();
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllFromSupabase]);

  // Sincronización en tiempo real con Supabase Auth
  useEffect(() => {
    let isMounted = true;

    const syncUserSession = async (session: any) => {
      if (session?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const role = (profile?.role || 'cliente') as UserRole;
          if (isMounted) {
            setCurrentRoleState(role);
            try {
              localStorage.setItem('acicalados_cached_role', role);
            } catch {}

            const name = profile?.first_name
              ? `${profile.first_name} ${profile.last_name || ''}`.trim()
              : session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'Cliente';

            const userObj = {
              id: session.user.id,
              name,
              email: session.user.email || '',
              avatar:
                profile?.avatar_url ||
                session.user.user_metadata?.avatar_url ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
              role,
              phone: sanitizePhone(profile?.phone || '') || '',
              dni: sanitizeDni(profile?.dni || '') || '',
            };

            setCurrentUserOverride(userObj);
            try {
              localStorage.setItem('acicalados_cached_user', JSON.stringify(userObj));
            } catch {}
            fetchAllFromSupabase();
          }
        } catch (err) {
          console.warn('Sincronización de perfil de auth completada con fallbacks:', err);
        } finally {
          if (isMounted) {
            setIsAuthLoading(false);
          }
        }
      } else {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await syncUserSession(session);
      } else {
        if (isMounted) {
          setCurrentRoleState('anon');
          setCurrentUserOverride(null);
          try {
            localStorage.removeItem('acicalados_cached_role');
            localStorage.removeItem('acicalados_cached_user');
          } catch {}
          setIsAuthLoading(false);
        }
      }
    }).catch((err) => {
      console.warn('Error verificando sesión Supabase:', err);
      if (isMounted) {
        setIsAuthLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await syncUserSession(session);
      } else {
        if (isMounted) {
          setCurrentRoleState('anon');
          setCurrentUserOverride(null);
          try {
            localStorage.removeItem('acicalados_cached_role');
            localStorage.removeItem('acicalados_cached_user');
          } catch {}
          setBookings([]);
          setIsAuthLoading(false);
          fetchAllFromSupabase();
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAllFromSupabase]);

  // Perfil del usuario sincronizado estrictamente con la sesión real de Supabase
  const currentUser = useMemo(() => {
    if (currentUserOverride) {
      return currentUserOverride;
    }
    return {
      id: 'anon-0',
      name: 'Visitante Invitado',
      email: '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      role: 'anon' as UserRole,
      phone: '',
      dni: '',
    };
  }, [currentUserOverride]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error cerrando sesión:', err);
    }
    try {
      localStorage.removeItem('acicalados_cached_role');
      localStorage.removeItem('acicalados_cached_user');
    } catch {}
    setCurrentUserOverride(null);
    setCurrentRoleState('anon');
    setIsAuthLoading(false);
    setBookings([]);
    setActiveView('/');
  }, [setActiveView]);

  // Thermal Ticket Actions
  const openTicketModal = useCallback((type: 'booking' | 'venta' | 'pos', data: Booking | VentaMostrador) => {
    setActiveTicket({ type: type === 'pos' ? 'venta' : type, data });
  }, []);

  const closeTicketModal = useCallback(() => {
    setActiveTicket(null);
  }, []);

  // Lightbox Actions
  const openLightbox = useCallback((data: LightboxData) => {
    setLightboxImage(data);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
  }, []);

  // All cart mutations reconcile against the current catalog, including zero stock.
  const addToCart = useCallback((product: Product, quantity = 1) => {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return;
    setCart(prev => reconcileCart([...prev, { productId: product.id, quantity }], products));
    setIsCartOpen(true);
  }, [products]);
  const removeFromCart = useCallback((productId: string) => setCart(prev => prev.filter(i => i.product.id !== productId)), []);
  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (!Number.isSafeInteger(quantity) || quantity < 0) return;
    setCart(prev => reconcileCart(prev.map(i => ({ productId: i.product.id, quantity: i.product.id === productId ? quantity : i.quantity })), products));
  }, [products]);
  const clearCart = useCallback(() => setCart([]), []);
  const revalidateCart = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').in('id', cart.map(i => i.product.id));
    if (error || !data) throw new Error('No se pudo verificar el stock. Inténtalo nuevamente.');
    const fresh = data.map(p => ({ ...products.find(i => i.id === p.id), ...p, active: p.is_active,
      use_type: p.use_type, image_url: p.images?.[0] || '' })) as Product[];
    const next = reconcileCart(cart, fresh);
    const changed = JSON.stringify(cart.map(i => [i.product.id,i.quantity,i.product.price_cents])) !== JSON.stringify(next.map(i => [i.product.id,i.quantity,i.product.price_cents]));
    setCart(next);
    return !changed && next.length > 0;
  }, [cart, products]);

  const addBooking = useCallback(async (bookingData: Omit<Booking, 'id' | 'code' | 'created_at'>): Promise<Booking | null> => {
    const key = 'booking:' + JSON.stringify(bookingData);
    if (pendingOperations.current.has(key)) return null;
    pendingOperations.current.add(key);
    try {
      const data = await qaRpc<any>('qa_create_booking', { p_request_id: requestId(key), p_booking: bookingData });
      const created = mapBooking(data);
      setBookings(prev => [created, ...prev.filter(b => b.id !== created.id)]);
      pulseRealtime();
      return created;
    } finally { pendingOperations.current.delete(key); }
  }, [pulseRealtime]);

  const registerBookingPayment = useCallback(async (bookingId: string, amountCents: number, method: string,
    cashCents = 0, yapeCents = 0, voucherUrl?: string, notes?: string): Promise<boolean> => {
    const key = JSON.stringify(['payment', bookingId, amountCents, method, cashCents, yapeCents, notes]);
    if (pendingOperations.current.has(key)) return false;
    pendingOperations.current.add(key);
    try {
      await qaRpc('qa_register_payment', { p_id: requestId(key), p_booking: bookingId, p_amount: amountCents,
        p_method: method, p_cash: cashCents, p_yape: yapeCents, p_notes: notes || '' });
      await fetchAllFromSupabase();
      requests.current.delete(key);
      pulseRealtime();
      return true;
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
      return false;
    } finally { pendingOperations.current.delete(key); }
  }, [fetchAllFromSupabase, pulseRealtime]);

  const voidPayment = useCallback(async (paymentId: string, reason: string): Promise<boolean> => {
    if (pendingOperations.current.has(paymentId)) return false;
    pendingOperations.current.add(paymentId);
    try {
      await qaRpc('qa_void_payment', { p_id: paymentId, p_reason: reason });
      await fetchAllFromSupabase();
      return true;
    } catch (err) { setOperationError(err instanceof Error ? err.message : 'No se pudo anular el pago.'); return false; }
    finally { pendingOperations.current.delete(paymentId); }
  }, [fetchAllFromSupabase]);

  const mutateBookingService = useCallback(async (bookingId: string, index: number, action: string, value = '') => {
    const serviceId = bookings.find(b => b.id === bookingId)?.services[index]?.id;
    if (!serviceId) throw new Error('Actualiza las reservas antes de modificar el servicio.');
    const saved = await qaRpc<any>('qa_update_booking_service', { p_id: serviceId, p_action: action, p_value: value });
    const booking = mapBooking(saved);
    setBookings(prev => prev.map(b => b.id === booking.id ? booking : b));
    pulseRealtime();
  }, [bookings, pulseRealtime]);
  const liberateServiceEarly = useCallback(async (id: string, index: number) => {
    try { await mutateBookingService(id, index, 'release'); }
    catch (err) { setOperationError(err instanceof Error ? err.message : 'No se pudo liberar el servicio.'); }
  }, [mutateBookingService]);
  const reassignBookingService = useCallback(async (id: string, index: number, employeeId: string, _name: string) => {
    await mutateBookingService(id, index, 'assign', employeeId);
  }, [mutateBookingService]);
  const updateBookingServicePrice = useCallback(async (id: string, index: number, price: number) => {
    if (!Number.isSafeInteger(price) || price < 0) throw new Error('Precio inválido.');
    await mutateBookingService(id, index, 'price', String(price));
  }, [mutateBookingService]);

  const deleteBooking = useCallback(async (bookingId: string): Promise<boolean> => {
    // 1. Verificación estricta de rol Administrador
    if (currentRole !== 'admin') {
      console.error('Permiso denegado: solo el Administrador puede eliminar reservas.');
      throw new Error('Permiso denegado: Solo los administradores pueden eliminar reservas permanentemente.');
    }

    try {
      // 2. Si la reserva está en Supabase (UUID de 36 caracteres)
      if (bookingId.includes('-') && bookingId.length === 36) {
        const { data, error } = await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId)
          .select('id');

        if (error) {
          console.error('Error al eliminar reserva en Supabase:', error);
          throw new Error(error.message || 'Error en la base de datos al eliminar reserva');
        }

        // Si data está vacío, RLS rechazó el DELETE o el registro no existe
        if (!data || data.length === 0) {
          console.error('Supabase RLS denegó la eliminación (0 registros afectados).');
          throw new Error('No se pudo eliminar en el servidor: la política de seguridad RLS rechazó la operación.');
        }
      }

      // 3. Confirmación en estado local
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      pulseRealtime();

      // 4. Revalidar caché inmediatamente desde Supabase
      await fetchAllFromSupabase();
      return true;
    } catch (err) {
      console.error('Error en deleteBooking:', err);
      // Re-sincronizar tabla ante cualquier anomalía
      await fetchAllFromSupabase();
      throw err;
    }
  }, [currentRole, fetchAllFromSupabase, pulseRealtime]);

  const editBooking = useCallback(async (bookingId: string, updates: Partial<Booking>): Promise<boolean> => {
    try {
      const saved = await qaRpc<any>('qa_edit_booking', { p_id: bookingId, p_updates: updates });
      const booking = mapBooking(saved);
      setBookings(prev => prev.map(b => b.id === bookingId ? booking : b));
      pulseRealtime();
      return true;
    } catch (err) { setOperationError(err instanceof Error ? err.message : 'No se pudo editar la reserva.'); return false; }
  }, [pulseRealtime]);

  // POS HANDLERS
  const deleteVentaMostrador = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await supabase.from('ventas_mostrador').delete().eq('id', id).select('id').single();
    if (error || !data) { setOperationError('No se pudo eliminar la venta.'); return false; }
    setVentasMostrador(prev => prev.filter(v => v.id !== id));
    pulseRealtime();
    return true;
  }, [pulseRealtime]);

  const processPosSaleWithStock = useCallback(async (
    saleData: Omit<VentaMostrador, 'id' | 'ticket_number' | 'created_at'> & { created_at?: string },
    items: Array<{ product_id?: string; product_name: string; quantity: number; unit_price: number; total: number }>
  ): Promise<{ success: boolean; ticket_number: string; sales: VentaMostrador[] }> => {
    const saleKey = JSON.stringify(['sale', { ...saleData, created_at: undefined }, items]);
    const saleRequestId = requestId(saleKey);
    const ticketNumber = `TK-${saleRequestId}`;
    const nowIso = new Date().toISOString();
    const createdAt = saleData.created_at || nowIso;

    const isMixto = saleData.payment_method?.toLowerCase() === 'mixto';
    const finalMetodoPago = isMixto ? 'MIXTO' : (saleData.payment_method.charAt(0).toUpperCase() + saleData.payment_method.slice(1));

    const pSale = {
      cliente_nombre: saleData.client_name,
      cliente_dni: saleData.client_dni || null,
      cliente_phone: saleData.client_phone || null,
      metodo_pago: finalMetodoPago,
      total: saleData.total_price_cents / 100,
      subtotal: saleData.subtotal != null ? saleData.subtotal : (saleData.subtotal_cents != null ? saleData.subtotal_cents / 100 : items.reduce((s, i) => s + i.total, 0)),
      monto_descuento: saleData.monto_descuento != null ? saleData.monto_descuento : (saleData.discount_cents != null ? saleData.discount_cents / 100 : 0),
      product_name: saleData.product_name,
      monto_efectivo: saleData.monto_efectivo ?? (saleData.cash_cents != null ? saleData.cash_cents / 100 : null),
      monto_yape: saleData.monto_yape ?? (saleData.yape_cents != null ? saleData.yape_cents / 100 : null),
      monto_transferencia: saleData.monto_transferencia ?? (saleData.transfer_cents != null ? saleData.transfer_cents / 100 : null),
      detalles_pago: saleData.detalles_pago || null,
      ticket_number: ticketNumber,
      fecha: createdAt,
      created_at: createdAt,
      notas: saleData.notes || null,
      registrado_por: currentUser?.id || null,
    };

    const pItems = items.map((item) => ({
      product_id: item.product_id || null,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    }));

    const data = await qaRpc<any>('qa_process_pos_sale', { p_request_id: saleRequestId, p_sale: pSale, p_items: pItems });
    if (!data?.sale_id || data?.success === false) throw new Error('El servidor no confirmó la venta.');
    requests.current.delete(saleKey);

    // Descontar stock localmente
    items.forEach((item) => {
      if (item.product_id) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === item.product_id
              ? { ...p, stock: Math.max(0, p.stock - item.quantity) }
              : p
          )
        );
      }
    });

    const singleSale: VentaMostrador = {
      ...saleData,
      id: (data as any)?.sale_id || `vnt-${Date.now()}`,
      ticket_number: (data as any)?.ticket_number || ticketNumber,
      product_name: saleData.product_name,
      quantity: saleData.quantity,
      unit_price_cents: saleData.unit_price_cents,
      subtotal: (data as any)?.subtotal ?? (saleData.subtotal_cents ? saleData.subtotal_cents / 100 : saleData.total_price_cents / 100),
      subtotal_cents: saleData.subtotal_cents ?? saleData.total_price_cents,
      monto_descuento: (data as any)?.descuento ?? (saleData.discount_cents ? saleData.discount_cents / 100 : 0),
      discount_cents: saleData.discount_cents ?? 0,
      total_price_cents: saleData.total_price_cents,
      detalles_items: items,
      created_at: createdAt,
    };

    setVentasMostrador((prev) => [singleSale, ...prev]);
    pulseRealtime();

    return {
      success: true,
      ticket_number: (data as any)?.ticket_number || ticketNumber,
      sales: [singleSale],
    };
  }, [currentUser, pulseRealtime]);

  // EXPENSES HANDLERS
  const addExpense = useCallback((expenseData: Omit<Expense, 'id' | 'created_at' | 'voided'>) => {
    const today = getTodayDateString();
    const nowIso = new Date().toISOString();
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      voided: false,
      date: expenseData.date || today,
      created_at: nowIso,
    };
    setExpenses((prev) => [newExpense, ...prev]);
    pulseRealtime();

    supabase.from('expenses').insert({
      description: expenseData.description,
      category: expenseData.category,
      amount_cents: expenseData.amount_cents,
      payment_method: expenseData.payment_method === 'efectivo' ? 'cash' : expenseData.payment_method,
      expense_date: expenseData.date || today,
      created_at: nowIso,
      supplier: expenseData.beneficiary || null,
      receipt_url: expenseData.voucher_url || null,
      status: 'active',
    }).then();
  }, [pulseRealtime]);

  const voidExpense = useCallback((expenseId: string, reason: string) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expenseId
          ? { ...e, voided: true, voided_reason: reason, voided_by: currentUser.name }
          : e
      )
    );
    pulseRealtime();

    if (expenseId.includes('-') && expenseId.length === 36) {
      supabase.from('expenses').update({
        status: 'voided',
        void_reason: reason,
        voided_at: new Date().toISOString(),
      }).eq('id', expenseId).then();
    }
  }, [currentUser.name, pulseRealtime]);

  // EMPLOYEE & ATTENDANCE HANDLERS
  const addEmployee = useCallback(async (empData: Omit<Employee, 'id' | 'qr_code_uuid'> & { skills?: string[] }): Promise<Employee | null> => {
    try {
      const firstName = empData.first_name || empData.full_name.trim().split(' ')[0] || 'Colaborador';
      const lastName = empData.last_name || empData.full_name.trim().split(' ').slice(1).join(' ') || '';

      const photoUrl = empData.foto_url || empData.avatar_url || empData.avatar || null;

      const insertPayload = {
        first_name: firstName,
        last_name: lastName,
        type: empData.type,
        dni: sanitizeDni(empData.dni) || null,
        phone: sanitizePhone(empData.phone) || null,
        email: empData.email || null,
        foto_url: photoUrl,
        avatar_url: photoUrl,
        handles_reception: empData.handles_reception || false,
        shift_start: empData.shift_start || '09:00',
        shift_end: empData.shift_end || '18:00',
        commission_percentage: empData.commission_percentage ?? 40,
        is_active: empData.active ?? true,
        rotation_order: empData.rotation_order || 0,
      };

      const { data, error } = await supabase.from('employees').insert(insertPayload).select().single();

      if (error || !data) {
        console.error('Error inserting employee in Supabase:', error);
        const newId = `emp-${Date.now()}`;
        const fallbackEmp: Employee = {
          ...empData,
          id: newId,
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          qr_code_uuid: `qr-${newId}`,
        };
        setEmployees((prev) => [...prev, fallbackEmp]);
        pulseRealtime();
        return fallbackEmp;
      }

      if (empData.skills && empData.skills.length > 0) {
        const skillRows = empData.skills.map((serviceId) => ({
          employee_id: data.id,
          service_id: serviceId,
        }));
        await supabase.from('employee_skills').insert(skillRows);
      }

      const newEmp: Employee = {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        type: data.type,
        skills: empData.skills || [],
        active: data.is_active,
        avatar: data.foto_url || data.avatar_url || empData.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        avatar_url: data.foto_url || data.avatar_url,
        foto_url: data.foto_url || data.avatar_url,
        phone: data.phone || '',
        email: data.email || '',
        dni: data.dni || '',
        handles_reception: data.handles_reception || false,
        shift_start: data.shift_start || '09:00',
        shift_end: data.shift_end || '18:00',
        commission_percentage: data.commission_percentage || 40,
        qr_code_uuid: data.id,
        rotation_order: data.rotation_order,
      };

      setEmployees((prev) => [...prev, newEmp]);
      pulseRealtime();
      return newEmp;
    } catch (err) {
      console.error('Error adding employee:', err);
      return null;
    }
  }, [pulseRealtime]);

  const updateEmployee = useCallback(async (updated: Employee): Promise<boolean> => {
    try {
      const firstName = updated.first_name || updated.full_name.trim().split(' ')[0] || 'Colaborador';
      const lastName = updated.last_name || updated.full_name.trim().split(' ').slice(1).join(' ') || '';

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === updated.id
            ? {
                ...updated,
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`.trim(),
              }
            : e
        )
      );
      pulseRealtime();

      if (updated.id.includes('-') && updated.id.length === 36) {
        const photoUrl = updated.foto_url !== undefined ? updated.foto_url : updated.avatar_url;
        const updatePayload: any = {
          first_name: firstName,
          last_name: lastName,
          type: updated.type,
          dni: sanitizeDni(updated.dni) || null,
          phone: sanitizePhone(updated.phone) || null,
          email: updated.email || null,
          handles_reception: updated.handles_reception || false,
          shift_start: updated.shift_start || '09:00',
          shift_end: updated.shift_end || '18:00',
          commission_percentage: updated.commission_percentage ?? 40,
          is_active: updated.active,
        };

        if (photoUrl !== undefined) {
          updatePayload.foto_url = photoUrl || null;
          updatePayload.avatar_url = photoUrl || null;
        }

        const { error } = await supabase
          .from('employees')
          .update(updatePayload as any)
          .eq('id', updated.id);

        if (error) {
          console.error('Error updating employee in Supabase:', error);
          return false;
        }

        // Sincronizar habilidades
        await supabase.from('employee_skills').delete().eq('employee_id', updated.id);
        if (updated.skills && updated.skills.length > 0) {
          const skillRows = updated.skills.map((serviceId) => ({
            employee_id: updated.id,
            service_id: serviceId,
          }));
          await supabase.from('employee_skills').insert(skillRows);
        }
      }
      return true;
    } catch (err) {
      console.error('Error updating employee:', err);
      return false;
    }
  }, [pulseRealtime]);

  const deleteEmployee = useCallback(async (empId: string): Promise<boolean> => {
    try {
      if (empId.includes('-') && empId.length === 36) {
        await supabase.from('employee_skills').delete().eq('employee_id', empId);
        await supabase.from('employee_blocks').delete().eq('employee_id', empId);
        const { error } = await supabase.from('employees').delete().eq('id', empId);
        if (error) {
          console.error('Error deleting employee from Supabase:', error);
          return false;
        }
      }
      setEmployees((prev) => prev.filter((e) => e.id !== empId));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error in deleteEmployee:', err);
      return false;
    }
  }, [pulseRealtime]);

  const addEmployeeLeave = useCallback(async (leaveData: {
    employee_id: string;
    leave_type: string;
    reason: string;
    start_date: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    is_full_day: boolean;
    document_url?: string;
  }): Promise<boolean> => {
    try {
      const startDate = leaveData.start_date;
      const endDate = leaveData.end_date || leaveData.start_date;
      const isFullDay = leaveData.is_full_day;
      const startTime = isFullDay ? '00:00:00' : (leaveData.start_time || '09:00:00') + (leaveData.start_time?.length === 5 ? ':00' : '');
      const endTime = isFullDay ? '23:59:59' : (leaveData.end_time || '18:00:00') + (leaveData.end_time?.length === 5 ? ':00' : '');

      const datesToInsert: string[] = [];
      let cur = new Date(`${startDate}T12:00:00Z`);
      const end = new Date(`${endDate}T12:00:00Z`);

      while (cur <= end) {
        datesToInsert.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }

      if (datesToInsert.length === 0) {
        datesToInsert.push(startDate);
      }

      const rows = datesToInsert.map((dateStr) => ({
        employee_id: leaveData.employee_id,
        block_date: dateStr,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        reason: leaveData.reason,
        leave_type: leaveData.leave_type,
        document_url: leaveData.document_url || null,
        is_full_day: isFullDay,
        status: 'aprobado',
      }));

      const { data, error } = await supabase.from('employee_blocks').insert(rows).select();
      if (error) {
        console.error('Error inserting employee_blocks:', error);
        return false;
      }

      const emp = employees.find((e) => e.id === leaveData.employee_id);
      const empName = emp ? emp.full_name : 'Colaborador';

      if (data && data.length > 0) {
        const newBlocks: EmployeeBlock[] = data.map((b: any) => ({
          id: b.id,
          employee_id: b.employee_id,
          employee_name: empName,
          date: b.block_date,
          block_date: b.block_date,
          start_date: b.block_date,
          end_date: b.end_date || b.block_date,
          start_time: b.start_time?.substring(0, 5) || '00:00',
          end_time: b.end_time?.substring(0, 5) || '23:59',
          reason: b.reason,
          leave_type: b.leave_type,
          document_url: b.document_url,
          is_full_day: b.is_full_day,
          status: b.status,
          created_at: b.created_at,
        }));
        setEmployeeBlocks((prev) => [...newBlocks, ...prev]);
      }
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error in addEmployeeLeave:', err);
      return false;
    }
  }, [employees, pulseRealtime]);

  const deleteEmployeeBlock = useCallback(async (blockId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('employee_blocks').delete().eq('id', blockId);
      if (error) {
        console.error('Error deleting employee_block:', error);
        return false;
      }
      setEmployeeBlocks((prev) => prev.filter((b) => b.id !== blockId));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error in deleteEmployeeBlock:', err);
      return false;
    }
  }, [pulseRealtime]);

  const toggleEmployeeActive = useCallback((empId: string) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === empId) {
          const nextActive = !e.active;
          if (empId.includes('-') && empId.length === 36) {
            supabase.from('employees').update({ is_active: nextActive }).eq('id', empId).then();
          }
          return { ...e, active: nextActive };
        }
        return e;
      })
    );
    pulseRealtime();
  }, [pulseRealtime]);

  // Resolver colaborador a partir del código QR escaneado, ID o DNI
  const resolveEmployeeFromCode = useCallback(
    (qrCode: string): Employee | undefined => {
      const cleanQr = (qrCode || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      let emp = employees.find(
        (e) =>
          (e.qr_code && e.qr_code === cleanQr) ||
          e.qr_code_uuid === cleanQr ||
          e.id === cleanQr ||
          (e.dni && e.dni === cleanQr)
      );

      if (!emp && cleanQr.startsWith('ACICALADOS-EMP-')) {
        const rawPayload = cleanQr.replace('ACICALADOS-EMP-', '');
        emp = employees.find(
          (e) =>
            rawPayload.includes(e.id) ||
            (e.qr_code && cleanQr === e.qr_code) ||
            (e.dni && rawPayload.endsWith(e.dni))
        );
      }

      if (!emp) {
        emp = employees.find(
          (e) =>
            (e.qr_code && cleanQr.includes(e.qr_code)) ||
            (e.id && cleanQr.includes(e.id)) ||
            (e.dni && cleanQr.includes(e.dni))
        );
      }
      return emp;
    },
    [employees]
  );

  // Check-In / Check-Out QR Scanner con cálculo de puntualidad y horas extra
  const scanAttendanceQR = useCallback(
    (
      qrCode: string
    ): {
      success: boolean;
      message: string;
      employee?: Employee;
      type?: 'check_in' | 'check_out';
      record?: EmployeeAttendance;
      punctuality?: 'puntual' | 'tardanza' | 'horas_extra';
      minutes?: number;
      requiresExitModal?: boolean;
    } => {
      const emp = resolveEmployeeFromCode(qrCode);

      if (!emp) {
        return {
          success: false,
          message: 'Credencial QR no reconocida en el sistema de colaboradores.',
        };
      }

      const today = getTodayDateString();
      const nowLima = new Date().toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const isoNow = new Date().toISOString();
      const [nowH, nowM] = nowLima.split(':').map(Number);
      const nowMinutes = nowH * 60 + nowM;

      // Configuración de turnos y tolerancias
      const [entryH, entryM] = (attendanceSettings.shift_entry_time || '09:00')
        .split(':')
        .map(Number);
      const entryMinutes = entryH * 60 + entryM;
      const entryTolerance = attendanceSettings.entry_tolerance_minutes ?? 15;
      const maxEntryAllowed = entryMinutes + entryTolerance;

      const [exitH, exitM] = (attendanceSettings.shift_exit_time || '19:00')
        .split(':')
        .map(Number);
      const exitMinutes = exitH * 60 + exitM;
      const exitTolerance = attendanceSettings.exit_tolerance_minutes ?? 15;
      const overtimeThreshold = exitMinutes + exitTolerance;

      const currentAttendance = attendance.find(
        (a) => a.employee_id === emp.id && a.date === today
      );

      // CASO 1: ENTRADA (Check-In)
      if (!currentAttendance) {
        const isLate = nowMinutes > maxEntryAllowed;
        const tardyMinutes = isLate ? Math.max(0, nowMinutes - entryMinutes) : 0;
        const status = isLate ? 'tardanza' : 'presente';
        const punctuality = isLate ? 'tardanza' : 'puntual';

        const generatedId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `att-${Date.now()}`;

        const newAtt: EmployeeAttendance = {
          id: generatedId,
          employee_id: emp.id,
          employee_name: emp.full_name,
          employee_type: emp.type as any,
          date: today,
          check_in: nowLima,
          check_out: null,
          worked_minutes: 0,
          bonus_minutes: 0,
          bonus_calculation_type: 'auto',
          status,
          tardy_minutes: tardyMinutes,
          overtime_minutes: 0,
        };

        setAttendance((prev) => [newAtt, ...prev]);
        pulseRealtime();

        supabase
          .from('employee_attendances')
          .insert({
            id: generatedId.length === 36 ? generatedId : undefined,
            employee_id: emp.id,
            date: today,
            check_in: isoNow,
            status,
            tardy_minutes: tardyMinutes,
            overtime_minutes: 0,
          })
          .then();

        return {
          success: true,
          message: isLate
            ? `¡Entrada registrada a las ${nowLima}! Tardanza de ${tardyMinutes} min (tolerancia: ${entryTolerance} min).`
            : `¡Entrada puntual registrada exitosamente a las ${nowLima}!`,
          employee: emp,
          type: 'check_in',
          record: newAtt,
          punctuality,
          minutes: tardyMinutes,
        };
      }

      // CASO 2: SALIDA (Check-Out) -> Detener guardado automático y requerir confirmación (Definitiva vs Emergencia)
      if (currentAttendance && !currentAttendance.check_out) {
        return {
          success: true,
          message: `${emp.full_name} ya cuenta con entrada hoy. Se requiere confirmar el tipo de salida (Definitiva o Emergencia).`,
          employee: emp,
          type: 'check_out',
          record: currentAttendance,
          requiresExitModal: true,
        };
      }

      // CASO 3: YA MARCÓ ENTRADA Y SALIDA
      return {
        success: false,
        message: `${emp.full_name} ya completó su jornada de hoy (Entrada: ${currentAttendance.check_in}, Salida: ${currentAttendance.check_out}).`,
        employee: emp,
        record: currentAttendance,
      };
    },
    [attendance, attendanceSettings, resolveEmployeeFromCode, pulseRealtime]
  );

  // Registro de salida con selección de modalidad (Definitiva vs. Emergencia)
  const registerAttendanceExit = useCallback(
    async ({
      employeeId,
      attendanceId,
      exitType,
      exitReason,
    }: {
      employeeId: string;
      attendanceId: string;
      exitType: 'definitiva' | 'emergencia';
      exitReason?: string;
    }) => {
      const today = getTodayDateString();
      const nowLima = new Date().toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const isoNow = new Date().toISOString();
      const [nowH, nowM] = nowLima.split(':').map(Number);
      const nowMinutes = nowH * 60 + nowM;

      const [exitH, exitM] = (attendanceSettings.shift_exit_time || '19:00')
        .split(':')
        .map(Number);
      const exitMinutes = exitH * 60 + exitM;
      const exitTolerance = attendanceSettings.exit_tolerance_minutes ?? 15;
      const overtimeThreshold = exitMinutes + exitTolerance;

      const currentAttendance = attendance.find(
        (a) => a.id === attendanceId || (a.employee_id === employeeId && a.date === today)
      );

      const inTime = currentAttendance?.check_in || attendanceSettings.shift_entry_time || '09:00';
      const [inH, inM] = inTime.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const workedMinutes = Math.max(0, nowMinutes - inMinutes);

      const hasOvertime = nowMinutes > overtimeThreshold;
      const overtimeMinutes = hasOvertime ? Math.max(0, nowMinutes - exitMinutes) : 0;
      const workedHoursStr = `${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m`;
      const cleanReason = exitType === 'emergencia' ? (exitReason || '').trim() : null;

      const updatedAtt: EmployeeAttendance = {
        ...(currentAttendance || {
          id: attendanceId,
          employee_id: employeeId,
          employee_name: '',
          employee_type: 'barberia' as any,
          date: today,
          check_in: inTime,
          status: 'presente',
          bonus_calculation_type: 'auto',
          bonus_minutes: overtimeMinutes,
        }),
        check_out: nowLima,
        exit_time: isoNow,
        exit_type: exitType,
        exit_reason: cleanReason,
        worked_minutes: workedMinutes,
        overtime_minutes: overtimeMinutes,
        bonus_minutes: overtimeMinutes,
        bonus_calculation_type: 'auto',
      };

      setAttendance((prev) =>
        prev.map((a) =>
          a.id === attendanceId || (a.employee_id === employeeId && a.date === today)
            ? updatedAtt
            : a
        )
      );
      pulseRealtime();

      try {
        await supabase
          .from('employee_attendances')
          .update({
            check_out: isoNow,
            exit_time: isoNow,
            exit_type: exitType,
            exit_reason: cleanReason,
            exit_justification: cleanReason,
            overtime_minutes: overtimeMinutes,
            bonus_minutes: overtimeMinutes,
            bonus_calculation_type: 'auto',
            updated_at: isoNow,
          })
          .eq('id', attendanceId);
      } catch (err) {
        console.error('Error al actualizar salida en Supabase:', err);
      }

      return {
        success: true,
        message:
          exitType === 'emergencia'
            ? `¡Salida de Emergencia registrada a las ${nowLima}! Motivo: ${cleanReason || 'No especificado'}. Jornada cumplida: ${workedHoursStr}.`
            : hasOvertime
            ? `¡Salida Definitiva registrada a las ${nowLima}! Jornada: ${workedHoursStr}. Horas extra a favor: +${overtimeMinutes} min (${(overtimeMinutes / 60).toFixed(1)}h).`
            : `¡Salida Definitiva registrada exitosamente a las ${nowLima}! Jornada cumplida: ${workedHoursStr}.`,
        overtimeMinutes,
        workedMinutes,
        workedDisplay: workedHoursStr,
        record: updatedAtt,
      };
    },
    [attendance, attendanceSettings, pulseRealtime]
  );

  const registerAttendancePunch = useCallback(
    (employeeId: string, punchType: 'check_in' | 'check_out') => {
      const emp = employees.find(
        (e) => e.id === employeeId || e.qr_code_uuid === employeeId
      );
      if (!emp) return;
      const today = getTodayDateString();
      const nowLima = new Date().toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const [nowH, nowM] = nowLima.split(':').map(Number);
      const nowMinutes = nowH * 60 + nowM;

      const [entryH, entryM] = (attendanceSettings.shift_entry_time || '09:00')
        .split(':')
        .map(Number);
      const entryMinutes = entryH * 60 + entryM;
      const entryTolerance = attendanceSettings.entry_tolerance_minutes ?? 15;
      const maxEntryAllowed = entryMinutes + entryTolerance;

      const [exitH, exitM] = (attendanceSettings.shift_exit_time || '19:00')
        .split(':')
        .map(Number);
      const exitMinutes = exitH * 60 + exitM;
      const exitTolerance = attendanceSettings.exit_tolerance_minutes ?? 15;
      const overtimeThreshold = exitMinutes + exitTolerance;

      if (punchType === 'check_in') {
        const isLate = nowMinutes > maxEntryAllowed;
        const tardyMinutes = isLate ? Math.max(0, nowMinutes - entryMinutes) : 0;
        const status = isLate ? 'tardanza' : 'presente';

        const generatedId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `att-${Date.now()}`;

        setAttendance((prev) => {
          const existing = prev.find((a) => a.employee_id === emp.id && a.date === today);
          if (existing) {
            return prev.map((a) =>
              a.id === existing.id
                ? { ...a, check_in: nowLima, status, tardy_minutes: tardyMinutes }
                : a
            );
          }
          const newAtt: EmployeeAttendance = {
            id: generatedId,
            employee_id: emp.id,
            employee_name: emp.full_name,
            employee_type: emp.type as any,
            date: today,
            check_in: nowLima,
            check_out: null,
            worked_minutes: 0,
            bonus_minutes: 0,
            bonus_calculation_type: 'auto',
            status,
            tardy_minutes: tardyMinutes,
            overtime_minutes: 0,
          };
          return [newAtt, ...prev];
        });

        supabase
          .from('employee_attendances')
          .insert({
            id: generatedId.length === 36 ? generatedId : undefined,
            employee_id: emp.id,
            date: today,
            check_in: nowLima,
            status,
            tardy_minutes: tardyMinutes,
            overtime_minutes: 0,
          })
          .then();
      } else {
        setAttendance((prev) => {
          const existing = prev.find((a) => a.employee_id === emp.id && a.date === today);
          const inTime = existing?.check_in || attendanceSettings.shift_entry_time || '09:00';
          const [inH, inM] = inTime.split(':').map(Number);
          const inMinutes = inH * 60 + inM;
          const workedMinutes = Math.max(0, nowMinutes - inMinutes);

          const hasOvertime = nowMinutes > overtimeThreshold;
          const overtimeMinutes = hasOvertime ? Math.max(0, nowMinutes - exitMinutes) : 0;

          if (existing) {
            if (existing.id.includes('-') && existing.id.length === 36) {
              supabase
                .from('employee_attendances')
                .update({
                  check_out: nowLima,
                  overtime_minutes: overtimeMinutes,
                  bonus_minutes: overtimeMinutes,
                  bonus_calculation_type: 'auto',
                })
                .eq('id', existing.id)
                .then();
            }

            return prev.map((a) =>
              a.id === existing.id
                ? {
                    ...a,
                    check_out: nowLima,
                    worked_minutes: workedMinutes,
                    overtime_minutes: overtimeMinutes,
                    bonus_minutes: overtimeMinutes,
                    bonus_calculation_type: 'auto',
                  }
                : a
            );
          } else {
            const generatedId =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `att-${Date.now()}`;
            const newAtt: EmployeeAttendance = {
              id: generatedId,
              employee_id: emp.id,
              employee_name: emp.full_name,
              employee_type: emp.type as any,
              date: today,
              check_in: attendanceSettings.shift_entry_time || '09:00',
              check_out: nowLima,
              worked_minutes: workedMinutes,
              bonus_minutes: overtimeMinutes,
              bonus_calculation_type: 'auto',
              status: 'presente',
              tardy_minutes: 0,
              overtime_minutes: overtimeMinutes,
            };

            supabase
              .from('employee_attendances')
              .insert({
                id: generatedId.length === 36 ? generatedId : undefined,
                employee_id: emp.id,
                date: today,
                check_in: attendanceSettings.shift_entry_time || '09:00',
                check_out: nowLima,
                bonus_minutes: overtimeMinutes,
                bonus_calculation_type: 'auto',
                status: 'presente',
                tardy_minutes: 0,
                overtime_minutes: overtimeMinutes,
              })
              .then();

            return [newAtt, ...prev];
          }
        });
      }
      pulseRealtime();
    },
    [attendanceSettings, employees, pulseRealtime]
  );

  const manualAdjustBonus = useCallback((attendanceId: string, newBonusMinutes: number, reason: string) => {
    setAttendance((prev) =>
      prev.map((a) =>
        a.id === attendanceId
          ? {
              ...a,
              bonus_minutes: newBonusMinutes,
              bonus_calculation_type: 'manual',
              justification_note: a.justification_note
                ? `${a.justification_note} | Ajuste Bono: ${reason}`
                : `Ajuste Bono: ${reason}`,
            }
          : a
      )
    );
    pulseRealtime();

    if (attendanceId.includes('-') && attendanceId.length === 36) {
      supabase.from('employee_attendances').update({
        bonus_minutes: newBonusMinutes,
        bonus_calculation_type: 'manual',
        bonus_adjustment_reason: reason,
      }).eq('id', attendanceId).then();
    }
  }, [pulseRealtime]);

  const submitJustification = useCallback((attendanceId: string, note: string, docUrl?: string) => {
    setAttendance((prev) =>
      prev.map((a) =>
        a.id === attendanceId
          ? {
              ...a,
              justification_note: note,
              justification_document_url: docUrl,
              status: 'falta_justificada',
            }
          : a
      )
    );
    pulseRealtime();
  }, [pulseRealtime]);

  // SETTINGS HANDLERS
  const updatePaymentSettings = useCallback(async (newSettings: Partial<PaymentSettings>): Promise<boolean> => {
    const settings = { ...newSettings, advance_percentage: advancePercentage(newSettings.advance_percentage) };
    const { data, error } = await (supabase as any).from('business_config').update(settings).eq('id', 1).select('id').single();
    if (error || !data) { setOperationError('No se pudo guardar la configuración de pagos.'); return false; }
    setPaymentSettings(prev => ({ ...prev, ...settings }));
    pulseRealtime();
    return true;
  }, [pulseRealtime]);

  const updateBonusSettings = useCallback((newSettings: Partial<BonusSettings>) => {
    setBonusSettings((prev) => ({ ...prev, ...newSettings }));
    pulseRealtime();
  }, [pulseRealtime]);

  const updateAttendanceSettings = useCallback(
    async (newSettings: Partial<AttendanceSettings>): Promise<boolean> => {
      try {
        const merged: AttendanceSettings = {
          ...attendanceSettings,
          ...newSettings,
        };
        setAttendanceSettings(merged);

        const { data, error } = await supabase
          .from('attendance_settings')
          .upsert({
            id: merged.id || undefined,
            shift_entry_time: merged.shift_entry_time,
            shift_exit_time: merged.shift_exit_time,
            entry_tolerance_minutes: Number(merged.entry_tolerance_minutes),
            exit_tolerance_minutes: Number(merged.exit_tolerance_minutes),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          setAttendanceSettings({
            id: data.id,
            shift_entry_time: data.shift_entry_time,
            shift_exit_time: data.shift_exit_time,
            entry_tolerance_minutes: Number(data.entry_tolerance_minutes),
            exit_tolerance_minutes: Number(data.exit_tolerance_minutes),
          });
        }
        pulseRealtime();
        return true;
      } catch (err) {
        console.error('Error actualizando configuración de horarios de asistencia:', err);
        return false;
      }
    },
    [attendanceSettings, pulseRealtime]
  );

  // CATALOG CRUD
  const addService = useCallback(async (srvData: Omit<Service, 'id'>): Promise<boolean> => {
    try {
      const slug = srvData.slug || srvData.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      const insertPayload = {
        name: srvData.name,
        slug: slug,
        description: srvData.description?.trim() || null,
        type: srvData.category,
        price_cents: srvData.price_cents,
        currency: 'PEN',
        duration_minutes: srvData.duration_minutes,
        capacity: srvData.capacity || 1,
        staff_required: 1,
        is_active: srvData.active !== undefined ? srvData.active : true,
        is_public: srvData.active !== undefined ? srvData.active : true,
        images: srvData.image_url ? [srvData.image_url] : [],
      };

      const { data, error } = await supabase
        .from('services')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Error al insertar servicio en Supabase:', error);
        return false;
      }

      if (data) {
        const newSrv: Service = {
          id: data.id,
          name: data.name,
          slug: data.slug,
          category: data.type as 'barberia' | 'spa',
          price_cents: data.price_cents,
          duration_minutes: data.duration_minutes,
          capacity: data.capacity,
          active: data.is_active,
          image_url: data.images && data.images.length > 0 ? data.images[0] : srvData.image_url,
          description: data.description || '',
        };
        setServices((prev) => [...prev, newSrv]);
        pulseRealtime();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error adding service:', err);
      return false;
    }
  }, [pulseRealtime]);

  const updateService = useCallback(async (srv: Service): Promise<boolean> => {
    try {
      const sanitizedSrv: Service = {
        ...srv,
        description: srv.description?.trim() || '',
      };

      if (srv.id.length !== 36) return false;
      {
        const { error } = await supabase.from('services').update({
          name: srv.name,
          slug: srv.slug,
          type: srv.category,
          price_cents: srv.price_cents,
          duration_minutes: srv.duration_minutes,
          description: srv.description?.trim() || null,
          is_active: srv.active,
          is_public: srv.active,
          images: srv.image_url ? [srv.image_url] : [],
          updated_at: new Date().toISOString(),
        }).eq('id', srv.id).select('id').single();

        if (error) {
          console.error('Error al actualizar servicio en Supabase:', error);
          return false;
        }
      }
      setServices((prev) => prev.map((s) => (s.id === srv.id ? sanitizedSrv : s)));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error updating service:', err);
      return false;
    }
  }, [pulseRealtime]);

  const deleteService = useCallback(async (serviceId: string): Promise<boolean> => {
    try {

      if (serviceId.length !== 36) return false;
      {
        const { error } = await supabase.from('services').delete().eq('id', serviceId).select('id').single();
        if (error) {
          console.error('Error al eliminar servicio en Supabase:', error);
          return false;
        }
      }
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error deleting service:', err);
      return false;
    }
  }, [pulseRealtime]);

  const toggleServiceActive = useCallback(async (serviceId: string, currentActive: boolean): Promise<boolean> => {
    try {
      const nextActive = !currentActive;

      if (serviceId.length !== 36) return false;
      {
        const { error } = await supabase.from('services').update({
          is_active: nextActive,
          is_public: nextActive,
          updated_at: new Date().toISOString(),
        }).eq('id', serviceId).select('id').single();

        if (error) {
          console.error('Error al alternar estado de servicio en Supabase:', error);
          return false;
        }
      }
      setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, active: nextActive } : s)));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error toggling service active:', err);
      return false;
    }
  }, [pulseRealtime]);

  const addProduct = useCallback(async (prodData: Omit<Product, 'id'>): Promise<boolean> => {
    try {
      const baseSlug = prodData.name
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const uniqueSlug = `${baseSlug || 'prod'}-${Date.now()}`;

      const insertPayload: any = {
        name: prodData.name.trim(),
        slug: prodData.slug && prodData.slug.trim() ? prodData.slug.trim() : uniqueSlug,
        description: prodData.description || null,
        category: prodData.category,
        price_cents: prodData.price_cents,
        currency: 'PEN',
        stock: prodData.stock,
        min_stock: prodData.min_stock ?? 5,
        barcode: prodData.barcode || null,
        unit_measure: prodData.unit_measure || 'unidad',
        use_type: prodData.use_type || 'venta',
        is_active: prodData.active !== undefined ? prodData.active : true,
        images: prodData.image_url ? [prodData.image_url] : [],
        sort_order: 0,
      };

      const { data, error } = await supabase
        .from('products')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Error al insertar producto en Supabase:', error);
        return false;
      }

      if (data) {
        const newProd: Product = {
          id: data.id,
          name: data.name,
          slug: data.slug,
          category: (data.category || 'ceras_pomadas') as any,
          price_cents: data.price_cents,
          stock: data.stock,
          min_stock: data.min_stock ?? 5,
          barcode: data.barcode || undefined,
          unit_measure: data.unit_measure || 'unidad',
          use_type: (data.use_type as ProductUseType) || 'venta',
          image_url: data.images && data.images.length > 0 ? data.images[0] : prodData.image_url,
          description: data.description || '',
          active: data.is_active !== undefined ? data.is_active : true,
        };
        setProducts((prev) => [newProd, ...prev]);

        // Si se registró con stock inicial mayor a cero, registrar movimiento INGRESO
        if (newProd.stock > 0) {
          supabase.from('inventory_movements').insert({
            product_id: newProd.id,
            movement_type: 'INGRESO',
            quantity: newProd.stock,
            user_id: currentUser?.id || null,
            area_destination: 'Almacén Principal',
            notes: 'Stock inicial por alta de producto',
          }).then();
        }

        pulseRealtime();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error adding product:', err);
      return false;
    }
  }, [pulseRealtime, currentUser]);

  const updateProduct = useCallback(async (prod: Product): Promise<boolean> => {
    try {

      if (prod.id.startsWith('prod-')) return false;
      {
        const { error } = await supabase
          .from('products')
          .update({
            name: prod.name.trim(),
            category: prod.category,
            description: prod.description || null,
            price_cents: prod.price_cents,
            stock: prod.stock,
            min_stock: prod.min_stock ?? 5,
            barcode: prod.barcode || null,
            unit_measure: prod.unit_measure || 'unidad',
            use_type: prod.use_type || 'venta',
            images: prod.image_url ? [prod.image_url] : [],
            is_active: prod.active !== undefined ? prod.active : true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prod.id).select('id').single();

        if (error) {
          console.error('Error al actualizar producto en Supabase:', error);
          return false;
        }
      }
      setProducts(prev => prev.map(p => p.id === prod.id ? prod : p));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error updating product:', err);
      return false;
    }
  }, [pulseRealtime]);

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Borrado Lógico (Soft Delete): Retirar del catálogo activo local

      if (id.startsWith('prod-')) return false;
      {
        // Soft delete en Supabase para proteger la integridad de ventas y movimientos
        const { error } = await supabase
          .from('products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id).select('id').single();
        if (error) {
          console.error('Error al realizar soft delete de producto en Supabase:', error);
          return false;
        }
      }
      setProducts(prev => prev.filter(p => p.id !== id));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error deleting product:', err);
      return false;
    }
  }, [pulseRealtime]);

  const addWardrobeItem = useCallback(async (itemData: Omit<WardrobeItem, 'id'>): Promise<boolean> => {
    try {
      const codeUpper = (itemData.code || 'A').toUpperCase().trim();
      const insertPayload = {
        name: itemData.name,
        code: codeUpper,
        description: itemData.description || null,
        category: itemData.category,
        price_cents: itemData.rental_price_cents,
        deposit_cents: itemData.deposit_cents || 0,
        availability_status: itemData.status === 'mantenimiento' ? 'en_mantenimiento' : itemData.status || 'disponible',
        is_active: itemData.active !== undefined ? itemData.active : true,
        images: itemData.image_url ? [itemData.image_url] : [],
      };

      const { data, error } = await supabase
        .from('wardrobe_items')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Error al insertar prenda de vestuario en Supabase:', error);
        return false;
      }

      if (data) {
        const newItem: WardrobeItem = {
          id: data.id,
          code: (data.code || codeUpper).toUpperCase().trim(),
          name: data.name,
          category: data.category || 'Bodas y Matrimonio',
          rental_price_cents: data.price_cents,
          deposit_cents: data.deposit_cents || 0,
          status: (data.availability_status || 'disponible') as WardrobeStatus,
          active: data.is_active !== undefined ? data.is_active : true,
          image_url: data.images && data.images.length > 0 ? data.images[0] : itemData.image_url,
          description: data.description || '',
        };
        setWardrobe((prev) => [...prev, newItem]);
        pulseRealtime();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error adding wardrobe item:', err);
      return false;
    }
  }, [pulseRealtime]);

  const updateWardrobeItem = useCallback(async (item: WardrobeItem): Promise<boolean> => {
    try {
      const codeUpper = (item.code || 'A').toUpperCase().trim();
      const updatedItem = { ...item, code: codeUpper };

      if (item.id.startsWith('ward-')) return false;
      {
        const { error } = await supabase.from('wardrobe_items').update({
          name: item.name,
          code: codeUpper,
          description: item.description || null,
          category: item.category,
          price_cents: item.rental_price_cents,
          deposit_cents: item.deposit_cents,
          availability_status: item.status === 'mantenimiento' ? 'en_mantenimiento' : item.status,
          is_active: item.active !== undefined ? item.active : true,
          images: item.image_url ? [item.image_url] : [],
          updated_at: new Date().toISOString(),
        }).eq('id', item.id).select('id').single();

        if (error) {
          console.error('Error al actualizar prenda de vestuario en Supabase:', error);
          return false;
        }
      }
      setWardrobe((prev) => prev.map((w) => (w.id === item.id ? updatedItem : w)));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error updating wardrobe item:', err);
      return false;
    }
  }, [pulseRealtime]);

  const deleteWardrobeItem = useCallback(async (id: string): Promise<boolean> => {
    try {

      if (id.startsWith('ward-')) return false;
      {
        const { error } = await supabase.from('wardrobe_items').delete().eq('id', id).select('id').single();
        if (error) {
          console.error('Error al eliminar prenda en Supabase:', error);
          return false;
        }
      }
      setWardrobe((prev) => prev.filter((w) => w.id !== id));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error deleting wardrobe item:', err);
      return false;
    }
  }, [pulseRealtime]);

  const toggleWardrobeActive = useCallback(async (id: string, currentActive: boolean): Promise<boolean> => {
    try {
      const nextActive = !currentActive;

      if (id.length !== 36) return false;
      {
        const { error } = await supabase.from('wardrobe_items').update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        }).eq('id', id).select('id').single();

        if (error) {
          console.error('Error al alternar visibilidad de vestuario en Supabase:', error);
          return false;
        }
      }
      setWardrobe((prev) => prev.map((w) => (w.id === id ? { ...w, active: nextActive } : w)));
      pulseRealtime();
      return true;
    } catch (err) {
      console.error('Error toggling wardrobe active state:', err);
      return false;
    }
  }, [pulseRealtime]);

  const updateWardrobeStatus = useCallback(async (id: string, status: WardrobeStatus) => {
    const { error } = await supabase.from('wardrobe_items').update({
      availability_status: status === 'mantenimiento' ? 'en_mantenimiento' : status,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select('id').single();
    if (error) { setOperationError('No se pudo cambiar el estado de la prenda.'); return; }
    setWardrobe(prev => prev.map(w => w.id === id ? { ...w, status } : w));
    pulseRealtime();
  }, [pulseRealtime]);

  // ==========================================
  // OPERACIONES DE ALQUILER DE VESTUARIOS (dress_rentals)
  // ==========================================
  const addDressRental = useCallback(async (data: Omit<DressRental, 'id' | 'ticket_code' | 'created_at' | 'updated_at'>): Promise<DressRental | null> => {
    const key = 'dress:' + JSON.stringify(data);
    if (pendingOperations.current.has(key)) return null;
    pendingOperations.current.add(key);
    try {
      // The private upload path binds web vouchers to this request ID.
      const id = data.origin === 'web' ? data.voucher_url?.split('/')[1] : requestId(key);
      const created = await qaRpc<DressRental>('qa_create_dress_rental', { p_request_id: id, p_rental: data });
      setDressRentals(prev => [created, ...prev.filter(r => r.id !== created.id)]);
      pulseRealtime();
      return created;
    } finally { pendingOperations.current.delete(key); }
  }, [pulseRealtime]);

  const transitionDress = useCallback(async (id: string, action: string, amount = 0, guarantee = 0, reason = '') => {
    if (pendingOperations.current.has(id)) return false;
    pendingOperations.current.add(id);
    try {
      const saved = await qaRpc<DressRental>('qa_transition_dress', { p_id: id, p_action: action, p_amount: amount, p_guarantee: guarantee, p_reason: reason });
      setDressRentals(prev => prev.map(r => r.id === id ? saved : r));
      pulseRealtime();
      return true;
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'No se pudo guardar el alquiler.');
      return false;
    } finally { pendingOperations.current.delete(id); }
  }, [pulseRealtime]);
  const validateYapeVoucher = useCallback((id: string, approved: boolean, reason?: string) => transitionDress(id, approved ? 'approve' : 'cancel', 0, 0, reason), [transitionDress]);
  const confirmDressDelivery = useCallback((id: string, amount: number, guarantee: number) => transitionDress(id, 'deliver', amount, guarantee), [transitionDress]);
  const processDressReturn = useCallback((id: string, guarantee: number, reason?: string) => transitionDress(id, 'return', 0, guarantee, reason), [transitionDress]);
  const cancelDressRental = useCallback((id: string, reason?: string) => transitionDress(id, 'cancel', 0, 0, reason), [transitionDress]);
  const deleteDressRental = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await (supabase as any).from('dress_rentals').delete().eq('id', id).select('id').single();
    if (error || !data) { setOperationError('No se pudo eliminar el alquiler.'); return false; }
    setDressRentals(prev => prev.filter(r => r.id !== id));
    pulseRealtime();
    return true;
  }, [pulseRealtime]);

  // KPI CALCULATIONS (Reglas oficiales: Section C.1 & C.5 - Filtrado estricto por "Hoy" America/Lima UTC-5)
  const kpis = useMemo(() => {
    const today = getTodayDateString();

    // 1. Citas activas de Hoy (excluyendo canceladas y expiradas)
    const activeBookings = bookings.filter((b) => {
      if (
        b.status === 'cancelada' ||
        b.status === 'cancelled' ||
        b.status === 'expirada' ||
        Boolean(b.cancelled_at) ||
        Boolean(b.expired_at)
      ) {
        return false;
      }
      return getLimaDateFromTimestamp(b.date) === today;
    });

    // Suma únicamente reservas en estado PAGADO (100%) y adelantos percibidos en tiempo real
    const ingresosServiciosCents = activeBookings.reduce(
      (acc, b) => acc + getBookingCollectedAmountCents(b),
      0
    );

    // 2. Ventas de Mostrador de Hoy (excluyendo anuladas)
    const activeVentas = ventasMostrador.filter(
      (v: any) => !v.voided && getLimaDateFromTimestamp(v.created_at || v.fecha) === today
    );
    const ventasMostradorCents = activeVentas.reduce(
      (acc, v) => acc + (v.total_price_cents || 0),
      0
    );

    const totalIngresosCents = ingresosServiciosCents + ventasMostradorCents;

    // 3. Egresos Operativos de Hoy (excluyendo anulados)
    const activeExpenses = expenses.filter(
      (e) => !e.voided && getLimaDateFromTimestamp(e.date || e.created_at) === today
    );
    const totalEgresosCents = activeExpenses.reduce(
      (acc, e) => acc + (e.amount_cents || 0),
      0
    );

    const balanceNetoCents = totalIngresosCents - totalEgresosCents;

    const citasHoy = bookings.filter(
      (b) =>
        getLimaDateFromTimestamp(b.date) === today &&
        b.status !== 'cancelada' &&
        b.status !== 'cancelled' &&
        !b.cancelled_at
    );
    const citasConfirmadas = citasHoy.filter(
      (b) => b.payment_status === 'total' || b.payment_status === 'parcial'
    );

    const saldosPorCobrarCents = activeBookings.reduce((acc, b) => {
      const collected = getBookingCollectedAmountCents(b);
      const saldo = Math.max(0, (b.total_price_cents || 0) - collected);
      return acc + saldo;
    }, 0);

    return {
      totalIngresosCents,
      ingresosServiciosCents,
      ventasMostradorCents,
      totalEgresosCents,
      balanceNetoCents,
      citasHoyCount: citasHoy.length,
      citasConfirmadasCount: citasConfirmadas.length,
      saldosPorCobrarCents,
    };
  }, [bookings, expenses, ventasMostrador]);

  return (
    <AppContext.Provider
      value={{
        currentRole,
        isAuthLoading,
        isDataLoading,
        isLoading: isDataLoading,
        activeView,
        setActiveView,
        currentUser,
        signOut,
        services,
        products,
        wardrobe,
        employees,
        setEmployees,
        employeeBlocks,
        setEmployeeBlocks,
        bookings,
        paymentLogs,
        ventasMostrador,
        expenses,
        attendance,
        attendanceRecords: attendance,
        paymentSettings,
        bonusSettings,
        attendanceSettings,
        updateAttendanceSettings,
        cart,
        whatsappNumber,
        revalidateCart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        activeTicket,
        openTicketModal,
        closeTicketModal,
        lightboxImage,
        openLightbox,
        closeLightbox,
        realtimeConnected,
        pulseRealtime,
        lastSyncTimestamp,
        refreshData: fetchAllFromSupabase,
        addBooking,
        registerBookingPayment,
        voidPayment,
        liberateServiceEarly,
        reassignBookingService,
        updateBookingServicePrice,
        deleteBooking,
        editBooking,
        processPosSaleWithStock,
        deleteVentaMostrador,
        setProducts,
        addExpense,
        voidExpense,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        toggleEmployeeActive,
        addEmployeeLeave,
        deleteEmployeeBlock,
        scanAttendanceQR,
        resolveEmployeeFromCode,
        registerAttendanceExit,
        registerAttendancePunch,
        manualAdjustBonus,
        submitJustification,
        updatePaymentSettings,
        updateBonusSettings,
        addService,
        updateService,
        deleteService,
        toggleServiceActive,
        addProduct,
        updateProduct,
        deleteProduct,
        addWardrobeItem,
        updateWardrobeItem,
        deleteWardrobeItem,
        toggleWardrobeActive,
        updateWardrobeStatus,
        dressRentals,
        addDressRental,
        validateYapeVoucher,
        confirmDressDelivery,
        processDressReturn,
        cancelDressRental,
        deleteDressRental,
        kpis,
      }}
    >
      {children}
      {operationError && <div role="alert" className="fixed bottom-4 left-4 right-4 z-[200] rounded-xl bg-rose-950 border border-rose-500 p-4 text-white text-sm flex justify-between gap-4">
        <span>{operationError}</span><button onClick={() => setOperationError(null)}>Cerrar</button>
      </div>}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
