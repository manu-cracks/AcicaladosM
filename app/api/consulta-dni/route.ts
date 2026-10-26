/**
 * Next.js App Router Route Handler: GET /api/consulta-dni
 * Proxy seguro para APIS PERU sin exponer APIS_PERU_TOKEN al cliente.
 */

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const dni = (searchParams.get('dni') || '').trim();

    if (!/^\d{8}$/.test(dni)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'El DNI debe contener exactamente 8 dígitos numéricos.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const token = process.env.APIS_PERU_TOKEN;
    if (!token) {
      console.error('[consulta-dni] Variable de entorno APIS_PERU_TOKEN no configurada.');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Servicio de consulta no configurado en el servidor.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const apisResponse = await fetch(`https://dniruc.apisperu.com/api/v1/dni/${dni}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!apisResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'DNI no encontrado o error en el servicio de consulta.',
        }),
        {
          status: apisResponse.status >= 500 ? 502 : 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data: any = await apisResponse.json();

    if (!data || data.success === false || !data.nombres) {
      return new Response(
        JSON.stringify({
          success: false,
          message: data?.message || 'DNI no encontrado',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const apellidos = `${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();

    return new Response(
      JSON.stringify({
        success: true,
        dni: data.dni || dni,
        nombres: (data.nombres || '').trim(),
        apellidos: apellidos,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[consulta-dni] Error inesperado en el proxy:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno al consultar el DNI',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
