

/* ===============================
   UPW ERP – FINAL STABLE BACKEND
   Google Sheets as Database
================================ */


require("dotenv").config();

const { google } = require("googleapis");

// GOOGLE AUTH (FIX)
const auth = new google.auth.GoogleAuth({
  keyFile: __dirname + "/credentials.json",
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ]
});

const express = require("express");
const cors = require("cors");
const path = require("path");



const app = express();
const PORT = 3000;


/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbx-OAjqDtgiH53U_WWuCCby9xHPzMVk7-exYB8BBGvWNeCLDqoanJyYxFkmChoVjoRAuw/exec"


/* ===============================
   STATIC FRONTEND
================================ */
app.use(express.static(__dirname));

/* ===============================
   ROOT
================================ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

/* ===============================
   GOOGLE SHEETS CONFIG
================================ */
const SPREADSHEET_ID = "1Ie4iQt-1h1UIynTMuUamn5icM-K0WxZ5KtWwJpOJb0I";



async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

async function getDrive() {
  const client = await auth.getClient();
  return google.drive({ version: "v3", auth: client });
}




// ===============================
// AUTO CREATE DESIGNERS SHEET
// ===============================
async function ensureDesignersSheet() {
  const sh = await getSheets();

  const meta = await sh.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheets = meta.data.sheets.map(s => s.properties.title);
  if (sheets.includes("Designers")) return;

  await sh.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        addSheet: { properties: { title: "Designers" } }
      }]
    }
  });

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Designers!A1:C1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Name", "Status", "CreatedAt"]]
    }
  });

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Designers!A:C",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        ["Rahul", "ACTIVE", new Date().toLocaleString()],
        ["Suresh", "ACTIVE", new Date().toLocaleString()]
      ]
    }
  });
}




/* ======================================================
   CUSTOMER MASTER
====================================================== */
app.post("/api/customers", async (req, res) => {
  try {

    const sh = await getSheets();
    const data = req.body;

    const customerId = "CUST-" + Date.now();
    const now = new Date().toLocaleString();

    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Customers!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          customerId,
          data.customerName,
          data.companyName,
          data.contactPerson,
          data.mobile,
          data.altMobile,
          data.email,
          data.industry,
          data.area,
          data.city,
          data.state,
          data.pincode,
          data.country,
          data.gst,
          data.pan,
          data.paymentTerms,
          data.category,
          data.status,
          data.reference,
          data.remark,
          now
        ]]
      }
    });

    res.json({ success: true });

  } catch (err) {
    console.error("CUSTOMER SAVE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

app.get("/api/customers/list", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Customers!A:W",
  });
  const rows = (r.data.values || []).slice(1);
  res.json(rows.map(r => ({
    id: r[0], customerName: r[1], companyName: r[2],
    mobile: r[4], email: r[6], status: r[17]
  })));
});

/* ======================================================
   ENQUIRIES
====================================================== */
app.post("/api/enquiries", async (req, res) => {
  const d = req.body;
  const sh = await getSheets();

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "ENQ-" + Date.now(),
        d.customerId, d.customerName,
        new Date().toLocaleDateString(),
        "Admin", d.priority || "",
        d.partName, d.quantity, d.material,
        d.drawing, d.process, d.tolerance,
        d.surface, d.delivery,
        "NEW", new Date().toLocaleString()
      ]]
    }
  });

  res.json({ success: true });
});

app.get("/api/enquiries/list", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
  });
  const rows = (r.data.values || []).slice(1);
  res.json(rows.map(r => ({
    id: r[0],
    customerName: r[2],
    requirement: r[6],
    status: r[14]
  })));
});

app.post("/api/enquiries/status", async (req, res) => {
  try {
    const { enquiryId, status } = req.body;
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Enquiries!A:S"
    });

    const rows = r.data.values;
    const idx = rows.findIndex(r => r[0] === enquiryId);

    if (idx === -1) {
      return res.json({ success: false });
    }

    rows[idx][14] = status; // 👈 STATUS COLUMN

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Enquiries!A:S",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });

  } catch (e) {
    res.status(500).json({ success: false });
  }
});


