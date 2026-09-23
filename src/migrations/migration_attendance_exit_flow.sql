-- ==============================================================================
-- Migración: Flujo de Salida de Asistencia (Definitiva vs. Emergencia)
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- Descripción: Agrega los campos exit_time, exit_type y exit_reason a la tabla
--              employee_attendances para diferenciar salidas definitivas de salidas
--              por emergencia justificada.
-- ==============================================================================

ALTER TABLE employee_attendances 
ADD COLUMN IF NOT EXISTS exit_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exit_type TEXT CHECK (exit_type IN ('definitiva', 'emergencia') OR exit_type IS NULL),
ADD COLUMN IF NOT EXISTS exit_reason TEXT;

-- Comentario descriptivo en columnas
COMMENT ON COLUMN employee_attendances.exit_time IS 'Marca temporal exacta de la salida registrada del colaborador';
COMMENT ON COLUMN employee_attendances.exit_type IS 'Tipo de salida: definitiva (cierre habitual de jornada) o emergencia (retiro imprevisto justificado)';
COMMENT ON COLUMN employee_attendances.exit_reason IS 'Texto descriptivo del motivo de salida cuando exit_type es emergencia (nulo si es definitiva)';
