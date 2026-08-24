## Why

Los clientes con maquina de frio/calor necesitan una oferta mensual que incluya el alquiler y una cantidad definida de bidones x20L, sin perder trazabilidad de cobros, entregas, deuda, stock ni el funcionamiento offline del reparto. Hoy cada bidon se vende de forma individual y no existe un registro mensual inmutable que permita controlar cupo, vencimiento y atribucion reversible de visitas.

## What Changes

- Incorporar promociones mensuales administrables exclusivamente para clientes con `maquinaFrioCalor`, con cupos fijos de 4, 6, 8 o 10 bidones x20L y precio total mensual configurable que incluye alquiler.
- Permitir que el cliente elija una promocion entre los dias 1 y 10, crear un registro mensual durable con instantaneas de promocion, precio y cupo, y bloquear cambios de promocion durante el periodo.
- Permitir entregas antes del pago hasta el cupo contratado; atribuir cada x20 entregado a la suscripcion y vender cualquier excedente al precio unitario corriente mediante el flujo de venta existente.
- Integrar el pago total de la suscripcion con los metodos de pago existentes, marcarla vencida desde el dia 16 y no habilitar el periodo siguiente mientras exista una suscripcion impaga vencida.
- Hacer reversibles los efectos de cuota al editar o eliminar visitas y preservar los indicadores existentes de ventas, deuda y stock, con indicadores separados para suscripciones cuando corresponda.
- Mantener la ruta local offline-first de mutaciones y la sincronizacion posterior, sin usar Firestore `runTransaction`, sin cambiar autenticacion ni reglas de seguridad.
- Definir comportamiento por defecto para clientes existentes con maquina de frio/calor sin suscripcion y una migracion manual, aditiva y no destructiva.
- Añadir tareas de TDD estricto y verificaciones manuales de operacion offline y reconexion.

## Capabilities

### New Capabilities
- `dispenser-subscriptions`: Administracion, contratacion, cobro, vencimiento y control mensual de promociones de bidones x20L para clientes con maquina de frio/calor.

### Modified Capabilities
- `operational-integrity`: Las visitas deben atribuir y revertir de forma coherente los bidones x20L cubiertos por una suscripcion mensual, manteniendo los efectos existentes de ventas, deuda y stock en la mutacion local offline-first.

## Impact

- Afecta la administracion de promociones, clientes con `maquinaFrioCalor`, resumenes operativos y el formulario de visita en `src/App.jsx`, con logica de dominio y pruebas enfocadas adicionales.
- Añade documentos de datos de promociones y suscripciones mensuales, y campos de resumen de suscripcion en clientes; conserva las colecciones y metricas existentes de visitas, ventas, deuda y stock.
- Usa los metodos de pago existentes para el cobro de suscripcion, sin cambiar autenticacion, PIN administrativo ni reglas de seguridad de Firestore.
- Requiere una migracion manual y reversible por lotes pequeños para datos existentes; no realiza escrituras destructivas ni automaticas al desplegar.
