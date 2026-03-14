const API = "https://uniquecrm.onrender.com";

// =========================
// CHART INSTANCES (GLOBAL)
// =========================
let statusPieChart = null;
let machineBarChart = null;



/* =====================================================
   UPW ERP – FINAL ADMIN LOGIC (STABLE)
===================================================== */

/* =========================
   ELEMENTS
========================= */
const customerTable = document.getElementById("customerTable");
const customerSelect = document.getElementById("enqCustomer");
const enquiryTable = document.getElementById("enquiryTable");
const ordersTable = document.getElementById("ordersTable");
const custMsg = document.getElementById("custMsg");

/* =========================
   PAGE NAVIGATION
========================= */
function showPage(page) {
  document.querySelectorAll(".page").forEach(p => {
    p.style.display = "none";
    p.classList.remove("active");
  });

  const el = document.getElementById("page-" + page);
  if (!el) return;

  el.style.display = "block";
  el.classList.add("active");

  if (page === "dashboard") loadDashboardKPI();
  if (page === "customers") {
    loadCustomerKPI();
    loadCustomers();
  }
  if (page === "enquiries") {
    loadEnquiryKPI();
    loadCustomers();
    loadEnquiries();
  }
  if (page === "orders") {
    loadOrderKPI();
    loadOrders();
  }
}

/* =========================
   CUSTOMERS
========================= */
async function loadCustomers() {
  if (!customerTable) return;

  customerTable.innerHTML = "";
  if (customerSelect)
    customerSelect.innerHTML = `<option value="">Select Customer</option>`;

  const res = await fetch(API +"/api/customers/list");
  const customers = await res.json();

  customers.forEach(c => {
    const row = customerTable.insertRow();
    row.innerHTML = `
      <td>${c.id}</td>
      <td>${c.customerName}</td>
      <td>${c.companyName || "-"}</td>
      <td>${c.mobile}</td>
      <td>${c.email || "-"}</td>
      <td>${c.status || "Active"}</td>
    `;

    if (customerSelect) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.customerName;
      customerSelect.appendChild(opt);
    }
  });
}

async function addCustomer() {
  const payload = {
    customerName: custName.value.trim(),
    companyName: companyName.value.trim(),
    contactPerson: contactPerson.value.trim(),
    mobile: custPhone.value.trim(),
    alternateMobile: altPhone.value.trim(),
    email: custEmail.value.trim(),
    industry: industry.value.trim(),
    address: address.value.trim(),
    city: city.value.trim(),
    state: state.value.trim(),
    pincode: pincode.value.trim(),
    country: country.value.trim(),
    gstNo: gst.value.trim(),
    panNo: pan.value.trim(),
    paymentTerms: paymentTerms.value,
    creditLimit: creditLimit.value.trim(),
    status: customerStatus.value,
    source: source.value,
    salesPerson: salesPerson.value.trim(),
    notes: notes.value.trim()
  };

  if (!payload.customerName || !payload.mobile) {
    alert("Customer Name & Mobile required");
    return;
  }

  const res = await fetch(API +"/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (result.success) {
    custMsg.innerText = "Customer saved successfully ✓";
    custMsg.style.color = "green";
    document
      .querySelectorAll("#page-customers input, #page-customers select")
      .forEach(i => (i.value = ""));
    loadCustomers();
    loadCustomerKPI();
  } else {
    custMsg.innerText = "Error saving customer";
    custMsg.style.color = "red";
  }
}

/* =========================
   ENQUIRIES
========================= */
async function addEnquiry() {
  const payload = {
    customerId: enqCustomer.value,
    customerName: enqCustomer.options[enqCustomer.selectedIndex]?.text,
    priority: enqPriority.value,
    partName: partName.value.trim(),
    quantity: quantity.value.trim(),
    material: material.value,
    drawing: drawing.value,
    process: process.value,
    delivery: delivery.value.trim()
  };

  if (!payload.customerId || !payload.partName || !payload.quantity) {
    alert("Customer, Part & Quantity required");
    return;
  }

  const res = await fetch(API +"/api/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  if (result.success) {
    alert("Enquiry saved");
    loadEnquiries();
    loadEnquiryKPI();
  }
}

