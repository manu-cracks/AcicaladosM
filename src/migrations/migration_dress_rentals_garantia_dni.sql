-- ==============================================================================
-- MIGRACIÓN: MODALIDAD DE GARANTÍA HÍBRIDA (EFECTIVO + DNI FÍSICO)
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Añadir columna booleana para registrar si el cliente dejó DNI físico en custodia
ALTER TABLE public.dress_rentals 
  ADD COLUMN IF NOT EXISTS garantia_dni_fisico boolean DEFAULT false;

COMMENT ON COLUMN public.dress_rentals.garantia_dni_fisico IS 'Indica si el cliente dejó su DNI físico en custodia preventiva junto a la garantía en efectivo';
