# Ayah's Dry Clean & Laundry — Full Architecture & Implementation Spec (v2.2)

> **Purpose**: This document is a self-contained, complete blueprint for an AI model or software engineer to implement. It covers every file, schema, Google Apps Script backend (`code.gs`), frontend UI component, and state transition. No external context is required.

---

## 1. Executive Summary & Key Architectural Updates (v2.2)

### What Changed in v2.2:

1. **Brand Tagline & Developer Watermark**
   - Brand tagline updated across header and receipts:
     `Wash, dry, fold, repeat.` (replaces *"Track every drop-off, from Received to Released."*).
   - Discreet footer watermark at the bottom of the counter screen:
     `Made by Jan Vincent "Binting" Aningat`.

2. **Customer Privacy: Daily Collection Removed from Counter Screen**
   - The sticky bottom bar (`Collected Today: ₱X,XXX`) is **removed from the public counter screen** so customers standing at the counter cannot see shop revenues.
   - Transferred into the **Settings (⚙️) drawer** under a dedicated, private **"Daily Shift & Cash Summary"** section (and visible in the BIR & Financial view).

3. **Cash In & Out (Petty Cash & Delivery Expense Tracker)**
   - Since the laundry is home-based and staff/household handles parcel deliveries, rider fees, gas refills, and detergent purchases:
   - Added a **Cash Flow (In / Out)** logging tool accessible in Settings / Accounting:
     - Fields: **Type** (Cash In / Cash Out), **Amount (₱)**, **Category** (*Delivery / Parcel*, *Gas & Electricity*, *Detergent / Supplies*, *Household / Other*), **Notes / Reference**, and **Timestamp**.
     - Automatically logs to a dedicated `Cashflow` tab in Google Sheets and syncs with `localStorage`.
     - Displays net daily cash balance: `Collections + Cash In - Cash Out = Cash in Drawer`.

4. **GCash & Maya Payment Details on Receipts**
   - Settings includes optional fields:
     - `gcashName` and `gcashNumber` (e.g. `Ayah L. / 0917 123 4567`)
     - `mayaName` and `mayaNumber`
   - When configured, printable receipts include a clean digital payment box:
     ```
     ─────────────────────────────
     GCash / Maya Payments:
     GCash: 0917 123 4567 (Ayah L.)
     ─────────────────────────────
     ```

5. **Customer-Facing Live Total Display (Drop-off Form)**
   - High-contrast, large-type **Live Total Banner** directly on the intake form:
     ```
     ┌────────────────────────────────────────────────────────┐
     │  TOTAL TO PAY:  ₱150                                   │
     │  7.5 kg × ₱20/kg · Regular Service                     │
     └────────────────────────────────────────────────────────┘
     ```
   - Automatically computes as staff types the weight or switches service type, giving customers clear, transparent pricing.

6. **Year-Prefixed Transaction Codes (`YY-A1`, e.g., `26-A1`)**
   - Sequential codes incorporate the two-digit fiscal year:
     - 2026: `26-A1` through `26-A999`, then `26-B1` ...
     - 2027: Automatically rolls over and restarts at `27-A1`.
   - Settings provides a **Reset / Set Code Counter** tool to clear test counters.

7. **Discrete BIR & Financial Records Access**
   - No sensitive financial tabs visible on the main counter screen.
   - Accessed via **Settings (⚙️) → "📋 Open BIR & Financial Records"**.
   - Includes full annual/monthly recaps, master audit ledgers, CSV export, and individual **"🗑️ Purge"** / **"Clear All Test Data"** buttons.

8. **100% Automated Date & Time Timestamping**
   - Zero manual date or time entry on intake form; auto-stamped in Philippine Standard Time (`Asia/Manila`, UTC+8).

---

## 2. Technology Stack & Deployment

| Component | Technology | Rationale |
|---|---|---|
| Frontend Host | **GitHub Pages** (`https://binting16.github.io/`) | Static hosting, free, fast, zero build step |
| Frontend Architecture | Vanilla JS (ES Modules), HTML5, CSS3 | Native browser execution, no npm/bundler required |
| Primary Database | **Google Sheets + Google Apps Script (`code.gs`)** | Free, permanent cloud storage, direct spreadsheet access for accountant, no credit card required |
| Offline Fallback | Browser `localStorage` | Guarantees intake continues during Philippine internet outages |
| Receipt Printing | CSS `@media print` + Thermal Mode | Direct support for Standard A4/Letter and POS 58mm/80mm thermal rolls |

