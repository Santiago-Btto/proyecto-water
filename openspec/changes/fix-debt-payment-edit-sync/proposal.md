## Why

Al editar una visita previa para quitar un fiado y registrar el cobro de deuda anterior por Mercado Pago, el saldo `deudaAcumulada` del cliente no se recalcula. Esto deja incorrecto el indicador operativo "Plata en la calle" aunque la visita editada muestre el nuevo cobro.

## What Changes

- Encaminar los guardados de visitas, incluidas sus ediciones, por el helper transaccional `saveVisitAtomically` ya existente.
- Eliminar del flujo de visita la persistencia no atómica basada en `mutate` y el ajuste de stock separado, para que visita, cliente y stock aplicable compartan el resultado de la transacción.
- Devolver el resultado `{ ok, error? }` del guardado a `VisitaSheet` para que cierre únicamente ante éxito y conserve el formulario ante error.
- Añadir cobertura TDD estricta para editar una visita con fiado y sustituirla por un cobro de deuda anterior con Mercado Pago, verificando el saldo acumulado resultante.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `operational-integrity`: Las ediciones de visita deben invocar la persistencia atómica y propagar su resultado al formulario, preservando correctamente los efectos de deuda y stock.
- `operational-integrity-testing`: La cobertura automatizada debe incluir la regresión de reemplazar un fiado por un cobro de deuda anterior mediante Mercado Pago.

## Impact

- Afecta la integración de `guardarVisita` y `VisitaSheet` en `src/App.jsx`.
- Reutiliza `src/operationalIntegrity.js` y su transacción Firestore existente; puede extender sus pruebas en `src/operationalIntegrity.test.js` y/o añadir una prueba de integración enfocada.
- Afecta las colecciones `${COLLECTION}_visitas`, `${COLLECTION}_clientes` y, cuando el stock está activo, `${COLLECTION}_stock`.
- No modifica autenticación, PIN administrativo ni reglas de seguridad de Firestore.
