# QA Correcciones Implementadas

## Información

- **Repositorio:** https://github.com/manu-cracks/AcicaladosM
- **Rama:** fix/qa-acicalados-integral-v2
- **Commit base:** 35b48b75d5f710119841fd802005ee79b59388bc
- **Fecha:** 25/09/2026

---

## Resumen

Se ha realizado una auditoría e implementación técnica integral de todas las incidencias identificadas en el informe rector `INFORME_QA_ACICALADOS_FLUJOS_Y_CORRECCIONES.md` (QA-001 a QA-015). Las correcciones abordan las causas raíz tanto a nivel de backend y contratos de persistencia en Supabase (RPCs transaccionales con bloqueos consultivos, RLS estricto y Storage privado para comprobantes) como en la lógica de cliente en React 19 + TypeScript (operaciones asíncronas sin falsos éxitos, validaciones estrictas de stock y disponibilidad, sincronización de estado, y persistencia de carrito).

---

## Cambios implementados

### QA-001 – Navegación pública y reset de scroll
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/public/ClientLayout.tsx`
- **Problema:** Al navegar entre secciones públicas inferiores, la ventana mantenía la posición de desplazamiento de la vista anterior, desorientando al usuario.
- **Solución:** Se configuró `history.scrollRestoration = 'manual'` y se agregó un hook de efecto que ejecuta `window.scrollTo({ top: 0, behavior: 'instant' })` cada vez que `activeView` cambia, preservando el comportamiento de modales y drawers.
- **Pruebas:** Playwright E2E test `responsive ${width}x${height} public views and navigation` valida que tras navegar desde el final de la página principal hacia `/reservar`, `window.scrollY === 0`.
- **Resultado:** PASS (14 tests E2E superados).

### QA-002 – Reserva mostrada como exitosa antes de confirmación de Supabase
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/context/AppContext.tsx`, `src/components/public/PublicBookingFlow.tsx`, `src/lib/qaApi.ts`, `src/migrations/migration_qa_booking_payment_consistency.sql`
- **Problema:** El cliente creaba una reserva local en memoria y avanzaba al paso de confirmación y pago aunque el INSERT a Supabase fallara.
- **Solución:** `addBooking` se convirtió en una función asíncrona que invoca la función RPC transaccional `qa_create_booking`. Solo si el backend responde con el registro persistido y su código real (`AC-...`) se actualiza el estado y se avanza al paso 5. Si falla, se muestra un mensaje de error claro en la UI y se preservan intactos todos los datos ingresados en el formulario.
- **Pruebas:** Test unitario/DB `failed service detail leaves no booking and racing submissions get one slot` y Playwright test `booking failure retains the form and never displays a real code`.
- **Resultado:** PASS.

### QA-003 – Voucher de citas no persistente
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/common/PaymentQRWidget.tsx`, `src/lib/qaApi.ts`, `src/lib/businessRules.ts`, `src/migrations/migration_qa_booking_payment_consistency.sql`, `src/components/dashboard/PendingBookingVouchers.tsx`
- **Problema:** El voucher se cargaba con `URL.createObjectURL(file)`, perdiéndose al recargar o en otros navegadores.
- **Solución:** Se implementó subida obligatoria al bucket privado `payment-vouchers` mediante Supabase Storage. La función RPC `qa_prepare_voucher` valida que la reserva exista, pertenezca al cliente o sesión y emite un path único. Tras la carga binaria, `qa_submit_booking_voucher` vincula el comprobante a `payment_logs` en estado `pending`. La visualización se realiza mediante Signed URLs con caducidad de 300 segundos (`voucherPreview`).
- **Pruebas:** DB test `voucher must exist in private Storage, stays pending, retries do not duplicate` y Playwright test `failUpload: no voucher success` / `booking success uses the persisted code; linked voucher survives a page reload`.
- **Resultado:** PASS.

### QA-004 – Pérdida de trazabilidad de reservas para invitados
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/public/ClientPortal.tsx`, `src/migrations/migration_qa_booking_payment_consistency.sql`
- **Problema:** Los usuarios invitados (`role === 'anon'`) no podían consultar sus reservas en "Mi Cuenta", mientras que los usuarios autenticados veían un historial vacío si no había sincronización.
- **Solución:** Se implementó una consulta segura en dos factores mediante la función RPC `qa_lookup_booking(p_code, p_phone)`. Requiere tanto el código de cita como el celular de contacto, redactando datos sensibles (email, DNI, IDs de pago). Los usuarios autenticados consultan exclusivamente sus propias reservas mediante `user_id = auth.uid()`.
- **Pruebas:** Test DB `guest lookup needs both code and phone and redacts sensitive fields`, Playwright tests `booking success uses the persisted code` y `authenticated history queries the session user only`.
- **Resultado:** PASS.

