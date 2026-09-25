# INFORME QA – ANÁLISIS DE FLUJOS, DEFECTOS Y CORRECCIONES
## Proyecto: AcicaladosM

**Repositorio analizado:** `manu-cracks/AcicaladosM`  
**Documento de referencia:** `SPA ACICALADOS FLUJO.docx`  
**Tipo de revisión:** QA funcional, QA de integración, validación de experiencia de usuario y revisión técnica del flujo  
**Enfoque:** Portal público, reservas, pagos, vestuario, productos, cuenta del cliente y WhatsApp  
**Fecha de análisis:** 24/09/2026

---

# 1. Objetivo del análisis

El presente documento describe el flujo funcional actual del sistema **AcicaladosM**, identifica defectos observables y riesgos técnicos, y propone correcciones desde la perspectiva de un especialista de **Quality Assurance (QA)**.

El análisis se basa en:

- El flujo probado manualmente y documentado en `SPA ACICALADOS FLUJO.docx`.
- La revisión del código fuente de la rama `main`.
- La trazabilidad entre comportamiento visible, lógica del frontend y persistencia en Supabase.
- Riesgos de consistencia entre interfaz, datos, estados, stock, pagos y canales de confirmación.

El objetivo no es únicamente listar errores visuales, sino determinar:

- Qué comportamiento está ocurriendo.
- Qué debería ocurrir.
- Qué causa probable existe en el código.
- Cómo corregirlo.
- Cómo validar que el error no vuelva a aparecer.

---

# 2. Alcance de QA

Se revisaron principalmente los siguientes módulos:

1. Portal público.
2. Navegación.
3. Flujo de reserva de servicios.
4. Selección de fecha y horario.
5. Registro de datos personales.
6. Confirmación de reserva.
7. Pago de adelanto vía Yape.
8. Carga de comprobantes.
9. Portal “Mi Cuenta”.
10. Vestuario.
11. Productos.
12. Carrito de compras.
13. Confirmaciones por WhatsApp.
14. Persistencia de datos en Supabase.
15. Estados de reservas.
16. Estados de prendas.
17. Stock de productos.
18. Comportamiento responsive y experiencia móvil.

---

# 3. Flujo funcional actual

## 3.1. Flujo principal de reserva de servicios

El flujo observado actualmente es:

```text
Inicio
  ↓
Reservar “Mi Cita Online”
  ↓
Paso 1: Selección del tipo de experiencia
  ↓
Paso 2: Selección de servicio(s)
  ↓
Paso 3: Selección de fecha y horario
  ↓
Paso 4: Registro de datos personales
  ↓
Confirmar reserva
  ↓
Creación inmediata de reserva local
  ↓
Pantalla de éxito
  ↓
Paso 5: Instrucciones de pago
  ↓
Carga de comprobante
  ↓
Confirmación opcional vía WhatsApp
```

### Observación QA crítica

Actualmente el sistema puede mostrar la pantalla:

> “¡Reserva Registrada Exitosamente!”

antes de tener confirmación definitiva de que el registro fue almacenado correctamente en Supabase.

Esto genera una posible inconsistencia entre:

- Estado mostrado al usuario.
- Estado local de React.
- Estado real en base de datos.

---

## 3.2. Flujo de “Mi Cuenta”

```text
Usuario
  ↓
Ingreso a “Mi Cuenta”
  ↓
Verificación de sesión
  ↓
¿Usuario autenticado?
  ├── Sí → Consultar reservas de Supabase
  └── No → Mostrar historial vacío
```

Actualmente un usuario invitado puede realizar una reserva, pero al ir posteriormente a “Mi Cuenta” el sistema no conserva un historial funcional asociado al invitado.

---

## 3.3. Flujo de pago de reserva

```text
Reserva creada
  ↓
Mostrar QR / número Yape
  ↓
Usuario realiza pago
  ↓
Usuario selecciona comprobante
  ↓
Sistema muestra “comprobante cargado”
  ↓
Opcional: abrir WhatsApp
```

