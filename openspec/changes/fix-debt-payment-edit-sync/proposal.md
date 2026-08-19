## Why

Al editar una visita previa para quitar un fiado y registrar el cobro de deuda anterior por Mercado Pago, el saldo `deudaAcumulada` del cliente no se recalcula. Esto deja incorrecto el indicador operativo "Plata en la calle" aunque la visita editada muestre el nuevo cobro.

## What Changes

- Encaminar los guardados de visitas, incluidas sus ediciones, por el helper transaccional `saveVisitAtomically` ya existente.
- Eliminar del flujo de visita la persistencia no atómica basada en `mutate` y el ajuste de stock separado, para que visita, cliente y stock aplicable compartan el resultado de la transacción.
- Devolver el resultado `{ ok, error? }` del guardado a `VisitaSheet` para que cierre únicamente ante éxito y conserve el formulario ante error.
- Mostrar los errores de venta inválida y de persistencia junto al botón fijo "Guardar visita", incluyendo orientación accionable cuando el guardado falle por conectividad.
- Recuperar siempre el estado de envío del formulario con `try`/`catch`/`finally`, incluso si el callback de guardado lanza una excepción.
- Investigar y cubrir la regresión reportada donde vender fiado un bidón x20 válido aparenta no ejecutar ninguna acción, sin relajar las reglas de validación de ventas.
- Añadir cobertura TDD estricta para editar una visita con fiado y sustituirla por un cobro de deuda anterior con Mercado Pago, verificando el saldo acumulado resultante.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `operational-integrity`: Las ediciones de visita deben invocar la persistencia atómica y propagar su resultado al formulario, preservando correctamente los efectos de deuda y stock; los fallos de validación o guardado deben quedar visibles y recuperables en el formulario.
- `operational-integrity-testing`: La cobertura automatizada debe incluir la regresión de reemplazar un fiado por un cobro de deuda anterior mediante Mercado Pago y el caso válido de un bidón x20 fiado.

## Impact

- Afecta la integración de `guardarVisita` y `VisitaSheet` en `src/App.jsx`, incluido el estado y los mensajes de guardado del formulario.
- Reutiliza `src/operationalIntegrity.js` y su transacción Firestore existente; puede extender sus pruebas en `src/operationalIntegrity.test.js` y/o añadir una prueba de integración enfocada.
- Afecta las colecciones `${COLLECTION}_visitas`, `${COLLECTION}_clientes` y, cuando el stock está activo, `${COLLECTION}_stock`.
- No modifica autenticación, PIN administrativo ni reglas de seguridad de Firestore.
