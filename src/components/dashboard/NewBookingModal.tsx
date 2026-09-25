import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Service, Employee, formatSoles, BusinessCategory } from '../../types';
import { getTodayDateString } from '../../data/initialData';
import {
  checkEmployeeAvailability,
  getEligibleEmployeesForService,
  timeToMinutes,
  minutesToTime,
} from '../../lib/bookingAvailability';
import {
  sanitizePhone,
  sanitizeDni,
  handleNumericKeyDown,
  PHONE_PLACEHOLDER,
  DNI_PLACEHOLDER,
} from '../../lib/validators';
import {
  Plus,
  X,
  Search,
  Scissors,
  Sparkles,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Smartphone,
  Layers,
  Check,
  Building2,
} from 'lucide-react';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    services,
    employees,
    employeeBlocks,
    bookings,
    currentRole,
    addBooking,
    openTicketModal,
  } = useApp();

  const todayStr = getTodayDateString();

  // 1. Datos del Cliente
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientDni, setClientDni] = useState('');
  const [nameError, setNameError] = useState(false);

  // 2. Filtros y Búsqueda de Servicios
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'barberia' | 'spa'>('todos');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // 3. Fecha, Hora y Asignación
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('11:00');
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [serviceAssignments, setServiceAssignments] = useState<Record<string, string>>({});

  // 4. Modalidades y Métodos de Pago
  const [paymentType, setPaymentType] = useState<'sin_pago' | 'completo' | 'adelanto'>('sin_pago');
  const [singleMethod, setSingleMethod] = useState<'efectivo' | 'yape' | 'transferencia'>('efectivo');
  
  // Pago Mixto (solo en Pago Completo)
  const [isMixto, setIsMixto] = useState<boolean>(false);
  const [mixtoCombination, setMixtoCombination] = useState<
    'efectivo_yape' | 'efectivo_transferencia' | 'yape_transferencia'
  >('efectivo_yape');
  const [mixtoAmount1, setMixtoAmount1] = useState<string>('');
  const [mixtoAmount2, setMixtoAmount2] = useState<string>('');

  // Pago de Adelanto
  const [advanceAmountInput, setAdvanceAmountInput] = useState<string>('');

  // Estado de error general o envío
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset de formulario al abrir el modal (estado inicial limpio, sin servicios preseleccionados)
  useEffect(() => {
    if (isOpen) {
      setNameError(false);
      setSubmitError(null);
      setSelectedServiceIds([]);
      setServiceAssignments({});
    }
  }, [isOpen]);

  // Servicios seleccionados completos
  const selectedServicesList = useMemo(() => {
    return services.filter((s) => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  // Cálculo de duración máxima simultánea y precio total sumado
  // Al realizarse los servicios en paralelo, la duración total de estadía del cliente equivale al servicio que más demore.
  const totalDurationMinutes = useMemo(() => {
    if (selectedServicesList.length === 0) return 0;
    return Math.max(...selectedServicesList.map((s) => s.duration_minutes || 30));
  }, [selectedServicesList]);

  const totalPriceCents = useMemo(() => {
    return selectedServicesList.reduce((acc, s) => acc + (s.price_cents || 0), 0);
  }, [selectedServicesList]);

  const totalPriceSoles = totalPriceCents / 100;

  // Hora de fin calculada de la cita (momento en que concluye el servicio más largo)
  const calculatedEndTime = useMemo(() => {
    const startMin = timeToMinutes(startTime);
    const endMin = startMin + totalDurationMinutes;
    return minutesToTime(endMin);
  }, [startTime, totalDurationMinutes]);

  // Tipo de reserva (barberia, spa, mixto)
  const bookingCategoryType = useMemo((): BusinessCategory => {
    const hasBarberia = selectedServicesList.some((s) => s.category === 'barberia');
    const hasSpa = selectedServicesList.some((s) => s.category === 'spa');
    if (hasBarberia && hasSpa) return 'mixto';
    if (hasSpa) return 'spa';
    return 'barberia';
  }, [selectedServicesList]);


  // Filtrado de servicios para la lista
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      if (!srv.active) return false;
      if (categoryFilter === 'barberia' && srv.category !== 'barberia') return false;
      if (categoryFilter === 'spa' && srv.category !== 'spa') return false;
      if (serviceSearch.trim()) {
        const q = serviceSearch.toLowerCase();
        return (
          srv.name.toLowerCase().includes(q) ||
          (srv.description && srv.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [services, categoryFilter, serviceSearch]);

  // Toggle de selección de servicio (toggle puro: permite deselección total)
  const toggleServiceSelection = (srvId: string) => {
    setSelectedServiceIds((prev) => {
      const exists = prev.includes(srvId);
      if (exists) {
        setServiceAssignments((curr) => {
          if (!curr[srvId]) return curr;
          const next = { ...curr };
          delete next[srvId];
          return next;
        });
        return prev.filter((id) => id !== srvId);
      } else {
        return [...prev, srvId];
      }
    });
  };

  // Colaboradores activos aptos (excluyendo recepcionistas puros)
  const availableEmployeesList = useMemo(() => {
    return employees.filter(
      (e) => e.active && e.type !== 'recepcionista' && e.role !== 'recepcionista'
    );
  }, [employees]);

  // Carga laboral de cada especialista en la fecha seleccionada
  const employeeWorkloads = useMemo(() => {
    const workloads: Record<string, number> = {};
    for (const emp of availableEmployeesList) {
      const activeCount = bookings.filter((b) => {
        if (b.date !== date) return false;
        return (
          (b as any).assigned_employee_id === emp.id ||
          b.services?.some((s) => s.employee_id === emp.id)
        );
      }).length;
      workloads[emp.id] = activeCount;
    }
    return workloads;
  }, [availableEmployeesList, bookings, date]);

  // Programación simultánea (paralela) de cada servicio seleccionado:
  // Todos inician exactamente a la misma hora base (startTime), y cada uno finaliza según su propia duración
  const scheduledServices = useMemo(() => {
    const baseStartMin = timeToMinutes(startTime);
    return selectedServicesList.map((srv, index) => {
      const duration = srv.duration_minutes || 30;
      const endMin = baseStartMin + duration;
      const srvStartStr = startTime;
      const srvEndStr = minutesToTime(endMin);
      return {
        service: srv,
        index,
        startTime: srvStartStr,
        endTime: srvEndStr,
        durationMinutes: duration,
      };
    });
  }, [selectedServicesList, startTime]);

  // Asignación automática óptima independiente por cada servicio en paralelo
  // Procura asignar especialistas distintos para servicios que se ejecutan simultáneamente
  const autoAssignedByService = useMemo(() => {
    const result: Record<string, Employee | null> = {};
    const assignedIds = new Set<string>();

    for (const item of scheduledServices) {
      const srv = item.service;
      const eligible = getEligibleEmployeesForService(srv, availableEmployeesList);
      const candidates = eligible.length > 0 ? eligible : availableEmployeesList;

      // Ordenar priorizando:
      // 1. Que no esté ya asignado a otro servicio simultáneo en esta cita
      // 2. Disponibilidad en tiempo real en la franja [item.startTime, item.endTime]
      // 3. Menor carga laboral del día
      const sorted = [...candidates].sort((a, b) => {
        const aAssigned = assignedIds.has(a.id) ? 1 : 0;
        const bAssigned = assignedIds.has(b.id) ? 1 : 0;
        if (aAssigned !== bAssigned) return aAssigned - bAssigned;

        const aAvail = checkEmployeeAvailability({
          employee: a,
          date,
          startTime: item.startTime,
          durationMinutes: item.durationMinutes,
          bookings,
          employeeBlocks,
        }).isAvailable ? 1 : 0;

        const bAvail = checkEmployeeAvailability({
          employee: b,
          date,
          startTime: item.startTime,
          durationMinutes: item.durationMinutes,
          bookings,
          employeeBlocks,
        }).isAvailable ? 1 : 0;

        if (aAvail !== bAvail) return bAvail - aAvail;

        const aLoad = employeeWorkloads[a.id] || 0;
        const bLoad = employeeWorkloads[b.id] || 0;
        return aLoad - bLoad;
      });

      const chosen = sorted[0] || null;
      result[srv.id] = chosen;
      if (chosen) {
        assignedIds.add(chosen.id);
      }
    }

    return result;
  }, [scheduledServices, availableEmployeesList, date, bookings, employeeBlocks, employeeWorkloads]);

  // Colaborador efectivo asignado a cada servicio
  const getEffectiveEmployeeForService = useCallback(
    (serviceId: string): Employee | null => {
      if (assignmentMode === 'auto') {
        return autoAssignedByService[serviceId] || null;
      }
      const manualEmpId = serviceAssignments[serviceId];
      if (manualEmpId) {
        const found = availableEmployeesList.find((e) => e.id === manualEmpId);
        if (found) return found;
      }
      return autoAssignedByService[serviceId] || null;
    },
    [assignmentMode, autoAssignedByService, serviceAssignments, availableEmployeesList]
  );

  // Consulta de disponibilidad de un colaborador para un servicio determinado
  const getServiceAvailability = useCallback(
    (item: { service: Service; startTime: string; durationMinutes: number }, emp: Employee | null) => {
      if (!emp) {
        return { isAvailable: false, message: 'No hay especialista asignado' };
      }
      return checkEmployeeAvailability({
        employee: emp,
        date,
        startTime: item.startTime,
        durationMinutes: item.durationMinutes,
        bookings,
        employeeBlocks,
      });
    },
    [date, bookings, employeeBlocks]
  );

  // Manejo de importes en Pago Mixto
  useEffect(() => {
    if (paymentType === 'completo' && isMixto) {
      const half = Math.floor(totalPriceSoles / 2);
      const remainder = Number((totalPriceSoles - half).toFixed(2));
      setMixtoAmount1(half.toString());
      setMixtoAmount2(remainder.toString());
    }
  }, [paymentType, isMixto, totalPriceSoles]);

  // Validación de suma en Pago Mixto
  const mixtoSum = useMemo(() => {
    const a1 = parseFloat(mixtoAmount1) || 0;
    const a2 = parseFloat(mixtoAmount2) || 0;
    return Number((a1 + a2).toFixed(2));
  }, [mixtoAmount1, mixtoAmount2]);

  const isMixtoSumValid = useMemo(() => {
    if (paymentType !== 'completo' || !isMixto) return true;
    return Math.abs(mixtoSum - totalPriceSoles) < 0.01;
  }, [paymentType, isMixto, mixtoSum, totalPriceSoles]);

  // Autocompletado del segundo monto en mixto al tipear el primero
  const handleMixtoAmount1Change = (val: string) => {
    setMixtoAmount1(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= totalPriceSoles) {
      const diff = Number((totalPriceSoles - num).toFixed(2));
      setMixtoAmount2(diff.toString());
    }
  };

  // Validación del monto de adelanto
  const advanceAmountNum = parseFloat(advanceAmountInput) || 0;
  const isAdvanceAmountValid = useMemo(() => {
    if (paymentType !== 'adelanto') return true;
    return advanceAmountNum > 0 && advanceAmountNum <= totalPriceSoles;
  }, [paymentType, advanceAmountNum, totalPriceSoles]);

  // Verificación de asignación completa y sin conflictos
  const allServicesAssigned = useMemo(() => {
    if (scheduledServices.length === 0) return false;
    return scheduledServices.every((item) => {
      const emp = getEffectiveEmployeeForService(item.service.id);
      return emp !== null;
    });
  }, [scheduledServices, getEffectiveEmployeeForService]);

  const hasAvailabilityConflict = useMemo(() => {
    if (assignmentMode !== 'manual') return false;
    return scheduledServices.some((item) => {
      const emp = getEffectiveEmployeeForService(item.service.id);
      if (!emp) return true;
      const avail = getServiceAvailability(item, emp);
      return !avail.isAvailable;
    });
  }, [assignmentMode, scheduledServices, getEffectiveEmployeeForService, getServiceAvailability]);

  // Control de colisión simultánea: Detectar si el mismo especialista fue asignado a 2 o más servicios en paralelo
  const duplicateSpecialistCollisions = useMemo(() => {
    const usage: Record<string, { employee: Employee; serviceNames: string[] }> = {};

    for (const item of scheduledServices) {
      const emp = getEffectiveEmployeeForService(item.service.id);
      if (emp) {
        if (!usage[emp.id]) {
          usage[emp.id] = { employee: emp, serviceNames: [item.service.name] };
        } else {
          usage[emp.id].serviceNames.push(item.service.name);
        }
      }
    }

    return Object.values(usage).filter((u) => u.serviceNames.length > 1);
  }, [scheduledServices, getEffectiveEmployeeForService]);

  const hasDuplicateCollision = duplicateSpecialistCollisions.length > 0;

  // Botón Submit habilitado/deshabilitado
  const canSubmit = useMemo(() => {
    if (!clientName.trim()) return false;
    if (selectedServicesList.length === 0) return false;
    if (!allServicesAssigned) return false;
    if (hasAvailabilityConflict) return false;
    if (hasDuplicateCollision) return false;
    if (paymentType === 'completo' && isMixto && !isMixtoSumValid) return false;
    if (paymentType === 'adelanto' && !isAdvanceAmountValid) return false;
    return true;
  }, [
    clientName,
    selectedServicesList,
    allServicesAssigned,
    hasAvailabilityConflict,
    hasDuplicateCollision,
    paymentType,
    isMixto,
    isMixtoSumValid,
    isAdvanceAmountValid,
  ]);

  if (!isOpen) return null;

  // Manejo del Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!clientName.trim()) {
      setNameError(true);
      setSubmitError('El nombre del cliente es obligatorio (*)');
      return;
    }

    if (selectedServicesList.length === 0) {
      setSubmitError('Debe seleccionar al menos un servicio.');
      return;
    }

    if (!allServicesAssigned) {
      setSubmitError('Hay servicios seleccionados que no tienen especialista asignado.');
      return;
    }

    if (hasDuplicateCollision) {
      const firstCol = duplicateSpecialistCollisions[0];
      setSubmitError(
        `Conflicto de asignación simultánea: ${firstCol.employee.full_name} fue asignado/a a ${firstCol.serviceNames.length} servicios simultáneos ("${firstCol.serviceNames.join('" y "')}"). Una persona no puede realizar dos atenciones a la vez a las ${startTime}. Asigne especialistas diferentes.`
      );
      return;
    }

    if (assignmentMode === 'manual' && hasAvailabilityConflict) {
      const conflictItem = scheduledServices.find((item) => {
        const emp = getEffectiveEmployeeForService(item.service.id);
        if (!emp) return true;
        return !getServiceAvailability(item, emp).isAvailable;
      });
      if (conflictItem) {
        const emp = getEffectiveEmployeeForService(conflictItem.service.id);
        const avail = getServiceAvailability(conflictItem, emp);
        setSubmitError(
          `Conflicto en "${conflictItem.service.name}": ${emp?.full_name || 'Especialista'} no está disponible (${avail.message || 'Horario ocupado'}).`
        );
      } else {
        setSubmitError('Uno o más especialistas seleccionados tienen conflicto de horario.');
      }
      return;
    }

    if (paymentType === 'completo' && isMixto && !isMixtoSumValid) {
      setSubmitError(
        `En pago mixto, la suma de los montos (S/ ${mixtoSum.toFixed(2)}) debe coincidir exactamente con el total de la cita (S/ ${totalPriceSoles.toFixed(2)}).`
      );
      return;
    }

    if (paymentType === 'adelanto' && !isAdvanceAmountValid) {
      setSubmitError(
        `El adelanto ingresado (S/ ${advanceAmountNum}) debe ser mayor a 0 y no exceder el total de la cita (S/ ${totalPriceSoles.toFixed(2)}).`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Determinar datos de pago
      let paidCents = 0;
      let pMethod: string | null = null;
      let cashCents = 0;
      let yapeCents = 0;
      let transferCents = 0;
      let paymentNotes = '';

      if (paymentType === 'completo') {
        paidCents = totalPriceCents;
        if (isMixto) {
          pMethod = 'mixto';
          const a1 = Math.round((parseFloat(mixtoAmount1) || 0) * 100);
          const a2 = Math.round((parseFloat(mixtoAmount2) || 0) * 100);

          if (mixtoCombination === 'efectivo_yape') {
            cashCents = a1;
            yapeCents = a2;
            paymentNotes = `Mixto (Efectivo: S/ ${(a1 / 100).toFixed(2)} + Yape: S/ ${(a2 / 100).toFixed(2)})`;
          } else if (mixtoCombination === 'efectivo_transferencia') {
            cashCents = a1;
            transferCents = a2;
            paymentNotes = `Mixto (Efectivo: S/ ${(a1 / 100).toFixed(2)} + Transferencia: S/ ${(a2 / 100).toFixed(2)})`;
          } else {
            yapeCents = a1;
            transferCents = a2;
            paymentNotes = `Mixto (Yape: S/ ${(a1 / 100).toFixed(2)} + Transferencia: S/ ${(a2 / 100).toFixed(2)})`;
          }
        } else {
          pMethod = singleMethod;
          if (singleMethod === 'efectivo') cashCents = paidCents;
          else if (singleMethod === 'yape') yapeCents = paidCents;
          else if (singleMethod === 'transferencia') transferCents = paidCents;
          paymentNotes = `Pago Total (${singleMethod.toUpperCase()})`;
        }
      } else if (paymentType === 'adelanto') {
        paidCents = Math.round(advanceAmountNum * 100);
        pMethod = singleMethod;
        if (singleMethod === 'efectivo') cashCents = paidCents;
        else if (singleMethod === 'yape') yapeCents = paidCents;
        else if (singleMethod === 'transferencia') transferCents = paidCents;
        paymentNotes = `Adelanto Recepción (${singleMethod.toUpperCase()})`;
      }

      // 2. Construir ítems de servicio con especialista independiente por cada uno
      const serviceItems = scheduledServices.map((item) => {
        const srv = item.service;
        const assignedEmp = getEffectiveEmployeeForService(srv.id);
        if (!assignedEmp) {
          throw new Error(`No se pudo asignar especialista para el servicio: ${srv.name}`);
        }

        return {
          service_id: srv.id,
          service_name: srv.name,
          employee_id: assignedEmp.id,
          employee_name: assignedEmp.full_name,
          price_cents: srv.price_cents,
          duration_minutes: item.durationMinutes,
          hora_inicio: item.startTime,
          hora_fin: item.endTime,
          start_time: item.startTime,
          end_time: item.endTime,
        };
      });

      // 3. Crear reserva (QA-002: ahora async, espera confirmación de Supabase)
      const newBooking = await addBooking({
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || '',
        client_dni: clientDni.trim() || undefined,
        client_email: 'recepcion@acicalados.pe',
        date,
        start_time: startTime,
        end_time: calculatedEndTime,
        type: bookingCategoryType,
        services: serviceItems,
        total_price_cents: totalPriceCents,
        advance_amount_cents: paidCents,
        payment_status: paidCents >= totalPriceCents ? 'total' : paidCents > 0 ? 'parcial' : 'sin_pago',
        payment_method: pMethod || undefined,
        cash_cents: cashCents,
        yape_cents: yapeCents,
        transfer_cents: transferCents,
        payment_notes: paymentNotes || undefined,
      });

      if (!newBooking) {
        setSubmitError('No se pudo registrar la reserva en el sistema. Verifica la conexión e inténtalo nuevamente.');
        return;
      }

      // Limpiar formulario y cerrar
      setClientName('');
      setClientPhone('');
      setClientDni('');
      setSelectedServiceIds([]);
      setServiceAssignments({});
      setPaymentType('sin_pago');
      setIsMixto(false);
      setAdvanceAmountInput('');

      onClose();
      if (onSuccess) onSuccess();

      // Abrir ticket térmico opcional si se registró pago
      if (paidCents > 0 && openTicketModal) {
        openTicketModal('booking', newBooking);
      }
    } catch (err: any) {
      console.error('Error al crear reserva manual:', err);
      setSubmitError(err?.message || 'Error al guardar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="bg-[#121212] border border-[#C8A45C]/40 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Superior del Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#C8A45C]/25 bg-gradient-to-r from-[#171717] to-[#121212] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8A45C]/15 border border-[#C8A45C]/40 text-[#E6C875] flex items-center justify-center shadow-inner">
              <Plus className="w-5 h-5 text-[#C8A45C]" />
            </div>
            <div>
              <h3 className="font-serif-luxury text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Nueva Reserva Manual</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C8A45C]/20 border border-[#C8A45C]/40 text-[#E6C875] font-normal uppercase tracking-wider">
                  {currentRole === 'admin' ? 'Administrador' : 'Recepción'}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Agenda citas con verificación de disponibilidad en tiempo real y cobro de adelantos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:border-[#C8A45C]/50 hover:bg-[#C8A45C]/10 flex items-center justify-center transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Formulario Scrolleable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
          {/* Mensaje de Error General si existe */}
          {submitError && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Validación requerida:</span>
                <span className="text-[11px] leading-relaxed">{submitError}</span>
              </div>
            </div>
          )}

          {/* SECCIÓN 1: DATOS DEL CLIENTE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
              <h4 className="font-serif-luxury text-sm font-bold text-[#E6C875] flex items-center gap-2">
                <User className="w-4 h-4 text-[#C8A45C]" />
                <span>1. Datos del Cliente</span>
              </h4>
              <span className="text-[10px] text-neutral-400 font-mono">
                Solo el nombre es obligatorio
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Nombre (Obligatorio) */}
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium flex items-center gap-1">
                  <span>Nombre del Cliente</span>
                  <span className="text-amber-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Manuel Elías Ore..."
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    if (e.target.value.trim()) setNameError(false);
                  }}
                  className={`w-full bg-[#181818] border rounded-xl p-2.5 text-white outline-none transition ${
                    nameError
                      ? 'border-red-500 focus:border-red-400 bg-red-950/20'
                      : 'border-neutral-800 focus:border-[#C8A45C]/70'
                  }`}
                />
                {nameError && (
                  <span className="text-[10px] text-red-400 block font-medium">
                    El nombre es obligatorio para registrar la reserva
                  </span>
                )}
              </div>

              {/* Teléfono WhatsApp (Completamente Opcional) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-neutral-400 font-normal">
                    Teléfono WhatsApp <span className="text-neutral-500">(Opcional)</span>
                  </label>
                  <span className="text-[9px] text-neutral-500 font-mono">9 dígitos</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder={PHONE_PLACEHOLDER}
                  value={clientPhone}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => setClientPhone(sanitizePhone(e.target.value))}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C]/70 text-white rounded-xl p-2.5 outline-none font-mono"
                />
              </div>

              {/* DNI (Completamente Opcional) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-neutral-400 font-normal">
                    DNI <span className="text-neutral-500">(Opcional)</span>
                  </label>
                  <span className="text-[9px] text-neutral-500 font-mono">8 dígitos</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder={DNI_PLACEHOLDER}
                  value={clientDni}
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => setClientDni(sanitizeDni(e.target.value))}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C]/70 text-white rounded-xl p-2.5 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: SELECCIÓN Y BÚSQUEDA DE SERVICIOS */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-1.5">
              <h4 className="font-serif-luxury text-sm font-bold text-[#E6C875] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#C8A45C]" />
                <span>2. Servicios a Realizar</span>
                <span className="text-neutral-400 text-xs font-normal">
                  ({selectedServicesList.length} seleccionado{selectedServicesList.length === 1 ? '' : 's'})
                </span>
              </h4>

              {/* Pestañas de Categoría */}
              <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-xl border border-neutral-800">
                {(['todos', 'barberia', 'spa'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition capitalize ${
                      categoryFilter === cat
                        ? 'bg-[#C8A45C] text-black shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat === 'todos' ? 'Todos' : cat === 'barberia' ? 'Barbería' : 'Spa'}
                  </button>
                ))}
              </div>
            </div>

            {/* Buscador de Servicios */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#C8A45C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar servicio por nombre o palabra clave..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C]/70 text-white rounded-xl pl-9 pr-8 py-2 outline-none text-xs"
              />
              {serviceSearch && (
                <button
                  type="button"
                  onClick={() => setServiceSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Cuadrícula de Servicios Disponibles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 border border-neutral-800/80 rounded-2xl bg-[#0E0E0E]">
              {filteredServices.length === 0 ? (
                <div className="col-span-full py-8 text-center text-neutral-500">
                  No se encontraron servicios con los filtros aplicados.
                </div>
              ) : (
                filteredServices.map((srv) => {
                  const isSelected = selectedServiceIds.includes(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => toggleServiceSelection(srv.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                        isSelected
                          ? 'bg-[#C8A45C]/15 border-[#C8A45C] text-white shadow-[0_0_15px_rgba(200,164,92,0.15)]'
                          : 'bg-[#161616] border-neutral-800/90 text-neutral-300 hover:border-[#C8A45C]/40 hover:bg-[#1A1A1A]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-xs leading-snug line-clamp-2">
                          {srv.name}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                            isSelected
                              ? 'bg-[#C8A45C] border-[#C8A45C] text-black'
                              : 'border-neutral-700 bg-black/40'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/50">
                        <span
                          className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                            srv.category === 'barberia'
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {srv.category === 'barberia' ? 'Barbería' : 'Spa'}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-neutral-400">{srv.duration_minutes}m</span>
                          <span className="font-bold text-[#E6C875]">
                            {formatSoles(srv.price_cents)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Resumen de Servicios Seleccionados */}
            {selectedServicesList.length > 0 && (
              <div className="p-3 rounded-xl bg-[#161616] border border-[#C8A45C]/30 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                    Seleccionados:
                  </span>
                  {selectedServicesList.map((srv) => (
                    <span
                      key={srv.id}
                      className="inline-flex items-center gap-1 bg-black/60 border border-neutral-700 text-neutral-200 px-2 py-0.5 rounded-md text-[11px]"
                    >
                      <span>{srv.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleServiceSelection(srv.id);
                        }}
                        className="text-neutral-400 hover:text-red-400 ml-0.5 cursor-pointer"
                        title="Deseleccionar servicio"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-neutral-400 text-xs font-mono">
                    Estadía cliente: <strong className="text-white">{totalDurationMinutes} min</strong>
                  </span>
                  <span className="text-[#C8A45C] text-sm font-bold font-mono">
                    Total: {formatSoles(totalPriceCents)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 3: FECHA, HORARIO Y ASIGNACIÓN DE ESPECIALISTAS POR SERVICIO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
              <h4 className="font-serif-luxury text-sm font-bold text-[#E6C875] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C8A45C]" />
                <span>3. Horario & Asignación de Especialista por Servicio (Atención Simultánea)</span>
              </h4>
              <span className="text-[10px] text-neutral-400 font-mono">
                {scheduledServices.length > 0
                  ? `Estadía máxima: ${totalDurationMinutes} min (Fin: ${calculatedEndTime})`
                  : 'Sin servicios seleccionados'}
              </span>
            </div>

            {/* Banner explicativo de atención simultánea */}
            {scheduledServices.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[#C8A45C]/10 border border-[#C8A45C]/30 text-[#E6C875] text-[11px] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#C8A45C]" />
                <span>
                  <strong>Atención en Paralelo:</strong> Todos los servicios inician a las <strong>{startTime}</strong> de forma simultánea, atendidos por su respectivo especialista. La estadía del cliente equivale al servicio que más demore ({totalDurationMinutes} min).
                </span>
              </div>
            )}

            {/* Fecha y Hora de Inicio General */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Fecha de la Cita</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  min={todayStr}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C]/70 text-white rounded-xl p-2.5 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Hora de Inicio de la Cita (Simultánea)</span>
                </label>
                <input
                  type="time"
                  required
                  step="1800"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#C8A45C]/70 text-white rounded-xl p-2.5 outline-none font-mono"
                />
              </div>
            </div>

            {/* Alerta de Colisión por Especialista Duplicado */}
            {hasDuplicateCollision && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 flex items-start gap-2.5 text-xs animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block text-amber-300">Conflicto: Especialista asignado a múltiples servicios simultáneos</strong>
                  {duplicateSpecialistCollisions.map((col, cIdx) => (
                    <span key={cIdx} className="block text-[11px] text-amber-200/90">
                      • <strong>{col.employee.full_name}</strong> está asignado/a a {col.serviceNames.length} servicios al mismo tiempo: <em>{col.serviceNames.join(', ')}</em>. Asigne especialistas diferentes para cada servicio.
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Selector de Modo de Asignación */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-neutral-300 font-medium block">
                  Modo de Asignación del Personal
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {bookingCategoryType === 'mixto'
                    ? 'Reserva Mixta (Barbería + Spa)'
                    : `Reserva ${bookingCategoryType.toUpperCase()}`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentMode('auto')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    assignmentMode === 'auto'
                      ? 'bg-[#C8A45C]/15 border-[#C8A45C] text-white shadow-sm'
                      : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Sparkles
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      assignmentMode === 'auto' ? 'text-[#C8A45C]' : 'text-neutral-500'
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-xs block text-white">
                      Asignación Automática Inteligente
                    </span>
                    <span className="text-[10px] text-neutral-400 leading-snug block mt-0.5">
                      Asigna automáticamente especialistas calificados diferentes por servicio según disponibilidad en tiempo real.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAssignmentMode('manual')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    assignmentMode === 'manual'
                      ? 'bg-[#C8A45C]/15 border-[#C8A45C] text-white shadow-sm'
                      : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <User
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      assignmentMode === 'manual' ? 'text-[#C8A45C]' : 'text-neutral-500'
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-xs block text-white">
                      Asignación Manual por Servicio
                    </span>
                    <span className="text-[10px] text-neutral-400 leading-snug block mt-0.5">
                      Elige de forma independiente al colaborador calificado para cada servicio seleccionado.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* TARJETAS DE ASIGNACIÓN INDEPENDIENTE POR CADA SERVICIO */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#C8A45C]" />
                  <span>Especialistas por Servicio Simultáneo ({scheduledServices.length}):</span>
                </span>
                <span className="text-[10px] text-neutral-400">
                  {bookingCategoryType === 'mixto'
                    ? '⚡ Barbería y Spa atendidos por especialistas independientes'
                    : 'Cada servicio tiene su propio especialista asignado'}
                </span>
              </div>

              {scheduledServices.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-neutral-800 bg-[#121212] text-center text-xs text-neutral-400">
                  No hay servicios seleccionados. Selecciona al menos un servicio en la sección anterior para asignar especialistas y configurar el horario.
                </div>
              ) : (
                scheduledServices.map((item) => {
                const srv = item.service;
                const assignedEmp = getEffectiveEmployeeForService(srv.id);
                const availStatus = getServiceAvailability(item, assignedEmp);
                const eligibleEmps = getEligibleEmployeesForService(srv, availableEmployeesList);
                const candidates = eligibleEmps.length > 0 ? eligibleEmps : availableEmployeesList;
                const isSpa = srv.category === 'spa';
                const isDuplicate = assignedEmp
                  ? duplicateSpecialistCollisions.some((col) => col.employee.id === assignedEmp.id)
                  : false;

                return (
                  <div
                    key={srv.id}
                    className={`p-3.5 sm:p-4 rounded-xl bg-[#161616] border transition space-y-3 ${
                      isDuplicate
                        ? 'border-amber-500/60 bg-amber-950/10'
                        : 'border-neutral-800/90 hover:border-[#C8A45C]/30'
                    }`}
                  >
                    {/* Header de la tarjeta del servicio */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/70 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isSpa
                              ? 'bg-purple-950/70 border border-purple-800/60 text-purple-300'
                              : 'bg-[#C8A45C]/20 border border-[#C8A45C]/40 text-[#E6C875]'
                          }`}
                        >
                          {item.index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-white block">
                              {srv.name}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                isSpa
                                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                                  : 'bg-[#C8A45C]/20 text-[#E6C875] border border-[#C8A45C]/40'
                              }`}
                            >
                              {isSpa ? 'Spa / Estética' : 'Barbería'}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ⏱️ {item.startTime} a {item.endTime} ({item.durationMinutes} min)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="text-xs font-bold text-[#E6C875]">
                          {formatSoles(srv.price_cents)}
                        </span>
                      </div>
                    </div>

                    {/* Selector o Vista de Asignación */}
                    {assignmentMode === 'manual' ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#C8A45C]" />
                            <span>Seleccionar Especialista para este Servicio:</span>
                          </label>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {candidates.length} colaborador{candidates.length === 1 ? '' : 'es'} calificado{candidates.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <select
                          value={assignedEmp?.id || ''}
                          onChange={(e) => {
                            setServiceAssignments((prev) => ({
                              ...prev,
                              [srv.id]: e.target.value,
                            }));
                          }}
                          className={`w-full bg-[#1a1a1a] border text-white rounded-xl p-2.5 outline-none text-xs ${
                            isDuplicate
                              ? 'border-amber-500/80 focus:border-amber-400'
                              : 'border-neutral-800 focus:border-[#C8A45C]'
                          }`}
                        >
                          {candidates.map((emp) => {
                            const empAvail = checkEmployeeAvailability({
                              employee: emp,
                              date,
                              startTime: item.startTime,
                              durationMinutes: item.durationMinutes,
                              bookings,
                              employeeBlocks,
                            });
                            const load = employeeWorkloads[emp.id] || 0;
                            return (
                              <option key={emp.id} value={emp.id}>
                                {emp.full_name} ({emp.type}) — {empAvail.isAvailable ? '🟢 Disponible' : `🔴 Ocupado (${empAvail.message || 'Conflicto'})`} — {load} cita{load === 1 ? '' : 's'} hoy
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : (
                      /* Vista en Modo Automático */
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#1a1a1a] p-3 rounded-xl border border-neutral-800/80">
                        <div className="flex items-center gap-3">
                          {assignedEmp?.avatar ? (
                            <img
                              src={assignedEmp.avatar}
                              alt={assignedEmp.full_name}
                              className="w-9 h-9 rounded-lg object-cover border border-[#C8A45C]/30 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {assignedEmp?.full_name?.charAt(0) || 'E'}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-white">
                                {assignedEmp?.full_name || 'Especialista Sugerido'}
                              </span>
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                                {assignedEmp?.type || (isSpa ? 'Spa' : 'Barbero')}
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-400 block mt-0.5">
                              Asignado automáticamente por área ({isSpa ? 'Spa' : 'Barbería'}) · Carga: {assignedEmp ? (employeeWorkloads[assignedEmp.id] || 0) : 0} citas hoy
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Auto-Asignado</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Alerta de Colisión Directa si el mismo especialista fue elegido para 2+ servicios simultáneos */}
                    {isDuplicate && (
                      <div className="px-3 py-2 rounded-lg bg-amber-950/50 border border-amber-500/50 text-amber-200 flex items-start gap-2 text-[11px] animate-fadeIn">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-amber-300">Colisión: Especialista ya asignado en esta cita</span>
                          <span className="text-[10px] text-amber-200/90 leading-snug">
                            <strong>{assignedEmp?.full_name}</strong> ya está asignado/a a otro servicio simultáneo que inicia a las {item.startTime}. Una persona no puede atender dos servicios al mismo tiempo.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Estado de Disponibilidad en Tiempo Real para este servicio */}
                    {assignedEmp && !isDuplicate && (
                      <div>
                        {availStatus.isAvailable ? (
                          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 flex items-center gap-2 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              <strong>{assignedEmp.full_name}</strong> está disponible para este servicio de {item.startTime} a {item.endTime}.
                            </span>
                          </div>
                        ) : (
                          <div className="px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 flex items-start gap-2 text-[11px] animate-fadeIn">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block">Conflicto de Horario:</span>
                              <span className="text-[10px] text-red-300/90 leading-snug">
                                {availStatus.message || 'El especialista ya cuenta con una cita o bloqueo en este intervalo.'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>
          </div>

          {/* SECCIÓN 4: MODALIDADES Y MÉTODOS DE PAGO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
              <h4 className="font-serif-luxury text-sm font-bold text-[#E6C875] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#C8A45C]" />
                <span>4. Modalidad y Método de Pago</span>
              </h4>
              <span className="text-xs font-bold text-[#C8A45C] font-mono">
                Total: {formatSoles(totalPriceCents)}
              </span>
            </div>

            {/* Selector de Modalidad: Sin Pago / Pago Completo / Adelanto */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentType('sin_pago');
                  setIsMixto(false);
                }}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  paymentType === 'sin_pago'
                    ? 'bg-[#C8A45C]/20 border-[#C8A45C] text-white font-bold'
                    : 'bg-[#161616] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <span className="block text-xs">Sin Pago Ahora</span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  Pagar en el local
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType('adelanto');
                  setIsMixto(false);
                }}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  paymentType === 'adelanto'
                    ? 'bg-[#C8A45C]/20 border-[#C8A45C] text-white font-bold'
                    : 'bg-[#161616] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <span className="block text-xs">Pago de Adelanto</span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  Monto manual (S/.)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('completo')}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  paymentType === 'completo'
                    ? 'bg-[#C8A45C]/20 border-[#C8A45C] text-white font-bold'
                    : 'bg-[#161616] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <span className="block text-xs">Pago Completo</span>
                <span className="text-[10px] text-[#E6C875] font-normal">
                  Total: {formatSoles(totalPriceCents)}
                </span>
              </button>
            </div>

            {/* CASO A: PAGO DE ADELANTO (Efectivo, Yape, Transferencia) */}
            {paymentType === 'adelanto' && (
              <div className="p-3.5 rounded-2xl bg-[#161616] border border-[#C8A45C]/30 space-y-3 animate-fadeIn">
                <div className="space-y-0.5">
                  <label className="text-xs font-semibold text-white block">
                    Monto del Adelanto Abonado (S/.)
                  </label>
                  <span className="text-[10px] text-neutral-400 block">
                    Ingresa el monto manual abonado (admite montos enteros o decimales libres).
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold font-mono">
                      S/
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={totalPriceSoles}
                      required
                      placeholder="Ej. 20 ó 25.50"
                      value={advanceAmountInput}
                      onChange={(e) => setAdvanceAmountInput(e.target.value)}
                      className={`w-full bg-[#1C1C1C] border rounded-xl pl-8 pr-3 py-2 text-white font-mono text-sm outline-none ${
                        !isAdvanceAmountValid && advanceAmountInput
                          ? 'border-red-500 text-red-300'
                          : 'border-neutral-700 focus:border-[#C8A45C]'
                      }`}
                    />
                  </div>
                  <div className="text-right text-xs font-mono shrink-0">
                    <span className="text-neutral-400 block text-[10px]">Saldo por cobrar:</span>
                    <span className="text-white font-bold">
                      S/ {Math.max(0, totalPriceSoles - (parseFloat(advanceAmountInput) || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Selección de Método de Pago para Adelanto: SOLO 3 OPCIONES */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-neutral-300 font-medium block">
                    Forma de Pago del Adelanto (Seleccione una):
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['efectivo', 'yape', 'transferencia'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSingleMethod(m)}
                        className={`p-2 rounded-xl border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          singleMethod === m
                            ? 'bg-[#C8A45C]/20 border-[#C8A45C] text-white font-bold'
                            : 'bg-black/40 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {m === 'efectivo' && <DollarSign className="w-3.5 h-3.5 text-[#C8A45C]" />}
                        {m === 'yape' && <Smartphone className="w-3.5 h-3.5 text-[#C8A45C]" />}
                        {m === 'transferencia' && <Building2 className="w-3.5 h-3.5 text-[#C8A45C]" />}
                        <span className="capitalize text-xs">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CASO B: PAGO COMPLETO (Efectivo, Yape, Transferencia, Mixto) */}
            {paymentType === 'completo' && (
              <div className="p-3.5 rounded-2xl bg-[#161616] border border-[#C8A45C]/30 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Forma de Pago Completo (Total: {formatSoles(totalPriceCents)}):
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                    Saldo al finalizar: S/ 0.00
                  </span>
                </div>

                {/* 4 Opciones de Pago Completo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['efectivo', 'yape', 'transferencia'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setIsMixto(false);
                        setSingleMethod(m);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        !isMixto && singleMethod === m
                          ? 'bg-[#C8A45C]/20 border-[#C8A45C] text-white font-bold shadow-sm'
                          : 'bg-black/40 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {m === 'efectivo' && <DollarSign className="w-3.5 h-3.5 text-[#C8A45C]" />}
                      {m === 'yape' && <Smartphone className="w-3.5 h-3.5 text-[#C8A45C]" />}
                      {m === 'transferencia' && <Building2 className="w-3.5 h-3.5 text-[#C8A45C]" />}
                      <span className="capitalize text-xs">{m}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsMixto(true)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isMixto
                        ? 'bg-[#C8A45C]/20 border-[#C8A45C] text-white font-bold shadow-sm'
                        : 'bg-black/40 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-[#C8A45C]" />
                    <span className="text-xs">Mixto</span>
                  </button>
                </div>

                {/* Desglose de Pago Mixto (Exactamente 2 métodos combinados) */}
                {isMixto && (
                  <div className="p-3 rounded-xl bg-black/60 border border-neutral-800 space-y-2.5 animate-fadeIn">
                    <div className="space-y-1">
                      <span className="text-[11px] text-neutral-300 font-medium block">
                        Combinación de 2 Métodos:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {[
                          { id: 'efectivo_yape', label: 'Efectivo + Yape' },
                          { id: 'efectivo_transferencia', label: 'Efectivo + Transferencia' },
                          { id: 'yape_transferencia', label: 'Yape + Transferencia' },
                        ].map((combo) => (
                          <button
                            key={combo.id}
                            type="button"
                            onClick={() => setMixtoCombination(combo.id as any)}
                            className={`px-2 py-1.5 rounded-lg border text-center text-[11px] transition ${
                              mixtoCombination === combo.id
                                ? 'bg-[#C8A45C] text-black font-bold border-[#C8A45C]'
                                : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {combo.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Inputs de los dos montos con validación de suma */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-400 font-medium block capitalize">
                          {mixtoCombination.split('_')[0]} (S/.)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={totalPriceSoles}
                          value={mixtoAmount1}
                          onChange={(e) => handleMixtoAmount1Change(e.target.value)}
                          className="w-full bg-[#181818] border border-neutral-700 text-white rounded-lg p-2 font-mono text-xs outline-none focus:border-[#C8A45C]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-400 font-medium block capitalize">
                          {mixtoCombination.split('_')[1]} (S/.)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={totalPriceSoles}
                          value={mixtoAmount2}
                          onChange={(e) => setMixtoAmount2(e.target.value)}
                          className="w-full bg-[#181818] border border-neutral-700 text-white rounded-lg p-2 font-mono text-xs outline-none focus:border-[#C8A45C]"
                        />
                      </div>
                    </div>

                    {/* Badge de Verificación de Suma */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-neutral-400">
                        Suma combinada: <strong className="text-white font-mono">S/ {mixtoSum.toFixed(2)}</strong> / S/ {totalPriceSoles.toFixed(2)}
                      </span>
                      {isMixtoSumValid ? (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Suma exacta
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {mixtoSum < totalPriceSoles
                            ? `Falta S/ ${(totalPriceSoles - mixtoSum).toFixed(2)}`
                            : `Excede por S/ ${(mixtoSum - totalPriceSoles).toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RESUMEN FINAL & BOTONES DE ACCIÓN */}
          <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-neutral-400 space-y-0.5 text-center sm:text-left">
              <div>
                Cliente: <strong className="text-white">{clientName.trim() || '—'}</strong>
                {clientPhone && <span className="text-neutral-500 font-mono"> ({clientPhone})</span>}
              </div>
              <div>
                Especialista{scheduledServices.length > 1 ? 's' : ''}:{' '}
                <strong className="text-[#E6C875]">
                  {scheduledServices.length === 0
                    ? 'Ningún servicio seleccionado'
                    : scheduledServices.length === 1
                    ? (getEffectiveEmployeeForService(scheduledServices[0]?.service.id)?.full_name || 'Sin asignar')
                    : scheduledServices.map((item) => {
                        const emp = getEffectiveEmployeeForService(item.service.id);
                        return `${item.service.name}: ${emp?.full_name || 'Sin asignar'}`;
                      }).join(' · ')
                  }
                </strong>
                {scheduledServices.length > 0 && (
                  <>
                    {' · '}
                    Horario Simultáneo: <strong className="text-white font-mono">{startTime} a {calculatedEndTime}</strong>
                    <span className="text-neutral-500 font-mono text-[10px]"> (Estadía máx: {totalDurationMinutes} min)</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 transition text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={selectedServiceIds.length === 0 || !canSubmit || isSubmitting}
                className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg ${
                  selectedServiceIds.length > 0 && canSubmit && !isSubmitting
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#C8A45C] text-black hover:brightness-110 shadow-[0_4px_20px_rgba(200,164,92,0.3)] cursor-pointer'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
                }`}
                title={selectedServiceIds.length === 0 ? 'Debe seleccionar al menos un servicio' : undefined}
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando Reserva...' : 'Confirmar y Crear Cita'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