### QA-005 – Fallback local de vestuario que puede simular éxito
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/context/AppContext.tsx`, `src/components/public/PublicDressBookingModal.tsx`, `src/migrations/migration_qa_booking_payment_consistency.sql`
- **Problema:** Si el INSERT de alquiler en Supabase fallaba, existía un fallback en memoria que generaba un ticket ficticio para el cliente.
- **Solución:** Se eliminó por completo el fallback local engañoso. `addDressRental` invoca el RPC `qa_create_dress_rental`. Si ocurre un error, se lanza y se captura en la UI mostrando `setErrorMsg`, permitiendo al usuario reintentar sin perder su selección.
- **Pruebas:** Test DB `wardrobe rejects maintenance, overlap and unpersisted voucher; lifecycle collects once`.
- **Resultado:** PASS.

### QA-006 – Voucher de vestuario basado en blob temporal cuando falla Storage
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/public/PublicDressBookingModal.tsx`, `src/lib/qaApi.ts`
- **Problema:** Ante fallos de Storage, se asignaba un blob temporal como voucher y se permitía continuar.
- **Solución:** Se valida estrictamente que `voucherUrl` exista, no comience con `blob:` y sea una ruta persistente en Storage. Si Storage falla, se detiene el flujo y se notifica al usuario.
- **Pruebas:** Test DB de rechazo de voucher no persistido y validación de tipos MIME JPG/PNG/WebP hasta 5 MB.
- **Resultado:** PASS.

### QA-007 – Prendas activas pero no disponibles que siguen pudiendo reservarse
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/public/PublicWardrobe.tsx`, `src/components/public/PublicDressBookingModal.tsx`, `src/lib/businessRules.ts`, `src/migrations/migration_qa_booking_payment_consistency.sql`
- **Problema:** Prendas con `active = true` pero en estado `mantenimiento`, `en_uso` o `reservado` permitían abrir el modal y registrar alquileres.
- **Solución:** Se implementó la regla `isWardrobeReservable(item)` que exige `item.active === true && item.status === 'disponible'`. En el catálogo público, el botón se deshabilita mostrando "No disponible". Adicionalmente, el RPC `qa_create_dress_rental` realiza una comprobación con bloqueo a nivel de base de datos antes de confirmar el registro.
- **Pruebas:** Test unitario `wardrobe requires active and explicitly available` y Playwright test `zero stock and maintenance cannot be booked`.
- **Resultado:** PASS.

### QA-008 – Carrito que permite superar el stock disponible
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/common/CartDrawer.tsx`, `src/components/public/PublicShop.tsx`, `src/lib/businessRules.ts`, `src/context/AppContext.tsx`
- **Problema:** El botón `+` en el carrito permitía incrementar la cantidad indefinidamente por encima del stock del producto.
- **Solución:** El botón `+` se deshabilita cuando `item.quantity >= item.product.stock`. La función `reconcileCart` limita la cantidad a `Math.floor(product.stock)`. En `PublicShop`, productos con `stock <= 0` muestran "Sin stock" y se deshabilitan. Además, antes de confirmar la compra por WhatsApp, `revalidateCart` consulta el stock fresco en Supabase y notifica si hubo cambios.
- **Pruebas:** Tests unitarios `cart clamps duplicates, rejects negative/fractional input and refreshes price`, `cart removes zero stock, inactive and internal products`, y Playwright test `stock 1 stops increment; cart restores after reload`.
- **Resultado:** PASS.

