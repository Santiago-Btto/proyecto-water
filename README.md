# Reparto de Agua

Aplicación web para administrar un reparto de agua desde el celular o la computadora. Permite que administración y repartidores trabajen sobre los mismos datos, con sincronización en tiempo real y funcionamiento sin conexión temporal.

## Qué permite hacer

- Gestionar clientes, direcciones, teléfonos y días de visita.
- Organizar el recorrido diario de cada repartidor.
- Registrar ventas, cobros, fiado, gastos y movimientos de deuda.
- Controlar envases permanentes, envases prestados y stock por repartidor.
- Consultar historial de visitas, caja y métricas del reparto.
- Administrar promociones y suscripciones de bidones de 20 L.
- Exportar clientes, visitas y gastos a CSV.
- Instalar la aplicación como PWA en Android.

## Tecnologías

- React 18 + Vite
- Firebase Firestore, con caché local persistente
- Tailwind CSS
- Vitest
- PWA mediante `vite-plugin-pwa`

## Requisitos

- Node.js 18 o superior.
- Un proyecto de Firebase con Firestore habilitado.
- Una cuenta de Vercel, si se desea publicar la aplicación.

## Ejecutar el proyecto localmente

```bash
npm install
npm run dev
```

Abrí la dirección que muestre Vite, normalmente `http://localhost:5173`.

Para ejecutar las pruebas:

```bash
npm test
```

Para crear la versión de producción:

```bash
npm run build
```

El resultado se genera en `dist/`.

## Configurar Firebase

1. Creá un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. En **Firestore Database**, creá una base de datos en una región cercana, por ejemplo `southamerica-east1`.
3. Registrá una aplicación web desde **Configuración del proyecto → Tus apps → Web**.
4. Copiá la configuración de Firebase en [`src/firebaseConfig.js`](src/firebaseConfig.js).
5. Confirmá que Firestore esté habilitado antes de abrir la app.
6. En **Authentication → Sign-in method**, habilitá **Correo electrónico/Contraseña**.
7. En **Authentication → Users**, creá una sola cuenta compartida para el negocio. La app pedirá ese correo y contraseña antes de mostrar los perfiles.

La app usa estas colecciones principales:

- `repartoAgua_clientes`
- `repartoAgua_visitas`
- `repartoAgua_gastos`
- `repartoAgua_stock`
- `repartoAgua_promotions`
- `repartoAgua_subscriptions`
- `repartoAgua/config`

## Seguridad de Firestore

La app exige iniciar sesión por correo y contraseña antes de cargar datos. Después del acceso se muestran los perfiles de Administrador y repartidores; el PIN de administrador sigue siendo una segunda protección dentro de la aplicación.

Para que la protección también exista en la base de datos, publicá las reglas incluidas en [`firestore.rules`](firestore.rules):

1. Abrí **Firestore Database → Rules** en Firebase Console.
2. Reemplazá el contenido por el de `firestore.rules` y elegí **Publish**.

Esas reglas bloquean toda lectura y escritura de las colecciones de reparto si no hay una sesión iniciada. No publiques reglas como `allow read, write: if true`.

También es recomendable restringir la clave de API desde Google Cloud Console a los dominios donde se publique la aplicación.

## Desplegar en Vercel

1. Subí este repositorio a GitHub, incluyendo `src/`, `public/`, `package.json` y `vite.config.js`.
2. En [Vercel](https://vercel.com/), elegí **Add New → Project** e importá el repositorio.
3. Vercel detectará Vite automáticamente. Si necesitás configurarlo manualmente:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Publicá el proyecto y verificá que la aplicación pueda conectarse a Firestore.

## Instalarla en Android

1. Abrí la URL publicada en Chrome.
2. Tocá el menú de Chrome (⋮).
3. Elegí **Instalar aplicación** o **Agregar a pantalla de inicio**.

La app quedará disponible como un acceso directo y conservará los cambios pendientes cuando el teléfono se quede sin señal; Firestore los sincroniza al recuperar conexión.

## Solución de problemas

| Problema | Qué revisar |
| --- | --- |
| No se puede conectar a la base de datos | La configuración de `src/firebaseConfig.js`, Firestore habilitado y las reglas de acceso. |
| No se actualizan los datos entre celulares | Que ambos usen la misma URL publicada y el mismo proyecto de Firebase. |
| Error 404 en Vercel | Que `package.json` y `vite.config.js` estén en la raíz del repositorio. |
| El build falla | Ejecutá `npm install` nuevamente y comprobá que usás Node.js 18 o superior. |

## Estructura relevante

```text
src/
├── App.jsx                       # Interfaz y flujo principal
├── firebaseConfig.js             # Conexión con Firebase
├── operationalIntegrity.js       # Reglas de visitas, deuda y stock
├── dispenserSubscriptions.js     # Promociones y suscripciones
└── *.test.js                     # Pruebas de la lógica de negocio
```

## Próximas mejoras recomendadas

- Incorporar autenticación real y permisos por rol en Firestore.
- Mantener las operaciones de una visita en una transacción para evitar conflictos entre celulares.
- Separar las pantallas y componentes de `App.jsx` en archivos más pequeños.
