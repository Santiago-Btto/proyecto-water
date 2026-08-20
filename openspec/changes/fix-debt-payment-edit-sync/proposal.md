## Why

Al editar una visita previa para quitar un fiado y registrar el cobro de deuda anterior por Mercado Pago, el saldo `deudaAcumulada` del cliente no se recalcula. Esto deja incorrecto el indicador operativo "Plata en la calle" aunque la visita editada muestre el nuevo cobro.

## What Changes

- Conservar y corregir la ruta offline-first de guardado basada en `mutate` y la cache local persistente; el flujo de guardado de visitas NO DEBE usar Firestore `runTransaction`.
- Aplicar la visita editada y el cliente recalculado dentro de la misma mutacion local, para que ambos resultados sean visibles juntos en el estado local y queden pendientes de sincronizacion cuando no haya conexion.
- Devolver el resultado `{ ok, error? }` del guardado a `VisitaSheet` para que cierre únicamente ante éxito y conserve el formulario ante error.
- Mostrar los errores de venta inválida y de persistencia junto al botón fijo "Guardar visita", incluyendo orientación accionable cuando el guardado falle por conectividad.
- Recuperar siempre el estado de envío del formulario con `try`/`catch`/`finally`, incluso si el callback de guardado lanza una excepción.
- Investigar y cubrir la regresión reportada donde vender fiado un bidón x20 válido aparenta no ejecutar ninguna acción, sin relajar las reglas de validación de ventas.
- Añadir cobertura TDD estricta para editar una visita con fiado de $500 y sustituirla por un cobro de deuda anterior de $1000 por Mercado Pago, verificando el estado local y que tanto la deuda acumulada como "Plata en la calle" terminan en $0.
- Verificar manualmente el guardado offline y su posterior reconexion, sin requerir una transaccion del servidor.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `operational-integrity`: Las ediciones de visita deben actualizar en una unica mutacion local persistente la visita y el saldo del cliente, propagar su resultado al formulario y preservar correctamente los efectos de deuda y stock; los fallos de validacion o guardado deben quedar visibles y recuperables en el formulario.
- `operational-integrity-testing`: La cobertura TDD debe incluir la regresion de reemplazar un fiado por un cobro de deuda anterior mediante Mercado Pago, el estado local y total de deuda resultantes, la verificacion manual offline/reconexion y el caso valido de un bidon x20 fiado.

## Impact

- Afecta la integración de `guardarVisita` y `VisitaSheet` en `src/App.jsx`, incluido el estado y los mensajes de guardado del formulario.
- Afecta la ruta de guardado de visitas y su logica local asociada en `src/App.jsx`; puede extender sus pruebas enfocadas sin introducir pruebas que dependan de Firestore remoto.
- Afecta las colecciones `${COLLECTION}_visitas`, `${COLLECTION}_clientes` y, cuando el stock está activo, `${COLLECTION}_stock`.
- No modifica autenticacion, PIN administrativo ni reglas de seguridad de Firestore, y no introduce `runTransaction` en la ruta de guardado de visitas.