### QA-009 – Reservas canceladas o expiradas que pueden seguir bloqueando horarios
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/lib/bookingAvailability.ts`, `src/migrations/migration_qa_booking_payment_consistency.sql`
- **Problema:** El algoritmo de disponibilidad no excluía adecuadamente reservas en estado `cancelada`, `expirada`, `completada` o con `liberado_at`.
- **Solución:** Se creó el filtro `isBookingInactive(booking)` que ignora toda reserva cancelada, expirada, completada o liberada. En el backend, `qa_availability` aplica los mismos filtros en SQL, liberando de forma inmediata los horarios al cancelar citas.
- **Pruebas:** Tests DB `all availability entry points ignore cancellation and completion timestamps`, `released services and adjacent slots do not conflict`, y `cancelled booking releases slot and public availability exposes no client data`.
- **Resultado:** PASS.

### QA-010 – Números de WhatsApp inconsistentes / hardcodeados
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/data/initialData.ts`, `src/lib/businessRules.ts`, `src/context/AppContext.tsx`, `src/components/public/ClientLayout.tsx`, `src/components/public/PublicLocation.tsx`, `src/components/common/CartDrawer.tsx`, `src/components/common/PaymentQRWidget.tsx`
- **Problema:** Diversos componentes tenían números telefónicos hardcodeados y contradictorios (ej. `987654321` vs `997766828`).
- **Solución:** Se unificó en una sola fuente de verdad expuesta en `AppContext`: `whatsappNumber`. Prioriza `business_config.whatsapp_url / whatsapp_phone`, con fallback a `import.meta.env.VITE_WHATSAPP_PHONE` y valor por defecto oficial `51997766828`. Se normalizan los dígitos con la función `whatsappPhone`.
- **Pruebas:** Test unitario `contact normalizes country code once and ignores URL query digits` y Playwright test `footer uses the business-config WhatsApp and manual payment copy`.
- **Resultado:** PASS.

### QA-011 – Porcentaje de adelanto mostrado de forma fija
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/public/PublicBookingFlow.tsx`, `src/components/public/PublicLanding.tsx`, `src/components/public/PublicServices.tsx`, `src/components/dashboard/ReservasManager.tsx`, `src/lib/businessRules.ts`
- **Problema:** El texto mostraba "25%" estático aunque la configuración tuviera otro porcentaje.
- **Solución:** Todos los títulos y textos informativos utilizan `{paymentSettings.advance_percentage}%` de forma reactiva. La función `advancePercentage` valida y limita el valor entre 0% y 100%.
- **Pruebas:** Test unitario `advance handles zero, boundaries and invalid configuration`.
- **Resultado:** PASS.

### QA-012 – Texto de Yape que puede inducir a pensar que existe verificación automática
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/public/ClientLayout.tsx`, `src/components/common/PaymentQRWidget.tsx`, `src/components/dashboard/ReservasManager.tsx`
- **Problema:** Textos como "Verificación Inmediata" sugerían una integración API directa con Yape, cuando la verificación es manual por recepción.
- **Solución:** Se actualizó la redacción a: `"Pagos vía Yape sujetos a validación del comprobante por recepción"` y badges de `"Validación manual"` en el widget de pago.
- **Pruebas:** Playwright test `footer uses the business-config WhatsApp and manual payment copy`.
- **Resultado:** PASS.

### QA-013 – Problemas de composición responsive / espacios innecesarios en móvil
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/components/public/ClientLayout.tsx`, `src/components/public/PublicBookingFlow.tsx`, `src/components/public/PublicDressBookingModal.tsx`
- **Problema:** Espacios vacíos y desbordamiento horizontal en pantallas pequeñas.
- **Solución:** Se ajustaron paddings, anchos máximos (`max-w-full overflow-x-hidden`), cards flexibles y modales adaptables con `max-h-[92vh]`.
- **Pruebas:** Playwright E2E suite ejecutada en 5 resoluciones móviles reales: 360x800, 375x812, 390x844, 412x915 y 430x932, verificando `document.documentElement.scrollWidth <= innerWidth + 1`.
- **Resultado:** PASS (5 resoluciones aprobadas).

### QA-014 – Carrito no persistente
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/lib/businessRules.ts`, `src/context/AppContext.tsx`
- **Problema:** Al recargar la página el carrito se reiniciaba a vacío.
- **Solución:** Se implementó almacenamiento en `localStorage` bajo la clave `acicalados_cart`. Al inicializarse la aplicación o actualizarse el catálogo de productos, `reconcileCart` valida la estructura, descarta productos eliminados o inactivos, actualiza precios y limita las cantidades al stock disponible.
- **Pruebas:** Playwright test `stock 1 stops increment; cart restores after reload`.
- **Resultado:** PASS.

