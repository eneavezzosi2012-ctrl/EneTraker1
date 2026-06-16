import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSd2ebsThrqKcIEDl3AR1Rh-4b0RXLro0",
  authDomain: "enea-traker.firebaseapp.com",
  databaseURL: "https://enea-traker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "enea-traker",
  storageBucket: "enea-traker.firebasestorage.app",
  messagingSenderId: "398697700448",
  appId: "1:398697700448:web:8351e723f0accc36fcf705",
  measurementId: "G-67D99Z6G8M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
window.__firestore = db;
window.__fbHelpers = { doc, getDoc, setDoc, deleteDoc, collection, getDocs };
window.__fbReady = true;
window.dispatchEvent(new Event("fb-ready"));
