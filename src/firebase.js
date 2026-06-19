
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyAsSS5Tm6QdgaLkDE0mLCO8eJfIk0WjOrE",
  authDomain: "oncowispr.firebaseapp.com",
  projectId: "oncowispr",
  storageBucket: "oncowispr.firebasestorage.app",
  messagingSenderId: "945429606753",
  appId: "1:945429606753:web:6f13dfcba4c8d0c2591520",
  measurementId: "G-9517PTGTG3"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);