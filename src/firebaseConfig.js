// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDclVml6BewwOWG5PQrtKyi28mNFiHOR44",
  authDomain: "agua-correa-e8c6b.firebaseapp.com",
  projectId: "agua-correa-e8c6b",
  storageBucket: "agua-correa-e8c6b.firebasestorage.app",
  messagingSenderId: "734391391296",
  appId: "1:734391391296:web:8d6b04b87b74181552fba5",
  measurementId: "G-07VXHTFX6S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);