### Problema detectado

En el flujo normal de citas, el comprobante se representa mediante una URL temporal del navegador (`blob:`).

No se realiza una carga real y persistente del archivo a Supabase Storage.

Por lo tanto:

- El comprobante puede verse en la sesión actual.
- Puede parecer que fue cargado.
- Pero no queda necesariamente disponible después de recargar la página.
- Tampoco queda disponible en otro dispositivo o sesión.

---

## 3.4. Flujo de vestuario

```text
Vestuario
  ↓
Ver catálogo
  ↓
Seleccionar prenda
  ↓
Abrir reserva online
  ↓
Seleccionar fecha
  ↓
Ingresar datos personales
  ↓
Adjuntar voucher
  ↓
Registrar alquiler
  ↓
Generar ticket
  ↓
Notificar por WhatsApp
```

La estructura general es correcta, pero existen riesgos relacionados con:

- Estado de la prenda.
- Validación real de disponibilidad.
- Persistencia del voucher.
- Confirmación de la reserva cuando Supabase falla.

---

## 3.5. Flujo de productos

```text
Productos
  ↓
Seleccionar producto
  ↓
Añadir al carrito
  ↓
Incrementar / reducir cantidad
  ↓
Ver subtotal
  ↓
Confirmar pedido por WhatsApp
```

Actualmente el carrito se administra principalmente en memoria del frontend y no se observa una validación estricta contra el stock antes de incrementar cantidades.

---

# 4. Resumen ejecutivo de defectos

| ID | Módulo | Severidad | Tipo | Hallazgo |
|---|---|---:|---|---|
| QA-001 | Navegación | Alta | UX / Funcional | Las vistas públicas no siempre reinician el scroll |
| QA-002 | Reservas | Crítica | Integración | Se muestra éxito antes de confirmar persistencia en Supabase |
| QA-003 | Pagos | Crítica | Persistencia | El voucher de cita no se sube realmente al servidor |
| QA-004 | Mi Cuenta | Alta | Funcional | Invitados pierden trazabilidad de sus reservas |
| QA-005 | Vestuario | Alta | Integración | Puede generarse reserva local si falla Supabase |
| QA-006 | Vestuario | Alta | Persistencia | Se acepta blob local como voucher válido |
| QA-007 | Vestuario | Alta | Regla de negocio | No se valida el estado real de la prenda al reservar |
| QA-008 | Productos | Alta | Regla de negocio | Se puede superar el stock desde el carrito |
| QA-009 | Reservas | Alta | Disponibilidad | Reservas canceladas/expiradas pueden bloquear horarios |
| QA-010 | WhatsApp | Media-Alta | Configuración | Existen números hardcodeados distintos |
| QA-011 | Pagos | Media | Consistencia | Texto fijo “25%” puede no coincidir con configuración |
| QA-012 | Footer | Media | UX / Comunicación | Mensaje de Yape puede inducir a pensar que hay integración directa |
| QA-013 | Mobile | Media | UX | Espacios vacíos y composición mejorable en vistas móviles |
| QA-014 | Productos | Media-Alta | Persistencia | El carrito no se conserva ante recarga |
| QA-015 | Estados | Alta | Consistencia | Éxito local puede diferir del estado real en BD |

---

# 5. Hallazgos detallados y correcciones

## QA-001 – La navegación pública no reinicia el scroll

**Módulo:** Navegación pública  
**Severidad:** Alta  
**Tipo:** UX / Funcional

### Descripción

Al navegar desde una sección inferior de la página hacia otra vista pública, la posición vertical puede mantenerse.

Esto coincide con la observación del flujo manual donde, al entrar a “Reservar Mi cita Online”, el usuario aparece desplazado hacia una zona inferior.

### Resultado actual

El usuario puede ingresar a una nueva pantalla y verla desde la mitad o desde la parte baja.

### Resultado esperado

