-- ==============================================================================
-- MIGRACIÓN: INCORPORACIÓN DEL ROL / ÁREA VESTUARIO (MODISTA) EN EMPLOYEES
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Actualizar restricción de tipo en public.employees para admitir 'vestuario' y 'modista'
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_type_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_type_check 
  CHECK (type = ANY (ARRAY['barbero'::text, 'barberia'::text, 'spa'::text, 'recepcionista'::text, 'vestuario'::text, 'modista'::text]));

-- 2. Asegurar inserción / vinculación de la colaboradora de Vestuario para vepeja4602@bullbaby.com
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Obtener UUID de auth.users si existe
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = 'vepeja4602@bullbaby.com' LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Asegurar perfil en VESTUARIO_ADMIN
    INSERT INTO public.profiles (id, first_name, last_name, role)
    VALUES (v_user_id, 'MODISTA', 'VESTUARIO', 'VESTUARIO_ADMIN')
    ON CONFLICT (id) DO UPDATE SET
      role = 'VESTUARIO_ADMIN',
      first_name = CASE WHEN public.profiles.first_name = '' THEN 'MODISTA' ELSE public.profiles.first_name END;

    -- Asegurar registro en public.employees
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE email = 'vepeja4602@bullbaby.com' OR profile_id = v_user_id) THEN
      INSERT INTO public.employees (
        profile_id,
        first_name,
        last_name,
        type,
        is_active,
        rotation_order,
        email,
        phone,
        handles_reception,
        shift_start,
        shift_end,
        commission_percentage
      ) VALUES (
        v_user_id,
        'MODISTA',
        'VESTUARIO',
        'vestuario',
        true,
        99,
        'vepeja4602@bullbaby.com',
        '987654321',
        false,
        '09:00',
        '18:00',
        0
      );
    ELSE
      UPDATE public.employees
      SET 
        type = 'vestuario',
        is_active = true,
        profile_id = v_user_id
      WHERE email = 'vepeja4602@bullbaby.com' OR profile_id = v_user_id;
    END IF;
  END IF;
END;
$$;
