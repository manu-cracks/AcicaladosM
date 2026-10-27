-- Migración: Registro estructurado de Método de Pago (JSONB) en Dress Rentals
-- Proyecto: acicaladosMej

ALTER TABLE public.dress_rentals 
ADD COLUMN IF NOT EXISTS detalles_pago JSONB;

COMMENT ON COLUMN public.dress_rentals.detalles_pago IS 'Desglose estructurado del método de pago ({ metodo: "Efectivo" | "Yape" | "Mixto", monto_efectivo?: number, monto_yape?: number, total_pagado: number })';
