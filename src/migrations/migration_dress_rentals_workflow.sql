-- ==============================================================================
-- MIGRACIÓN: TABLA dress_rentals Y AMPLIACIÓN DE wardrobe_items (size, color)
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Agregar columnas size y color a wardrobe_items
ALTER TABLE public.wardrobe_items 
ADD COLUMN IF NOT EXISTS size text DEFAULT 'M',
ADD COLUMN IF NOT EXISTS color text DEFAULT 'Variado';

-- 2. Crear tabla dress_rentals para el flujo de reservas y alquileres
CREATE TABLE IF NOT EXISTS public.dress_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE,
  origin text NOT NULL DEFAULT 'local' CHECK (origin IN ('web', 'local')),
  wardrobe_item_id uuid REFERENCES public.wardrobe_items(id) ON DELETE SET NULL,
  item_code text NOT NULL,
  item_name text NOT NULL,
  item_size text DEFAULT 'M',
  item_color text DEFAULT 'Variado',
  client_first_name text NOT NULL,
  client_last_name text NOT NULL,
  client_dni text NOT NULL,
  client_phone text NOT NULL,
  event_name text NOT NULL,
  destination text NOT NULL,
  event_date date NOT NULL,
  return_date date NOT NULL,
  status text NOT NULL DEFAULT 'reservado' CHECK (status IN ('por_validar', 'reservado', 'entregado', 'finalizado', 'anulado')),
  rental_price_cents integer NOT NULL DEFAULT 0,
  advance_cents integer NOT NULL DEFAULT 0,
  pending_cents integer NOT NULL DEFAULT 0,
  guarantee_cents integer NOT NULL DEFAULT 0,
  guarantee_returned_cents integer,
  penalty_cents integer DEFAULT 0,
  penalty_reason text,
  is_immediate_delivery boolean NOT NULL DEFAULT false,
  delivery_date timestamptz,
  actual_return_date timestamptz,
  voucher_url text,
  voucher_declared_amount_cents integer,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Índices para alto rendimiento en calendarios y búsquedas
CREATE INDEX IF NOT EXISTS idx_dress_rentals_item_code ON public.dress_rentals(item_code);
CREATE INDEX IF NOT EXISTS idx_dress_rentals_status ON public.dress_rentals(status);
CREATE INDEX IF NOT EXISTS idx_dress_rentals_dates ON public.dress_rentals(event_date, return_date);

-- 4. RLS en dress_rentals
ALTER TABLE public.dress_rentals ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas existentes si las hubiera
DROP POLICY IF EXISTS "dress_rentals_all_admin_recep" ON public.dress_rentals;
DROP POLICY IF EXISTS "dress_rentals_public_select" ON public.dress_rentals;
DROP POLICY IF EXISTS "dress_rentals_public_insert" ON public.dress_rentals;

-- Políticas para personal administrativo ('admin', 'recepcionista')
CREATE POLICY "dress_rentals_all_admin_recep" ON public.dress_rentals
  FOR ALL
  TO public
  USING (
    COALESCE(public.get_user_role(), private.get_user_role()) IN ('admin', 'recepcionista')
    OR current_user = 'postgres'
  )
  WITH CHECK (
    COALESCE(public.get_user_role(), private.get_user_role()) IN ('admin', 'recepcionista')
    OR current_user = 'postgres'
  );

-- Políticas para reservas web públicas
CREATE POLICY "dress_rentals_public_select" ON public.dress_rentals
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "dress_rentals_public_insert" ON public.dress_rentals
  FOR INSERT
  TO public
  WITH CHECK (true);