Cada cambio de vista pública debería iniciar en la parte superior, salvo cuando exista un comportamiento explícito de restauración de scroll.

### Causa técnica probable

El reset de scroll está implementado principalmente para vistas del dashboard, pero no de forma global para las vistas públicas.

### Corrección recomendada

Agregar un efecto global asociado a `activeView`.

Ejemplo conceptual:

```ts
useEffect(() => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'instant'
  });
}, [activeView]);
```

### Criterios de aceptación

- Inicio → Reservar debe abrir arriba.
- Vestuario → Productos debe abrir arriba.
- Productos → Mi Cuenta debe abrir arriba.
- Debe funcionar en escritorio y móvil.
- El botón “Atrás” del navegador debe mantener un comportamiento coherente.

---

## QA-002 – La aplicación muestra éxito antes de confirmar el INSERT

**Módulo:** Reservas  
**Severidad:** Crítica  
**Tipo:** Integración / Consistencia

### Descripción

La reserva se agrega primero al estado local del frontend y luego se intenta almacenar de forma asíncrona en Supabase.

La interfaz puede avanzar al paso 5 y mostrar un código de reserva aunque la base de datos falle.

### Riesgo

El cliente puede creer que:

- Tiene una cita confirmada.
- El horario está reservado.
- Su reserva está registrada.

cuando el backend podría no haber almacenado nada.

### Resultado esperado

La interfaz debe mostrar éxito solo después de una respuesta positiva de Supabase.

### Corrección recomendada

Convertir `addBooking()` en una operación asíncrona.

Flujo correcto:

```text
Usuario confirma
  ↓
Validar datos
  ↓
Enviar INSERT a Supabase
  ↓
¿INSERT OK?
  ├── Sí → Actualizar estado local → Mostrar éxito
  └── No → Mostrar error → Mantener formulario
```

Ejemplo conceptual:

```ts
const created = await addBooking(data);

if (!created) {
  setBookingFormError(
    'No se pudo registrar la reserva. Intenta nuevamente.'
  );
  return;
}

setCreatedBooking(created);
setCurrentStep(5);
```

### Criterios de aceptación

- Si Supabase está desconectado no debe mostrarse “Reserva registrada”.
- No debe generarse ticket definitivo si la BD falló.
- No debe bloquearse visualmente un horario inexistente.
- El código mostrado debe corresponder al código persistido.

---

## QA-003 – El voucher de citas no es persistente

**Módulo:** Pagos / Reservas  
**Severidad:** Crítica  
**Tipo:** Persistencia

### Descripción

El componente de pago utiliza una URL temporal creada mediante:

```ts
URL.createObjectURL(file)
```

Esto no significa que el archivo haya sido almacenado en Supabase.

### Riesgo

La interfaz da la impresión de que el comprobante fue cargado correctamente, pero el archivo podría desaparecer al:

- Actualizar la página.
- Cerrar el navegador.
- Cambiar de dispositivo.

### Corrección recomendada

Crear un bucket dedicado, por ejemplo:

```text
payment-vouchers/
```

y guardar mediante Supabase Storage.

Flujo:

```text
Seleccionar comprobante
  ↓
Validar archivo
  ↓
Subir a Storage
  ↓
Obtener URL o path
  ↓
Guardar referencia en booking/payment_logs
  ↓
Mostrar confirmación
```

### Validaciones recomendadas

- JPG.
- PNG.
- WebP.
- PDF si se desea.
- Máximo 5 MB.
- Sanitizar nombre de archivo.
- Generar nombre único.
- Asociar voucher al ID de reserva.

### Criterios de aceptación

Después de recargar:

- El voucher debe seguir existiendo.
- Debe poder visualizarse desde administración.
- Debe estar relacionado con la reserva correcta.

---

## QA-004 – El usuario invitado pierde el historial

**Módulo:** Mi Cuenta  
**Severidad:** Alta  
**Tipo:** Funcional

### Descripción

Cuando `currentUser.role === 'anon'`, el portal no consulta reservas y presenta un historial vacío.

