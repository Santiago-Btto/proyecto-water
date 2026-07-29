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
import { getFirestore } from "firebase/firestore";

export const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);

// Nombre de la colección de Firestore donde se guardan los datos del negocio.
// Si alguna vez querés usar el mismo proyecto de Firebase para otro reparto,
// cambiá este nombre para que no se mezclen los datos.
export const COLLECTION = "repartoAgua";
