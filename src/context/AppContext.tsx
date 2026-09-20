import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserRole,
  Service,
  Product,
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
  INITIAL_SERVICES,
  INITIAL_PRODUCTS,
  INITIAL_WARDROBE,
  INITIAL_DRESS_RENTALS,
  INITIAL_EMPLOYEES,
  INITIAL_BOOKINGS,
  INITIAL_PAYMENT_LOGS,
  INITIAL_VENTAS_MOSTRADOR,
  INITIAL_EXPENSES,
  INITIAL_ATTENDANCE,
  INITIAL_PAYMENT_SETTINGS,
  INITIAL_BONUS_SETTINGS,
  INITIAL_ATTENDANCE_SETTINGS,
  getTodayDateString,
} from '../data/initialData';
import { sanitizePhone, sanitizeDni } from '../lib/validators';
import { supabase } from '../lib/supabase/client';
import { timeToMinutes, minutesToTime } from '../lib/bookingAvailability';

interface AppContextType {
  // Navigation & Role
  currentRole: UserRole;
  isAuthLoading: boolean;
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
  addBooking: (booking: Omit<Booking, 'id' | 'code' | 'created_at'>) => Booking;
  registerBookingPayment: (
    bookingId: string,
    amountCents: number,
    method: 'yape' | 'efectivo' | 'transferencia' | 'mixto' | string,
    cashCents?: number,
    yapeCents?: number,
    voucherUrl?: string,
    notes?: string
  ) => void;
  voidPayment: (paymentId: string, reason: string) => void;
  liberateServiceEarly: (bookingId: string, serviceIndex: number) => void;
  reassignBookingService: (bookingId: string, serviceIndex: number, newEmployeeId: string, newEmployeeName: string) => Promise<void>;
  updateBookingServicePrice: (bookingId: string, serviceIndex: number, newPriceCents: number) => Promise<void>;
  deleteBooking: (bookingId: string) => Promise<boolean>;
  editBooking: (bookingId: string, updates: Partial<Booking>) => Promise<boolean>;

