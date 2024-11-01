import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA1NgJzOiq5fvshuLlOAPwfQNzyRDa57gA",
  authDomain: "dream-factory-f31d0.firebaseapp.com",
  projectId: "dream-factory-f31d0",
  storageBucket: "dream-factory-f31d0.firebasestorage.app",
  messagingSenderId: "349046566545",
  appId: "1:349046566545:web:78fc5a4169490bf5621930",
  measurementId: "G-48G3B4K0Q6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

export default app; 