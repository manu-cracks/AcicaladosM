-- ==============================================================================
-- MIGRACIÓN: ATRIBUCIÓN DE VENTAS Y RENDIMIENTO ECONÓMICO EN MOSTRADOR (POS)
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Asegurar columnas de vendedor en ventas_mostrador con default 'Recepcionista'
ALTER TABLE public.ventas_mostrador 
  ADD COLUMN IF NOT EXISTS vendedor_nombre TEXT NOT NULL DEFAULT 'Recepcionista',
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- 2. Asegurar columnas de vendedor en ventas_mostrador_detalles con default 'Recepcionista'
ALTER TABLE public.ventas_mostrador_detalles
  ADD COLUMN IF NOT EXISTS vendedor_nombre TEXT NOT NULL DEFAULT 'Recepcionista',
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- 3. Índices para rendimiento en métricas y rankings
CREATE INDEX IF NOT EXISTS idx_ventas_mostrador_vendedor_nombre ON public.ventas_mostrador(vendedor_nombre);
CREATE INDEX IF NOT EXISTS idx_ventas_mostrador_vendedor_id ON public.ventas_mostrador(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_mostrador_fecha ON public.ventas_mostrador(fecha);

-- 4. Actualizar función RPC process_pos_sale para persistir vendedor_nombre y vendedor_id
CREATE OR REPLACE FUNCTION public.process_pos_sale(p_sale jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_curr_stock integer;
  v_prod_name text;
  v_ticket text;
  v_sale_id uuid;
  v_user_id uuid;
  v_item_total numeric;
  v_item_unit numeric;
  v_total_qty integer := 0;
  v_summary_names text := '';
  v_total_cobrar numeric;
  v_subtotal numeric;
  v_descuento numeric;
  v_vendedor_nombre text;
  v_vendedor_id uuid;
  v_item_vendedor_nombre text;
  v_item_vendedor_id uuid;
BEGIN
  v_ticket := p_sale->>'ticket_number';
  IF v_ticket IS NULL OR v_ticket = '' THEN
    v_ticket := 'TK-' || (floor(random() * 90000 + 10000))::text;
  END IF;

  v_user_id := NULL;
  IF (p_sale->>'registrado_por') IS NOT NULL AND (p_sale->>'registrado_por') != '' THEN
    BEGIN
      v_user_id := (p_sale->>'registrado_por')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  -- Resolver vendedor cabecera (default: 'Recepcionista')
  v_vendedor_nombre := COALESCE(NULLIF(TRIM(p_sale->>'vendedor_nombre'), ''), NULLIF(TRIM(p_sale->>'vendedor'), ''), 'Recepcionista');
  v_vendedor_id := NULL;
  IF (p_sale->>'vendedor_id') IS NOT NULL AND (p_sale->>'vendedor_id') != '' THEN
    BEGIN
      v_vendedor_id := (p_sale->>'vendedor_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_vendedor_id := NULL;
    END;
  END IF;

  v_total_cobrar := COALESCE((p_sale->>'total')::numeric, 0);
  v_subtotal     := COALESCE((p_sale->>'subtotal')::numeric, v_total_cobrar);
  v_descuento    := COALESCE((p_sale->>'monto_descuento')::numeric, 0);

  -- 1. Validar y descontar stock de cada producto atómicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a cero';
    END IF;

    v_total_qty := v_total_qty + v_qty;
    v_prod_name := COALESCE(v_item->>'product_name', 'Producto');
    IF v_summary_names = '' THEN
      v_summary_names := v_qty::text || 'x ' || v_prod_name;
    ELSE
      v_summary_names := v_summary_names || ', ' || v_qty::text || 'x ' || v_prod_name;
    END IF;

    IF (v_item->>'product_id') IS NOT NULL AND (v_item->>'product_id') != '' THEN
      v_product_id := (v_item->>'product_id')::uuid;

      SELECT stock, name INTO v_curr_stock, v_prod_name
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado: %', v_product_id;
      END IF;

      IF v_curr_stock < v_qty THEN
        RAISE EXCEPTION 'Stock insuficiente para "%": disponible %, solicitado %', v_prod_name, v_curr_stock, v_qty;
      END IF;

      UPDATE public.products
      SET stock = stock - v_qty, updated_at = now()
      WHERE id = v_product_id;

      v_item_unit := COALESCE((v_item->>'unit_price')::numeric, 0);

      INSERT INTO public.inventory_movements (
        product_id,
        movement_type,
        quantity,
        user_id,
        area_destination,
        notes
      ) VALUES (
        v_product_id,
        'VENTA',
        v_qty,
        v_user_id,
        'Venta Mostrador',
        'Venta Ticket #' || v_ticket || ' - P.Unit: S/ ' || v_item_unit::text || ' - Cliente: ' || COALESCE(p_sale->>'cliente_nombre', 'Cliente Varios')
      );
    END IF;
  END LOOP;

  -- 2. Guardar cabecera de la venta en ventas_mostrador incluyendo vendedor
  INSERT INTO public.ventas_mostrador (
    cliente_nombre,
    producto_nombre,
    cantidad,
    precio_unitario,
    subtotal,
    monto_descuento,
    total,
    metodo_pago,
    fecha,
    ticket_number,
    monto_efectivo,
    monto_yape,
    monto_transferencia,
    detalles_pago,
    detalles_items,
    notas,
    registrado_por,
    vendedor_nombre,
    vendedor_id
  ) VALUES (
    COALESCE(p_sale->>'cliente_nombre', 'Cliente Varios'),
    COALESCE(p_sale->>'product_name', v_summary_names),
    v_total_qty,
    CASE WHEN v_total_qty > 0 THEN ROUND(v_subtotal / v_total_qty, 2) ELSE v_subtotal END,
    v_subtotal,
    v_descuento,
    v_total_cobrar,
    COALESCE(p_sale->>'metodo_pago', 'Efectivo'),
    COALESCE((p_sale->>'fecha')::timestamptz, now()),
    v_ticket,
    (p_sale->>'monto_efectivo')::numeric,
    (p_sale->>'monto_yape')::numeric,
    (p_sale->>'monto_transferencia')::numeric,
    p_sale->'detalles_pago',
    p_items,
    p_sale->>'notas',
    v_user_id,
    v_vendedor_nombre,
    v_vendedor_id
  ) RETURNING id INTO v_sale_id;

  -- 3. Guardar detalles individuales en ventas_mostrador_detalles con atribución por ítem
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_unit := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_item_total := COALESCE((v_item->>'total')::numeric, v_item_unit * COALESCE((v_item->>'quantity')::integer, 1));
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    v_prod_name := COALESCE(v_item->>'product_name', 'Producto');
    v_product_id := NULL;
    IF (v_item->>'product_id') IS NOT NULL AND (v_item->>'product_id') != '' THEN
      BEGIN
        v_product_id := (v_item->>'product_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_product_id := NULL;
      END;
    END IF;

    v_item_vendedor_nombre := COALESCE(
      NULLIF(TRIM(v_item->>'vendedor_nombre'), ''), 
      NULLIF(TRIM(v_item->>'vendedor'), ''), 
      NULLIF(TRIM(v_item->>'seller_name'), ''), 
      v_vendedor_nombre
    );
    v_item_vendedor_id := NULL;
    IF (v_item->>'vendedor_id') IS NOT NULL AND (v_item->>'vendedor_id') != '' THEN
      BEGIN
        v_item_vendedor_id := (v_item->>'vendedor_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_item_vendedor_id := NULL;
      END;
    ELSIF (v_item->>'employee_id') IS NOT NULL AND (v_item->>'employee_id') != '' THEN
      BEGIN
        v_item_vendedor_id := (v_item->>'employee_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_item_vendedor_id := NULL;
      END;
    ELSE
      v_item_vendedor_id := v_vendedor_id;
    END IF;

    INSERT INTO public.ventas_mostrador_detalles (
      venta_id,
      ticket_number,
      product_id,
      producto_nombre,
      cantidad,
      precio_unitario,
      subtotal,
      vendedor_nombre,
      vendedor_id
    ) VALUES (
      v_sale_id,
      v_ticket,
      v_product_id,
      v_prod_name,
      v_qty,
      v_item_unit,
      v_item_total,
      v_item_vendedor_nombre,
      v_item_vendedor_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_number', v_ticket,
    'sale_id', v_sale_id,
    'total', v_total_cobrar,
    'subtotal', v_subtotal,
    'descuento', v_descuento,
    'vendedor_nombre', v_vendedor_nombre
  );
END;
$function$;
