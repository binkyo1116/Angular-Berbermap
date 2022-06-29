// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAKd1BYqyk8kYGfpxBKt_WdsRMgcUzp7Gw',
  authDomain: 'berbermap.firebaseapp.com',
  projectId: 'berbermap',
  storageBucket: 'berbermap.appspot.com',
  messagingSenderId: '68173930158',
  appId: '1:68173930158:web:e06af9043722cf00b8973f',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
