import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDBim2oF5MbNEA_2tCuLAHiaFbuOFBpoWI",
  authDomain: "lr-zeinali-dehaghani.firebaseapp.com",
  databaseURL: "https://lr-zeinali-dehaghani-default-rtdb.firebaseio.com",
  projectId: "lr-zeinali-dehaghani",
  storageBucket: "lr-zeinali-dehaghani.firebasestorage.app",
  messagingSenderId: "992450233846",
  appId: "1:992450233846:web:148cf439c94e12160fb3d7",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);