/* ======================================================
   ORDERS
====================================================== */
app.post("/api/orders", async (req, res) => {
  const { enquiryId, customerName, requirement } = req.body;
  const sh = await getSheets();

  const enq = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
  });

  const rows = enq.data.values;
  const idx = rows.findIndex(r => r[0] === enquiryId);

  if (rows[idx][14] !== "NEW")
    return res.json({ success: false });

  const orderId = "ORD-" + Date.now();

 await sh.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET_ID,
  range: "Orders!A:I",   // 🔥 A:E hota → ata A:I kara
  valueInputOption: "USER_ENTERED",
  requestBody: {
    values: [[
      orderId,
      customerName,
      requirement,
      "",                // Designer
      "CREATED",         // Status

      req.body.poStatus || "PENDING",
      req.body.poNumber || "",
      req.body.poNote || "",
      req.body.poReceivedDate || ""
    ]]
  }
});

  rows[idx][14] = "CONVERTED";

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Enquiries!A:S",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true, orderId });
});

app.post("/api/orders/status", async (req, res) => {
  try {

    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.json({ success: false });
    }

    const sh = await getSheets();

const response = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A:I"
    });

    const rows = response.data.values;

    let found = false;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === orderId) {
        rows[i][4] = status; // Status column (E)
        found = true;
        break;
      }
    }

    if (!found) {
      return res.json({ success: false });
    }

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });

  } catch (err) {
    console.error("ORDER STATUS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

app.get("/api/orders/list", async (req, res) => {
  const sh = await getSheets();
  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Orders!A:I",
  });
  const rows = (r.data.values || []).slice(1);
  res.json(rows.map(r => ({
  orderId: r[0],
  customerName: r[1],
  requirement: r[2],
  designer: r[3],
  status: r[4],

  poStatus: r[5],
  poNumber: r[6],
  poNote: r[7],
  poDate: r[8]
})));
});

app.post("/api/orders/assign", async (req, res) => {
  try {
    const { orderId, designer } = req.body;

    if (!orderId || !designer) {
      return res.json({ success: false, message: "Missing data" });
    }

    const sh = await getSheets();

    const ordRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A:E"
    });

    const rows = ordRes.data.values;
    const idx = rows.findIndex((r, i) => i > 0 && r[0] === orderId);

    if (idx === -1) {
      return res.json({ success: false, message: "Order not found" });
    }

    rows[idx][3] = designer;        // Designer
    rows[idx][4] = "ASSIGNED";      // Status

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });

  } catch (err) {
    console.error("ORDER ASSIGN ERROR:", err);
    res.status(500).json({ success: false });
  }
});




// ===============================
// GET DESIGNERS LIST
// ===============================
app.get("/api/designers/list", async (req, res) => {
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Designers!A:B",
  });

  const rows = (r.data.values || []).slice(1);

  const designers = rows
    .filter(r => r[1] === "ACTIVE")
    .map(r => r[0]);

  res.json(designers);
});



/* ======================================================
   OPERATOR – FETCH DESIGN (READ ONLY)
====================================================== */
app.get("/api/design/:jobId", async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Design_Log!A:F",
    });

    const rows = r.data.values || [];
    const data = rows.find(r => r[0] === jobId);

    if (!data) {
      return res.json({ success: false });
    }

    res.json({
      success: true,
      designNo: data[2],
      designer: data[3],
      designUrl: data[4]
    });

  } catch (e) {
    res.status(500).json({ success: false });
  }
});