async function loadEnquiries() {
  enquiryTable.innerHTML = "";

  const res = await fetch(API + "/api/enquiries/list");
  const enquiries = await res.json();

  enquiries.forEach(e => {
    const row = enquiryTable.insertRow();

    let action = "-";
   if (e.status === "NEW") {
  action = `
    <button onclick="openConvertModal('${e.id}')">
      Convert → Order
    </button>
    <button class="lost-btn" data-enquiry="${e.id}">
      Mark Lost
    </button>
  `;
}
    else {
      action = e.status;
    }

    row.innerHTML = `
      <td>${e.id}</td>
      <td>${e.customerName}</td>
      <td>${e.requirement || "-"}</td>
      <td>${action}</td>
    `;
  });
}

// ===============================
// OPEN CONVERT MODAL
// ===============================
function openConvertModal(enquiryId, customer, part) {
  document.getElementById("convEnquiryId").value = enquiryId;
  document.getElementById("convertOrderModal").style.display = "flex";
}

// ===============================
// CLOSE MODAL
// ===============================
function closeConvertModal() {
  document.getElementById("convertOrderModal").style.display = "none";
}

// ===============================
// CONFIRM CONVERT
// ===============================
async function confirmConvertOrder() {

  const enquiryId = document.getElementById("convEnquiryId").value;

  // 👇 enquiry table madhun data gheu
  const resEnq = await fetch(API + "/api/enquiries/list");
  const allEnq = await resEnq.json();
  const enq = allEnq.find(x => x.id === enquiryId);

  const payload = {
    enquiryId: enquiryId,
    customerName: enq.customerName,
    requirement: enq.requirement,
    poStatus: document.getElementById("poStatus").value,
    poNumber: document.getElementById("poNumber").value,
    poNote: document.getElementById("poNote").value,
    poReceivedDate: document.getElementById("poReceivedDate").value
  };

  const res = await fetch(API + "/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (!result.success) {
    alert("Order create failed");
    return;
  }

  await fetch(API + "/api/enquiries/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enquiryId, status: "CONVERTED" })
  });

  closeConvertModal();
  loadEnquiries();
  loadOrders();
  loadEnquiryKPI();
  loadOrderKPI();
  showPage("orders");
}
/* =========================
   CLICK HANDLERS
========================= */
document.addEventListener("click", async e => {
  // Convert enquiry
  if (e.target.classList.contains("convert-btn")) {
    const enquiryId = e.target.dataset.enquiry;

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  enquiryId: enquiryId,
  customerName: "",   // temporarily blank
  requirement: "",    // temporarily blank
  poStatus: document.getElementById("poStatus").value,
  poNumber: document.getElementById("poNumber").value,
  poNote: document.getElementById("poNote").value,
  poReceivedDate: document.getElementById("poReceivedDate").value
})
    });

    const result = await res.json();
    if (!result.success) {
      alert("Order create failed");
      return;
    }

    await fetch("/api/enquiries/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enquiryId, status: "CONVERTED" })
    });

    loadEnquiries();
    loadOrders();
    loadEnquiryKPI();
    loadOrderKPI();
    showPage("orders");
  }

  // Mark lost
  if (e.target.classList.contains("lost-btn")) {
    const enquiryId = e.target.dataset.enquiry;

    await fetch("/api/enquiries/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enquiryId, status: "LOST" })
    });

    loadEnquiries();
    loadEnquiryKPI();
  }
});

/* =========================
   ORDERS
========================= */
async function loadOrders() {
  ordersTable.innerHTML = "";

  const res = await fetch(API + "/api/orders/list");
  const orders = await res.json();

  const table = document.getElementById("ordersTable");
  table.innerHTML = ""; 
  
  orders.forEach(o => {
    const row = ordersTable.insertRow();

    row.innerHTML = `
      <td>${o.orderId}</td>
      <td>${o.customerName}</td>
      <td>${o.requirement}</td>
      <td>
        ${
          o.status === "CREATED"
            ? `<select onchange="assignDesigner('${o.orderId}', this.value)">
                <option value="">Assign</option>
                <option>Rahul</option>
                <option>Suresh</option>
              </select>`
            : o.designer || "-"
        }
      </td>
      <td>${o.status}</td>
    `;
  });
}

async function assignDesigner(orderId, designer) {
  if (!designer) return;

  await fetch(API +"/api/orders/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, designer })
  });

  loadOrders();
  loadOrderKPI();
}

