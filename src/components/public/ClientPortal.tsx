import { qaRpc, mapBooking } from '../../lib/qaApi';
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { formatSoles, formatLimaDate, Booking } from '../../types';
import { PaymentQRWidget } from '../common/PaymentQRWidget';
import { supabase } from '../../lib/supabase/client';
import {
  User,
  Phone,
  FileText,
  Mail,
  Calendar,
  CalendarX2,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  LayoutDashboard,
} from 'lucide-react';
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

export const ClientPortal: React.FC = () => {
  const { currentUser, setActiveView } = useApp();

  // Profile fields state synchronized strictly with currentUser
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [dni, setDni] = useState(currentUser.dni || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Bookings list fetched strictly for this client
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  // Selected booking to pay pending balance
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);

  // QA-004: Estado para búsqueda por código y celular de invitados no autenticados
  const [guestLookupCode, setGuestLookupCode] = useState('');
  const [guestLookupPhone, setGuestLookupPhone] = useState('');
  const [isLookingUpGuest, setIsLookingUpGuest] = useState(false);
  const [guestLookupError, setGuestLookupError] = useState<string | null>(null);
  const [guestLookupDone, setGuestLookupDone] = useState(false);

  // Sincronizar datos del titular al cambiar currentUser o cargar sesión
  useEffect(() => {
    if (currentUser && currentUser.role !== 'anon') {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      if (currentUser.phone) setPhone(currentUser.phone);
      if (currentUser.dni) setDni(currentUser.dni);
    }
  }, [currentUser]);

  // Consulta estricta a Supabase de las reservas del cliente autenticado
  const fetchUserReservations = useCallback(async () => {
    if (!currentUser?.id || currentUser.role === 'anon') {
      setUserBookings([]);
      setIsLoadingBookings(false);
      return;
    }

    setIsLoadingBookings(true);
    try {
      let query = supabase
        .from('bookings')
        .select('*, booking_services(*)')
        .order('booking_date', { ascending: false });

      query = query.eq('user_id', currentUser.id);

      const { data, error } = await query;
      if (error) {
        console.error('Error al obtener reservas del cliente:', error);
        setUserBookings([]);
        return;
      }

      setUserBookings((data || []).map(mapBooking));
    } catch (err) {
      console.error('Error inesperado al cargar citas:', err);
      setUserBookings([]);
    } finally {
      setIsLoadingBookings(false);
    }
  }, [currentUser]);

  // QA-004: Búsqueda de reservas para usuarios no autenticados (invitados) por código y celular
  const handleGuestLookup = useCallback(async () => {
    const cleanPhone = sanitizePhone(guestLookupPhone);
    if (!guestLookupCode.trim() || !cleanPhone || !isValidPhone(cleanPhone)) {
      setGuestLookupError('Ingresa el código de reserva y un celular válido.');
      return;
    }

    if (isLookingUpGuest) return;
    setUserBookings([]);
    setIsLookingUpGuest(true);
    setGuestLookupError(null);
    setGuestLookupDone(false);

    try {
      const data = await qaRpc<any[]>('qa_lookup_booking', { p_code: guestLookupCode.trim().toUpperCase(), p_phone: cleanPhone });
      setUserBookings(data.map(mapBooking));
      setGuestLookupDone(true);
    } catch (err) {
      console.error('Error en búsqueda de invitado:', err);
      setGuestLookupError('Error inesperado. Inténtalo nuevamente.');
    } finally {
      setIsLookingUpGuest(false);
    }
  }, [guestLookupPhone, guestLookupCode]);

  useEffect(() => {
    fetchUserReservations();
  }, [fetchUserReservations]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    if (phone.trim() && !isValidPhone(phone)) {
      setProfileError(PHONE_ERROR_MESSAGE);
      return;
    }

    if (dni.trim() && !isValidDni(dni)) {
      setProfileError(DNI_ERROR_MESSAGE);
      return;
    }

    setProfileSaving(true);
    try {
      if (currentUser?.id && currentUser.id.includes('-')) {
        const names = name.trim().split(' ');
        const firstName = names[0] || 'Cliente';
        const lastName = names.slice(1).join(' ') || '';

        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: sanitizePhone(phone) || null,
            dni: sanitizeDni(dni) || null,
          })
          .eq('id', currentUser.id);

        if (error) {
          console.error('Error actualizando perfil en Supabase:', error);
          setProfileError('No se pudo guardar los datos en la nube.');
          return;
        }
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      console.error('Error al guardar datos:', err);
      setProfileError('Error inesperado al guardar.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-[#C8A45C]">
            Portal de Autoservicio del Cliente
          </span>
          <h1 className="font-serif-luxury text-3xl font-bold text-white">
            Mi Cuenta & Mis Reservas
          </h1>
          <p className="text-xs text-neutral-400">
            Administra tus datos personales, consulta tus citas agendadas y liquida saldos pendientes vía código QR.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-3 bg-[#161616] border border-neutral-800 p-2.5 rounded-xl">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-lg object-cover border border-[#C8A45C]/40"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-xs font-bold text-white block">{currentUser.name}</span>
              <span className="text-[10px] text-[#C8A45C] font-semibold uppercase">
                {currentUser.role === 'VESTUARIO_ADMIN' || currentUser.email?.toLowerCase() === 'vepeja4602@bullbaby.com'
                  ? 'Admin Vestuario'
                  : currentUser.role === 'admin'
                  ? 'Administrador'
                  : currentUser.role === 'recepcionista'
                  ? 'Recepción'
                  : 'Cliente Acicalados'}
              </span>
            </div>
          </div>

          {(currentUser.role === 'VESTUARIO_ADMIN' ||
            currentUser.role === 'admin' ||
            currentUser.role === 'recepcionista' ||
            currentUser.email?.toLowerCase() === 'vepeja4602@bullbaby.com') && (
            <button
              type="button"
              onClick={() =>
                setActiveView(
                  currentUser.role === 'VESTUARIO_ADMIN' || currentUser.email?.toLowerCase() === 'vepeja4602@bullbaby.com'
                    ? '/dashboard/vestuario'
                    : '/dashboard'
                )
              }
              className="flex items-center gap-2 px-3.5 py-2.5 bg-[#C8A45C]/15 hover:bg-[#C8A45C]/25 text-[#E6C875] hover:text-white border border-[#C8A45C]/40 rounded-xl text-xs font-bold transition shadow cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-[#C8A45C]" />
              <span>Panel de Gestión</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Profile Editor Card */}
        <div className="lg:col-span-4 bg-[#141414] border border-[#C8A45C]/25 rounded-2xl p-6 space-y-6 shadow-xl">
          <h3 className="font-serif-luxury text-base font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-[#C8A45C]" />
            <span>Datos del Titular</span>
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-neutral-400">Nombres y Apellidos</label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl pl-9 pr-3 py-2 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-neutral-400">Teléfono WhatsApp</label>
                <span className="text-[10px] text-neutral-500 font-mono">9 dígitos</span>
              </div>
              <div className="relative">

                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  maxLength={9}
                  placeholder={PHONE_PLACEHOLDER}
                  value={phone}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => {
                    setPhone(sanitizePhone(e.target.value));
                    if (profileError) setProfileError(null);
                  }}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl pl-9 pr-3 py-2 outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-neutral-400">DNI / Documento de Identidad</label>
                <span className="text-[10px] text-neutral-500 font-mono">8 dígitos</span>
              </div>
              <div className="relative">
                <FileText className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  placeholder={DNI_PLACEHOLDER}
                  value={dni}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => {
                    setDni(sanitizeDni(e.target.value));
                    if (profileError) setProfileError(null);
                  }}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C] text-white rounded-xl pl-9 pr-3 py-2 outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  disabled
                  readOnly
                  className="w-full bg-[#181818]/60 border border-neutral-800/80 text-neutral-400 rounded-xl pl-9 pr-3 py-2 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {profileError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-center gap-2 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full py-2.5 rounded-xl font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow transition disabled:opacity-50"
            >
              {profileSaving ? 'Guardando...' : profileSaved ? '✓ Datos Guardados' : 'Actualizar Mis Datos'}
            </button>
          </form>
        </div>

        {/* Bookings History & Balance Payment */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C8A45C]" />
                <h3 className="font-serif-luxury text-base font-bold text-white">
                  Historial de Citas & Estado de Pagos
                </h3>
              </div>
              <span className="text-xs text-neutral-500 font-mono">
                {userBookings.length} {userBookings.length === 1 ? 'reserva' : 'reservas'}
              </span>
            </div>

            {isLoadingBookings ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#C8A45C] animate-spin mx-auto" />
                <p className="text-xs text-neutral-400">Consultando tus reservas registradas...</p>
              </div>
            ) : userBookings.length === 0 ? (
              /* Estado Vacío + QA-004: Búsqueda para invitados */
              <div className="space-y-5">
                {/* QA-004: Formulario de búsqueda por código y celular para usuarios invitados */}
                {(currentUser.role === 'anon' || currentUser.role === 'anonimo') && (
                  <div className="bg-[#181818]/80 border border-[#C8A45C]/20 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#C8A45C]/15 border border-[#C8A45C]/30 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-[#C8A45C]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">¿Reservaste sin cuenta?</h4>
                        <p className="text-[11px] text-neutral-400">Ingresa el código de reserva y el celular registrado.</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1 min-w-0 space-y-2">

                        <input aria-label="Código de reserva" value={guestLookupCode} onChange={e => setGuestLookupCode(e.target.value)} placeholder="Código de reserva AC-…" className="w-full min-w-0 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" />
                      <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={9}
                          placeholder={PHONE_PLACEHOLDER}
                          value={guestLookupPhone}
                          onKeyDown={(e) => {
                            handleNumericKeyDown(e);
                            if (e.key === 'Enter') handleGuestLookup();
                          }}
                          onChange={(e) => {
                            setGuestLookupPhone(sanitizePhone(e.target.value));
                            if (guestLookupError) setGuestLookupError(null);
                          }}
                          className="w-full bg-[#1A1A1A] border border-neutral-800 focus:border-[#C8A45C] text-white text-xs rounded-xl pl-9 pr-3 py-2 outline-none font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isLookingUpGuest}
                        onClick={handleGuestLookup}
                        className="px-4 py-2 rounded-xl bg-[#C8A45C] hover:bg-[#D4AF37] text-black text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLookingUpGuest ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        <span>{isLookingUpGuest ? 'Buscando...' : 'Buscar'}</span>
                      </button>
                    </div>
                    {guestLookupError && (
                      <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{guestLookupError}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Estado vacío cuando no hay reservas */}
                <div className="bg-[#181818]/60 border border-neutral-800/80 rounded-xl p-8 sm:p-12 text-center space-y-5">
                  <div className="w-14 h-14 rounded-2xl bg-[#C8A45C]/10 border border-[#C8A45C]/30 flex items-center justify-center text-[#C8A45C] mx-auto shadow-inner">
                    <CalendarX2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h4 className="font-serif-luxury text-lg font-bold text-white">
                      {guestLookupDone
                        ? 'No encontramos una reserva con ese código y celular'
                        : 'Aún no tienes citas agendadas'}
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {guestLookupDone
                        ? 'Verifica que el número es el mismo que usaste al reservar, o crea una nueva reserva.'
                        : 'Cuando reserves una cita en nuestra barbería o spa, podrás consultar aquí los detalles de tu servicio, el especialista asignado y liquidar saldos pendientes vía código QR.'}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveView('/reservar')}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] hover:from-[#DFCA8D] hover:to-[#D4AF37] text-black shadow-lg shadow-[#C8A45C]/10 transition"
                    >
                      <span>Reservar Mi Primera Cita</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {userBookings.map((b) => {
                  const saldoPendiente = Math.max(0, b.total_price_cents - b.advance_amount_cents);
                  const hasPendingBalance = saldoPendiente > 0;

                  return (
                    <div
                      key={b.id}
                      className="bg-[#181818] border border-neutral-800 hover:border-[#C8A45C]/30 rounded-xl p-4 sm:p-5 space-y-4 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                        <div className="flex flex-wrap min-w-0 items-center gap-3">
                          <span className="break-all font-mono text-xs font-bold text-[#E6C875] bg-black/40 px-2.5 py-1 rounded border border-neutral-800">
                            #{b.code}
                          </span>
                          <div>
                            <span className="text-xs font-semibold text-white block">
                              {formatLimaDate(b.date)} a las {b.start_time} - {b.end_time}
                            </span>
                            <span className="text-[10px] text-neutral-500 uppercase">
                              Categoría: {b.type}
                            </span>
                          </div>
                        </div>

                        {/* Payment Status Badge */}
                        <div className="flex items-center shrink-0">
                          {b.payment_status === 'total' ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1 shadow-sm">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>PAGADO COMPLETO</span>
                            </span>
                          ) : b.payment_status === 'parcial' ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1 shadow-sm">
                              <Clock className="w-3 h-3" />
                              <span>SALDO PENDIENTE</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-red-950/60 text-red-300 border border-red-800/60 flex items-center gap-1 shadow-sm">
                              <AlertCircle className="w-3 h-3" />
                              <span>SIN PAGO</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-neutral-300">Estado de la reserva: {b.status || 'pendiente'}</p>
                      {/* Services Detail */}
                      <div className="space-y-1">
                        {b.services.map((srv, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-neutral-300">
                            <span>• {srv.service_name} ({srv.duration_minutes} min)</span>
                            <span className="text-neutral-400">{formatSoles(srv.price_cents)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-[#121212] p-3 rounded-lg border border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Total Cita:</span>
                          <span className="font-bold text-white">{formatSoles(b.total_price_cents)}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Adelanto Cobrado:</span>
                          <span className="font-semibold text-emerald-400">
                            {formatSoles(b.advance_amount_cents)}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Saldo por Pagar:</span>
                          <span className="font-bold text-[#E6C875]">
                            {formatSoles(saldoPendiente)}
                          </span>
                        </div>

                        {hasPendingBalance && (
                          <button
                            type="button"
                            onClick={() => setPayingBooking(payingBooking?.id === b.id ? null : b)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C8A45C] hover:bg-[#D4AF37] text-black shadow transition flex items-center gap-1.5"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{payingBooking?.id === b.id ? 'Ocultar QR' : 'Liquidar Saldo con QR'}</span>
                          </button>
                        )}
                      </div>

                      {/* Payment QR Widget to pay the remaining balance */}
                      {payingBooking?.id === b.id && (
                        <div className="pt-2 animate-in fade-in duration-200">
                          <PaymentQRWidget
                            amountCents={saldoPendiente}
                            bookingCode={b.code}
                            bookingId={b.id}
                            clientPhone={b.client_phone}
                            clientName={b.client_name}
                            title={`Liquidar Saldo Pendiente de Reserva #${b.code}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
