import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  ShoppingBag, 
  User, 
  ChevronDown, 
  Calendar, 
  LogOut, 
  LayoutDashboard, 
  LogIn,
  X,
  Home,
  Scissors,
  Sparkles,
  MapPin,
  Menu,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { 
    activeView, 
    setActiveView, 
    cart, 
    setIsCartOpen, 
    currentRole, 
    currentUser,
    signOut
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K or Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchModalOpen(false);
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else {
      setSearchQuery('');
    }
  }, [searchModalOpen]);

  // Exact order required: Inicio | Servicios | Vestuario | Productos | Ubicación
  const navLinks = [
    { view: '/', label: 'Inicio', icon: <Home className="w-4 h-4" /> },
    { view: '/servicios', label: 'Servicios', icon: <Scissors className="w-4 h-4" /> },
    { view: '/vestuario', label: 'Vestuario', icon: <Sparkles className="w-4 h-4" /> },
    { view: '/productos', label: 'Productos', icon: <ShoppingBag className="w-4 h-4" /> },
    { view: '/ubicacion', label: 'Ubicación', icon: <MapPin className="w-4 h-4" /> },
  ];

  const handleNavClick = (view: string) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setSearchModalOpen(false);
  };

  const handleSignOut = () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    signOut();
  };

  const isVestuarioAdmin =
    currentRole === 'VESTUARIO_ADMIN' ||
    currentUser?.role === 'VESTUARIO_ADMIN' ||
    currentUser?.email?.toLowerCase() === 'vepeja4602@bullbaby.com';

  const isStaffRole =
    currentRole === 'admin' ||
    currentRole === 'recepcionista' ||
    currentRole === 'empleado' ||
    isVestuarioAdmin;
  const isAuthenticated = currentRole !== 'anon' && currentRole !== 'anonimo';

  // Client display name fallback
  const clientName = currentUser?.name || (isAuthenticated ? 'Cliente' : 'Mi Cuenta');

  // Search items list
  const searchItems = [
    { title: 'Corte de Cabello Premium', category: 'Servicios', view: '/servicios', desc: 'Asesoría y corte personalizado con lavado y peinado' },
    { title: 'Perfilado y Afeitado de Barba', category: 'Servicios', view: '/servicios', desc: 'Ritual clásico con toallas calientes y aceites esenciales' },
    { title: 'Tratamiento Facial y Spa', category: 'Servicios', view: '/servicios', desc: 'Limpieza profunda, exfoliación e hidratación' },
    { title: 'Trajes y Ternas Exclusivos', category: 'Vestuario', view: '/vestuario', desc: 'Alquiler y venta de alta costura para eventos' },
    { title: 'Pomadas y Ceras para Barba', category: 'Productos', view: '/productos', desc: 'Fijación y brillo de calidad profesional' },
    { title: 'Shampoo y Tónicos Capilares', category: 'Productos', view: '/productos', desc: 'Cuidado capilar anticaída y fortalecedor' },
    { title: 'Sede Pichari y Horarios', category: 'Ubicación', view: '/ubicacion', desc: 'Encuéntranos en Av. Arriba Perú Mz. K - Lt. 9, Pichari' },
  ];

  const filteredSearch = searchQuery.trim()
    ? searchItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];
  // Bloqueo de scroll de fondo al abrir menú móvil o buscador
  useEffect(() => {
    if (mobileMenuOpen || searchModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, searchModalOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-[#C8A45C]/30 shadow-[0_4px_25px_rgba(0,0,0,0.85)] w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between w-full">
        
        {/* 1. LOGOTIPO (Extremo izquierdo) */}
        <div className="flex items-center min-w-0 shrink">
          <button
            type="button"
            onClick={() => handleNavClick('/')}
            className="flex items-center group cursor-pointer focus:outline-none min-w-0"
            aria-label="Acicalados - Inicio"
          >
            <img
              src="/LogoAcicalados.svg"
              alt="Logo Acicalados"
              className="h-8 sm:h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-105 shrink-0"
            />
            <div className="h-6 sm:h-8 w-[1px] bg-[#C8A45C]/35 mx-1.5 sm:mx-3 shrink-0" />
            <div className="flex flex-col justify-center text-left select-none min-w-0">
              <span
                className="font-serif-luxury font-bold text-xs sm:text-base lg:text-xl tracking-[0.14em] sm:tracking-[0.2em] text-[#C8A45C] group-hover:text-[#EBDBB2] transition-colors leading-none truncate"
              >
                ACICALADOS
              </span>
              <span
                className="tracking-[0.18em] sm:tracking-[0.28em] text-[7px] sm:text-[10px] text-[#C8A45C]/80 font-semibold leading-none mt-0.5 truncate hidden xs:block"
              >
                DISEÑO &amp; CALIDAD
              </span>
            </div>
          </button>
        </div>

        {/* 2. MENÚ DE NAVEGACIÓN CENTRAL (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((item) => {
            const isActive =
              item.view === '/'
                ? activeView === '/'
                : item.view === '/productos'
                ? activeView === '/productos' || activeView === '/tienda'
                : activeView === item.view || activeView.startsWith(item.view + '/');

            return (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`text-sm lg:text-[15px] transition-all duration-200 relative pb-1.5 pt-1 font-medium tracking-wide focus:outline-none cursor-pointer ${
                  isActive
                    ? "text-[#C8A45C] font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2.5px] after:bg-[#C8A45C] after:rounded-full after:shadow-[0_0_8px_rgba(200,164,92,0.6)]"
                    : "text-neutral-300 hover:text-white hover:text-[#EBDBB2]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* 3. ÁREA DERECHA (Acciones, Perfil y Hamburguesa Móvil) */}
        <div className="flex items-center gap-1 sm:gap-2.5 lg:gap-4 shrink-0">
          
          {/* Ícono de búsqueda (lupa) */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="p-1.5 sm:p-2 rounded-lg text-neutral-300 hover:text-[#C8A45C] hover:bg-[#C8A45C]/10 transition-colors cursor-pointer flex items-center justify-center focus:outline-none"
            title="Buscar servicios, vestuario o productos (Ctrl+K)"
            aria-label="Buscar"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Separador vertical sólo visible en tablet y desktop */}
          <div className="hidden sm:block h-5 sm:h-6 w-[1px] bg-[#C8A45C]/30 mx-0.5" />

          {/* Ícono de carrito de compras */}
          <button
            id="cart-drawer-trigger-btn"
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="group inline-flex items-center justify-center h-8 sm:h-[38px] p-1.5 sm:px-3 sm:py-1.5 rounded-full hover:bg-[#C8A45C]/15 text-neutral-200 hover:text-[#C8A45C] transition-all duration-200 text-xs sm:text-sm font-medium cursor-pointer shrink-0 gap-1 sm:gap-2 relative focus:outline-none"
            title="Abrir Carrito de Compras"
            aria-label="Abrir Carrito"
          >
            <ShoppingBag className="w-4 h-4 text-neutral-200 group-hover:text-[#C8A45C] transition-colors shrink-0" />
            <span className="hidden md:inline tracking-wide select-none leading-none">
              Carrito
            </span>
            {cartCount > 0 && (
              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#C8A45C] text-black font-extrabold text-[9px] sm:text-xs flex items-center justify-center shrink-0 shadow-inner leading-none">
                {cartCount}
              </span>
            )}
          </button>

          {/* Perfil de usuario */}
          <div className="relative inline-flex items-center" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="group inline-flex items-center justify-center h-8 sm:h-[38px] p-1.5 sm:px-2.5 sm:py-1.5 rounded-full hover:bg-[#C8A45C]/15 text-neutral-200 hover:text-[#C8A45C] transition-all duration-200 text-xs sm:text-sm font-medium cursor-pointer shrink-0 gap-1 sm:gap-2 border border-transparent hover:border-[#C8A45C]/30 focus:outline-none"
              aria-expanded={userDropdownOpen}
              aria-haspopup="true"
              title="Mi Cuenta"
              aria-label="Mi Cuenta"
            >
              <User className="w-4 h-4 text-[#C8A45C] group-hover:text-[#EBDBB2] transition-colors shrink-0" />

              <span className="hidden md:inline max-w-[110px] truncate leading-none select-none text-neutral-200 group-hover:text-[#EBDBB2] transition-colors font-medium">
                {clientName}
              </span>

              <ChevronDown
                className={`hidden sm:block w-3.5 h-3.5 text-[#C8A45C]/70 group-hover:text-[#C8A45C] transition-transform duration-200 shrink-0 ${
                  userDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Menú Desplegable de Usuario (Desktop y Móvil) */}
            {userDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 sm:w-56 bg-[#111111] border border-[#C8A45C]/40 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.9)] py-2 z-50 animate-fadeIn backdrop-blur-md">
                {!isAuthenticated ? (
                  <>
                    <div className="px-4 py-2.5 border-b border-[#C8A45C]/20 mb-1">
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">
                        Acceso a tu Cuenta
                      </p>
                      <p className="text-xs text-neutral-300 truncate mt-0.5">
                        Inicia sesión o regístrate
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleNavClick('/auth/login')}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-[#C8A45C] hover:text-white hover:bg-[#C8A45C]/15 transition-colors cursor-pointer group/item font-semibold"
                    >
                      <LogIn className="w-4 h-4 text-[#C8A45C] group-hover/item:scale-110 transition-transform shrink-0" />
                      <span>Iniciar Sesión / Registro</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-2.5 border-b border-[#C8A45C]/20 mb-1">
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">
                        {isVestuarioAdmin
                          ? 'Admin Vestuario'
                          : currentRole === 'admin'
                          ? 'Administrador'
                          : currentRole === 'recepcionista'
                          ? 'Recepción'
                          : currentRole === 'empleado'
                          ? 'Colaborador'
                          : 'Cliente Autenticado'}
                      </p>
                      <p className="text-sm font-semibold text-[#C8A45C] truncate mt-0.5">
                        {clientName}
                      </p>
                    </div>

                    {/* Administrador / Recepcionista / Vestuario: Panel de Gestión */}
                    {isStaffRole && (
                      <button
                        type="button"
                        onClick={() => handleNavClick(isVestuarioAdmin ? '/dashboard/vestuario' : '/dashboard')}
                        className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-[#C8A45C] bg-[#C8A45C]/10 hover:bg-[#C8A45C]/20 hover:text-white transition-colors cursor-pointer group/item font-semibold border-b border-[#C8A45C]/20 mb-1"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#C8A45C] group-hover/item:scale-110 transition-transform shrink-0" />
                        <span>Panel de Gestión</span>
                      </button>
                    )}

                    {/* Mis Citas / Mis Reservas */}
                    <button
                      type="button"
                      onClick={() => handleNavClick('/mi-cuenta')}
                      className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-neutral-200 hover:text-white hover:bg-[#C8A45C]/15 transition-colors cursor-pointer group/item"
                    >
                      <Calendar className="w-4 h-4 text-[#C8A45C] group-hover/item:scale-110 transition-transform shrink-0" />
                      <span>Mis Citas / Mis Reservas</span>
                    </button>

                    {/* Mi Cuenta */}
                    <button
                      type="button"
                      onClick={() => handleNavClick('/mi-cuenta')}
                      className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-neutral-200 hover:text-white hover:bg-[#C8A45C]/15 transition-colors cursor-pointer group/item"
                    >
                      <User className="w-4 h-4 text-[#C8A45C] group-hover/item:scale-110 transition-transform shrink-0" />
                      <span>Mi Cuenta</span>
                    </button>

                    <div className="my-1 border-t border-[#C8A45C]/20" />

                    {/* Cerrar Sesión */}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer group/item"
                    >
                      <LogOut className="w-4 h-4 text-red-400 group-hover/item:scale-110 transition-transform shrink-0" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Botón de Menú Hamburguesa (3 barras) */}
          <button
            id="mobile-nav-toggle-btn"
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl text-[#C8A45C] hover:text-[#EBDBB2] hover:bg-[#C8A45C]/15 border border-[#C8A45C]/35 transition-all flex items-center justify-center cursor-pointer shrink-0 focus:outline-none active:scale-95 ml-0.5 sm:ml-1"
            title={mobileMenuOpen ? 'Cerrar Menú de Navegación' : 'Abrir Menú de Navegación'}
            aria-label={mobileMenuOpen ? 'Cerrar Menú de Navegación' : 'Abrir Menú de Navegación'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-[#C8A45C]" />
            ) : (
              <Menu className="w-5 h-5 text-[#C8A45C]" />
            )}
          </button>
        </div>
      </div>
    </header>

    {/* Portales Desplegables Montados en Document.body para Evitar Restricciones de Contenedores */}
    {typeof document !== 'undefined' &&
      createPortal(
        <>
          {/* MODAL DE BÚSQUEDA INTERACTIVA */}
          {searchModalOpen && (
            <div
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-fadeIn"
              onClick={() => setSearchModalOpen(false)}
            >
          <div
            className="w-full max-w-xl bg-[#111111] border border-[#C8A45C]/40 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.9)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 py-3.5 border-b border-[#C8A45C]/25 bg-black/60">
              <Search className="w-5 h-5 text-[#C8A45C] mr-3 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar servicios, trajes, productos o ubicación..."
                className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 focus:outline-none text-sm sm:text-base"
              />
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="text-xs px-2 py-1 bg-neutral-800 text-neutral-400 rounded-md hover:bg-neutral-700 hover:text-white transition ml-2"
              >
                ESC
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-neutral-900/60">
              {filteredSearch.length > 0 ? (
                filteredSearch.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleNavClick(item.view)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[#C8A45C]/10 transition-colors group cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-200 group-hover:text-[#C8A45C] transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">
                        {item.desc}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#C8A45C] bg-[#C8A45C]/10 border border-[#C8A45C]/20 px-2 py-0.5 rounded-full shrink-0 ml-3">
                      {item.category}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-neutral-400">
                  <p className="text-sm">No se encontraron resultados para &quot;{searchQuery}&quot;</p>
                  <p className="text-xs text-neutral-500 mt-1">Prueba con corte, barba, trajes o productos.</p>
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-black/40 border-t border-[#C8A45C]/15 text-center flex justify-between items-center text-xs text-neutral-400">
              <span>Acicalados Spa &amp; Barber Shop</span>
              <span className="text-[#C8A45C] font-serif-luxury">Diseño &amp; Calidad</span>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER RESPONSIVO COMPLETO PARA DISPOSITIVOS MÓVILES */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md animate-fadeIn flex justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[86vw] max-w-[340px] h-full bg-[#0E0E0E] border-l border-[#C8A45C]/35 shadow-[-20px_0_50px_rgba(0,0,0,0.95)] p-5 sm:p-6 flex flex-col justify-between overflow-y-auto animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top: Header with Brand & Close Button */}
            <div className="space-y-5">
              <div className="w-full flex items-center justify-between pb-3.5 border-b border-[#C8A45C]/25">
                <div className="flex items-center gap-2">
                  <img src="/LogoAcicalados.svg" alt="Acicalados" className="h-7 w-auto object-contain" />
                  <span className="font-serif-luxury font-bold text-sm tracking-[0.16em] text-[#C8A45C]">
                    ACICALADOS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-xl border border-[#C8A45C]/35 text-[#C8A45C] hover:text-white hover:border-[#C8A45C] hover:bg-[#C8A45C]/15 flex items-center justify-center transition cursor-pointer"
                  aria-label="Cerrar Menú"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Card inside Drawer */}
              <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#C8A45C]/25 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/35 text-[#E6C875] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest block font-semibold leading-tight">
                      {isVestuarioAdmin
                        ? 'Admin Vestuario'
                        : isStaffRole
                        ? currentRole === 'admin'
                          ? 'Administrador'
                          : 'Recepción'
                        : isAuthenticated
                        ? 'Cliente'
                        : 'Bienvenido'}
                    </span>
                    <span className="text-xs font-bold text-white block truncate leading-tight mt-0.5">
                      {clientName}
                    </span>
                  </div>
                </div>

                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => handleNavClick('/auth/login')}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] text-black font-bold text-[10px] uppercase tracking-wider shrink-0 hover:brightness-110 transition shadow"
                  >
                    Ingresar
                  </button>
                ) : (
                  <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                    Online
                  </span>
                )}
              </div>

              {/* Secciones Principales de Navegación */}
              <div className="space-y-2">
                {isStaffRole && (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => handleNavClick(isVestuarioAdmin ? '/dashboard/vestuario' : '/dashboard')}
                      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/40 font-bold shadow-md shadow-black/40 hover:bg-[#C8A45C]/25"
                    >
                      <div className="flex items-center gap-3.5">
                        <LayoutDashboard className="w-4 h-4 text-[#C8A45C]" />
                        <span className="tracking-wide">Panel de Gestión</span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E6C875] shadow-[0_0_8px_#E6C875]" />
                    </button>
                  </div>
                )}
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#C8A45C]/80 px-2 py-0.5 block text-left">
                  Navegación Principal
                </span>
                <nav className="space-y-1.5 text-left w-full">
                  {navLinks.map((item) => {
                    const isActive =
                      item.view === '/'
                        ? activeView === '/'
                        : item.view === '/productos'
                        ? activeView === '/productos' || activeView === '/tienda'
                        : activeView === item.view || activeView.startsWith(item.view + '/');

                    return (
                      <button
                        key={item.view}
                        type="button"
                        onClick={() => handleNavClick(item.view)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/55 font-bold shadow-md shadow-black/40'
                            : 'text-neutral-300 hover:text-white hover:bg-neutral-900/80 border border-transparent font-medium hover:border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className={isActive ? 'text-[#E6C875]' : 'text-[#C8A45C]'}>
                            {item.icon}
                          </span>
                          <span className="tracking-wide">{item.label}</span>
                        </div>
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E6C875] shadow-[0_0_8px_#E6C875]" />
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Bottom: Cerrar Sesión & Footer Info */}
            <div className="pt-4 space-y-3">
              {/* Opción de Cerrar Sesión (al fondo, sutilmente separada con divisor limpio) */}
              {isAuthenticated && (
                <div className="pt-2 border-t border-[#C8A45C]/20">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer font-medium"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}

              {/* Bottom Slogan & City */}
              <div className="w-full pt-3 pb-1 border-t border-[#C8A45C]/15 text-center space-y-0.5">
                <span className="text-[10px] text-[#C8A45C]/60 tracking-[0.2em] font-semibold block uppercase">
                  Spa Acicalados Barber Shop
                </span>
                <span className="text-[9px] text-neutral-500 block font-mono">
                  Sede Pichari · Cusco, Perú
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )}
</>
  );
};