---

## 3. Google Apps Script Backend (`code.gs`)

### 3.1 Spreadsheet Tabs

1. **Yearly Order Tabs (`2026`, `2027`)**:
   `Code | Timestamp | Date | Time | Customer Name | Phone | Service | Weight (kg) | Rate (PHP) | Price (PHP) | Payment Status | Paid At | Order Status | Record Status | Delete Reason | Deleted At | Notes`
2. **`Cashflow` Tab**:
   `EntryID | Timestamp | Date | Time | Type (IN/OUT) | Amount (PHP) | Category | Notes`
3. **`Settings` Tab**:
   `Key | Value` (pricing, min weight, counter, business info, GCash/Maya info, Web App preferences)

---

### 3.2 Complete `code.gs` Source Code

```javascript
/**
 * Ayah's Dry Clean and Laundry — Google Apps Script Backend (code.gs)
 * Version: 2.2
 */

const TIMEZONE = "Asia/Manila";

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    const params = (e && e.parameter) || {};
    let postData = {};

    if (e && e.postData && e.postData.contents) {
      try { postData = JSON.parse(e.postData.contents); } catch (err) { postData = {}; }
    }

    const action = params.action || postData.action;
    let responseData = { success: false, error: "Invalid action" };

    switch (action) {
      case "ping":
        responseData = { success: true, message: "Ayah Laundry API is online", time: new Date() };
        break;

      case "getSettings":
        responseData = { success: true, settings: getSettings() };
        break;

      case "updateSettings":
        responseData = { success: true, settings: updateSettings(postData.settings || {}) };
        break;

      case "getTransactions":
        const year = params.year || postData.year || new Date().getFullYear();
        const includeDeleted = params.includeDeleted === "true" || postData.includeDeleted === true;
        responseData = { success: true, transactions: getTransactions(year, includeDeleted) };
        break;

      case "addTransaction":
        responseData = { success: true, transaction: addTransaction(postData.transaction || {}) };
        break;

      case "updateTransaction":
        responseData = { success: true, updated: updateTransaction(postData.code, postData.updates || {}) };
        break;

      case "deleteTransaction":
        responseData = { success: true, deleted: deleteTransaction(postData.code, postData.reason || "Staff deleted") };
        break;

      case "purgeTransaction":
        responseData = { success: true, purged: purgeTransaction(postData.code, postData.year) };
        break;

      case "clearTestData":
        responseData = { success: true, cleared: clearTestData(postData.year || new Date().getFullYear()) };
        break;

      case "getCashflow":
        responseData = { success: true, cashflow: getCashflow(params.limit || 100) };
        break;

      case "addCashflow":
        responseData = { success: true, entry: addCashflow(postData.entry || {}) };
        break;

      case "getRecap":
        const recapYear = params.year || postData.year || new Date().getFullYear();
        responseData = { success: true, recap: calculateRecap(recapYear) };
        break;

      default:
        responseData = { success: false, error: "Action not recognized: " + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// -----------------------------------------------------------------------------
// Sheet Provisioning
// -----------------------------------------------------------------------------

function getOrCreateYearSheet(year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = String(year);
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = [
      "Code", "Timestamp", "Date", "Time", "Customer Name", "Phone",
      "Service", "Weight (kg)", "Rate (PHP)", "Price (PHP)",
      "Payment Status", "Paid At", "Order Status", "Record Status",
      "Delete Reason", "Deleted At", "Notes"
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#1F6F78")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");

    sheet.setFrozenRows(1);
    for (let i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 130);
    }
  }

  return sheet;
}

function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Settings");

  if (!sheet) {
    sheet = ss.insertSheet("Settings");
    sheet.getRange(1, 1, 1, 2).setValues([["Key", "Value"]]);
    sheet.getRange(1, 1, 1, 2).setBackground("#1F6F78").setFontColor("#FFFFFF").setFontWeight("bold");

    const defaultSettings = [
      ["rateRegular", 20],
      ["rateExpress", 35],
      ["minWeight", 5],
      ["counter", 0],
      ["counterYear", new Date().getFullYear()],
      ["businessName", "Ayah's Dry Clean and Laundry"],
      ["businessAddress", "Your Address Here"],
      ["businessTIN", "000-000-000-000"],
      ["businessPhone", "0900 000 0000"],
      ["gcashName", ""],
      ["gcashNumber", ""],
      ["mayaName", ""],
      ["mayaNumber", ""],
      ["printMode", "a4"]
    ];

    sheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
  }

  return sheet;
}

function getOrCreateCashflowSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Cashflow");

  if (!sheet) {
    sheet = ss.insertSheet("Cashflow");
    const headers = ["EntryID", "Timestamp", "Date", "Time", "Type", "Amount (PHP)", "Category", "Notes"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#164F56").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
    for (let i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 140);
    }
  }

  return sheet;
}

// -----------------------------------------------------------------------------
// Settings Functions
// -----------------------------------------------------------------------------

function getSettings() {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  const settings = {};

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    let val = data[i][1];
    if (key === "counter" || key === "counterYear" || key === "rateRegular" || key === "rateExpress" || key === "minWeight") {
      val = Number(val) || 0;
    }
    settings[key] = val;
  }

  return settings;
}

function updateSettings(newSettings) {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  const keys = Object.keys(newSettings);

  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const val = newSettings[key];
    let found = false;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        sheet.getRange(i + 1, 2).setValue(val);
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([key, val]);
    }
  }

  return getSettings();
}

// -----------------------------------------------------------------------------
// Transaction Functions
// -----------------------------------------------------------------------------

function generateYearCode(year, counter) {
  const yy = String(year).slice(-2);
  const safeCounter = Math.max(1, parseInt(counter, 10) || 1);
  const block = Math.floor((safeCounter - 1) / 999) + 1;
  const number = ((safeCounter - 1) % 999) + 1;

  let s = '';
  let n = block;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }

  return yy + '-' + s + number;
}

function addTransaction(tx) {
  const settings = getSettings();
  const now = new Date();
  const currentYear = now.getFullYear();

  let nextCounter = Number(settings.counter) || 0;
  if (Number(settings.counterYear) !== currentYear) {
    nextCounter = 0;
  }
  nextCounter += 1;

  const code = tx.code || generateYearCode(currentYear, nextCounter);
  const sheet = getOrCreateYearSheet(currentYear);

  const dateStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");

  const isPaid = Boolean(tx.paid);
  const paidAtStr = isPaid
    ? (tx.paidAt ? Utilities.formatDate(new Date(tx.paidAt), TIMEZONE, "yyyy-MM-dd HH:mm:ss") : (dateStr + " " + timeStr))
    : "";

  const row = [
    code,
    now.getTime(),
    dateStr,
    timeStr,
    tx.name || "",
    tx.phone || "",
    tx.type === "express" ? "Express" : "Regular",
    Number(tx.weight) || 0,
    tx.type === "express" ? (settings.rateExpress || 35) : (settings.rateRegular || 20),
    Math.round(Number(tx.price)) || 0,
    isPaid ? "PAID" : "UNPAID",
    paidAtStr,
    tx.status || "Received",
    "ACTIVE",
    "",
    "",
    tx.notes || ""
  ];

  sheet.appendRow(row);
  updateSettings({ counter: nextCounter, counterYear: currentYear });

  return {
    code: code,
    createdAt: now.getTime(),
    date: dateStr,
    time: timeStr,
    name: tx.name,
    phone: tx.phone,
    type: tx.type,
    weight: tx.weight,
    price: tx.price,
    paid: isPaid,
    paidAt: isPaid ? now.getTime() : null,
    status: tx.status || "Received",
    recordStatus: "ACTIVE"
  };
}

function getTransactions(year, includeDeleted) {
  const sheet = getOrCreateYearSheet(year);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const recordStatus = String(row[13] || "ACTIVE").toUpperCase();

    if (!includeDeleted && recordStatus === "DELETED") continue;

    results.push({
      rowIndex: i + 1,
      code: String(row[0]),
      createdAt: Number(row[1]) || new Date(row[2] + " " + row[3]).getTime(),
      date: String(row[2]),
      time: String(row[3]),
      name: String(row[4]),
      phone: String(row[5]),
      type: String(row[6]).toLowerCase() === "express" ? "express" : "regular",
      weight: Number(row[7]),
      rate: Number(row[8]),
      price: Number(row[9]),
      paid: String(row[10]).toUpperCase() === "PAID",
      paidAt: row[11] ? new Date(row[11]).getTime() : null,
      status: String(row[12] || "Received"),
      recordStatus: recordStatus,
      deleteReason: String(row[14] || ""),
      deletedAt: row[15] ? new Date(row[15]).getTime() : null,
      notes: String(row[16] || "")
    });
  }

  return results.reverse();
}

function updateTransaction(identifier, updates) {
  const now = new Date();
  const year = now.getFullYear();
  const sheet = getOrCreateYearSheet(year);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(identifier)) {
      const rowIndex = i + 1;

      if (updates.status !== undefined) {
        sheet.getRange(rowIndex, 13).setValue(updates.status);
      }
      if (updates.paid !== undefined) {
        const isPaid = Boolean(updates.paid);
        sheet.getRange(rowIndex, 11).setValue(isPaid ? "PAID" : "UNPAID");
        const paidStr = isPaid ? Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss") : "";
        sheet.getRange(rowIndex, 12).setValue(paidStr);
      }
      if (updates.notes !== undefined) {
        sheet.getRange(rowIndex, 17).setValue(updates.notes);
      }

      return true;
    }
  }

  return false;
}

function deleteTransaction(identifier, reason) {
  const now = new Date();
  const year = now.getFullYear();
  const sheet = getOrCreateYearSheet(year);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(identifier)) {
      const rowIndex = i + 1;
      sheet.getRange(rowIndex, 14).setValue("DELETED");
      sheet.getRange(rowIndex, 15).setValue(reason || "Staff deleted");
      sheet.getRange(rowIndex, 16).setValue(Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
      return true;
    }
  }

  return false;
}

function purgeTransaction(code, year) {
  const targetYear = year || new Date().getFullYear();
  const sheet = getOrCreateYearSheet(targetYear);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(code)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }

  return false;
}

function clearTestData(year) {
  const sheet = getOrCreateYearSheet(year);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  updateSettings({ counter: 0, counterYear: year });
  return true;
}

// -----------------------------------------------------------------------------
// Cash Flow (Petty Cash, Deliveries & Expenses)
// -----------------------------------------------------------------------------

function addCashflow(entry) {
  const sheet = getOrCreateCashflowSheet();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, TIMEZONE, "HH:mm:ss");
  const entryId = "CF-" + now.getTime().toString(36).toUpperCase();

  const row = [
    entryId,
    now.getTime(),
    dateStr,
    timeStr,
    (entry.type || "OUT").toUpperCase(),
    Number(entry.amount) || 0,
    entry.category || "General",
    entry.notes || ""
  ];

  sheet.appendRow(row);

  return {
    entryId,
    createdAt: now.getTime(),
    date: dateStr,
    time: timeStr,
    type: (entry.type || "OUT").toUpperCase(),
    amount: Number(entry.amount) || 0,
    category: entry.category || "General",
    notes: entry.notes || ""
  };
}

function getCashflow(limit) {
  const sheet = getOrCreateCashflowSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    results.push({
      entryId: String(row[0]),
      createdAt: Number(row[1]),
      date: String(row[2]),
      time: String(row[3]),
      type: String(row[4]).toUpperCase(),
      amount: Number(row[5]) || 0,
      category: String(row[6]),
      notes: String(row[7])
    });
  }

  return results.reverse().slice(0, Number(limit) || 100);
}

// -----------------------------------------------------------------------------
// Recap Engine: Daily, Weekly, Monthly, and Annual Totals
// -----------------------------------------------------------------------------

function calculateRecap(year) {
  const sheet = getOrCreateYearSheet(year);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {
      daily: {},
      weekly: {},
      monthly: {},
      annual: { totalOrders: 0, totalWeight: 0, grossSales: 0, collected: 0, unpaid: 0, deleted: 0 }
    };
  }

  const annual = { totalOrders: 0, totalWeight: 0, grossSales: 0, collected: 0, unpaid: 0, deleted: 0 };
  const daily = {};
  const monthly = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr = String(row[2]);
    const monthStr = dateStr.substring(0, 7);
    const weight = Number(row[7]) || 0;
    const price = Number(row[9]) || 0;
    const isPaid = String(row[10]).toUpperCase() === "PAID";
    const isDeleted = String(row[13]).toUpperCase() === "DELETED";

    if (isDeleted) {
      annual.deleted++;
      continue;
    }

    annual.totalOrders++;
    annual.totalWeight += weight;
    annual.grossSales += price;
    if (isPaid) annual.collected += price;
    else annual.unpaid += price;

    if (!daily[dateStr]) daily[dateStr] = { orders: 0, weight: 0, sales: 0, collected: 0, unpaid: 0 };
    daily[dateStr].orders++;
    daily[dateStr].weight += weight;
    daily[dateStr].sales += price;
    if (isPaid) daily[dateStr].collected += price;
    else daily[dateStr].unpaid += price;

    if (!monthly[monthStr]) monthly[monthStr] = { orders: 0, weight: 0, sales: 0, collected: 0, unpaid: 0 };
    monthly[monthStr].orders++;
    monthly[monthStr].weight += weight;
    monthly[monthStr].sales += price;
    if (isPaid) monthly[monthStr].collected += price;
    else monthly[monthStr].unpaid += price;
  }

  return { daily, monthly, annual };
}
```