// ===============================
// GET JOBS IN PRODUCTION (FOR DROPDOWN)
// ===============================
app.get("/api/jobs/list", async (req, res) => {
  try {
    const sh = await getSheets();

    // 🔹 Fresh Production Jobs
    const jobsRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J"
    });

    const jobsRows = (jobsRes.data.values || []).slice(1);

    const freshJobs = jobsRows
      .filter(r => r[9] === "PRODUCTION")
      .map(r => ({
        jobId: r[0],
        orderId: r[1],
        customer: r[2],
        requirement: r[3],
        machines: r[6] ? r[6].split(",").map(m=>m.trim()) : []
      }));

    // 🔹 Active Production Jobs (RUNNING + HOLD)
    const prodRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const prodRows = (prodRes.data.values || []).slice(1);

    const activeJobs = prodRows
      .filter(r => r[5] === "RUNNING" || r[5] === "HOLD")
      .map(r => ({
        jobId: r[1],
        orderId: r[2],
        customer: "",
        requirement: "",
        machines: [r[4]]
      }));

    const map = {};

    [...freshJobs, ...activeJobs].forEach(j=>{
      map[j.jobId] = j;
    });

    res.json(Object.values(map));

  } catch (err) {
    console.error("JOB LIST ERROR:", err);
    res.json([]);
  }
});

app.post("/api/production/start", async (req, res) => {
  try {
    const { jobId } = req.body;
    const sh = await getSheets();

    const jobs = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J"
    });

    const rows = jobs.data.values;
    const idx = rows.findIndex(r => r[0] === jobId);

    if (idx === -1) return res.json({ success: false });

    rows[idx][9] = "RUNNING";

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
});
/* ===============================
   HOLD PRODUCTION
================================ */
app.post("/api/production/hold", async (req, res) => {
  const { jobId, reason } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[1] === jobId && r[5] === "RUNNING");

  if (idx === -1) return res.json({ success:false });

  rows[idx][5] = "HOLD";
  rows[idx][8] = reason;
  rows[idx][9] = new Date().toLocaleString();

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success:true });
});


/* ===============================
   COMPLETE PRODUCTION
================================ */
app.post("/api/operator/complete", async (req, res) => {
  try {
    const { jobId } = req.body;
    const sh = await getSheets();

    const jobs = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J"
    });

    const rows = jobs.data.values;
    const idx = rows.findIndex(r => r[0] === jobId);

    if (idx === -1) return res.json({ success: false });

    rows[idx][9] = "COMPLETED";

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ===============================
// GET CURRENT PRODUCTION STATUS
// ===============================
app.get("/api/production/status/:jobId", async (req, res) => {
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = (r.data.values || []).slice(1);

  const jobRows = rows.filter(r => r[1] === req.params.jobId);

  if(jobRows.length === 0){
    return res.json({ success:false });
  }

  const latestRow = jobRows[jobRows.length - 1];

  res.json({
    success:true,
    status: latestRow[5],
    startTime: latestRow[6]
  });
});
/* ======================================================
   DASHBOARD LIVE
====================================================== */


/* ======================================================
   QC MODULE
====================================================== */

/* 🔹 QC Pending Jobs */
app.get("/api/qc/pending", async (req, res) => {
  try {
    const sh = await getSheets();

    const prodRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = (prodRes.data.values || []).slice(1);

    const pending = rows
      .filter(r => r[5] === "COMPLETED")
      .map(r => ({
        jobId: r[1],
        orderId: r[2],
        operator: r[3],
        machine: r[4],
        completedTime: r[7]
      }));

    res.json(pending);

  } catch (err) {
    console.error("QC Pending Error:", err);
    res.json([]);
  }
});
/* ======================================================
   ADMIN – SINGLE LIVE DASHBOARD (READ ONLY)
====================================================== */
app.get("/api/admin/live-dashboard", async (req, res) => {
  try {
    const sh = await getSheets();

    const ord = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A:E"
    });

    const rows = (ord.data.values || []).slice(1);

    let kpi = {
      totalOrders: rows.length,
      created: 0,
      assigned: 0,
      production: 0
    };

    rows.forEach(r => {
      if (r[4] === "CREATED") kpi.created++;
      if (r[4] === "ASSIGNED") kpi.assigned++;
      if (r[4] === "PRODUCTION") kpi.production++;
    });

    res.json({ kpi });

  } catch (err) {
    console.error("ADMIN KPI ERROR:", err);
    res.status(500).json({ kpi: {} });
  }
});