### QA-015 – Diferencia entre estado visual y estado real almacenado en base de datos
- **Estado:** CORREGIDO
- **Archivos modificados:** `src/context/AppContext.tsx`, `src/components/dashboard/POSView.tsx`, `src/components/dashboard/ReservasManager.tsx`, `src/components/dashboard/vestuario/ValidateVoucherModal.tsx`, `src/components/dashboard/PendingBookingVouchers.tsx`
- **Problema:** Acciones operativas críticas realizaban modificaciones optimistas sin esperar confirmación remota, generando desincronizaciones en caso de error de red o RLS.
- **Solución:** Todas las mutaciones de reservas, pagos, ventas POS, vestuario y vouchers esperan confirmación de Supabase. Si una operación falla, se presenta un banner flotante accesible `role="alert"` (`setOperationError`), se preserva el estado real previo y no se emiten comprobantes. Se protegieron además todas las acciones contra doble envío (`isSubmitting`, `paymentBusy`, `uploadLock`, `pendingOperations`).
- **Pruebas:** DB tests de idempotencia y concurrencia; tests de fallo en reservas y vouchers.
- **Resultado:** PASS.

---

## Migraciones

Se creó el archivo de migración SQL complementario e idempotente:
`src/migrations/migration_qa_booking_payment_consistency.sql`

### ¿Qué cambia?
1. **Esquema interno privado:** Crea `qa_internal` con tablas de solicitudes idempotentes (`requests`) y registro de comprobantes temporales autorizados (`voucher_uploads`).
2. **Columnas de soporte:** Añade `yape_phone`, `yape_holder` y `yape_qr_url` a `public.business_config`, y `notes` a `public.bookings`.
3. **RPCs transaccionales con bloqueo consultivo:**
   - `qa_create_booking`: Valida servicios activos, especialistas habilitados, turnos, descansos/bloqueos, horarios y solapamientos; genera código seguro con formato `AC-...` y persiste la reserva y servicios en una sola transacción.
   - `qa_lookup_booking`: Consulta de reservas para invitados con código + teléfono de 9 dígitos.
   - `qa_availability`: Cálculo de aforo y ocupación ignorando citas canceladas o liberadas.
   - `qa_prepare_voucher`, `qa_can_upload_voucher`, `qa_submit_booking_voucher`: Gestión segura de vouchers.
   - `qa_create_dress_rental`, `qa_transition_dress`: Alquileres de vestuario con control estricto de estado y fechas.
   - `qa_process_pos_sale`: Venta de mostrador atómica con decremento de stock e idempotencia.
4. **Bucket privado y RLS:** Configura el bucket `payment-vouchers` como privado (máx. 5 MB, tipos JPEG, PNG, WebP) con políticas RLS de subida restringida a paths autorizados y lectura reservada a administradores y recepcionistas.

### Riesgos y mitigaciones
- *Riesgo:* Compatibilidad con datos preexistentes.
- *Mitigación:* Se usan sentencias `IF NOT EXISTS`, valores por defecto compatibles y soporte para registros antiguos con URLs directas.

### Rollback conceptual
- El script contiene transacciones seguras. Para revertir los RPCs de soporte QA, basta ejecutar:
  `DROP FUNCTION IF EXISTS public.qa_create_booking, public.qa_lookup_booking, ...; DROP SCHEMA IF EXISTS qa_internal CASCADE;`

---

## Pruebas ejecutadas

### 1. Compilación y Linter de TypeScript
```bash
npm run lint
```
**Resultado:** PASS (0 errores de TypeScript, `tsc --noEmit` exitoso)

### 2. Compilación de Producción con Vite
```bash
npm run build
```
**Resultado:** PASS (`vite build` exitoso, todos los módulos transformados y bundle generado en dist/)

### 3. Suite de Pruebas Unitarias y de Base de Datos
```bash
npm test
```
**Resultado:** PASS (19 pruebas superadas / 19 total)
- `cart clamps duplicates, rejects negative/fractional input and refreshes price` (PASS)
- `cart removes zero stock, inactive and internal products` (PASS)
- `advance handles zero, boundaries and invalid configuration` (PASS)
- `contact normalizes country code once and ignores URL query digits` (PASS)
- `vouchers reject SVG, PDF, zero and oversized files; accept supported images` (PASS)
- `wardrobe requires active and explicitly available` (PASS)
- `all availability entry points ignore cancellation and completion timestamps` (PASS)
- `released services and adjacent slots do not conflict` (PASS)
- `appointments cannot finish past closing time or employee shift` (PASS)
- `atomic booking uses server prices, real code, zero advance and idempotency` (PASS)
- `failed service detail leaves no booking and racing submissions get one slot` (PASS)
- `cancelled booking releases slot and public availability exposes no client data` (PASS)
- `guest lookup needs both code and phone and redacts sensitive fields` (PASS)
- `voucher must exist in private Storage, stays pending, retries do not duplicate` (PASS)
- `wardrobe rejects maintenance, overlap and unpersisted voucher; lifecycle collects once` (PASS)
- `public table insert and private voucher enumeration are denied` (PASS)
- `POS aggregates repeated lines, rejects negative quantity and decrements only once` (PASS)
- `service release is persisted and prices update the stored booking total` (PASS)
- `rescheduling shifts service intervals atomically and rejects an occupied slot` (PASS)

