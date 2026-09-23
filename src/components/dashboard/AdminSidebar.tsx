import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  Calendar,
  BookOpen,
  DollarSign,
  FileText,
  TrendingDown,
  Users,
  Clock,
  Sparkles,
  Shirt,
  Package,
  User,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const { activeView, setActiveView, currentRole, currentUser, signOut } = useApp();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Exact 11 short, concise module names in this exact order:
  // Inicio | Calendario | Reservas | Ventas | Reportes | Egresos | Empleados | Asistencia | Servicios | Vestuario | Productos
  const menuItems = [
    {
      view: '/dashboard',
      label: 'Inicio',
      icon: <Home className="w-4 h-4" />,
    },
    {
      view: '/dashboard/calendario',
      label: 'Calendario',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      view: '/dashboard/reservas',
      label: 'Reservas',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      view: '/dashboard/ventas',
      label: 'Ventas',
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      view: '/dashboard/reportes',
      label: 'Reportes',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      view: '/dashboard/egresos',
      label: 'Egresos',
      icon: <TrendingDown className="w-4 h-4" />,
    },
    {
      view: '/dashboard/empleados',
      label: 'Empleados',
      icon: <Users className="w-4 h-4" />,
    },
    {
      view: '/dashboard/asistencia',
      label: 'Asistencia',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      view: '/dashboard/servicios',
      label: 'Servicios',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      view: '/dashboard/vestuario',
      label: 'Vestuario',
      icon: <Shirt className="w-4 h-4" />,
    },
    {
      view: '/dashboard/productos',
      label: 'Productos',
      icon: <Package className="w-4 h-4" />,
    },
  ];

  const isVestuarioAdmin =
    currentRole === 'VESTUARIO_ADMIN' ||
    currentUser?.role === 'VESTUARIO_ADMIN' ||
    currentUser?.email?.toLowerCase() === 'vepeja4602@bullbaby.com';

  const visibleMenuItems = isVestuarioAdmin
    ? menuItems.filter((item) => item.view === '/dashboard/vestuario')
    : menuItems;

  const homeView = isVestuarioAdmin ? '/dashboard/vestuario' : '/dashboard';

  const handleNavigate = (view: string) => {
    setActiveView(view);
    setMobileDrawerOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    setActiveView('/');
  };

  // Role display badge in sobrio style
  const roleDisplay = isVestuarioAdmin
    ? 'Admin Vestuario'
    : currentRole === 'admin'
    ? 'Admin'
    : currentRole === 'recepcionista'
    ? 'Recepción'
    : 'Admin';

  return (
    <>
      {/* Mobile Top Bar for Dashboard View */}
      <div className="lg:hidden flex items-center justify-between p-3.5 bg-[#0E0E0E] border-b border-[#C8A45C]/20 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[#C8A45C] hover:text-white cursor-pointer"
            title="Abrir Menú"
            aria-label="Abrir Menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/LogoAcicalados.svg"
              alt="Logo Acicalados"
              className="h-6 w-auto object-contain"
            />
            <span className="font-serif-luxury font-bold text-sm text-[#C8A45C] tracking-wider">
              ACICALADOS
            </span>
            <span className="text-[10px] text-neutral-400 font-medium">
              · Panel de Gestión
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Main Sidebar (Desktop fixed 260px, Mobile drawer) */}
      <aside
        className={`fixed lg:relative top-0 left-0 z-50 lg:z-30 h-screen lg:h-full w-[260px] shrink-0 bg-[#0E0E0E] border-r border-[#C8A45C]/20 flex flex-col justify-between transition-transform duration-300 shadow-[4px_0_24px_rgba(0,0,0,0.85)] ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top 3px Golden Gradient Progress Indicator */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#9A7B38] via-[#E6C875] to-[#9A7B38] shrink-0" />

        {/* 1. Cabecera del Sidebar */}
        <div className="p-4 border-b border-neutral-800/80 shrink-0">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleNavigate(homeView)}
              className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
            >
              {/* Emblema dorado del logo */}
              <img
                src="/LogoAcicalados.svg"
                alt="Logo Acicalados"
                className="h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105 shrink-0"
              />

              {/* Título y subtítulo simple */}
              <div className="flex flex-col justify-center select-none">
                <span className="font-serif-luxury font-bold text-base tracking-[0.18em] text-[#C8A45C] group-hover:text-[#EBDBB2] transition-colors leading-none">
                  ACICALADOS
                </span>
                <span className="text-[10px] tracking-wider text-neutral-400 font-medium leading-none mt-1.5">
                  Panel de Gestión
                </span>
              </div>
            </button>

            {/* Mobile close button */}
            {mobileDrawerOpen && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="lg:hidden p-1 text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Cerrar Menú"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Lista de Módulos (Exactamente los 11 nombres para admin, solo Vestuario para VESTUARIO_ADMIN) */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {visibleMenuItems.map((item) => {
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                id={`sidebar-link-${item.view.replace('/dashboard/', '') || 'inicio'}`}
                onClick={() => handleNavigate(item.view)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-[#1C1A14] text-[#E6C875] border border-[#C8A45C]/40 shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#161616]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={isActive ? 'text-[#C8A45C]' : 'text-neutral-400'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>

                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#C8A45C]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* 3. Pie del Sidebar (Perfil y Cierre de Sesión) */}
        <div className="p-3 border-t border-[#C8A45C]/20 bg-[#121212] shrink-0">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[#181818] border border-neutral-800 mb-2.5">
            {/* Avatar con ícono de silueta en relieve/borde dorado */}
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1C1A14] to-[#121212] border border-[#C8A45C]/50 flex items-center justify-center text-[#C8A45C] shadow-inner shrink-0">
              <User className="w-4 h-4 text-[#C8A45C]" />
            </div>

            {/* Nombre completo y badge con rol sobrio */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {currentUser?.name || 'Administrador'}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#C8A45C]/15 text-[#E6C875] border border-[#C8A45C]/30 font-medium tracking-wide">
                  {roleDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Botón independiente para Cerrar Sesión */}
          <button
            id="sidebar-logout-btn"
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};
