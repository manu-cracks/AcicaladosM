import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ydvqzgyhymjgbyfkxqhd.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Selecciona un día disponible en el calendario, avanzando al mes siguiente
 * para evitar colisiones con reservas previas o fin de mes.
 */
async function selectAvailableCalendarDay(page: any) {
  const nextMonthBtn = page.locator('button[title*="Mes siguiente"]').or(page.locator('button[title*="siguiente"]')).first();
  await expect(nextMonthBtn).toBeVisible();
  await nextMonthBtn.click();

  const availableDay = page.locator('button[title*="Disponible"]').first();
  await expect(availableDay).toBeVisible();
  await availableDay.click();
}

test.describe('Módulo de Vestuario - Prevención de Fallback Local y Sincronización Real (QA-005)', () => {

  test('Escenario A: Falla de Inserción (Prevención de Fallback y WhatsApp)', async ({ page }) => {
    const uniqueSuffixA = Math.floor(1000 + Math.random() * 9000);
    const testDataA = {
      name: 'Carla',
      lastName: 'Mendoza Fail',
      dni: `7394${uniqueSuffixA}`,
      phone: `98712${uniqueSuffixA}`,
      eventName: 'Gala Aniversario Falla 500',
      destination: 'Hotel Westin San Isidro',
    };

    // 1. Limpieza previa en la base de datos
    await supabase.from('dress_rentals').delete().eq('client_dni', testDataA.dni);

    // 2. Navegar a /vestuario
    await page.goto('/vestuario');
    await expect(page.getByRole('heading', { name: /Alquiler de Vestuario/i })).toBeVisible();

    // 3. Abrir modal de reserva sobre la primera prenda activa
    const rentBtn = page.locator('button:has-text("Reservar Prenda")').first();
    await expect(rentBtn).toBeVisible();
    await rentBtn.click();

    await expect(page.getByText('Reservar Prenda Online (Vía Yape)')).toBeVisible();

    // Paso 1: Seleccionar fecha disponible en el calendario
    await selectAvailableCalendarDay(page);

    const continueBtn1 = page.getByRole('button', { name: /Continuar con Mis Datos/i });
    await expect(continueBtn1).toBeEnabled();
    await continueBtn1.click();

    // Paso 2: Llenar formulario de datos personales
    const nameInput = page.locator('input[placeholder*="María Lucía"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(testDataA.name);
    await page.locator('input[placeholder*="Gómez Torres"]').fill(testDataA.lastName);
    await page.locator('input[placeholder*="70123456"]').fill(testDataA.dni);
    await page.locator('input[placeholder*="991044301"]').fill(testDataA.phone);
    await page.locator('input[placeholder*="Matrimonio Civil"]').fill(testDataA.eventName);
    await page.locator('input[placeholder*="Miraflores"]').fill(testDataA.destination);

    const continueBtn2 = page.getByRole('button', { name: /Continuar al Pago con Yape/i });
    await expect(continueBtn2).toBeEnabled();
    await continueBtn2.click();

    // Paso 3: Adjuntar comprobante de pago
    const fileUpload = page.locator('input#client-voucher-upload');
    await expect(fileUpload).toBeAttached();

    // Adjuntar archivo dummy de voucher
    await page.locator('input#client-voucher-upload').setInputFiles({
      name: 'voucher-fail-sim.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    // Esperar a que el voucher esté procesado
    await expect(page.getByText(/✓ Comprobante cargado/i)).toBeVisible();

    // INTERCEPTACIÓN DE RED:
    // 1. Forzar error HTTP 500 en el POST a la tabla dress_rentals
    let interceptedPost = false;
    await page.route('**/rest/v1/dress_rentals*', async (route) => {
      if (route.request().method() === 'POST') {
        interceptedPost = true;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '500',
            message: 'Database connection failed: simulated outage for E2E test',
            details: 'Internal Server Error',
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 2. Monitorear e interceptar cualquier llamada / redirección a WhatsApp
    let whatsappTriggered = false;
    await page.route(/(whatsapp|api\.whatsapp|wa\.me)/i, async (route) => {
      whatsappTriggered = true;
      await route.abort();
    });
    page.on('popup', () => {
      whatsappTriggered = true;
    });

    // Clic en "Confirmar"
    const confirmBtn = page.getByRole('button', { name: /confirmar/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // ASSERTS UI:
    // 1. SE MUESTRE un mensaje de error claro de conexión
    const errorAlert = page.locator('[data-testid="error-alert"]').or(page.locator('div[class*="bg-rose-950"]')).or(page.getByText(/error.*(conexión|servidor|base de datos|500)/i));
    await expect(errorAlert).toBeVisible();

    // 2. NO se genere ni renderice un ticket definitivo
    await expect(page.getByText(/Reserva Web Nro:/i)).not.toBeVisible();
    await expect(page.getByText(/¡Hemos recibido tu solicitud de reserva!/i)).not.toBeVisible();
    await expect(page.getByText(/Ticket Nro:/i)).not.toBeVisible();

    // 3. NO se ejecute la notificación de WhatsApp
    expect(whatsappTriggered).toBe(false);
    await expect(page.getByText(/Notificar a Recepción por WhatsApp/i)).not.toBeVisible();

    // 4. SE MANTENGAN los datos ingresados en el formulario para poder reintentar (los inputs no deben limpiarse)
    // El modal no debe haberse cerrado
    await expect(page.getByText('Reservar Prenda Online (Vía Yape)')).toBeVisible();
    // Volver a Paso 2 para verificar que los datos están intactos
    const backBtn = page.getByRole('button', { name: /atrás/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    await expect(page.locator('input[placeholder*="María Lucía"]')).toHaveValue(testDataA.name);
    await expect(page.locator('input[placeholder*="Gómez Torres"]')).toHaveValue(testDataA.lastName);
    await expect(page.locator('input[placeholder*="70123456"]')).toHaveValue(testDataA.dni);
    await expect(page.locator('input[placeholder*="991044301"]')).toHaveValue(testDataA.phone);
    await expect(page.locator('input[placeholder*="Matrimonio Civil"]')).toHaveValue(testDataA.eventName);
    await expect(page.locator('input[placeholder*="Miraflores"]')).toHaveValue(testDataA.destination);

    // VERIFICACIÓN EN BASE DE DATOS (MCP / Supabase):
    const { data: dbRecords, error: selectErr } = await supabase
      .from('dress_rentals')
      .select('*')
      .eq('client_dni', testDataA.dni);

    expect(selectErr).toBeNull();
    expect(dbRecords).toBeDefined();
    expect(dbRecords?.length).toBe(0);
  });

  test('Escenario B: Flujo de Éxito y Sincronización Real', async ({ page }) => {
    const uniqueSuffixB = Math.floor(1000 + Math.random() * 9000);
    const testDataB = {
      name: 'Mariana',
      lastName: 'Valdivia Real',
      dni: `7845${uniqueSuffixB}`,
      phone: `99887${uniqueSuffixB}`,
      eventName: 'Boda Civil San Borja Éxito',
      destination: 'Salón de Recepciones Miraflores',
    };

    // 1. Limpieza previa en la base de datos
    await supabase.from('dress_rentals').delete().eq('client_dni', testDataB.dni);

    // 2. Navegar a /vestuario
    await page.goto('/vestuario');
    await expect(page.getByRole('heading', { name: /Alquiler de Vestuario/i })).toBeVisible();

    // 3. Abrir modal de reserva sobre la primera prenda activa
    const rentBtn = page.locator('button:has-text("Reservar Prenda")').first();
    await expect(rentBtn).toBeVisible();
    await rentBtn.click();

    await expect(page.getByText('Reservar Prenda Online (Vía Yape)')).toBeVisible();

    // Paso 1: Seleccionar fecha disponible
    await selectAvailableCalendarDay(page);

    const continueBtn1 = page.getByRole('button', { name: /Continuar con Mis Datos/i });
    await expect(continueBtn1).toBeEnabled();
    await continueBtn1.click();

    // Paso 2: Llenar datos personales válidos
    const nameInputB = page.locator('input[placeholder*="María Lucía"]');
    await expect(nameInputB).toBeVisible();
    await nameInputB.fill(testDataB.name);
    await page.locator('input[placeholder*="Gómez Torres"]').fill(testDataB.lastName);
    await page.locator('input[placeholder*="70123456"]').fill(testDataB.dni);
    await page.locator('input[placeholder*="991044301"]').fill(testDataB.phone);
    await page.locator('input[placeholder*="Matrimonio Civil"]').fill(testDataB.eventName);
    await page.locator('input[placeholder*="Miraflores"]').fill(testDataB.destination);

    const continueBtn2 = page.getByRole('button', { name: /Continuar al Pago con Yape/i });
    await expect(continueBtn2).toBeEnabled();
    await continueBtn2.click();

    // Paso 3: Adjuntar comprobante
    const fileUploadB = page.locator('input#client-voucher-upload');
    await expect(fileUploadB).toBeAttached();

    await page.locator('input#client-voucher-upload').setInputFiles({
      name: 'voucher-success-sim.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    await expect(page.getByText(/✓ Comprobante cargado/i)).toBeVisible();

    // En Escenario B: NO interceptamos con 500, permitimos que Supabase responda con HTTP 200/201 real.
    const confirmBtn = page.getByRole('button', { name: /confirmar/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // ASSERTS UI:
    // 1. Verifica que el ticket definitivo se muestre SOLO tras la respuesta positiva de Supabase
    await expect(page.getByText(/¡Hemos recibido tu solicitud de reserva!/i)).toBeVisible();
    await expect(page.getByText(/Reserva Web Nro:/i)).toBeVisible();

    // Extraer el código del ticket mostrado en la UI
    const ticketText = await page.locator('text=/Reserva Web Nro:/i').innerText();
    const match = ticketText.match(/Reserva Web Nro:\s*([WwPp]-\d+)/i);
    const displayedTicketCode = match ? match[1].toUpperCase() : '';
    expect(displayedTicketCode).toBeTruthy();

    // 2. Cerrar el modal y verificar que al volver a abrir el formulario sí se haya limpiado tras el éxito
    const closeBtn = page.getByRole('button', { name: /Cerrar y Regresar al Catálogo/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(page.getByText('Reservar Prenda Online (Vía Yape)')).not.toBeVisible();

    // Reabrir formulario para verificar que está limpio
    await rentBtn.click();
    await expect(page.getByText('Reservar Prenda Online (Vía Yape)')).toBeVisible();
    await selectAvailableCalendarDay(page);
    await page.getByRole('button', { name: /Continuar con Mis Datos/i }).click();

    await expect(page.locator('input[placeholder*="María Lucía"]')).toHaveValue('');
    await expect(page.locator('input[placeholder*="Gómez Torres"]')).toHaveValue('');
    await expect(page.locator('input[placeholder*="70123456"]')).toHaveValue('');
    await expect(page.locator('input[placeholder*="991044301"]')).toHaveValue('');
    await expect(page.locator('input[placeholder*="Matrimonio Civil"]')).toHaveValue('');
    await expect(page.locator('input[placeholder*="Miraflores"]')).toHaveValue('');

    // VERIFICACIÓN EN BASE DE DATOS (MCP / Supabase):
    // Busca el último alquiler insertado en Supabase y haz un assert asegurando que el código/ID existe realmente
    const { data: dbRecords, error: selectErr } = await supabase
      .from('dress_rentals')
      .select('*')
      .eq('ticket_code', displayedTicketCode)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(selectErr).toBeNull();
    expect(dbRecords).toBeDefined();
    expect(dbRecords?.length).toBe(1);

    const insertedRental = dbRecords![0];
    expect(insertedRental.ticket_code.toUpperCase()).toBe(displayedTicketCode);
    expect(insertedRental.client_first_name).toBe(testDataB.name);
    expect(insertedRental.client_last_name).toBe(testDataB.lastName);
    expect(insertedRental.client_dni).toBe(testDataB.dni);
  });
});