---

## 4. UI Layout Blueprint (Customer-Facing & Clean)

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER                                                 ⚙️   │
│  [Logo] Ayah's Dry Clean and Laundry                         │
│  Wash, dry, fold, repeat.                                    │
├──────────────────────────────────────────────────────────────┤
│  NEW DROP-OFF FORM                                  [panel]  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  CUSTOMER LIVE TOTAL BANNER                            │  │
│  │  TOTAL TO PAY:  ₱150                                   │  │
│  │  7.5 kg × ₱20/kg · Regular Service                     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────┐ ┌───────────┐  │
│  │ Customer Name│ │  Cellphone   │ │ Weight │ │  Service  │  │
│  └──────────────┘ └──────────────┘ └────────┘ └───────────┘  │
│  ┌──────────────┐ ┌──────────────┐                           │
│  │  Price (₱)   │ │Payment Status│   [ + Add Transaction ]   │
│  └──────────────┘ └──────────────┘                           │
├──────────────────────────────────────────────────────────────┤
│  TRANSACTIONS TABLE                                 [panel]  │
│  [Active Orders (12)]   [Released Orders (45)]               │
│  ┌───────────────────────────────┐ 🔍 Search                 │
│  │ Date range: [From] → [To]    │                           │
│  └───────────────────────────────┘                           │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Code   │ Date & Time │ Customer │ Wt │ Price │ Paid │... ││
│  │────────│─────────────│──────────│────│───────│──────│────││
│  │ 26-A1  │ Nov 18 2:54 │ Juan...  │7.5 │ ₱150  │ Paid │... ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
  FOOTER WATERMARK
  Made by Jan Vincent "Binting" Aningat