// ===============================
// OPEN CONVERT MODAL
// ===============================
function openConvertModal(enquiryId) {
  document.getElementById("convEnquiryId").value = enquiryId;
  document.getElementById("convertOrderModal").style.display = "flex";
}

// ===============================
function closeConvertModal() {
  document.getElementById("convertOrderModal").style.display = "none";
}

// ===============================
async function confirmConvertOrder() {

  const enquiryId = document.getElementById("convEnquiryId").value;

  // 🔥 Get enquiry details
  const resEnq = await fetch(API +"/api/enquiries/list");
  const allEnq = await resEnq.json();
  const enq = allEnq.find(x => x.id === enquiryId);

  const payload = {
    enquiryId: enquiryId,
    customerName: enq.customerName,
    requirement: enq.requirement,
    poStatus: document.getElementById("poStatus").value,
    poNumber: document.getElementById("poNumber").value,
    poNote: document.getElementById("poNote").value,
    poReceivedDate: document.getElementById("poReceivedDate").value
  };

  // 🔴 Validation
  if (payload.poStatus === "RECEIVED") {
    if (!payload.poNumber || !payload.poReceivedDate) {
      alert("PO Number & Date required");
      return;
    }
  }

  const res = await fetch(API +"/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (!result.success) {
    alert("Order create failed");
    return;
  }

  await fetch(API +"/api/enquiries/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enquiryId, status: "CONVERTED" })
  });

  closeConvertModal();
  loadEnquiries();
  loadOrders();
  loadEnquiryKPI();
  loadOrderKPI();
  showPage("orders");
}
/* =========================
   KPI FUNCTIONS
========================= */
async function loadDashboardKPI() {
  try {

    const res = await fetch(API +"/api/admin/overview");
    const data = await res.json();

    document.getElementById("kpiTotal").innerText = data.total || 0;
    document.getElementById("kpiProduction").innerText = data.production || 0;
    document.getElementById("kpiRunning").innerText = data.running || 0;
    document.getElementById("kpiQcPending").innerText = data.qcPending || 0;
    document.getElementById("kpiDeliveryReady").innerText = data.deliveryReady || 0;
    document.getElementById("kpiRejected").innerText = data.rejected || 0;

  } catch (err) {
    console.error("Dashboard KPI Error:", err);
  }
}

async function loadCustomerKPI() {
  const [cRes, oRes] = await Promise.all([
    fetch("/api/customers/list"),
    fetch("/api/orders/list")
  ]);

  const customers = await cRes.json();
  const orders = await oRes.json();

  document.getElementById("custTotal").innerText = customers.length;
  document.getElementById("custActive").innerText =
    customers.filter(c => c.status === "Active").length;
  document.getElementById("custInactive").innerText =
    customers.filter(c => c.status !== "Active").length;
  document.getElementById("custWithOrders").innerText =
    new Set(orders.map(o => o.customerName)).size;
  document.getElementById("custRepeat").innerText =
    orders.length -
    new Set(orders.map(o => o.customerName)).size;
}

async function loadEnquiryKPI() {
  const res = await fetch(API +"/api/enquiries/list");
  const e = await res.json();

  document.getElementById("enqTotal").innerText = e.length;
  document.getElementById("enqNew").innerText =
    e.filter(x => x.status === "NEW").length;
  document.getElementById("enqConverted").innerText =
    e.filter(x => x.status === "CONVERTED").length;
  document.getElementById("enqClosed").innerText =
    e.filter(x => x.status === "LOST").length;
}

async function loadOrderKPI() {
  const res = await fetch(API +"/api/orders/list");
  const o = await res.json();

  document.getElementById("ordTotal").innerText = o.length;
  document.getElementById("ordCreated").innerText =
    o.filter(x => x.status === "CREATED").length;
  document.getElementById("ordAssigned").innerText =
    o.filter(x => x.status === "ASSIGNED").length;
  document.getElementById("ordLocked").innerText =
    o.filter(x => x.status === "LOCKED").length;
  document.getElementById("ordCompleted").innerText =
    o.filter(x => x.status === "COMPLETED").length;
}

