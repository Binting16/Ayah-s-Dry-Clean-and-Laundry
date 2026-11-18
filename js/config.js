// Firebase configuration — replace with credentials from Firebase Console
export const FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

// Application Constants
export const STATUS_FLOW = ["Received", "Ongoing", "Finished", "Released"];
export const SERVICE_TYPES = ["regular", "express"];

export const DEFAULT_SETTINGS = {
  rateRegular: 20,
  rateExpress: 35,
  minWeight: 5,
  counter: 0,
  businessName: "Ayah's Dry Clean and Laundry",
  businessAddress: "Your Address Here",
  businessTIN: "000-000-000-000",
  businessPhone: "0900 000 0000",
  printMode: "a4" // 'a4' | 'thermal-80' | 'thermal-58'
};

export const STORAGE_PREFIX = "ayah-laundry";

export const VOID_REASONS = [
  "Wrong entry",
  "Customer cancelled",
  "Duplicate record",
  "Customer changed mind",
  "Other"
];
