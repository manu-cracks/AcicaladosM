import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TicketTermicoModal } from './components/common/TicketTermicoModal';
import { ImageLightboxModal } from './components/common/ImageLightboxModal';
import { CartDrawer } from './components/common/CartDrawer';
import { Navbar } from './components/common/Navbar';
import { AdminSidebar } from './components/dashboard/AdminSidebar';

// Public views
import { PublicLanding } from './components/public/PublicLanding';
import { PublicServices } from './components/public/PublicServices';
import { PublicBookingFlow } from './components/public/PublicBookingFlow';
import { PublicShop } from './components/public/PublicShop';
import { PublicWardrobe } from './components/public/PublicWardrobe';
import { PublicLocation } from './components/public/PublicLocation';
import { ClientPortal } from './components/public/ClientPortal';
import { ClientLayout } from './components/public/ClientLayout';

// Auth views
import { LoginView } from './components/auth/LoginView';
import { AuthCallback } from './components/auth/AuthCallback';

// Dashboard views
import { DashboardHome } from './components/dashboard/DashboardHome';
import { CalendarioView } from './components/dashboard/CalendarioView';
import { ReservasManager } from './components/dashboard/ReservasManager';
import { POSView } from './components/dashboard/POSView';
import { AsistenciaView } from './components/dashboard/AsistenciaView';
import { FinanzasView } from './components/dashboard/FinanzasView';
import { ColaboradoresView } from './components/dashboard/ColaboradoresView';
import { VestuarioManager } from './components/dashboard/VestuarioManager';
import { ReportesView } from './components/dashboard/ReportesView';
import { ServiciosManager } from './components/dashboard/ServiciosManager';
import { ProductosManager } from './components/dashboard/ProductosManager';
import { DashboardSkeleton } from './components/dashboard/DashboardSkeleton';

import { MapPin, Phone, ShieldCheck, Scissors, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activeView, setActiveView, currentRole, currentUser, isAuthLoading, isDataLoading } = useApp();
  const mainContentRef = React.useRef<HTMLElement>(null);

  const isDashboard = activeView.startsWith('/dashboard');
  const isAuthView = activeView === '/auth/login' || activeView === '/auth/callback';

  // Check RBAC permission for dashboard
  const isVestuarioAdmin =
    currentRole === 'VESTUARIO_ADMIN' ||
    currentUser?.role === 'VESTUARIO_ADMIN' ||
    currentUser?.email?.toLowerCase() === 'vepeja4602@bullbaby.com';

  const isPublicRole = currentRole === 'anonimo' || currentRole === 'cliente' || currentRole === 'anon';
  const isStaffRole = currentRole === 'admin' || currentRole === 'recepcionista' || isVestuarioAdmin;

  // Redirección inmediata:
  // 1. Bloquear a clientes de /dashboard/* y enviarlos a /mi-cuenta
  // 2. Proteger a VESTUARIO_ADMIN redirigiendo cualquier acceso a módulos prohibidos hacia /dashboard/vestuario
  React.useEffect(() => {
    if (isAuthLoading) return;
    if (isDashboard && isPublicRole) {
      setActiveView('/mi-cuenta');
    } else if (isVestuarioAdmin && isDashboard && activeView !== '/dashboard/vestuario') {
      setActiveView('/dashboard/vestuario');
    }
  }, [isAuthLoading, isDashboard, isPublicRole, isVestuarioAdmin, activeView, setActiveView]);

  // Reset scroll to top when changing dashboard views
  React.useEffect(() => {
    if (isDashboard && mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeView, isDashboard]);

  return (
    <div
      className={`text-neutral-200 flex flex-col font-sans selection:bg-[#C8A45C] selection:text-black w-full max-w-full ${
        isDashboard ? 'bg-[#0A0A0A] h-screen max-h-screen overflow-hidden' : 'bg-transparent min-h-screen overflow-x-hidden'
      }`}
    >
      {/* Global Thermal Ticket Modal */}
      <TicketTermicoModal />

      {/* Global Image Lightbox Modal */}
      <ImageLightboxModal />

      {/* Global Shopping Cart Drawer */}
      <CartDrawer />

      {isAuthView ? (
        // AUTHENTICATION LAYOUT (/auth/login & /auth/callback)
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1">
            {activeView === '/auth/login' && <LoginView />}
            {activeView === '/auth/callback' && <AuthCallback />}
          </main>
        </div>
      ) : isDashboard ? (
        // DASHBOARD LAYOUT
        <div className="flex-1 flex flex-col lg:flex-row h-full max-h-full overflow-hidden">
          <AdminSidebar />
          <main
            ref={mainContentRef}
            className="flex-1 h-full min-w-0 overflow-y-auto overflow-x-hidden pb-12 bg-neutral-950/70"
          >
            {isAuthLoading && !isStaffRole ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-3">
                <Loader2 className="w-8 h-8 text-[#C8A45C] animate-spin" />
                <p className="text-xs text-neutral-400">Verificando credenciales de acceso...</p>
              </div>
            ) : isPublicRole ? (
              <div className="max-w-md mx-auto my-20 p-6 rounded-2xl bg-[#141414] border border-red-900/40 text-center space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="font-serif-luxury text-lg font-bold text-white">
                  Acceso Restringido al Personal
                </h2>
                <p className="text-xs text-neutral-400">
                  El acceso a las rutas operativas del sistema está reservado exclusivamente para Administradores y Recepción. Redirigiendo a tu portal de cliente...
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('/mi-cuenta')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#C8A45C] text-black shadow cursor-pointer"
                >
                  Ir a Mis Citas / Mi Cuenta
                </button>
              </div>
            ) : isDataLoading ? (
              <DashboardSkeleton />
            ) : isVestuarioAdmin ? (
              <VestuarioManager />
            ) : (
              <>
                {activeView === '/dashboard' && <DashboardHome />}
                {activeView === '/dashboard/calendario' && <CalendarioView />}
                {activeView === '/dashboard/reservas' && <ReservasManager />}
                {activeView === '/dashboard/ventas' && <POSView />}
                {activeView === '/dashboard/reportes' && <ReportesView />}
                {(activeView === '/dashboard/egresos' || activeView === '/dashboard/finanzas') && <FinanzasView />}
                {(activeView === '/dashboard/empleados' || activeView === '/dashboard/colaboradores') && <ColaboradoresView />}
                {activeView === '/dashboard/asistencia' && <AsistenciaView />}
                {activeView === '/dashboard/servicios' && <ServiciosManager />}
                {activeView === '/dashboard/vestuario' && <VestuarioManager />}
                {activeView === '/dashboard/productos' && <ProductosManager />}
              </>
            )}
          </main>
        </div>
      ) : (
        // PUBLIC PORTAL LAYOUT (CON VIDEO DE FONDO PERSISTENTE)
        <ClientLayout>
          {activeView === '/' && <PublicLanding />}
          {activeView === '/servicios' && <PublicServices />}
          {activeView === '/reservar' && <PublicBookingFlow />}
          {(activeView === '/tienda' || activeView === '/productos') && <PublicShop />}
          {activeView === '/vestuario' && <PublicWardrobe />}
          {activeView === '/ubicacion' && <PublicLocation />}
          {activeView === '/mi-cuenta' && <ClientPortal />}
        </ClientLayout>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
