export const DEFAULT_FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyDclVml6BewwOWG5PQrtKyi28mNFiHOR44",
  authDomain: "agua-correa-e8c6b.firebaseapp.com",
  projectId: "agua-correa-e8c6b",
  storageBucket: "agua-correa-e8c6b.firebasestorage.app",
  messagingSenderId: "734391391296",
  appId: "1:734391391296:web:8d6b04b87b74181552fba5",
  measurementId: "G-07VXHTFX6S",
});

export function resolveFirebaseConfig(env = {}) {
  const isAlternateProject = Boolean(env.VITE_FIREBASE_PROJECT_ID);
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  };
  const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID || (!isAlternateProject ? DEFAULT_FIREBASE_CONFIG.measurementId : null);
  return measurementId ? { ...config, measurementId } : config;
}
