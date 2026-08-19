## Why

Una visita puede hoy persistirse con una venta sin productos o por $0, y los cambios de visita, cliente, deuda y stock se escriben por separado. Un fallo de persistencia o dos repartidores operando a la vez pueden dejar registros operativos inconsistentes sin informar claramente a quien carga el reparto.

## What Changes

- Rechazar el guardado de una venta que no tenga al menos un producto con cantidad positiva y un total positivo.
- Guardar cada operación de visita y sus efectos asociados de forma atómica en Firestore cuando modifique visita, cliente, deuda y stock.
- Mostrar al usuario los errores de persistencia y conservar el formulario para que pueda corregir o reintentar la operación.
- Incorporar un marco de pruebas automatizadas y pruebas que cubran las validaciones y la integridad de las operaciones de visita.

## Capabilities

### New Capabilities
- `operational-integrity`: Validación de ventas, persistencia atómica de operaciones de reparto y comunicación de errores de guardado.
- `operational-integrity-testing`: Infraestructura y cobertura automatizada para los contratos de integridad operacional.

### Modified Capabilities

Ninguna. No existen especificaciones base en el proyecto.

## Impact

- Afecta `src/App.jsx`, especialmente el formulario de visita y sus escrituras Firestore de visitas, clientes, deudas y stock.
- Afecta las colecciones `${COLLECTION}_visitas`, `${COLLECTION}_clientes` y `${COLLECTION}_stock` de Firestore.
- Añade dependencias y scripts de desarrollo para ejecutar pruebas.
- No cambia el PIN administrado en el cliente, no añade autenticación y no modifica reglas de seguridad de Firestore.