### Problema de experiencia

Un usuario puede completar todo el flujo como invitado y luego no encontrar su reserva.

### Opciones de corrección

#### Opción A – Obligar autenticación

Antes de registrar una cita:

```text
¿Tiene cuenta?
  ├── Sí → Login
  └── No → Crear cuenta
```

#### Opción B – Consulta temporal de reserva

Permitir consulta mediante:

- Código de reserva.
- DNI.
- Celular.
- Código + celular.

#### Opción C – Vinculación posterior

Cuando un invitado crea una cuenta:

```text
Buscar reservas con:
client_phone / client_email / DNI
  ↓
Vincular a user_id
```

### Recomendación QA

Para experiencia comercial, la opción más flexible es:

```text
Código de reserva + celular
```

sin obligar al usuario a registrarse previamente.

---

## QA-005 – Fallback local de vestuario puede simular éxito

**Módulo:** Vestuario  
**Severidad:** Alta  
**Tipo:** Integración

### Descripción

Si Supabase falla al registrar un alquiler, el código puede generar una reserva local temporal.

Esto mantiene la interfaz funcionando, pero genera inconsistencia.

### Riesgo

Puede producirse:

```text
Ticket mostrado al cliente
pero
Reserva inexistente en BD
```

### Corrección recomendada

No usar un fallback local como confirmación definitiva.

Se recomienda:

```ts
if (error) {
  throw error;
}
```

El fallback puede utilizarse únicamente como mecanismo offline si existe una cola de sincronización formal, pero no como reserva confirmada.

### Criterios de aceptación

- Si falla Supabase → mostrar error.
- No generar ticket definitivo.
- No notificar por WhatsApp como reserva confirmada.
- Mantener datos del formulario para reintentar.

---

## QA-006 – Voucher de vestuario puede quedar como blob local

**Módulo:** Vestuario / Pagos  
**Severidad:** Alta  
**Tipo:** Persistencia

### Descripción

Ante un error de Storage, el sistema utiliza:

```ts
URL.createObjectURL(file)
```

como alternativa.

Esta URL es temporal.

### Corrección recomendada

Si falla Supabase Storage:

```text
NO permitir avanzar
```

Mostrar:

> “No se pudo cargar el comprobante. Verifica tu conexión e inténtalo nuevamente.”

### Criterios de aceptación

La reserva solo podrá confirmarse cuando:

```text
voucher_storage_path != null
```

o exista una URL persistente validada.

---

## QA-007 – El estado de la prenda no se valida correctamente al reservar

**Módulo:** Vestuario  
**Severidad:** Alta  
**Tipo:** Regla de negocio

### Descripción

Las prendas tienen estados como:

```text
disponible
reservado
en_uso
mantenimiento
```

pero el catálogo público filtra principalmente por `active`.

Una prenda puede estar:

```text
active = true
status = mantenimiento
```

y seguir siendo visible/reservable.

### Corrección recomendada

La reserva debe validar:

```ts
item.active === true &&
item.status === 'disponible'
```

También debe existir una validación final en backend antes del INSERT.

### Criterios de aceptación

- `mantenimiento` → no reservable.
- `en_uso` → no reservable.
- `reservado` → no reservable para fechas en conflicto.
- `disponible` → reservable.

---

## QA-008 – El carrito puede superar el stock

**Módulo:** Productos  
**Severidad:** Alta  
**Tipo:** Regla de negocio

### Descripción

El botón `+` aumenta la cantidad sin comparar con `product.stock`.

### Escenario

```text
Stock = 1
Usuario agrega producto
Cantidad = 1
Usuario pulsa +
Cantidad = 2
Usuario pulsa +
Cantidad = 3
```

### Resultado esperado

Nunca debe permitirse:

```text
quantity > stock
```

### Corrección recomendada

```ts
const nextQuantity = item.quantity + 1;

if (nextQuantity > item.product.stock) {
  return;
}
```

También:

