// Google Apps Script Web App URL — deploy code.gs in Google Sheets and paste URL here
// Can also be configured directly in the app's Settings drawer without touching code!
export const GOOGLE_SHEETS_WEBAPP_URL = "REPLACE_ME_WITH_APPS_SCRIPT_WEBAPP_URL";

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
  printMode: "a4", // 'a4' | 'thermal-80' | 'thermal-58'
  googleSheetsUrl: ""
};

export const STORAGE_PREFIX = "ayah-laundry";

export const DELETE_REASONS = [
  "Staff entry mistake",
  "Customer cancelled order",
  "Duplicate entry",
  "Pricing correction",
  "Customer changed mind",
  "Other"
];
