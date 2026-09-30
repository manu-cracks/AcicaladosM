import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ydvqzgyhymjgbyfkxqhd.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

test.describe('Módulo de Reservas - Sincronización Estricta BD y Prevención UI Optimista', () => {

  test('Escenario A: Falla de Inserción y Prevención de UI Optimista', async ({ page }) => {
    const testDataA = {
      name: 'TestFail Optimista',
      phone: '999000111',
      dni: '11223344',
      email: 'fail_optimista@test.com',
      notes: 'Prueba de falla 500 y no registro fantasma',
    };

    // 1. Limpieza previa de posibles datos de prueba anteriores
    await supabase.from('bookings').delete().eq('client_email', testDataA.email);

    // 2. Navegar al flujo de reservas
    await page.goto('/reservar');
    await expect(page.getByText('Asistente de Reserva en 5 Pasos')).toBeVisible();

    // Paso 1: Seleccionar tipo de experiencia
    await expect(page.getByText('Paso 1: ¿Qué tipo de experiencia buscas hoy?')).toBeVisible();
    await page.getByRole('button', { name: /Continuar a Selección de Servicios/i }).click();

    // Paso 2: Seleccionar al menos un servicio
    await expect(page.getByText('Paso 2: Elige tus servicios')).toBeVisible();
    // Seleccionar el primer servicio disponible
    const firstServiceCard = page.locator('div[class*="cursor-pointer"]').filter({ hasText: 'min' }).first();
    await firstServiceCard.click();
    await page.getByRole('button', { name: /Continuar a Fecha y Horario/i }).click();

    // Paso 3: Fecha y Horario
    await expect(page.getByText('Paso 3: Fecha y Horario de Atención')).toBeVisible();
    // Seleccionar fecha de mañana para asegurar horarios disponibles completos
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(dateStr);

    // Esperar y hacer clic en el primer bloque disponible o continuar
    const availableSlot = page.locator('button:has-text("10:00")').first();
    if (await availableSlot.isVisible()) {
      await availableSlot.click();
    }
    const continueToContactBtn = page.getByRole('button', { name: /Continuar a Datos Personales/i });
    await expect(continueToContactBtn).toBeEnabled();
    await continueToContactBtn.click();

    // Paso 4: Datos de Contacto
    await expect(page.getByText('Paso 4: Datos de Contacto')).toBeVisible();
    await page.locator('input[placeholder*="Sebastián"]').fill(testDataA.name);
    await page.locator('input[type="tel"]').fill(testDataA.phone);
    await page.locator('input[placeholder*="72345678"]').fill(testDataA.dni);
    await page.locator('input[type="email"]').fill(testDataA.email);

    // INTERCEPTACIÓN: Forzar error HTTP 500 en el POST a la tabla bookings de Supabase
    let routeIntercepted = false;
    await page.route('**/rest/v1/bookings*', async (route) => {
      if (route.request().method() === 'POST') {
        routeIntercepted = true;
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

    // Clic en "Confirmar y Ver Instrucciones de Pago"
    const confirmBtn = page.getByRole('button', { name: /Confirmar y Ver Instrucciones de Pago/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // ASSERTS UI:
    // 1. NO debe avanzar al Paso 5 ("¡Reserva Registrada Exitosamente!")
    await expect(page.getByText('¡Reserva Registrada Exitosamente!')).not.toBeVisible();

    // 2. NO debe haber ticket ni código de cita generado
    await expect(page.locator('text=Código de Cita:')).not.toBeVisible();

    // 3. Debe mostrar un mensaje de error visible al usuario en la pantalla
    const errorAlert = page.locator('div[class*="bg-red-950"]').or(page.getByText(/error/i));
    await expect(errorAlert).toBeVisible();

    // VERIFICACIÓN EN BASE DE DATOS:
    // Confirmar mediante SELECT que NINGÚN registro se insertó con los datos de prueba
    const { data: dbRecords, error: selectError } = await supabase
      .from('bookings')
      .select('*')
      .or(`client_email.eq.${testDataA.email},client_phone.eq.${testDataA.phone}`);

    expect(selectError).toBeNull();
    expect(dbRecords).toBeDefined();
    expect(dbRecords?.length).toBe(0);
  });

  test('Escenario B: Flujo de Éxito Confirmado (Pessimistic Update)', async ({ page }) => {
    const testDataB = {
      name: 'TestSuccess Pessimistic',
      phone: '999888777',
      dni: '88776655',
      email: 'success_pessimistic@test.com',
      notes: 'Prueba de flujo exitoso con verificación estricta BD',
    };

    // 1. Limpieza previa de posibles datos de prueba anteriores
    await supabase.from('bookings').delete().eq('client_email', testDataB.email);

    // 2. Navegar al flujo de reservas
    await page.goto('/reservar');
    await expect(page.getByText('Asistente de Reserva en 5 Pasos')).toBeVisible();

    // Paso 1: Seleccionar tipo de experiencia
    await expect(page.getByText('Paso 1: ¿Qué tipo de experiencia buscas hoy?')).toBeVisible();
    await page.getByRole('button', { name: /Continuar a Selección de Servicios/i }).click();

    // Paso 2: Seleccionar un servicio
    await expect(page.getByText('Paso 2: Elige tus servicios')).toBeVisible();
    const firstServiceCard = page.locator('div[class*="cursor-pointer"]').filter({ hasText: 'min' }).first();
    await firstServiceCard.click();
    await page.getByRole('button', { name: /Continuar a Fecha y Horario/i }).click();

    // Paso 3: Fecha y Horario
    await expect(page.getByText('Paso 3: Fecha y Horario de Atención')).toBeVisible();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(dateStr);

    const availableSlot = page.locator('button:has-text("10:00")').first();
    if (await availableSlot.isVisible()) {
      await availableSlot.click();
    }
    const continueToContactBtn = page.getByRole('button', { name: /Continuar a Datos Personales/i });
    await expect(continueToContactBtn).toBeEnabled();
    await continueToContactBtn.click();

    // Paso 4: Datos de Contacto
    await expect(page.getByText('Paso 4: Datos de Contacto')).toBeVisible();
    await page.locator('input[placeholder*="Sebastián"]').fill(testDataB.name);
    await page.locator('input[type="tel"]').fill(testDataB.phone);
    await page.locator('input[placeholder*="72345678"]').fill(testDataB.dni);
    await page.locator('input[type="email"]').fill(testDataB.email);

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('request', (req) => {
      if (req.url().includes('bookings')) {
        console.log('REQ BOOKINGS:', req.method(), req.url());
      }
    });
    page.on('response', (res) => {
      if (res.url().includes('bookings')) {
        console.log('RES BOOKINGS:', res.status(), res.url());
      }
    });
    page.on('requestfailed', (req) => {
      if (req.url().includes('bookings')) {
        console.log('REQ FAILED BOOKINGS:', req.url(), req.failure()?.errorText);
      }
    });

    // NO interceptar con error: dejar fluir y esperar el response HTTP 200/201
    const postResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/bookings') &&
        response.request().method() === 'POST'
    );

    // Clic en "Confirmar y Ver Instrucciones de Pago"
    const confirmBtn = page.getByRole('button', { name: /Confirmar y Ver Instrucciones de Pago/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Esperar respuesta de red de Supabase
    const postResponse = await postResponsePromise;
    expect(postResponse.ok()).toBeTruthy();

    // ASSERTS UI:
    // Verificar que la pantalla de éxito se muestre SOLO después de la respuesta de red
    await expect(page.getByText('¡Reserva Registrada Exitosamente!')).toBeVisible({ timeout: 10000 });

    // Capturar el código de cita mostrado en la interfaz
    const codeHeading = page.locator('h3:has-text("Código de Cita:")');
    await expect(codeHeading).toBeVisible();
    const codeText = await codeHeading.textContent();
    const matchedCode = codeText?.match(/AC-\d+/)?.[0];
    expect(matchedCode).toBeTruthy();

    // VERIFICACIÓN EN BASE DE DATOS:
    // Conectarse a Supabase y obtener el registro insertado
    const { data: dbRecords, error: selectError } = await supabase
      .from('bookings')
      .select('*')
      .eq('client_email', testDataB.email)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(selectError).toBeNull();
    expect(dbRecords).toBeDefined();
    expect(dbRecords?.length).toBe(1);

    const insertedBooking = dbRecords![0];
    // Comparar y asegurar que el código de reserva guardado en la base de datos
    // coincide EXACTAMENTE con el que Playwright lee en la pantalla de éxito
    expect(insertedBooking.booking_code).toBe(matchedCode);

    // Limpieza posterior
    await supabase.from('bookings').delete().eq('id', insertedBooking.id);
  });

});