app.get("/api/supervisor/dashboard", async (req, res) => {
  try {
    const sh = await getSheets();

    const prodRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = (prodRes.data.values || []).slice(1);

    let running = 0;
    let hold = 0;
    let completed = 0;

    const operators = new Set();

    rows.forEach(r => {
      operators.add(r[3]);
      if (r[5] === "RUNNING") running++;
      if (r[5] === "HOLD") hold++;
      if (r[5] === "COMPLETED") completed++;
    });

    res.json({
      kpi: {
        running,
        hold,
        completed,
        operators: operators.size
      },
      jobs: rows.map(r => ({
        jobId: r[1],
        orderId: r[2],
        operator: r[3],
        machine: r[4],
        status: r[5],
        startTime: r[6]
      }))
    });

  } catch (err) {
    console.error(err);
    res.json({ kpi: {}, jobs: [] });
  }
});

app.get("/api/supervisor/live", async (req, res) => {
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = (r.data.values || []).slice(1);

  res.json(rows.map(r=>({
    jobId: r[1],
    operator: r[3],
    machine: r[4],
    status: r[5],
    minutes: r[8]
  })));
});



app.post("/api/qc/update", async (req, res) => {
  const { jobId, orderId, result, remarks, checkedBy } = req.body;
  const sh = await getSheets();

  await sh.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "QC!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "QC-" + Date.now(),
        jobId,
        orderId,
        result,
        remarks,
        checkedBy,
        new Date().toLocaleString()
      ]]
    }
  });

  res.json({ success: true });
});


/* ===============================
   START SERVER
================================ */
// ===============================
// INIT DESIGNERS SHEET (ONE TIME)
// ===============================

/* ======================================================
   OPERATOR → START PRODUCTION (QR FLOW)
====================================================== */

/* ===============================
   OPERATOR – HOLD JOB
================================ */
app.post("/api/operator/hold", async (req, res) => {
  try {
    const { jobId, reason } = req.body;
    if (!reason) return res.json({ success:false });

    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = r.data.values;
    const idx = rows.findIndex(r => r[1] === jobId && r[4] === "RUNNING");

    rows[idx][4] = "HOLD";
    rows[idx][6] = new Date().toLocaleString();
    rows[idx][9] = reason;

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success:true });

  } catch {
    res.status(500).json({ success:false });
  }
});

/* ===============================
   OPERATOR – COMPLETE JOB
================================ */
app.post("/api/operator/complete", async (req, res) => {
  try {
    const { jobId } = req.body;
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = r.data.values;
    const idx = rows.findIndex(r => r[1] === jobId);

    rows[idx][4] = "COMPLETED";
    rows[idx][8] = new Date().toLocaleString();

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success:true });

  } catch {
    res.status(500).json({ success:false });
  }
});


app.post("/api/production/resume", async (req, res) => {
  const { jobId } = req.body;
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J"
  });

  const rows = r.data.values;
  const idx = rows.findIndex(r => r[1] === jobId && r[5] === "HOLD");

  rows[idx][5] = "RUNNING";

  await sh.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Production!A:J",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  res.json({ success: true });
});




/* =========================
   PRODUCTION LIVE DASHBOARD
========================= */
app.get("/api/production/live", async (req, res) => {
  try {
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production_Log!A:F"
    });

    const rows = (r.data.values || []).slice(1);

    res.json(rows.map(r => ({
      jobId: r[1],
      machine: r[2],
      operator: r[3],
      status: r[4],
      time: r[5]
    })));
  } catch (e) {
    res.status(500).json([]);
  }
});


