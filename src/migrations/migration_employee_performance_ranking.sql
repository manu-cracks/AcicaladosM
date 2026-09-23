-- MIGRACIÓN: FUNCIÓN RPC PARA PANEL DE RENDIMIENTO (TOP DE TRABAJADORES)
-- Acicalados Spa & Barber Shop
-- Destino autorizado: Manu-Crack's Org / acicaladosMej

CREATE OR REPLACE FUNCTION get_employee_performance_ranking(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    foto_url TEXT,
    avatar_url TEXT,
    employee_type TEXT,
    is_active BOOLEAN,
    total_jobs INT,
    presencial_jobs INT,
    online_jobs INT,
    total_revenue_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS employee_id,
        TRIM(e.first_name || ' ' || e.last_name) AS employee_name,
        COALESCE(e.foto_url, e.avatar_url) AS foto_url,
        e.avatar_url,
        e.type AS employee_type,
        e.is_active,
        COUNT(filtered_jobs.id)::int AS total_jobs,
        COUNT(filtered_jobs.id) FILTER (WHERE filtered_jobs.is_presencial)::int AS presencial_jobs,
        COUNT(filtered_jobs.id) FILTER (WHERE NOT filtered_jobs.is_presencial)::int AS online_jobs,
        COALESCE(SUM(filtered_jobs.service_price_cents), 0)::bigint AS total_revenue_cents
    FROM employees e
    LEFT JOIN (
        SELECT 
            bs.id,
            bs.assigned_employee_id,
            bs.service_price_cents,
            (b.client_email ILIKE '%recepcion@acicalados.pe%' AND b.culqi_charge_id IS NULL) AS is_presencial
        FROM booking_services bs
        INNER JOIN bookings b ON b.id = bs.booking_id
        WHERE b.cancelled_at IS NULL
          AND (
              b.completed_at IS NOT NULL 
              OR b.payment_status IN ('total', 'parcial', 'pagada', 'completada') 
              OR b.confirmed_at IS NOT NULL
          )
          AND (p_start_date IS NULL OR b.booking_date >= p_start_date)
          AND (p_end_date IS NULL OR b.booking_date <= p_end_date)
    ) filtered_jobs ON filtered_jobs.assigned_employee_id = e.id
    WHERE e.is_active = true
    GROUP BY e.id, e.first_name, e.last_name, e.foto_url, e.avatar_url, e.type, e.is_active
    ORDER BY total_jobs DESC, total_revenue_cents DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_performance_ranking(DATE, DATE) TO authenticated, anon, service_role;

COMMENT ON FUNCTION get_employee_performance_ranking(DATE, DATE) IS 'Calcula el ranking y rendimiento de colaboradores (atenciones presenciales vs en línea e ingresos generados) para un rango de fechas';
