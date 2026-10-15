-- MIGRACIÓN: Soporte para Reserva de Packs en dress_rentals
ALTER TABLE public.dress_rentals 
  ADD COLUMN IF NOT EXISTS is_pack boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pack_item_ids uuid[];

CREATE INDEX IF NOT EXISTS idx_dress_rentals_is_pack ON public.dress_rentals(is_pack);
