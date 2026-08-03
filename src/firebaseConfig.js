// ============================================================
// Configuración de Firebase.
// Firestore usa caché persistente para que la app pueda seguir
// funcionando sin conexión y sincronice cuando vuelva la señal.
// ============================================================
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDclVml6BewwOWG5PQrtKyi28mNFiHOR44",
  authDomain: "agua-correa-e8c6b.firebaseapp.com",
  projectId: "agua-correa-e8c6b",
  storageBucket: "agua-correa-e8c6b.firebasestorage.app",
  messagingSenderId: "734391391296",
  appId: "1:734391391296:web:8d6b04b87b74181552fba5",
  measurementId: "G-07VXHTFX6S",
};

export const firebaseApp = initializeApp(firebaseConfig);

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
