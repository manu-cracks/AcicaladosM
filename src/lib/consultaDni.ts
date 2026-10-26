import { sanitizeDni, isValidDni } from './validators';

export interface ConsultaDniResponse {
  success: boolean;
  dni?: string;
  nombres?: string;
  apellidos?: string;
  message?: string;
}

/**
 * Consulta de datos de DNI mediante el endpoint proxy seguro (/api/consulta-dni).
 * Evita exponer el token de APIS PERU en el cliente y resuelve problemas de CORS.
 */
export async function consultarDniApi(dni: string): Promise<ConsultaDniResponse> {
  const cleanDni = sanitizeDni(dni);

  if (!isValidDni(cleanDni)) {
    return {
      success: false,
      message: 'El DNI debe contener exactamente 8 dígitos numéricos.',
    };
  }

  try {
    const response = await fetch(`/api/consulta-dni?dni=${encodeURIComponent(cleanDni)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data: ConsultaDniResponse = await response.json().catch(() => ({
      success: false,
      message: 'Respuesta inválida del servidor.',
    }));

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'No se encontraron datos para el DNI ingresado.',
      };
    }

    return {
      success: true,
      dni: data.dni || cleanDni,
      nombres: (data.nombres || '').trim(),
      apellidos: (data.apellidos || '').trim(),
    };
  } catch (error: any) {
    console.error('Error en consultarDniApi:', error);
    return {
      success: false,
      message: 'Error de conexión al consultar el DNI. Puedes ingresar los datos manualmente.',
    };
  }
}