### 4. Pruebas E2E de Flujos Críticos (Playwright)
```bash
npx playwright test
```
**Resultado:** PASS (14 pruebas superadas / 14 total)
- `booking failure retains the form and never displays a real code` (PASS)
- `booking success uses the persisted code; linked voucher survives a page reload` (PASS)
- `failUpload: no voucher success` (PASS)
- `failLink: no voucher success` (PASS)
- `stock 1 stops increment; cart restores after reload` (PASS)
- `zero stock and maintenance cannot be booked` (PASS)
- `responsive 360x800 public views and navigation` (PASS)
- `responsive 375x812 public views and navigation` (PASS)
- `responsive 390x844 public views and navigation` (PASS)
- `responsive 412x915 public views and navigation` (PASS)
- `responsive 430x932 public views and navigation` (PASS)
- `authenticated history queries the session user only` (PASS)
- `stock changes are rechecked before WhatsApp and give visible feedback` (PASS)
- `footer uses the business-config WhatsApp and manual payment copy` (PASS)

---

## Riesgos pendientes

1. **Aplicación de la migración en la base de datos de producción:**
   - La migración SQL `migration_qa_booking_payment_consistency.sql` debe ejecutarse en el panel de Supabase (SQL Editor) del proyecto de producción antes de desplegar la versión de frontend, para que las funciones RPC y el bucket privado `payment-vouchers` estén disponibles.
2. **Configuración inicial de variables de entorno del negocio:**
   - Debe asegurarse de que `business_config` contenga el número oficial de Yape, el nombre del titular y la URL del código QR institucional subida a Storage.

---

## Recomendaciones

1. Ejecutar la migración SQL en un ambiente de Staging de Supabase y verificar el bucket `payment-vouchers`.
2. Probar manualmente la validación de vouchers desde la vista de Recepción / Administración (`PendingBookingVouchers`).
3. Comprobar en un dispositivo físico la experiencia de subida de comprobantes JPG/PNG desde cámara o galería móvil.

---

## Archivos modificados

- `.env.example`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `.github/workflows/qa.yml`
- `src/types.ts`
- `src/data/initialData.ts`
- `src/lib/businessRules.ts`
- `src/lib/qaApi.ts`
- `src/lib/bookingAvailability.ts`
- `src/context/AppContext.tsx`
- `src/migrations/migration_qa_booking_payment_consistency.sql`
- `src/components/common/CartDrawer.tsx`
- `src/components/common/PaymentQRWidget.tsx`
- `src/components/dashboard/POSView.tsx`
- `src/components/dashboard/ReservasManager.tsx`
- `src/components/dashboard/PendingBookingVouchers.tsx`
- `src/components/dashboard/vestuario/DressAvailabilityCalendar.tsx`
- `src/components/dashboard/vestuario/ValidateVoucherModal.tsx`
- `src/components/public/ClientLayout.tsx`
- `src/components/public/ClientPortal.tsx`
- `src/components/public/PublicBookingFlow.tsx`
- `src/components/public/PublicDressBookingModal.tsx`
- `src/components/public/PublicLanding.tsx`
- `src/components/public/PublicLocation.tsx`
- `src/components/public/PublicServices.tsx`
- `src/components/public/PublicShop.tsx`
- `src/components/public/PublicWardrobe.tsx`
- `tests/businessRules.test.ts`
- `tests/database.test.ts`
- `tests/fixtures/schema.sql`
- `tests/e2e/public.spec.ts`

---

## Conclusión

El proyecto **AcicaladosM** cuenta ahora con una arquitectura robusta donde el frontend refleja fielmente el estado del backend. Se eliminaron falsos estados de éxito, fallbacks locales engañosos y blobs temporales. Toda reserva, pago y alquiler queda sólidamente persistido y auditado. Las suites de pruebas automatizadas unitarias, de base de datos y E2E garantizan la no regresión de las reglas de negocio.