```

---

## 5. Component & Workflow Details

### 5.1 Settings Drawer (⚙️) — Private Management Hub

Contains 5 clean, distinct sections:

1. **Daily Shift & Cash Summary (Private)**:
   - `Collected Today: ₱X,XXX` (N paid orders).
   - `Petty Cash Expenses Today: ₱X,XXX`.
   - `Net Drawer Balance: ₱X,XXX`.
2. **Cash In & Out (Petty Cash / Parcel & Delivery)**:
   - Quick form to record delivery payments, rider fees, gas, or detergent.
   - Shows recent cash movements with notes.
3. **Owner & Financial Records (Discrete Access)**:
   - Button: `📋 Open BIR & Financial Records`
   - Opens the full annual/monthly accounting view.
4. **Digital Payments on Receipts (GCash / Maya)**:
   - `GCash Name & Number`
   - `Maya Name & Number`
5. **Pricing & Database Settings**:
   - Google Sheets Web App URL.
   - Regular Rate, Express Rate, Minimum Weight.
   - Business Name, Address, TIN, Phone, Print Format.
   - `⚠️ Clear All Test Data` button and `Reset Code Counter` control.

### 5.2 Printable Receipt with Cashless Payment Details

Receipt includes:
- Brand Name, Address, TIN, Phone
- Order Code (`26-A1`), Date & Time
- Customer Details, Service, Weight, Rate, Total Price, Payment Status
- **GCash / Maya Box** (if set in settings):
  `GCash: 0917 123 4567 (Ayah L.)`
- Claim Notice: *"Please present this receipt when claiming laundry."*
- Tagline: *"Wash, dry, fold, repeat."*

---

## 6. Implementation Readiness

Everything is documented in this spec. When user issues the signal **"implement"**:
- Code changes will be executed cleanly across frontend and `code.gs`.
- All updates will be committed to Git.
