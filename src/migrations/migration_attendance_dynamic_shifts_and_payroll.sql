-- Migración: Parámetros Dinámicos de Horarios (Lunes a Sábado vs. Domingos) y Tracking de Ausencias/Permisos
-- Proyecto: Acicalados Spa & Barber Shop

-- 1. Agregar parámetros de Domingo a attendance_settings
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS sunday_entry_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS sunday_exit_time text DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS sunday_entry_tolerance_minutes integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS sunday_exit_tolerance_minutes integer DEFAULT 15;

-- 2. Asegurar columna absence_minutes en employee_attendances para tracking de pausas/permisos
ALTER TABLE public.employee_attendances
  ADD COLUMN IF NOT EXISTS absence_minutes integer DEFAULT 0;

-- 3. Actualizar fila de configuración existente con valores por defecto
UPDATE public.attendance_settings
SET 
  sunday_entry_time = COALESCE(sunday_entry_time, '09:00'),
  sunday_exit_time = COALESCE(sunday_exit_time, '19:00'),
  sunday_entry_tolerance_minutes = COALESCE(sunday_entry_tolerance_minutes, 15),
  sunday_exit_tolerance_minutes = COALESCE(sunday_exit_tolerance_minutes, 15)
WHERE id IS NOT NULL;