- Deshabilitar “Añadir” cuando `stock <= 0`.
- Mostrar “Sin stock”.
- Validar nuevamente antes de confirmar pedido.

---

## QA-009 – Reservas canceladas o expiradas pueden bloquear disponibilidad

**Módulo:** Reservas / Agenda  
**Severidad:** Alta  
**Tipo:** Disponibilidad

### Descripción

El cálculo de disponibilidad revisa reservas existentes, pero la función de conflicto no descarta necesariamente estados como:

```text
cancelada
expirada
```

### Riesgo

Un horario puede permanecer marcado como ocupado aun después de cancelar la cita.

### Corrección recomendada

Filtrar reservas activas:

```ts
if (
  booking.status === 'cancelada' ||
  booking.status === 'expirada'
) {
  return false;
}
```

Posiblemente también:

```text
completada
```

si se están calculando fechas futuras.

### Criterios de aceptación

Cancelar una cita futura debe liberar inmediatamente el horario.

---

## QA-010 – Números de WhatsApp inconsistentes

**Módulo:** WhatsApp  
**Severidad:** Media-Alta  
**Tipo:** Configuración

### Descripción

Existen distintos números definidos en diferentes componentes.

Ejemplos observados:

```text
+51 987654321
+51 997766828
```

### Riesgo

Pedidos o consultas pueden llegar a un número incorrecto.

### Corrección recomendada

Definir una única fuente de verdad.

Por ejemplo:

```ts
businessConfig.whatsapp_phone
```

o variable de entorno:

```text
VITE_WHATSAPP_PHONE
```

y utilizarla en:

- Footer.
- Productos.
- Vestuario.
- Pagos.
- Reservas.

---

## QA-011 – Texto fijo “25%” puede no coincidir con configuración

**Módulo:** Pagos  
**Severidad:** Media  
**Tipo:** Consistencia

### Descripción

El monto del adelanto utiliza una configuración dinámica, pero el texto puede mostrar:

> “Adelanto Mínimo del 25%”

de forma fija.

### Escenario

Configuración:

```text
advance_percentage = 30
```

Interfaz:

```text
Monto calculado = 30%
Texto = 25%
```

### Corrección recomendada

```tsx
title={`Abonar Adelanto Mínimo del ${paymentSettings.advance_percentage}%`}
```

---

## QA-012 – Mensaje de Yape puede interpretarse como integración automática

**Módulo:** Footer  
**Severidad:** Media  
**Tipo:** UX / Comunicación

### Texto actual

> “Pagos seguros vía Yape Perú & Verificación Inmediata”

### Problema

Puede interpretarse como:

- API oficial de Yape integrada.
- Verificación automática.
- Confirmación instantánea.

cuando el flujo depende de:

- Transferencia externa.
- Captura del comprobante.
- Revisión manual.

### Corrección recomendada

Usar una redacción como:

> “Pagos vía Yape sujetos a validación por recepción.”

o:

> “Aceptamos pagos por Yape. La confirmación se realiza previa validación del comprobante.”

---

## QA-013 – Espacios vacíos en versión móvil

**Módulo:** Responsive  
**Severidad:** Media  
**Tipo:** UX

### Descripción

El flujo funciona, pero algunos contenedores presentan áreas visualmente vacías en resoluciones móviles.

### Corrección recomendada

Revisar principalmente:

- `padding`.
- `margin`.
- alturas mínimas.
- tarjetas.
- columnas.
- grids.
- espacios alrededor del footer.

### Resoluciones QA sugeridas

```text
360 x 800
375 x 812
390 x 844
412 x 915
430 x 932
```

---

## QA-014 – El carrito no persiste

**Módulo:** Productos  
**Severidad:** Media-Alta  
**Tipo:** Persistencia

### Descripción

El carrito vive en estado React.

Al recargar:

```text
Carrito → vacío
```

### Corrección recomendada

Persistir temporalmente en:

```text
localStorage
```

Ejemplo:

```text
acicalados_cart
```

