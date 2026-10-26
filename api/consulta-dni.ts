/**
 * Vercel Serverless Function: GET /api/consulta-dni
 * Proxy seguro para APIS PERU sin exponer APIS_PERU_TOKEN al frontend.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      message: `Método ${req.method} no permitido.`,
    });
  }

  const { dni } = req.query || {};
  const cleanDni = typeof dni === 'string' ? dni.trim() : '';

  if (!/^\d{8}$/.test(cleanDni)) {
    return res.status(400).json({
      success: false,
      message: 'El DNI debe contener exactamente 8 dígitos numéricos.',
    });
  }

  const token = process.env.APIS_PERU_TOKEN;
  if (!token) {
    console.error('[consulta-dni] Variable de entorno APIS_PERU_TOKEN no configurada.');
    return res.status(500).json({
      success: false,
      message: 'Servicio de consulta no configurado en el servidor.',
    });
  }

  try {
    const apisResponse = await fetch(`https://dniruc.apisperu.com/api/v1/dni/${cleanDni}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!apisResponse.ok) {
      return res.status(apisResponse.status >= 500 ? 502 : 404).json({
        success: false,
        message: 'DNI no encontrado o error en el servicio de consulta.',
      });
    }

    const data: any = await apisResponse.json();

    if (!data || data.success === false || !data.nombres) {
      return res.status(404).json({
        success: false,
        message: data?.message || 'DNI no encontrado',
      });
    }

    const apellidos = `${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();

    return res.status(200).json({
      success: true,
      dni: data.dni || cleanDni,
      nombres: (data.nombres || '').trim(),
      apellidos: apellidos,
    });
  } catch (error: any) {
    console.error('[consulta-dni] Error inesperado en el proxy:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar el DNI',
    });
  }
}
