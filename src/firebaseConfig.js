// ============================================================
// Configuración de Firebase.
// Firestore usa caché persistente para que la app pueda seguir
// funcionando sin conexión y sincronice cuando vuelva la señal.
// ============================================================
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { resolveFirebaseConfig } from "./firebaseProjectConfig";

export const firebaseConfig = resolveFirebaseConfig(import.meta.env);

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

export const firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Colección base del negocio. La app crea, entre otras:
// repartoAgua_clientes
// repartoAgua_visitas
// repartoAgua_gastos
// repartoAgua_stock
// y el documento repartoAgua/config
export const COLLECTION = "repartoAgua";