y revalidar stock al restaurarlo.

---

## QA-015 – Estado visual y estado real pueden divergir

**Módulo:** Arquitectura / Estado  
**Severidad:** Alta  
**Tipo:** Consistencia

### Descripción

Algunos procesos utilizan una actualización optimista local antes de completar la operación remota.

Esto puede generar:

```text
UI = éxito
BD = error
```

### Corrección recomendada

Clasificar operaciones:

#### Operaciones que pueden ser optimistas

- Cambio de filtros.
- Preferencias visuales.
- Apertura de modales.

#### Operaciones que NO deberían confirmarse optimistamente

- Crear reserva.
- Registrar pago.
- Alquiler de prenda.
- Modificar stock.
- Confirmar entrega.
- Registrar devolución.
- Cargar comprobante.

---

# 6. Flujo corregido recomendado

## 6.1. Reserva de servicio

```text
Inicio
  ↓
Reservar
  ↓
Scroll = top
  ↓
Seleccionar tipo
  ↓
Seleccionar servicios
  ↓
Consultar disponibilidad REAL
  ↓
Seleccionar fecha/hora
  ↓
Ingresar datos
  ↓
Validar datos
  ↓
Enviar reserva a Supabase
  ↓
¿Reserva almacenada?
  ├── NO
  │    ↓
  │  Mostrar error
  │    ↓
  │  Conservar formulario
  │
  └── SÍ
       ↓
     Mostrar código real
       ↓
     Mostrar QR / adelanto
       ↓
     Subir voucher a Storage
       ↓
     Guardar payment_log
       ↓
     Estado = por_validar
       ↓
     Recepción valida
       ↓
     Estado = confirmada
```

---

## 6.2. Vestuario

```text
Abrir catálogo
  ↓
Filtrar active = true
  ↓
Validar status
  ↓
¿Disponible?
  ├── NO → Deshabilitar reserva
  └── SÍ
       ↓
     Elegir fechas
       ↓
     Validar conflictos
       ↓
     Datos del cliente
       ↓
     Subir voucher
       ↓
     ¿Storage OK?
       ├── NO → Error
       └── SÍ
            ↓
          INSERT Supabase
            ↓
          ¿INSERT OK?
            ├── NO → Error
            └── SÍ → Generar ticket
```

---

## 6.3. Productos

```text
Abrir tienda
  ↓
Consultar productos activos
  ↓
Mostrar stock
  ↓
Agregar al carrito
  ↓
Validar:
quantity <= stock
  ↓
Persistir carrito
  ↓
Confirmar pedido
  ↓
Revalidar stock
  ↓
Generar mensaje WhatsApp
```

---

# 7. Plan de pruebas de regresión

Después de realizar las correcciones se recomienda ejecutar la siguiente regresión.

## Reserva

- Reserva normal con usuario autenticado.
- Reserva como invitado.
- Supabase online.
- Supabase offline.
- Error intencional de INSERT.
- Doble clic en confirmar.
- Dos usuarios intentando tomar el mismo horario.
- Cancelación de reserva.
- Liberación del horario.
- Fecha pasada.
- Hora pasada.
- Servicio múltiple.

## Pagos

- Voucher JPG.
- Voucher PNG.
- Voucher WebP.
- Archivo demasiado grande.
- Archivo inválido.
- Fallo del Storage.
- Recarga después de subir voucher.
- Consulta desde otro dispositivo.
- Validación de Yape pendiente.
- Pago parcial.
- Pago total.

## Vestuario

- Disponible.
- Reservado.
- En uso.
- Mantenimiento.
- Fechas solapadas.
- Sin conflicto.
- Error de Storage.
- Error de INSERT.
- Comprobante obligatorio.
- Confirmación del ticket.

## Productos

- Stock 0.
- Stock 1.
- Stock alto.
- Incrementar por encima de stock.
- Disminuir a cero.
- Recargar navegador.
- Producto eliminado desde administración.
- Producto desactivado mientras permanece en carrito.

