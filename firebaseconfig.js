// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAYQk0sCfnXCh-tsyW_wSH6kGrUgfe1C1E",
  authDomain: "project911-43014.firebaseapp.com",
  projectId: "project911-43014",
  storageBucket: "project911-43014.firebasestorage.app",
  messagingSenderId: "1042862015013",
  appId: "1:1042862015013:web:6d4b78ae3697dbd72c35cc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);