  // POS
  registerVentaMostrador: (venta: Omit<VentaMostrador, 'id' | 'ticket_number' | 'created_at'> & { created_at?: string }) => VentaMostrador;
  registerCounterSale: (venta: Omit<VentaMostrador, 'id' | 'ticket_number' | 'created_at'> & { created_at?: string }) => VentaMostrador;
  deleteVentaMostrador: (id: string) => void;

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
  };
  registerAttendancePunch: (employeeId: string, punchType: 'check_in' | 'check_out') => void;
  manualAdjustBonus: (attendanceId: string, newBonusMinutes: number, reason: string) => void;
  submitJustification: (attendanceId: string, note: string, docUrl?: string) => void;

  // Settings
  updatePaymentSettings: (settings: Partial<PaymentSettings>) => void;
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
    setActiveViewState(view);
    if (typeof window !== 'undefined' && window.location.pathname !== view) {
      window.history.pushState(null, '', view);
    }
  }, []);

  // Sincronizar navegación con el historial del navegador
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        setActiveViewState(window.location.pathname || '/');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Protección de rutas: redirigir a clientes y no autenticados fuera de /dashboard SOLO cuando la autenticación no esté cargando
  useEffect(() => {
    if (isAuthLoading) return;

    if (
      activeViewState.startsWith('/dashboard') &&
      (currentRole === 'cliente' || currentRole === 'anonimo' || currentRole === 'anon')
    ) {
      setActiveView('/mi-cuenta');
    }
  }, [activeViewState, currentRole, isAuthLoading, setActiveView]);
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(INITIAL_WARDROBE);
  const [dressRentals, setDressRentals] = useState<DressRental[]>(INITIAL_DRESS_RENTALS);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [employeeBlocks, setEmployeeBlocks] = useState<EmployeeBlock[]>([]);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>(INITIAL_PAYMENT_LOGS);
  const [ventasMostrador, setVentasMostrador] = useState<VentaMostrador[]>(INITIAL_VENTAS_MOSTRADOR);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>(INITIAL_ATTENDANCE);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(INITIAL_PAYMENT_SETTINGS);
  const [bonusSettings, setBonusSettings] = useState<BonusSettings>(INITIAL_BONUS_SETTINGS);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>(INITIAL_ATTENDANCE_SETTINGS);
  const [cart, setCart] = useState<CartItem[]>([]);
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
      if (dbServices && dbServices.length > 0) {
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

      // 2. Productos
      const { data: dbProducts } = await supabase.from('products').select('*').order('sort_order');
      if (dbProducts && dbProducts.length > 0) {
        setProducts(
          dbProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: (p.category || 'ceras_pomadas') as any,
            price_cents: p.price_cents,
            stock: p.stock,
            image_url: p.images && p.images.length > 0 ? p.images[0] : 'https://images.unsplash.com/photo-1585232351009-aa87416fca90?auto=format&fit=crop&w=600&q=80',
            description: p.description || '',
            active: p.is_active !== undefined ? p.is_active : true,
          }))
        );
      }

      // 3. Vestuario
      const { data: dbWardrobe } = await supabase.from('wardrobe_items').select('*').order('code');
      if (dbWardrobe && dbWardrobe.length > 0) {
        setWardrobe(
          dbWardrobe.map((w: any) => ({
            id: w.id,
            code: (w.code || 'A').toUpperCase().trim(),
            name: w.name,
            category: w.category || 'Bodas y Matrimonio',
            rental_price_cents: w.price_cents,
            deposit_cents: w.deposit_cents || 0,
            status: (w.availability_status || 'disponible') as WardrobeStatus,
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
      if (dbRentals && dbRentals.length > 0) {
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
      if (dbEmployees && dbEmployees.length > 0) {
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
            avatar: e.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
            avatar_url: e.avatar_url,
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

      // 5. Configuración de Negocio
      const { data: dbConfig } = await supabase.from('business_config').select('*').limit(1).single();
      if (dbConfig) {
        setPaymentSettings((prev) => ({
          ...prev,
          advance_percentage: dbConfig.advance_percentage || 25,
          yape_phone: dbConfig.whatsapp_url?.replace(/\D/g, '') || '987654321',
        }));
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
        if (role === 'cliente') {
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
          }))
        );
      }

      // 7. Pagos
      const { data: dbPayments } = await supabase
        .from('payment_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbPayments && dbPayments.length > 0) {
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
            voided: p.status === 'voided',
            voided_reason: p.void_reason || undefined,
            voided_by: p.voided_by || undefined,
          }))
        );
      }

      // 8. Ventas de Mostrador
      const { data: dbVentas } = await supabase
        .from('ventas_mostrador')
        .select('*')
        .order('fecha', { ascending: false });
      if (dbVentas && dbVentas.length > 0) {
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

      // 9. Egresos
      const { data: dbExpenses } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (dbExpenses && dbExpenses.length > 0) {
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

      // 10. Configuración de Asistencia
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

      // 11. Registros de Asistencia
      const { data: dbAttendances } = await supabase
        .from('employee_attendances')
        .select('*')
        .order('date', { ascending: false });
      if (dbAttendances && dbAttendances.length > 0) {
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
            };
          })
        );
      }

      setLastSyncTimestamp(new Date());
    } catch (err) {
      console.warn('Conexión en línea con Supabase completada con fallbacks:', err);
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

  // Cart Functions
  const addToCart = useCallback((product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // BOOKING HANDLERS
  const addBooking = useCallback((bookingData: Omit<Booking, 'id' | 'code' | 'created_at'>): Booking => {
    const today = getTodayDateString();
    const randomCode = `AC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newId = `bk-${Date.now()}`;
    const sanitizedServices = (bookingData.services || []).map((srv) => {
      const srvStart = (srv.hora_inicio || srv.start_time || bookingData.start_time)?.substring(0, 5) || '10:00';
      const srvDuration = srv.duration_minutes || 30;
      const calcEnd = minutesToTime(timeToMinutes(srvStart) + srvDuration);
      const rawEnd = (srv.hora_fin || srv.end_time)?.substring(0, 5) || calcEnd;
      const effectiveEnd = (timeToMinutes(rawEnd) - timeToMinutes(srvStart) > srvDuration + 5) ? calcEnd : rawEnd;
      return {
        ...srv,
        hora_inicio: srvStart,
        hora_fin: effectiveEnd,
        start_time: srvStart,
        end_time: effectiveEnd,
        duration_minutes: srvDuration,
      };
    });

    const newBooking: Booking = {
      ...bookingData,
      services: sanitizedServices,
      id: newId,
      code: randomCode,
      created_at: `${today}T12:00:00Z`,
    };

    setBookings((prev) => [newBooking, ...prev]);
    pulseRealtime();

    // Persistir directamente en Supabase
    (async () => {
      try {
        const names = bookingData.client_name.trim().split(' ');
        const firstName = names[0] || 'Cliente';
        const lastName = names.slice(1).join(' ') || 'General';

        // Buscar UUID de empleado si es valido
        const primaryEmpId = bookingData.services?.[0]?.employee_id;
        const validEmp = employees.find(
          (e) => e.id === primaryEmpId || e.full_name === bookingData.services?.[0]?.employee_name
        );
        const safeEmployeeId =
          primaryEmpId && primaryEmpId.includes('-') && primaryEmpId.length === 36
            ? primaryEmpId
            : validEmp && validEmp.id.includes('-') && validEmp.id.length === 36
            ? validEmp.id
            : null;

        const advanceAmount = bookingData.advance_amount_cents || 0;
        const advancePercentage = Math.max(1, paymentSettings?.advance_percentage || 25);
        const totalPrice = bookingData.total_price_cents || 0;
        const balance = Math.max(0, totalPrice - advanceAmount);

        const authUid =
          currentUserOverride?.id && currentUserOverride.id.includes('-')
            ? currentUserOverride.id
            : (await supabase.auth.getSession()).data.session?.user?.id || null;

        const { data: insertedBooking, error } = await supabase
          .from('bookings')
          .insert({
            booking_code: randomCode,
            user_id: authUid,
            client_first_name: firstName,
            client_last_name: lastName,
            client_phone: sanitizePhone(bookingData.client_phone) || null,
            client_email: bookingData.client_email || null,
            client_dni: sanitizeDni(bookingData.client_dni) || null,
            service_type: bookingData.type || 'barberia',
            booking_date: bookingData.date,
            start_time: bookingData.start_time,
            end_time: bookingData.end_time,
            total_duration_minutes:
              bookingData.services?.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) || 60,
            total_price_cents: totalPrice,
            advance_percentage: advancePercentage,
            advance_amount_cents: advanceAmount,
            balance_cents: balance,
            payment_status:
              bookingData.payment_status ||
              (advanceAmount >= totalPrice ? 'total' : advanceAmount > 0 ? 'parcial' : 'sin_pago'),
            assigned_employee_id: safeEmployeeId,
            payment_method: (bookingData as any).payment_method || null,
          })
          .select()
          .single();

        if (insertedBooking) {
          if (bookingData.services && bookingData.services.length > 0) {
            const serviceRows = bookingData.services.map((srv) => {
              const matchedService = services.find(
                (s) => s.id === srv.service_id || s.name === srv.service_name
              );
              const srvId =
                matchedService && matchedService.id.includes('-') && matchedService.id.length === 36
                  ? matchedService.id
                  : srv.service_id && srv.service_id.includes('-') && srv.service_id.length === 36
                  ? srv.service_id
                  : null;

              const srvEmp = employees.find(
                (e) => e.id === srv.employee_id || e.full_name === srv.employee_name
              );
              const srvEmpId =
                srv.employee_id && srv.employee_id.includes('-') && srv.employee_id.length === 36
                  ? srv.employee_id
                  : srvEmp && srvEmp.id.includes('-') && srvEmp.id.length === 36
                  ? srvEmp.id
                  : safeEmployeeId;

              const srvHoraInicio = (srv.hora_inicio || srv.start_time || bookingData.start_time)?.substring(0, 5) || '10:00';
              const srvDuration = srv.duration_minutes || 30;
              const calcFin = minutesToTime(timeToMinutes(srvHoraInicio) + srvDuration);
              const rawFin = (srv.hora_fin || srv.end_time)?.substring(0, 5) || calcFin;
              const srvHoraFin = (timeToMinutes(rawFin) - timeToMinutes(srvHoraInicio) > srvDuration + 5) ? calcFin : rawFin;

              return {
                booking_id: insertedBooking.id,
                service_id: srvId,
                service_name: srv.service_name,
                service_price_cents: srv.price_cents,
                duration_minutes: srvDuration,
                assigned_employee_id: srvEmpId,
                hora_inicio: srvHoraInicio,
                hora_fin: srvHoraFin,
                start_time: srvHoraInicio,
                end_time: srvHoraFin,
                status: 'confirmada',
              };
            });
            await supabase.from('booking_services').insert(serviceRows);
          }

          // Si se registró un pago de adelanto o total al crear la reserva, registrar en payment_logs
          if (advanceAmount > 0) {
            const pMethod = (bookingData as any).payment_method || 'efectivo';
            const cashC = (bookingData as any).cash_cents || (pMethod === 'efectivo' ? advanceAmount : 0);
            const yapeC = (bookingData as any).yape_cents || (pMethod === 'yape' ? advanceAmount : 0);
            const pNotes = (bookingData as any).payment_notes || null;

            await supabase.from('payment_logs').insert({
              booking_id: insertedBooking.id,
              amount_cents: advanceAmount,
              payment_method: pMethod,
              payment_type: advanceAmount >= totalPrice ? 'total' : 'advance',
              cash_amount_cents: cashC,
              yape_amount_cents: yapeC,
              notes: pNotes,
              status: 'verified',
            });

            const newLog: PaymentLog = {
              id: `pay-${Date.now()}`,
              booking_id: insertedBooking.id,
              booking_code: insertedBooking.booking_code,
              amount_cents: advanceAmount,
              payment_method: pMethod,
              cash_cents: cashC,
              yape_cents: yapeC,
              transfer_cents: (bookingData as any).transfer_cents || 0,
              notes: pNotes,
              created_at: `${today}T12:00:00Z`,
              voided: false,
            };
            setPaymentLogs((prev) => [newLog, ...prev]);
          }

          // Actualizar ID local al UUID de Supabase
          setBookings((prev) =>
            prev.map((b) =>
              b.id === newId
                ? {
                    ...b,
                    id: insertedBooking.id,
                    code: insertedBooking.booking_code,
                  }
                : b
            )
          );
          pulseRealtime();
        } else if (error) {
          console.error('Error al insertar reserva en Supabase:', error);
        }
      } catch (err) {
        console.error('Error guardando reserva en Supabase:', err);
      }
    })();

    return newBooking;
  }, [paymentSettings.advance_percentage, pulseRealtime, employees, services]);

  const registerBookingPayment = useCallback(
    async (
      bookingId: string,
      amountCents: number,
      method: 'yape' | 'efectivo' | 'transferencia' | 'mixto' | string,
      cashCents = 0,
      yapeCents = 0,
      voucherUrl?: string,
      notes?: string
    ) => {
      const today = getTodayDateString();
      const targetBooking = bookings.find((b) => b.id === bookingId);
      const prevAdvance = targetBooking?.advance_amount_cents || 0;
      const totalPrice = targetBooking?.total_price_cents || 0;
      const newAdvance = prevAdvance + amountCents;
      const newBalance = Math.max(0, totalPrice - newAdvance);

      let payStatus: Booking['payment_status'] = 'sin_pago';
      if (newAdvance >= totalPrice && totalPrice > 0) {
        payStatus = 'total';
      } else if (newAdvance > 0) {
        payStatus = 'parcial';
      }

      setBookings((prev) => {
        return prev.map((b) => {
          if (b.id === bookingId) {
            return {
              ...b,
              advance_amount_cents: newAdvance,
              balance_cents: newBalance,
              payment_status: payStatus,
              confirmed_at: b.confirmed_at || (newAdvance > 0 ? `${today}T12:00:00Z` : undefined),
            };
          }
          return b;
        });
      });

      const newLog: PaymentLog = {
        id: `pay-${Date.now()}`,
        booking_id: bookingId,
        booking_code: targetBooking?.code || 'AC-0000',
        amount_cents: amountCents,
        payment_method: method,
        cash_cents: cashCents,
        yape_cents: yapeCents,
        voucher_url: voucherUrl,
        notes: notes,
        created_at: `${today}T12:00:00Z`,
        voided: false,
      };
      setPaymentLogs((prev) => [newLog, ...prev]);
      pulseRealtime();

      // Guardar log en Supabase y actualizar reserva
      if (bookingId.includes('-') && bookingId.length === 36) {
        try {
          await supabase.from('payment_logs').insert({
            booking_id: bookingId,
            amount_cents: amountCents,
            payment_method: method,
            cash_amount_cents: cashCents,
            yape_amount_cents: yapeCents,
            proof_url: voucherUrl || null,
            notes: notes || null,
            status: 'verified',
          });

          await supabase.from('bookings').update({
            advance_amount_cents: newAdvance,
            balance_cents: newBalance,
            payment_status: payStatus,
            confirmed_at: newAdvance > 0 ? (targetBooking?.confirmed_at || new Date().toISOString()) : null,
          }).eq('id', bookingId);

          pulseRealtime();
        } catch (err) {
          console.error('Error al registrar pago en Supabase:', err);
        }
      }
    },
    [bookings, pulseRealtime]
  );

  const voidPayment = useCallback((paymentId: string, reason: string) => {
    const payment = paymentLogs.find((p) => p.id === paymentId);
    if (!payment || payment.voided) return;

    setPaymentLogs((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, voided: true, voided_reason: reason, voided_by: currentUser.name }
          : p
      )
    );

    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === payment.booking_id) {
          const newAdvance = Math.max(0, b.advance_amount_cents - payment.amount_cents);
          let newPayStatus: Booking['payment_status'] = 'sin_pago';
          if (newAdvance >= b.total_price_cents && b.total_price_cents > 0) {
            newPayStatus = 'total';
          } else if (newAdvance > 0) {
            newPayStatus = 'parcial';
          }
          return {
            ...b,
            advance_amount_cents: newAdvance,
            balance_cents: Math.max(0, b.total_price_cents - newAdvance),
            payment_status: newPayStatus,
          };
        }
        return b;
      })
    );
    pulseRealtime();

    if (paymentId.includes('-') && paymentId.length === 36) {
      supabase.from('payment_logs').update({
        status: 'voided',
        void_reason: reason,
        voided_at: new Date().toISOString(),
      }).eq('id', paymentId).then();
    }
  }, [currentUser.name, paymentLogs, pulseRealtime]);

  const liberateServiceEarly = useCallback((bookingId: string, serviceIndex: number) => {
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          const updatedServices = [...b.services];
          if (updatedServices[serviceIndex]) {
            updatedServices[serviceIndex] = {
              ...updatedServices[serviceIndex],
              liberado_at: nowTime,
            };
          }
          return { ...b, services: updatedServices };
        }
        return b;
      })
    );
    pulseRealtime();

    if (bookingId.includes('-') && bookingId.length === 36) {
      supabase
        .from('booking_services')
        .select('id')
        .eq('booking_id', bookingId)
        .order('created_at')
        .then(({ data }) => {
          if (data && data[serviceIndex]) {
            supabase
              .from('booking_services')
              .update({
                liberado_at: nowIso,
                status: 'completada',
              })
              .eq('id', data[serviceIndex].id)
              .then(() => {
                pulseRealtime();
              });
          }
        });
    }
  }, [pulseRealtime]);

  const reassignBookingService = useCallback(
    async (bookingId: string, serviceIndex: number, newEmployeeId: string, newEmployeeName: string) => {
      // 1. Actualización optimista en estado local de React
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id === bookingId) {
            const updatedServices = [...(b.services || [])];
            if (updatedServices[serviceIndex]) {
              updatedServices[serviceIndex] = {
                ...updatedServices[serviceIndex],
                employee_id: newEmployeeId,
                employee_name: newEmployeeName,
              };
            }
            return {
              ...b,
              services: updatedServices,
              ...(serviceIndex === 0 ? { assigned_employee_id: newEmployeeId } : {}),
            };
          }
          return b;
        })
      );
      pulseRealtime();

      // 2. Persistencia en Supabase
      if (bookingId.includes('-') && bookingId.length === 36) {
        try {
          const currentBooking = bookings.find((b) => b.id === bookingId);
          const serviceRow = currentBooking?.services?.[serviceIndex];
          const serviceRowId = serviceRow?.id;

          if (serviceRowId && serviceRowId.includes('-') && serviceRowId.length === 36) {
            await supabase
              .from('booking_services')
              .update({ assigned_employee_id: newEmployeeId })
              .eq('id', serviceRowId);
          } else {
            const { data: dbServices } = await supabase
              .from('booking_services')
              .select('id')
              .eq('booking_id', bookingId)
              .order('created_at', { ascending: true });

            if (dbServices && dbServices[serviceIndex]) {
              await supabase
                .from('booking_services')
                .update({ assigned_employee_id: newEmployeeId })
                .eq('id', dbServices[serviceIndex].id);
            }
          }

          if (serviceIndex === 0) {
            await supabase
              .from('bookings')
              .update({ assigned_employee_id: newEmployeeId })
              .eq('id', bookingId);
          }

          pulseRealtime();
        } catch (err) {
          console.error('Error al reasignar especialista en Supabase:', err);
        }
      }
    },
    [bookings, pulseRealtime]
  );

  const updateBookingServicePrice = useCallback(
    async (bookingId: string, serviceIndex: number, newPriceCents: number) => {
      // 1. Verificación de rol: solo Administrador
      const isEffectiveAdmin = currentRole === 'admin' || currentUser?.role === 'admin';
      if (!isEffectiveAdmin) {
        throw new Error('Permiso denegado: Solo el Administrador puede modificar los precios de servicios individuales.');
      }

      if (newPriceCents < 0 || isNaN(newPriceCents)) {
        throw new Error('El precio debe ser un número válido mayor o igual a 0.');
      }

      const targetBooking = bookings.find((b) => b.id === bookingId);
      if (!targetBooking) {
        throw new Error('Reserva no encontrada');
      }

      const updatedServices = [...(targetBooking.services || [])];
      if (updatedServices[serviceIndex]) {
        updatedServices[serviceIndex] = {
          ...updatedServices[serviceIndex],
          price_cents: newPriceCents,
        };
      }
      const newTotal = updatedServices.reduce((sum, s) => sum + (s.price_cents || 0), 0);
      const advance = targetBooking.advance_amount_cents || 0;
      const newBalance = Math.max(0, newTotal - advance);
      const newStatus: PaymentStatus =
        advance >= newTotal && newTotal > 0
          ? 'total'
          : advance > 0
          ? 'parcial'
          : 'sin_pago';

      // 2. Actualización optimista inmediata en estado local de React
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id === bookingId) {
            return {
              ...b,
              services: updatedServices,
              total_price_cents: newTotal,
              balance_cents: newBalance,
              payment_status: newStatus,
            };
          }
          return b;
        })
      );
      pulseRealtime();

      // 3. Persistencia en Supabase
      if (bookingId.includes('-') && bookingId.length === 36) {
        try {
          const serviceRow = targetBooking.services?.[serviceIndex];
          const serviceRowId = serviceRow?.id;

          if (serviceRowId && serviceRowId.includes('-') && serviceRowId.length === 36) {
            const { error: srvErr } = await supabase
              .from('booking_services')
              .update({ service_price_cents: newPriceCents })
              .eq('id', serviceRowId);
            if (srvErr) throw srvErr;
          } else {
            const { data: dbServices, error: fetchErr } = await supabase
              .from('booking_services')
              .select('id')
              .eq('booking_id', bookingId)
              .order('created_at', { ascending: true });
            if (fetchErr) throw fetchErr;

            if (dbServices && dbServices[serviceIndex]) {
              const { error: updateErr } = await supabase
                .from('booking_services')
                .update({ service_price_cents: newPriceCents })
                .eq('id', dbServices[serviceIndex].id);
              if (updateErr) throw updateErr;
            }
          }

          // Actualizar la cabecera en bookings con los montos recalculados
          const { error: bookingErr } = await supabase
            .from('bookings')
            .update({
              total_price_cents: newTotal,
              balance_cents: newBalance,
              payment_status: newStatus,
            })
            .eq('id', bookingId);
          if (bookingErr) throw bookingErr;

          pulseRealtime();
        } catch (err: any) {
          console.error('Error al actualizar precio de servicio en Supabase:', err);
          throw new Error(err?.message || 'Error al persistir el nuevo precio.');
        }
      }
    },
    [bookings, currentRole, currentUser, pulseRealtime]
  );

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
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updates } : b))
      );
      pulseRealtime();

      if (bookingId.includes('-') && bookingId.length === 36) {
        const dbUpdates: any = {};
        if (updates.client_name) {
          const parts = updates.client_name.trim().split(' ');
          dbUpdates.client_first_name = parts[0] || '';
          dbUpdates.client_last_name = parts.slice(1).join(' ') || '';
        }
        if (updates.client_phone !== undefined) dbUpdates.client_phone = updates.client_phone;
        if (updates.client_email !== undefined) dbUpdates.client_email = updates.client_email;
        if (updates.date !== undefined) dbUpdates.booking_date = updates.date;
        if (updates.start_time !== undefined) dbUpdates.start_time = updates.start_time;
        if (updates.end_time !== undefined) dbUpdates.end_time = updates.end_time;
        if (updates.total_price_cents !== undefined) dbUpdates.total_price_cents = updates.total_price_cents;
        if (updates.advance_amount_cents !== undefined) {
          dbUpdates.advance_amount_cents = updates.advance_amount_cents;
          if (updates.total_price_cents !== undefined) {
            dbUpdates.balance_cents = Math.max(0, updates.total_price_cents - updates.advance_amount_cents);
          }
        }

        const { error } = await supabase.from('bookings').update(dbUpdates).eq('id', bookingId);
        if (error) {
          console.error('Error al actualizar reserva en Supabase:', error);
          fetchAllFromSupabase();
          throw error;
        }
      }
      return true;
    } catch (err) {
      console.error('Error en editBooking:', err);
      return false;
    }
  }, [fetchAllFromSupabase, pulseRealtime]);

  // POS HANDLERS
  const registerVentaMostrador = useCallback((
    ventaData: Omit<VentaMostrador, 'id' | 'ticket_number' | 'created_at'> & { created_at?: string }
  ): VentaMostrador => {
    const today = getTodayDateString();
    const newVenta: VentaMostrador = {
      ...ventaData,
      id: `vnt-${Date.now()}`,
      ticket_number: `TK-${Math.floor(10000 + Math.random() * 90000)}`,
      created_at: ventaData.created_at || `${today}T12:00:00Z`,
    };

    setVentasMostrador((prev) => [newVenta, ...prev]);

    // Reducir stock únicamente si corresponde a un producto registrado del catálogo
    if (ventaData.product_id) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === ventaData.product_id
            ? { ...p, stock: Math.max(0, p.stock - ventaData.quantity) }
            : p
        )
      );
    }

    pulseRealtime();

    // Guardar venta de mostrador en Supabase (destino autorizado acicaladosMej)
    const isMixto = ventaData.payment_method?.toLowerCase() === 'mixto';
    const finalMetodoPago = isMixto ? 'MIXTO' : (ventaData.payment_method.charAt(0).toUpperCase() + ventaData.payment_method.slice(1));

    supabase.from('ventas_mostrador').insert({
      cliente_nombre: ventaData.client_name,
      producto_nombre: ventaData.product_name,
      cantidad: ventaData.quantity,
      precio_unitario: ventaData.unit_price_cents / 100,
      total: ventaData.total_price_cents / 100,
      metodo_pago: finalMetodoPago as any,
      notas: ventaData.notes || null,
      ticket_number: newVenta.ticket_number,
      fecha: newVenta.created_at,
      monto_efectivo: ventaData.monto_efectivo ?? (ventaData.cash_cents != null ? ventaData.cash_cents / 100 : null),
      monto_yape: ventaData.monto_yape ?? (ventaData.yape_cents != null ? ventaData.yape_cents / 100 : null),
      monto_transferencia: ventaData.monto_transferencia ?? (ventaData.transfer_cents != null ? ventaData.transfer_cents / 100 : null),
      detalles_pago: ventaData.detalles_pago || null,
    } as any).then();

    return newVenta;
  }, [pulseRealtime]);

  const deleteVentaMostrador = useCallback((id: string) => {
    setVentasMostrador((prev) => prev.filter((v) => v.id !== id));
    pulseRealtime();
    if (id.includes('-') && id.length === 36) {
      supabase.from('ventas_mostrador').delete().eq('id', id).then();
    }
  }, [pulseRealtime]);

  // EXPENSES HANDLERS
  const addExpense = useCallback((expenseData: Omit<Expense, 'id' | 'created_at' | 'voided'>) => {
    const today = getTodayDateString();
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      voided: false,
      created_at: `${today}T12:00:00Z`,
    };
    setExpenses((prev) => [newExpense, ...prev]);
    pulseRealtime();

    supabase.from('expenses').insert({
      description: expenseData.description,
      category: expenseData.category,
      amount_cents: expenseData.amount_cents,
      payment_method: expenseData.payment_method === 'efectivo' ? 'cash' : expenseData.payment_method,
      expense_date: expenseData.date,
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

      const insertPayload = {
        first_name: firstName,
        last_name: lastName,
        type: empData.type,
        dni: sanitizeDni(empData.dni) || null,
        phone: sanitizePhone(empData.phone) || null,
        email: empData.email || null,
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
        avatar: data.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        avatar_url: data.avatar_url,
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
        const { error } = await supabase
          .from('employees')
          .update({
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
          })
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
    } => {
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

      // CASO 2: SALIDA (Check-Out)
      if (currentAttendance && !currentAttendance.check_out) {
        const [inH, inM] = (currentAttendance.check_in || '09:00')
          .split(':')
          .map(Number);
        const inMinutes = inH * 60 + inM;
        const workedMinutes = Math.max(0, nowMinutes - inMinutes);

        const hasOvertime = nowMinutes > overtimeThreshold;
        const overtimeMinutes = hasOvertime ? Math.max(0, nowMinutes - exitMinutes) : 0;
        const punctuality = hasOvertime ? 'horas_extra' : 'puntual';

        const updatedAtt: EmployeeAttendance = {
          ...currentAttendance,
          check_out: nowLima,
          worked_minutes: workedMinutes,
          overtime_minutes: overtimeMinutes,
          bonus_minutes: overtimeMinutes,
          bonus_calculation_type: 'auto',
        };

        setAttendance((prev) =>
          prev.map((a) => (a.id === currentAttendance.id ? updatedAtt : a))
        );
        pulseRealtime();

        supabase
          .from('employee_attendances')
          .update({
            check_out: isoNow,
            overtime_minutes: overtimeMinutes,
            bonus_minutes: overtimeMinutes,
            bonus_calculation_type: 'auto',
          })
          .eq('id', currentAttendance.id)
          .then();

        const workedHoursStr = `${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m`;
        return {
          success: true,
          message: hasOvertime
            ? `¡Salida registrada a las ${nowLima}! Jornada: ${workedHoursStr}. Horas extra a favor: +${overtimeMinutes} min (${(overtimeMinutes / 60).toFixed(1)}h).`
            : `¡Salida registrada a las ${nowLima}! Jornada cumplida: ${workedHoursStr}.`,
          employee: emp,
          type: 'check_out',
          record: updatedAtt,
          punctuality,
          minutes: overtimeMinutes,
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
    [attendance, attendanceSettings, employees, pulseRealtime]
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
  const updatePaymentSettings = useCallback((newSettings: Partial<PaymentSettings>) => {
    setPaymentSettings((prev) => ({ ...prev, ...newSettings }));
    pulseRealtime();
    if (newSettings.advance_percentage) {
      supabase.from('business_config').update({ advance_percentage: newSettings.advance_percentage }).eq('id', 1).then();
    }
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
        // Fallback local
        const newSrv: Service = { ...srvData, description: srvData.description?.trim() || '', id: `srv-${Date.now()}` };
        setServices((prev) => [...prev, newSrv]);
        pulseRealtime();
        return true;
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
      return true;
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
      setServices((prev) => prev.map((s) => (s.id === srv.id ? sanitizedSrv : s)));
      pulseRealtime();

      if (srv.id.includes('-') && srv.id.length === 36) {
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
        }).eq('id', srv.id);

        if (error) {
          console.error('Error al actualizar servicio en Supabase:', error);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error updating service:', err);
      return false;
    }
  }, [pulseRealtime]);

  const deleteService = useCallback(async (serviceId: string): Promise<boolean> => {
    try {
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      pulseRealtime();

      if (serviceId.includes('-') && serviceId.length === 36) {
        const { error } = await supabase.from('services').delete().eq('id', serviceId);
        if (error) {
          console.error('Error al eliminar servicio en Supabase:', error);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error deleting service:', err);
      return false;
    }
  }, [pulseRealtime]);

  const toggleServiceActive = useCallback(async (serviceId: string, currentActive: boolean): Promise<boolean> => {
    try {
      const nextActive = !currentActive;
      setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, active: nextActive } : s)));
      pulseRealtime();

      if (serviceId.includes('-') && serviceId.length === 36) {
        const { error } = await supabase.from('services').update({
          is_active: nextActive,
          is_public: nextActive,
          updated_at: new Date().toISOString(),
        }).eq('id', serviceId);

        if (error) {
          console.error('Error al alternar estado de servicio en Supabase:', error);
          return false;
        }
      }
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

      const insertPayload = {
        name: prodData.name.trim(),
        slug: prodData.slug && prodData.slug.trim() ? prodData.slug.trim() : uniqueSlug,
        description: prodData.description || null,
        category: prodData.category,
        price_cents: prodData.price_cents,
        currency: 'PEN',
        stock: prodData.stock,
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
        // Fallback reactivo local en caso de restricción o fallo de red
        const fallbackProd: Product = {
          ...prodData,
          slug: insertPayload.slug,
          id: `prod-${Date.now()}`,
          active: insertPayload.is_active,
        };
        setProducts((prev) => [fallbackProd, ...prev]);
        pulseRealtime();
        return true;
      }

      if (data) {
        const newProd: Product = {
          id: data.id,
          name: data.name,
          slug: data.slug,
          category: (data.category || 'ceras_pomadas') as any,
          price_cents: data.price_cents,
          stock: data.stock,
          image_url: data.images && data.images.length > 0 ? data.images[0] : prodData.image_url,
          description: data.description || '',
          active: data.is_active !== undefined ? data.is_active : true,
        };
        setProducts((prev) => [newProd, ...prev]);
        pulseRealtime();
        return true;
      }
      return true;
    } catch (err) {
      console.error('Error adding product:', err);
      return false;
    }
  }, [pulseRealtime]);

  const updateProduct = useCallback(async (prod: Product): Promise<boolean> => {
    try {
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)));
      pulseRealtime();

      if (!prod.id.startsWith('prod-')) {
        const { error } = await supabase
          .from('products')
          .update({
            name: prod.name.trim(),
            category: prod.category,
            description: prod.description || null,
            price_cents: prod.price_cents,
            stock: prod.stock,
            images: prod.image_url ? [prod.image_url] : [],
            is_active: prod.active !== undefined ? prod.active : true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prod.id);

        if (error) {
          console.error('Error al actualizar producto en Supabase:', error);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error updating product:', err);
      return false;
    }
  }, [pulseRealtime]);

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    try {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      pulseRealtime();

      if (!id.startsWith('prod-')) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
          console.error('Error al eliminar producto en Supabase:', error);
          return false;
        }
      }
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
        availability_status: itemData.status || 'disponible',
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
        // Fallback local
        const newItem: WardrobeItem = { ...itemData, code: codeUpper, id: `ward-${Date.now()}` };
        setWardrobe((prev) => [...prev, newItem]);
        pulseRealtime();
        return true;
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
      return true;
    } catch (err) {
      console.error('Error adding wardrobe item:', err);
      return false;
    }
  }, [pulseRealtime]);

  const updateWardrobeItem = useCallback(async (item: WardrobeItem): Promise<boolean> => {
    try {
      const codeUpper = (item.code || 'A').toUpperCase().trim();
      const updatedItem = { ...item, code: codeUpper };
      setWardrobe((prev) => prev.map((w) => (w.id === item.id ? updatedItem : w)));
      pulseRealtime();

      if (!item.id.startsWith('ward-')) {
        const { error } = await supabase.from('wardrobe_items').update({
          name: item.name,
          code: codeUpper,
          description: item.description || null,
          category: item.category,
          price_cents: item.rental_price_cents,
          deposit_cents: item.deposit_cents,
          availability_status: item.status,
          is_active: item.active !== undefined ? item.active : true,
          images: item.image_url ? [item.image_url] : [],
          updated_at: new Date().toISOString(),
        }).eq('id', item.id);

        if (error) {
          console.error('Error al actualizar prenda de vestuario en Supabase:', error);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error updating wardrobe item:', err);
      return false;
    }
  }, [pulseRealtime]);

  const deleteWardrobeItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      setWardrobe((prev) => prev.filter((w) => w.id !== id));
      pulseRealtime();

      if (!id.startsWith('ward-')) {
        const { error } = await supabase.from('wardrobe_items').delete().eq('id', id);
        if (error) {
          console.error('Error al eliminar prenda en Supabase:', error);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error deleting wardrobe item:', err);
      return false;
    }
  }, [pulseRealtime]);

  const toggleWardrobeActive = useCallback(async (id: string, currentActive: boolean): Promise<boolean> => {
    try {
      const nextActive = !currentActive;
      setWardrobe((prev) => prev.map((w) => (w.id === id ? { ...w, active: nextActive } : w)));
      pulseRealtime();

      if (id.includes('-') && id.length === 36) {
        const { error } = await supabase.from('wardrobe_items').update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        }).eq('id', id);

        if (error) {
          console.error('Error al alternar visibilidad de vestuario en Supabase:', error);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error toggling wardrobe active state:', err);
      return false;
    }
  }, [pulseRealtime]);

  const updateWardrobeStatus = useCallback((id: string, status: WardrobeStatus) => {
    setWardrobe((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    pulseRealtime();

    if (id.includes('-') && id.length === 36) {
      supabase.from('wardrobe_items').update({
        availability_status: status,
        updated_at: new Date().toISOString(),
      }).eq('id', id).then();
    }
  }, [pulseRealtime]);

  // ==========================================
  // OPERACIONES DE ALQUILER DE VESTUARIOS (dress_rentals)
  // ==========================================
  const addDressRental = useCallback(
    async (
      data: Omit<DressRental, 'id' | 'ticket_code' | 'created_at' | 'updated_at'>
    ): Promise<DressRental | null> => {
      try {
        // Generar correlativo dinámico según origen
        const prefix = data.origin === 'web' ? 'W' : 'P';
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const ticketCode = `${prefix}-${randomNum}`;

        const insertPayload = {
          ticket_code: ticketCode,
          origin: data.origin,
          wardrobe_item_id: data.wardrobe_item_id || null,
          item_code: data.item_code,
          item_name: data.item_name,
          item_size: data.item_size || 'M',
          item_color: data.item_color || 'Variado',
          client_first_name: data.client_first_name.trim(),
          client_last_name: data.client_last_name.trim(),
          client_dni: data.client_dni.trim(),
          client_phone: data.client_phone.trim(),
          event_name: data.event_name.trim(),
          destination: data.destination.trim(),
          event_date: data.event_date,
          return_date: data.return_date,
          status: data.status,
          rental_price_cents: data.rental_price_cents,
          advance_cents: data.advance_cents,
          pending_cents: data.pending_cents,
          guarantee_cents: data.guarantee_cents,
          guarantee_returned_cents: data.guarantee_returned_cents || null,
          penalty_cents: data.penalty_cents || 0,
          penalty_reason: data.penalty_reason || null,
          is_immediate_delivery: data.is_immediate_delivery,
          delivery_date: data.delivery_date || (data.is_immediate_delivery ? new Date().toISOString() : null),
          actual_return_date: data.actual_return_date || null,
          voucher_url: data.voucher_url || null,
          voucher_declared_amount_cents: data.voucher_declared_amount_cents || null,
          rejection_reason: data.rejection_reason || null,
          notes: data.notes || null,
        };

        const { data: dbData, error } = await (supabase as any)
          .from('dress_rentals')
          .insert(insertPayload)
          .select()
          .single();

        let newRental: DressRental;
        if (!error && dbData) {
          const raw: any = dbData;
          newRental = {
            id: raw.id,
            ticket_code: raw.ticket_code,
            origin: raw.origin as DressRentalOrigin,
            wardrobe_item_id: raw.wardrobe_item_id,
            item_code: raw.item_code,
            item_name: raw.item_name,
            item_size: raw.item_size || 'M',
            item_color: raw.item_color || 'Variado',
            client_first_name: raw.client_first_name,
            client_last_name: raw.client_last_name,
            client_dni: raw.client_dni,
            client_phone: raw.client_phone,
            event_name: raw.event_name,
            destination: raw.destination,
            event_date: raw.event_date,
            return_date: raw.return_date,
            status: raw.status as DressRentalStatus,
            rental_price_cents: raw.rental_price_cents,
            advance_cents: raw.advance_cents,
            pending_cents: raw.pending_cents,
            guarantee_cents: raw.guarantee_cents,
            guarantee_returned_cents: raw.guarantee_returned_cents,
            penalty_cents: raw.penalty_cents,
            penalty_reason: raw.penalty_reason,
            is_immediate_delivery: raw.is_immediate_delivery,
            delivery_date: raw.delivery_date,
            actual_return_date: raw.actual_return_date,
            voucher_url: raw.voucher_url,
            voucher_declared_amount_cents: raw.voucher_declared_amount_cents,
            rejection_reason: raw.rejection_reason,
            notes: raw.notes,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
          };
        } else {
          console.warn('Fallback reactivo local para alquiler de vestuario:', error);
          newRental = {
            ...data,
            id: `rent-${Date.now()}`,
            ticket_code: ticketCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        setDressRentals((prev) => [newRental, ...prev]);
        pulseRealtime();
        return newRental;
      } catch (err) {
        console.error('Error adding dress rental:', err);
        return null;
      }
    },
    [pulseRealtime]
  );

  const validateYapeVoucher = useCallback(
    async (rentalId: string, approved: boolean, reason?: string): Promise<boolean> => {
      try {
        const nextStatus: DressRentalStatus = approved ? 'reservado' : 'anulado';
        const updatePayload: any = {
          status: nextStatus,
          updated_at: new Date().toISOString(),
        };
        if (!approved && reason) {
          updatePayload.rejection_reason = reason;
        }

        setDressRentals((prev) =>
          prev.map((r) => (r.id === rentalId ? { ...r, ...updatePayload } : r))
        );
        pulseRealtime();

        if (rentalId.includes('-') && rentalId.length === 36) {
          await (supabase as any).from('dress_rentals').update(updatePayload).eq('id', rentalId);
        }
        return true;
      } catch (err) {
        console.error('Error validating Yape voucher:', err);
        return false;
      }
    },
    [pulseRealtime]
  );

  const confirmDressDelivery = useCallback(
    async (
      rentalId: string,
      balanceCollectedCents: number,
      guaranteeCollectedCents: number
    ): Promise<boolean> => {
      try {
        const updatePayload = {
          status: 'entregado' as DressRentalStatus,
          pending_cents: 0,
          guarantee_cents: guaranteeCollectedCents,
          delivery_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setDressRentals((prev) =>
          prev.map((r) =>
            r.id === rentalId
              ? {
                  ...r,
                  ...updatePayload,
                  advance_cents: r.advance_cents + balanceCollectedCents,
                }
              : r
          )
        );
        pulseRealtime();

        if (rentalId.includes('-') && rentalId.length === 36) {
          await (supabase as any).from('dress_rentals').update(updatePayload).eq('id', rentalId);
        }
        return true;
      } catch (err) {
        console.error('Error confirming dress delivery:', err);
        return false;
      }
    },
    [pulseRealtime]
  );

  const processDressReturn = useCallback(
    async (
      rentalId: string,
      guaranteeReturnedCents: number,
      penaltyReason?: string
    ): Promise<boolean> => {
      try {
        const existing = dressRentals.find((r) => r.id === rentalId);
        const originalGuarantee = existing?.guarantee_cents || 0;
        const penaltyCents = Math.max(0, originalGuarantee - guaranteeReturnedCents);

        const updatePayload = {
          status: 'finalizado' as DressRentalStatus,
          guarantee_returned_cents: guaranteeReturnedCents,
          penalty_cents: penaltyCents,
          penalty_reason: penaltyReason || null,
          actual_return_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setDressRentals((prev) =>
          prev.map((r) => (r.id === rentalId ? { ...r, ...updatePayload } : r))
        );
        pulseRealtime();

        if (rentalId.includes('-') && rentalId.length === 36) {
          await (supabase as any).from('dress_rentals').update(updatePayload).eq('id', rentalId);
        }
        return true;
      } catch (err) {
        console.error('Error processing dress return:', err);
        return false;
      }
    },
    [dressRentals, pulseRealtime]
  );

  const cancelDressRental = useCallback(
    async (rentalId: string, reason?: string): Promise<boolean> => {
      try {
        const updatePayload = {
          status: 'anulado' as DressRentalStatus,
          rejection_reason: reason || null,
          updated_at: new Date().toISOString(),
        };

        setDressRentals((prev) =>
          prev.map((r) => (r.id === rentalId ? { ...r, ...updatePayload } : r))
        );
        pulseRealtime();

        if (rentalId.includes('-') && rentalId.length === 36) {
          await (supabase as any).from('dress_rentals').update(updatePayload).eq('id', rentalId);
        }
        return true;
      } catch (err) {
        console.error('Error cancelling dress rental:', err);
        return false;
      }
    },
    [pulseRealtime]
  );

  const deleteDressRental = useCallback(
    async (rentalId: string): Promise<boolean> => {
      try {
        setDressRentals((prev) => prev.filter((r) => r.id !== rentalId));
        pulseRealtime();

        if (rentalId.includes('-') && rentalId.length === 36) {
          await (supabase as any).from('dress_rentals').delete().eq('id', rentalId);
        }
        return true;
      } catch (err) {
        console.error('Error deleting dress rental:', err);
        return false;
      }
    },
    [pulseRealtime]
  );

  // KPI CALCULATIONS (Reglas oficiales: Section C.1 & C.5)
  const kpis = useMemo(() => {
    const today = getTodayDateString();

    const activeBookings = bookings;

    // Suma únicamente reservas en estado PAGADO (100%) y adelantos percibidos en tiempo real
    const ingresosServiciosCents = activeBookings.reduce(
      (acc, b) => acc + getBookingCollectedAmountCents(b),
      0
    );

    const activeVentas = ventasMostrador.filter((v: any) => !v.voided);
    const ventasMostradorCents = activeVentas.reduce(
      (acc, v) => acc + (v.total_price_cents || 0),
      0
    );

    const totalIngresosCents = ingresosServiciosCents + ventasMostradorCents;

    const activeExpenses = expenses.filter((e) => !e.voided);
    const totalEgresosCents = activeExpenses.reduce(
      (acc, e) => acc + (e.amount_cents || 0),
      0
    );

    const balanceNetoCents = totalIngresosCents - totalEgresosCents;

    const citasHoy = bookings.filter((b) => b.date === today);
    const citasConfirmadas = bookings.filter(
      (b) => b.payment_status === 'total' || b.payment_status === 'parcial'
    );

    const saldosPorCobrarCents = activeBookings.reduce((acc, b) => {
      const collected = getBookingCollectedAmountCents(b);
      const saldo = Math.max(0, (b.total_price_cents || 0) - collected);
      return acc + saldo;
    }, 0);

    return {
      totalIngresosCents,
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
        registerVentaMostrador,
        registerCounterSale: registerVentaMostrador,
        deleteVentaMostrador,
        addExpense,
        voidExpense,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        toggleEmployeeActive,
        addEmployeeLeave,
        deleteEmployeeBlock,
        scanAttendanceQR,
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