## Navegación

- Inicio → Reservar.
- Reservar → Productos.
- Productos → Vestuario.
- Vestuario → Mi Cuenta.
- Atrás del navegador.
- Adelante del navegador.
- Scroll alto antes de cambiar de vista.

---

# 8. Priorización propuesta

## Prioridad P0 – Antes de producción

Corregir inmediatamente:

```text
QA-002
QA-003
QA-005
QA-006
QA-007
QA-008
QA-009
QA-015
```

Estas incidencias pueden afectar directamente:

- Reservas.
- Dinero.
- Disponibilidad.
- Stock.
- Comprobantes.
- Confianza del cliente.

## Prioridad P1 – Antes de liberar versión estable

```text
QA-001
QA-004
QA-010
QA-014
```

## Prioridad P2 – Mejora de experiencia

```text
QA-011
QA-012
QA-013
```

---

# 9. Recomendaciones técnicas de QA

## 9.1. Incorporar pruebas automatizadas

Actualmente se recomienda agregar como mínimo:

```text
Unit tests
Integration tests
E2E tests
```

Stack sugerido:

```text
Vitest
React Testing Library
Playwright
```

---

## 9.2. Casos E2E prioritarios

Ejemplos:

```text
E2E-001 Crear reserva satisfactoria
E2E-002 Fallo de Supabase al crear reserva
E2E-003 Upload persistente de voucher
E2E-004 Liberación de horario cancelado
E2E-005 Restricción por stock
E2E-006 Restricción por estado de prenda
E2E-007 Reserva como invitado
E2E-008 Historial autenticado
E2E-009 WhatsApp usa número oficial
E2E-010 Recuperación de carrito
```

---

## 9.3. Eliminar datos hardcodeados

Evitar valores repetidos como:

```text
números WhatsApp
porcentaje de adelanto
QR
horarios
teléfonos
direcciones
```

Centralizar en:

```text
business_config
```

o variables de entorno.

---

# 10. Criterios de calidad para una versión estable

El sistema puede considerarse estable para producción cuando:

- Una reserva nunca se muestre como exitosa si la BD falló.
- Todo voucher mostrado como “cargado” exista realmente en Storage.
- Los horarios cancelados se liberen correctamente.
- No se pueda vender por encima del stock.
- No se pueda reservar una prenda no disponible.
- El estado visual coincida con Supabase.
- Mi Cuenta muestre información trazable.
- WhatsApp utilice un único número oficial.
- El porcentaje de adelanto sea dinámico.
- Las vistas públicas comiencen arriba al navegar.
- Los errores de red sean visibles para el usuario.
- Existan pruebas E2E para los flujos críticos.

---

# 11. Conclusión QA

El sistema **AcicaladosM** presenta una estructura funcional amplia y un flujo comercial bien definido, pero existen varios puntos donde la interfaz puede asumir que una operación fue exitosa antes de que la persistencia haya sido confirmada.

Desde QA, el principal riesgo actual no está únicamente en la apariencia visual, sino en la **consistencia entre frontend y backend**.

Los puntos más sensibles son:

```text
Reserva local ≠ Reserva real
Voucher visible ≠ Voucher persistente
Prenda activa ≠ Prenda disponible
Cantidad en carrito ≠ Stock real
Reserva cancelada ≠ Horario liberado
Mensaje enviado ≠ Número oficial correcto
```

La prioridad debe ser reforzar:

1. Persistencia.
2. Estados de negocio.
3. Validaciones finales.
4. Manejo de errores.
5. Trazabilidad del cliente.
6. Pruebas automatizadas.
7. Regresión de los flujos críticos.

Con estas correcciones el sistema pasaría de un flujo principalmente funcional en interfaz a un comportamiento más confiable para una operación real en producción.

---

## Documento preparado con enfoque QA

**Perfil de análisis:** Quality Assurance / Functional Testing / Integration Testing / Software Quality  
**Proyecto:** AcicaladosM
