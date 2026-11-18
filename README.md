# Ayah's Dry Clean and Laundry

A lightweight, robust, and scalable transaction logging and management system for laundry and dry cleaning operations in the Philippines.

## 🚀 Features

- **Intuitive Interface**: Big, touch-friendly inputs and clear status updates designed for non-technical counter staff.
- **BIR-Ready Record Keeping**:
  - Implements soft-deletion (voiding with mandatory reasons) — preserves chronological sequence without broken code gaps.
  - Full audit trail (`createdAt`, `updatedAt`, `voidedAt`, `voidReason`).
  - One-click CSV export structured for BIR accounting audits.
- **Printable Receipts / Invoices**:
  - Automatic receipt generation for every transaction.
  - Supports regular paper (A4 / Letter) and POS thermal roll printers (80mm & 58mm).
  - Configurable business name, TIN, address, and phone number in settings.
- **Customer Auto-Suggest**: Remembers returning customers to speed up drop-offs.
- **Configurable Pricing & Minimums**: Dynamically set Regular / Express rates and minimum weight limit (e.g. 5kg) directly from the settings drawer without touching code.
- **Offline & Low-Bandwidth Resilient**:
  - Automatically runs in localStorage offline mode out of the box.
  - Seamlessly connects to Google Cloud Firebase Firestore for multi-device live sync and permanent backup.

---

## 🛠️ Project Structure

```
├── index.html                  # Main application shell
├── assets/                     # SVG icons & receipt logo
├── css/
│   ├── variables.css           # Color tokens, fonts & spacing
│   ├── base.css                # Base typography & resets
│   ├── layout.css              # App layout & header
│   ├── components.css          # Buttons, badges, toasts, modals & sidebar
│   ├── form.css                # Drop-off form & autocomplete
│   ├── table.css               # Transactions table & filters
│   ├── receipt.css             # Print styles (@media print)
│   └── responsive.css          # Tablet & mobile optimizations
└── js/
    ├── app.js                  # Main app bootstrap
    ├── config.js               # Firebase credentials & defaults
    ├── db.js                   # Unified DB layer (Firestore + localStorage)
    ├── state.js                # Reactive state manager
    ├── ui/                     # UI components (form, table, stats, receipt, etc.)
    └── utils/                  # Helpers (codes, dates, currency, validation, CSV)
```

---

## ☁️ Setting Up Cloud Sync (Firebase Firestore)

By default, the app runs locally in your browser. To enable multi-device sync (e.g. counter laptop + owner tablet) and permanent cloud backup for BIR:

1. Open [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Name your project (e.g., `ayahs-laundry`) and continue (disable Google Analytics if prompted).
3. In the sidebar under **Build**, click **Firestore Database** → **Create database**.
4. Choose **Start in production mode** and select the region **`asia-southeast1` (Singapore)**.
5. In the Firebase project overview, click the **Web icon `</>`** to register a web app.
6. Copy the `firebaseConfig` object and paste it into `js/config.js`:
   ```javascript
   export const FIREBASE_CONFIG = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
7. In Firestore Database under the **Rules** tab, set the rules:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
8. Save and publish the rules. Once configured, the app will automatically sync to Firestore!

---

## 🖨️ Receipt & Thermal Printing

1. Click the **⚙️ Settings** icon in the top right.
2. Under **Printing Preferences**, select your printer format:
   - **Standard A4 / Letter Paper**
   - **Thermal POS (80mm width)**
   - **Thermal POS (58mm width)**
3. When adding or viewing a transaction, click **🖨️ Print Receipt**.
4. In the browser print dialog:
   - For thermal printers: Set margins to **None** or **Minimum** and uncheck "Headers and Footers".