async function loadDashboardCharts() {
  const res = await fetch(API +"/api/admin/live-dashboard");
  const data = await res.json();

  const design = data.kpi?.created || 0;
  const production = data.kpi?.production || 0;
  const hold = data.kpi?.hold || 0;
  const completed = data.kpi?.completed || 0;

  

  /* ================= PIE CHART ================= */
  const pieCtx = document.getElementById("statusPie");
  if (pieCtx) {
    if (!statusPieChart) {
      statusPieChart = new Chart(pieCtx, {
        type: "doughnut",
        data: {
          labels: ["Design", "Production", "Hold", "Completed"],
          datasets: [{
            data: [design, production, hold, completed],
            backgroundColor: ["#f59e0b", "#16a34a", "#dc2626", "#6366f1"]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } }
        }
      });
    } else {
      statusPieChart.data.datasets[0].data =
        [design, production, hold, completed];
      statusPieChart.update();
    }
  }

  /* ================= BAR CHART ================= */
  const barCtx = document.getElementById("machineBar");
  if (barCtx) {
    if (!machineBarChart) {
      machineBarChart = new Chart(barCtx, {
        type: "bar",
        data: {
          labels: ["VMC-1", "VMC-2", "CNC-1", "LATHE"],
          datasets: [{
            label: "Jobs",
            data: [production, production, design, completed],
            backgroundColor: "#2563eb"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    } else {
      machineBarChart.data.datasets[0].data =
        [production, production, design, completed];
      machineBarChart.update();
    }
  }
}


/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  showPage("dashboard");

  // INITIAL LOADS
  loadDashboardKPI();
  loadDashboardCharts();
  loadCustomerKPI();
  loadEnquiryKPI();
  loadOrderKPI();


});


// =========================
// TOGGLE ENQUIRY FORM
// =========================
function toggleEnquiryForm() {
  const form = document.getElementById("enquiryForm");
  if (!form) return;

  if (form.style.display === "none" || form.style.display === "") {
    form.style.display = "block";
  } else {
    form.style.display = "none";
  }
}


document.getElementById("poStatus").addEventListener("change", function () {

  const status = this.value;

  const poNumber = document.getElementById("poNumber");
  const poDate = document.getElementById("poReceivedDate");
  const poNote = document.getElementById("poNote");

  if (status === "RECEIVED") {
    poNumber.disabled = false;
    poDate.disabled = false;
    poNote.disabled = false;
  } else {
    poNumber.value = "";
    poDate.value = "";
    poNote.value = "";
    poNumber.disabled = true;
    poDate.disabled = true;
    poNote.disabled = true;
  }

});


async function loadAdminOverview() {
  try {

    const res = await fetch(API +"/api/admin/overview");
    const data = await res.json();

    document.getElementById("totalJobs").innerText = data.total;
    document.getElementById("inProduction").innerText = data.production;
    document.getElementById("runningJobs").innerText = data.running;
    document.getElementById("qcPending").innerText = data.qcPending;
    document.getElementById("deliveryReady").innerText = data.deliveryReady;
    document.getElementById("rejectedJobs").innerText = data.rejected;

  } catch (err) {
    console.log("Dashboard load failed");
  }
}

window.addEventListener("load", loadAdminOverview);

async function loadDesignerLive() {
  const res = await fetch(API +"/api/admin/designer-live");
  const data = await res.json();

  const table = document.getElementById("designerLiveBody");
  table.innerHTML = "";

  data.forEach(row => {
    table.innerHTML += `
      <tr>
        <td>${row[0]}</td>
        <td>${row[1]}</td>
        <td>${row[3]}</td>
      </tr>
    `;
  });
}
// ==============================
// =
// PO STATUS SMART TOGGLE
// ===============================
// ===============================
// PO STATUS SHOW / HIDE
// ===============================
document.addEventListener("DOMContentLoaded", function () {

  const poStatus = document.getElementById("poStatus");
  const extra = document.getElementById("poExtraFields");

  if (!poStatus) return;

  poStatus.addEventListener("change", function () {

    if (this.value === "RECEIVED") {
      extra.style.display = "block";
    } else {
      extra.style.display = "none";

      // Clear fields
      document.getElementById("poNumber").value = "";
      document.getElementById("poReceivedDate").value = "";
      document.getElementById("poNote").value = "";
    }

  });

});

document.addEventListener("DOMContentLoaded", () => {
  loadAdminOverview();
});
