# QA Release Changelog

## Fixed

- **QA-001:** Corregido el scroll vertical al cambiar entre vistas públicas; ahora inicia en `top = 0` con restauración manual para navegación por historial.
- **QA-002:** Eliminado el falso estado de éxito en reservas. Ahora `addBooking` es asíncrono y solo avanza si Supabase confirma el INSERT con su código persistido.
- **QA-003:** Eliminado el uso de URLs temporales `blob:` como comprobante de pago de citas; se implementó almacenamiento persistente en el bucket privado `payment-vouchers`.
- **QA-004:** Restaurada la trazabilidad de reservas para usuarios invitados mediante verificación en dos factores (código de reserva + celular) sin exponer datos sensibles.
- **QA-005:** Eliminado el fallback local que generaba reservas ficticias de vestuario cuando Supabase fallaba.
- **QA-006:** Bloqueada la emisión de tickets de vestuario con URLs `blob:`; se exige ruta persistente confirmada en Supabase Storage.
- **QA-007:** Bloqueada la reserva de prendas en estados no disponibles (`mantenimiento`, `en_uso`, `reservado`) tanto en UI como en la validación previa al INSERT.
- **QA-008:** Restringido el incremento de cantidades en el carrito al stock disponible del producto (`quantity <= stock`), deshabilitando la adición para productos sin stock.
- **QA-009:** Corregido el cálculo de aforo y disponibilidad de citas para ignorar estados inactivos (`cancelada`, `expirada`, `completada`, `liberada`).
- **QA-010:** Eliminados los números de WhatsApp hardcodeados en los componentes públicos y administrativos, unificando la fuente de verdad en `business_config`.
- **QA-011:** Sustituido el texto fijo "25%" por el porcentaje dinámico configurado (`paymentSettings.advance_percentage`), con validaciones de límites (0% a 100%).
- **QA-012:** Corregido el texto de pagos con Yape en footer y checkout para aclarar que la validación del comprobante es manual por recepción.
- **QA-013:** Optimizada la composición responsive en resoluciones móviles estándar (360x800 a 430x932) sin desbordamiento horizontal.
- **QA-014:** Implementada la persistencia del carrito de compras en `localStorage` con revalidación y saneamiento contra el catálogo activo.
- **QA-015:** Eliminadas las actualizaciones optimistas no confirmadas en flujos críticos; se agregaron alertas de error visibles y estados de bloqueo contra doble envío.

## Improved

- Centralización de reglas de negocio (`src/lib/businessRules.ts`) para carrito, WhatsApp, porcentajes de adelanto y validación de comprobantes.
- Creación del componente administrativo `PendingBookingVouchers` para revisión, aprobación y rechazo de comprobantes de pago de citas.
- Gestión segura de fechas en calendarios de vestuario utilizando zona horaria America/Lima.
- Manejo accesible de errores en formularios públicos y modales administrativos.

## Security

- Restricción del bucket `payment-vouchers` a modo privado con políticas RLS de acceso exclusivo a roles autorizados (`admin`, `recepcionista`, `VESTUARIO_ADMIN`).
- Consulta de reservas de invitados mediante RPC con función `SECURITY DEFINER` que no expone DNI, correo electrónico ni identificadores de usuario.
- Prevención de ataques de inyección y sobreescritura mediante advisory locks de Postgres e identificadores de solicitud idempotentes.

## Database

- Creación de la migración `src/migrations/migration_qa_booking_payment_consistency.sql`.
- Funciones RPC transaccionales:
  - `qa_create_booking`
  - `qa_lookup_booking`
  - `qa_availability`
  - `qa_prepare_voucher`
  - `qa_submit_booking_voucher`
  - `qa_create_dress_rental`
  - `qa_transition_dress`
  - `qa_process_pos_sale`
  - `qa_review_payment`
  - `qa_void_payment`

## Tests

- 19 pruebas automatizadas unitarias y de base de datos en `tests/` cubriendo disponibilidad, stock, cálculos de adelanto y contratos SQL.
- 14 pruebas E2E con Playwright en `tests/e2e/public.spec.ts` validando flujos de reserva, fallo de persistencia, retención de formularios, comprobantes y diseño responsive móvil.
- Configuración de flujo de integración continua en `.github/workflows/qa.yml`.
