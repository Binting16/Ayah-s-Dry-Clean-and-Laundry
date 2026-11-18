# Ayah's Dry Clean and Laundry

> **"Wash, dry, fold, repeat."**

A lightweight, robust, and scalable transaction logging and management system for laundry and dry cleaning operations in the Philippines.

Designed specifically for counter staff with intuitive touch controls, automated timestamping, and a dedicated BIR records view.

---

## 🚀 Features

- **Intuitive Counter Intake (Laundry Log View)**:
  - Big, touch-friendly inputs designed for less computer-literate staff.
  - **Live Customer Total Banner**: Large real-time price preview (`TOTAL TO PAY: ₱150 · 7.5 kg × ₱20/kg`) visible to customers standing at the counter.
  - **100% Automated Date & Time**: Intake timestamp and payment timestamp are captured automatically in Philippine Standard Time (`Asia/Manila`, UTC+8). Zero manual date/time inputs required.
  - **Returning Customer Autocomplete**: Auto-suggests repeat customers to speed up order creation.
  - **Year-Prefixed Receipt Codes**: Formatted as `26-A1`, `26-A2` ... `26-A999`, `26-B1`. Automatically rolls over to `27-A1` on New Year.
  - **Clean Workspace**: Permanent deletion from the staff view keeps the daily log tidy.

- **Customer Privacy & Shift Management (Settings Drawer ⚙️)**:
  - Daily collections are kept **strictly private** inside the Settings drawer so customers looking over the counter cannot see shop revenues.
  - **Daily Shift & Cash Drawer Reconciliation**: Displays `Collected Today`, `Petty Cash Out`, and `Net Cash in Drawer`.
  - **Cash In & Out (Petty Cash & Delivery Tracker)**: Log rider delivery fees, Shopee/Lazada parcels, gas refills, and detergent purchases with notes.
  - **Testing & Reset Tools**: Dedicated `Clear All Test Data` button and `Reset Code Counter` control to easily wipe test transactions before opening.

- **Dedicated BIR & Financial Records View**:
  - Independent accounting and tax compliance view, hidden securely inside Settings away from counter customers.
  - **Annual Business Recap**: Real-time sales breakdown (Today, This Week, This Month, and Full Year / YTD) covering Gross Sales, Collected Cash, Receivables, Total Laundry Volume (kg), and Deleted/Voided receipts.
  - **Multi-Year Support**: Switch between calendar years (`2026`, `2025`, etc.) with a single click.
  - **Audit Preservation & Hard Purge**: Deleted logs are permanently preserved in Google Sheets with reason and timestamp. Includes individual **"🗑️ Purge"** buttons to permanently erase test rows when desired.
  - **1-Click BIR CSV Export**: Download an audit-ready CSV file formatted for Microsoft Excel with UTF-8 BOM encoding.

- **Printable Receipts / Invoices**:
  - Automated receipt generation for every transaction.
  - Supports both **Standard A4 / Letter Paper** and **POS Thermal Roll Printers (80mm & 58mm)**.
  - **GCash & Maya Digital Payments**: Automatically includes GCash / Maya account details on receipts for easy cashless payments.
  - Configurable business name, TIN, address, and phone number in settings.

- **Google Sheets as Cloud Database**:
  - Automatically provisions dedicated tabs per calendar year (e.g. `2026`) and `Cashflow`.
  - Automatic daily, weekly, monthly, and yearly sales totals.
  - Complete zero-failure offline fallback using `localStorage`.

---

## ☁️ Google Sheets Backend Setup (`code.gs`)

1. Open your [Google Sheets](https://sheets.google.com/) spreadsheet.
2. In the menu bar, go to **Extensions → Apps Script**.
3. Delete any default code in the editor and copy-paste the entire contents of [`code.gs`](file:///c:/Users/Admin/Documents/Code%20Projects/Ayah-s-Dry-Clean-and-Laundry/code.gs).
4. Click **Save** (💾 icon).
5. In the top right, click **Deploy → New deployment**.
6. Click the gear icon next to "Select type" and choose **Web app**:
   - **Description**: `Ayah Laundry Database API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` *(Crucial so GitHub Pages can sync without complex login)*
7. Click **Deploy**, review permissions, and grant access.
8. Copy the **Web app URL** (e.g., `https://script.google.com/macros/s/.../exec`).
9. In the Ayah Laundry app:
    - Click **Settings (⚙️)** in the top right.
    - Paste the URL into **Apps Script Web App URL** and it saves automatically!
    - *(Alternatively, paste it into `js/config.js` as `GOOGLE_SHEETS_WEBAPP_URL`)*.

---

## 🖨️ Thermal Receipt Printing Setup

1. Click **Settings (⚙️)** in the top right.
2. Under **Printing Preferences**, select:
   - **Standard A4 / Letter Paper**
   - **Thermal POS (80mm width)**
   - **Thermal POS (58mm width)**
3. When viewing any transaction, click **🖨️ Print Receipt**.
4. In the browser print dialog:
   - Set margins to **None** or **Minimum**.
   - Uncheck "Headers and Footers".

---

<p align="center">Made by Jan Vincent "Binting" Aningat</p>