/* ===============================
   OPERATOR PERFORMANCE
================================ */
app.get("/api/operator/performance", async (req, res) => {
  try {
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production_Log!A:F"
    });

    const rows = (r.data.values || []).slice(1);

    let summary = {};

    rows.forEach(r => {
      const op = r[3];
      if (!summary[op]) summary[op] = { jobs: 0 };
      summary[op].jobs++;
    });

    res.json(summary);
  } catch {
    res.status(500).json({});
  }
});



app.post("/api/qc/approve", async (req, res) => {
  try {
    const { jobId, remark } = req.body;
    const sh = await getSheets();

    const jobs = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J"
    });

    const rows = jobs.data.values;
    const idx = rows.findIndex(r => r[0] === jobId);

    if (idx === -1) return res.json({ success: false });

    rows[idx][9] = "DELIVERY_READY";

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
});

app.post("/api/qc/reject", async (req, res) => {
  try {
    const { jobId } = req.body;
    const sh = await getSheets();

    const jobs = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J"
    });

    const rows = jobs.data.values;
    const idx = rows.findIndex(r => r[0] === jobId);

    if (idx === -1) return res.json({ success: false });

    rows[idx][9] = "QC_REJECTED";

    await sh.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
});

app.post("/api/qc/process", async (req, res) => {
  try {
    const {
      jobId,
      result,
      actual,
      surface,
      visual,
      problem,
      rootCause,
      corrective
    } = req.body;

    const sh = await getSheets();
    const now = new Date().toLocaleString();

    // Save QC Record
    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "QC!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          "QC-" + Date.now(),
          jobId,
          result,
          actual,
          surface,
          visual,
          problem,
          rootCause,
          corrective,
          now
        ]]
      }
    });

    // Update Production Status
    const prodRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = prodRes.data.values;
    const idx = rows.findIndex(r => r[1] === jobId);

    if (idx !== -1) {
      if (result === "APPROVED") {
        rows[idx][5] = "DELIVERY_READY";
      } else {
        rows[idx][5] = "QC_REJECTED";
      }

      await sh.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Production!A:J",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows }
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ===============================
   FINAL JOB CREATE ROUTE (FIX)
================================ */
app.post("/api/jobs/create", async (req, res) => {
  try {
    const {
      jobId,
      orderId,
      customer,
      requirement,
      designer,
      designType,
      material,
      machines,
      operatorRemark
    } = req.body;

    if (!jobId || !orderId || !designer) {
      return res.status(400).json({ success: false });
    }

    const sh = await getSheets();

    // 1️⃣ Save Job
    await sh.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          jobId,
          orderId,
          customer,
          requirement,
          designType,
          material,
          machines,
          operatorRemark,
          designer,
          "PRODUCTION"   // 🔥 MASTER STATUS
        ]]
      }
    });

    // 2️⃣ Update Order Status
    const ord = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A:E"
    });

    const rows = ord.data.values;
    const idx = rows.findIndex(r => r[0] === orderId);

    if (idx > 0) {
      rows[idx][4] = "PRODUCTION";

      await sh.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Orders!A:E",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows }
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("JOB CREATE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ===============================
   JOBS IN PRODUCTION
================================ */
app.get("/api/jobs/in-production", async (req, res) => {
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:J"
  });

  const rows = (r.data.values || []).slice(1);

  const jobs = rows
    .filter(r => r[9] === "PRODUCTION")
    .map(r => ({
      jobId: r[0],
      orderId: r[1],
      customer: r[2],
      requirement: r[3],
      machines: r[6] ? r[6].split(", ") : []
    }));

  res.json(jobs);
});

/* ===============================
   JOB DETAILS
================================ */
app.get("/api/jobs/details/:jobId", async (req, res) => {
  const sh = await getSheets();

  const r = await sh.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Jobs!A:J"
  });

  const rows = r.data.values || [];
  const job = rows.find(r => r[0] === req.params.jobId);

  if (!job) return res.json({ success:false });

  res.json({
    success:true,
    data:{
      jobId: job[0],
      orderId: job[1],
      customer: job[2],
      requirement: job[3],
      machines: job[6] ? job[6].split(", ") : []
    }
  });
});

