# Ayah's Dry Clean and Laundry

A lightweight, robust, and scalable transaction logging and management system for laundry and dry cleaning operations in the Philippines.

Designed specifically for counter staff with intuitive touch controls, automated timestamping, and a dedicated BIR records view.

---

## 🚀 Features

- **Intuitive Counter Intake (Laundry Log View)**:
  - Big, touch-friendly inputs designed for less computer-literate staff.
  - **100% Automated Date & Time**: Intake timestamp and payment timestamp are captured automatically in Philippine Standard Time (`Asia/Manila`, UTC+8). Zero manual date/time inputs required.
  - **Returning Customer Autocomplete**: Auto-suggests repeat customers to speed up order creation.
  - **Sticky Bottom Bar**: Displays `Collected Today: ₱X,XXX` at all times.
  - **Clean Workspace**: Permanent deletion from the staff view keeps the daily log tidy.

- **Dedicated BIR & Financial Records View**:
  - Independent accounting and tax compliance view, separated from daily counter logging.
  - **Annual Business Recap**: Real-time sales breakdown (Today, This Week, This Month, and Full Year / YTD) covering Gross Sales, Collected Cash, Receivables, Total Laundry Volume (kg), and Deleted/Voided receipts.
  - **Multi-Year Support**: Switch between calendar years (`2026`, `2025`, etc.) with a single click.
  - **Audit Preservation**: Deleted logs are permanently preserved in Google Sheets and visible in the BIR tab marked as `[DELETED]` with mandatory reason and timestamp, guaranteeing uninterrupted sequential numbering for BIR audits.
  - **1-Click BIR CSV Export**: Download an audit-ready CSV file formatted for Microsoft Excel.

- **Printable Receipts / Invoices**:
  - Automated receipt generation for every transaction.
  - Supports both **Standard A4 / Letter Paper** and **POS Thermal Roll Printers (80mm & 58mm)**.
  - Configurable business name, TIN, address, and phone number in settings.

- **Google Sheets as Cloud Database**:
  - Automatically provisions dedicated tabs per calendar year (e.g. `2026`).
  - Automatic daily, weekly, monthly, and yearly sales totals.
  - Complete zero-failure offline fallback using `localStorage`.

---

## ☁️ Google Sheets Backend Setup (`code.gs`)

1. Open your [Google Sheets](https://sheets.google.com/) spreadsheet.
2. In the menu bar, go to **Extensions → Apps Script**.
3. Delete any default code in the editor and copy-paste the entire contents of [`code.gs`](file:///c:/Users/Admin/Documents/Code%20Projects/Ayah-s-Dry-Clean-and-Laundry/code.gs).
4. Click **Save** (💾 icon).
5. In the top right, click **Deploy → New deployment**.
6. Click the gear icon next to "Select type" and choose **Web app**.
7. Fill in:
   - **Description**: `Ayah Laundry Database API`
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone` *(Crucial so GitHub Pages can sync without complex login)*
8. Click **Deploy**, review permissions, and grant access.
9. Copy the **Web app URL** (e.g., `https://script.google.com/macros/s/.../exec`).
10. In the Ayah Laundry app:
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
