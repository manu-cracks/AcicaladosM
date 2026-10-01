-- ==============================================================================
-- MIGRACIÓN: Sistema Anti-Olvido de Inventario y Lista de Compras
-- Agrega columna in_shopping_list a la tabla products
-- ==============================================================================

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS in_shopping_list BOOLEAN DEFAULT FALSE NOT NULL;

-- Asegurar que min_stock no sea nulo y tenga valor por defecto de 5
ALTER TABLE public.products 
ALTER COLUMN min_stock SET DEFAULT 5;

UPDATE public.products 
SET min_stock = 5 
WHERE min_stock IS NULL;

-- Comentario descriptivo
COMMENT ON COLUMN public.products.in_shopping_list IS 'Indica si un producto en bajo stock ha sido reconocido o agregado a la lista de compras por el administrador';
COMMENT ON COLUMN public.products.min_stock IS 'Umbral de stock mínimo individual personalizado para disparar alertas de reabastecimiento';