// ===== GET NEXT JOB SEQUENCE =====
app.get("/api/job/next-seq", async (req, res) => {
  try {
    const sh = await getSheets();

    const r = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs!A:A"
    });

    const rows = (r.data.values || []).slice(1);

    let max = 0;

    rows.forEach(r => {
      const id = r[0];

      if (id && id.startsWith("J")) {

        const parts = id.split("-");
        const num = parseInt(parts[1]);

        // 🔥 Ignore old timestamp IDs
        if (!isNaN(num) && num < 1000) {
          if (num > max) max = num;
        }
      }
    });

    res.json({ seq: max + 1 });

  } catch (err) {
    res.json({ seq: 1 });
  }
});

app.get("/api/admin/designer-live", async (req, res) => {
  try {

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Jobs!A:J"
    });

    const rows = response.data.values || [];

    const inDesign = rows.slice(1).filter(r => r[4] === "DESIGN_IN_PROGRESS");

    res.json(inDesign);

  } catch (err) {
    res.status(500).json([]);
  }
});

app.get("/api/admin/operator-live", async (req, res) => {
  try {
    const sh = await getSheets();

    const prodRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:J"
    });

    const rows = (prodRes.data.values || []).slice(1);

    const runningJobs = rows.filter(r => r[5] === "RUNNING");

    res.json(runningJobs);

  } catch {
    res.json([]);
  }
});

app.get("/api/admin/qc-live", async (req, res) => {
  try {
    const sh = await getSheets();

    const jobs = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Jobs"
    });

    const rows = (jobs.data.values || []).slice(1);

    const qcPending = rows.filter(r => (r[9] || "").trim().toUpperCase() === "COMPLETED").length;
    const rejected = rows.filter(r => (r[9] || "").trim().toUpperCase() === "QC_REJECTED").length;
    const ready = rows.filter(r => (r[9] || "").trim().toUpperCase() === "DELIVERY_READY").length;

    res.json({
      qcPending,
      rejected,
      ready
    });

  } catch (err) {
    console.error("QC live error:", err);
    res.status(500).json({
      qcPending: 0,
      rejected: 0,
      ready: 0
    });
  }
});

app.get("/api/admin/overview", async (req, res) => {
  try {

    const sh = await getSheets();

    /* -------- ORDERS -------- */
    const ordersRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A:J"
    });

    const orders = ordersRes.data.values || [];
    const totalOrders = orders.length > 1 ? orders.length - 1 : 0;

    let inProduction = 0;

    orders.slice(1).forEach(row => {
      if (row[4] === "PRODUCTION") {
        inProduction++;
      }
    });


    /* -------- PRODUCTION -------- */
    const prodRes = await sh.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Production!A:K"
    });

    const production = prodRes.data.values || [];

    let running = 0;
    let completed = 0;

    production.slice(1).forEach(row => {
      if (row[5] === "RUNNING") running++;
      if (row[5] === "COMPLETED") completed++;
    });


    // -------- QC ----------
const qcRes = await sh.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: "QC!A:G"
});

const qcRows = (qcRes.data.values || []).slice(1);

let approved = 0;
let rejected = 0;

qcRows.forEach(row => {
  const result = (row[2] || "").trim().toUpperCase(); // ✅ Column C

  if (result === "APPROVED") approved++;
  if (result === "REJECTED") rejected++;
});

   res.json({
  total: totalOrders,
  production: inProduction,
  running,
  qcPending: completed,
  deliveryReady: approved,
  rejected: rejected   // ✅ FIX
});

  } catch (error) {
    console.log("Dashboard Error:", error.message);
    res.status(500).json({
      total: 0,
      production: 0,
      running: 0,
      qcPending: 0,
      deliveryReady: 0,
      rejected: 0
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});







