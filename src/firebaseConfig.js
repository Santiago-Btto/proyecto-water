// ============================================================
// Configuración de Firebase (tus credenciales ya cargadas).
// Ahora también activa el modo sin conexión: Firestore guarda
// los datos en el celular y sincroniza solo cuando vuelve la señal.
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDclVml6BewwOWG5PQrtKyi28mNFiHOR44",
  authDomain: "agua-correa-e8c6b.firebaseapp.com",
  projectId: "agua-correa-e8c6b",
  storageBucket: "agua-correa-e8c6b.firebasestorage.app",
  messagingSenderId: "734391391296",
  appId: "1:734391391296:web:8d6b04b87b74181552fba5",
  measurementId: "G-07VXHTFX6S"
};

import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

export const firebaseApp = initializeApp(firebaseConfig);

// initializeFirestore con persistentLocalCache = guarda una copia local
// (IndexedDB) en el celular. Si el repartidor se queda sin señal, puede
// seguir marcando ventas normalmente; en cuanto vuelve la conexión,
// Firestore sincroniza todo solo, sin que nadie tenga que hacer nada.
// persistentMultipleTabManager permite tener la app abierta en más de
// una pestaña/ventana del mismo celular sin que se pisen entre sí.
export const firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Nombre base de la colección de Firestore donde se guardan los datos
// del negocio. Si alguna vez querés usar el mismo proyecto de Firebase
// para otro reparto, cambiá este nombre para que no se mezclen los datos.
export const COLLECTION = "repartoAgua";
