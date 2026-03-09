/* =========================
   UPW ERP – DESIGNER FINAL
========================= */

// 🔒 Single source of truth
let activeJobId = "";


/* =========================
   PAGE SWITCH
========================= */
function showDesignerPage(page) {
  document.querySelectorAll(".page").forEach(p =>
    p.classList.remove("active")
  );
  document.getElementById("page-" + page).classList.add("active");
}

/* =========================
   LOAD DASHBOARD
========================= */
async function loadDesignerDashboard() {

  const assignedTable = document.getElementById("assignedTable");
  const inDesignTable = document.getElementById("inDesignTable");
  const productionTable = document.getElementById("productionTable");

  assignedTable.innerHTML = "";
  inDesignTable.innerHTML = "";
  productionTable.innerHTML = "";

  const res = await fetch("/api/orders/list");
  const orders = await res.json();

  let assigned = 0;
  let inProgress = 0;
  let completed = 0;
  let production = 0;

  orders.forEach(o => {

    // ASSIGNED
    if (o.status === "ASSIGNED" || o.status === "CREATED") {
      assigned++;

      const r = assignedTable.insertRow();
      r.innerHTML = `
        <td>${o.orderId}</td>
        <td>${o.customerName || "-"}</td>
        <td>${o.requirement || "-"}</td>
        <td>
          <button onclick="startDesign('${o.orderId}')">
            Start Design
          </button>
        </td>
      `;
    }

    // IN DESIGN
    if (o.status === "DESIGN_IN_PROGRESS") {
      inProgress++;

      const r = inDesignTable.insertRow();
      r.innerHTML = `
        <td>${o.orderId}</td>
        <td>${o.customerName}</td>
        <td>${o.startTime || "-"}</td>
        <td>
          <button onclick="openDesignWorkspace('${o.orderId}')">
            Complete Design
          </button>
        </td>
      `;
    }

    // PRODUCTION
    if (o.status === "PRODUCTION") {
      production++;

      const r = productionTable.insertRow();
      r.innerHTML = `
        <td>${o.orderId}</td>
        <td>${o.customerName}</td>
        <td>Sent To Production</td>
      `;
    }

    if (o.status === "DESIGN_COMPLETED") {
      completed++;
    }

  });

  // KPI Update
  document.getElementById("kpiAssigned").innerText = assigned;
  document.getElementById("kpiInProgress").innerText = inProgress;
  document.getElementById("kpiCompleted").innerText = completed;
  document.getElementById("kpiProduction").innerText = production;

}

/* =========================
   START DESIGN
========================= */
async function startDesign(orderId) {

  const res = await fetch("/api/orders/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: orderId,
      status: "DESIGN_IN_PROGRESS",
      startTime: new Date().toLocaleString()
    })
  });

  const data = await res.json();

  if (!data.success) {
    alert("Status update failed");
    return;
  }

  alert("Design Started ✅");

  loadDesignerDashboard();
  showDesignerPage("indesign");
}

/* =========================
   COMPLETE DESIGN
========================= */
async function completeDesign() {

  if (!activeJobId) {
    alert("Generate QR first");
    return;
  }

  const designerName = wsDesignerName.value.trim();
  if (!designerName) {
    alert("Designer name required");
    return;
  }

  const machines = [...document.querySelectorAll(".machineChk:checked")]
    .map(cb => cb.value)
    .join(", ");

  const payload = {
    jobId: activeJobId,
    orderId: wsOrderId.value,
    customer: wsCustomer.value,
    requirement: wsRequirement.value,
    designer: designerName,
    designType: document.getElementById("wsDesignType").value,
    material: document.getElementById("wsMaterial").value,
    machines: machines,
    operatorRemark: document.getElementById("wsOperatorRemark").value
  };

  console.log("SENDING JOB:", payload);

  const res = await fetch("/api/jobs/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (!result.success) {
    alert("Job creation failed");
    return;
  }
  

alert("Order Sent To Production 🚀");

loadDesignerDashboard();
showDesignerPage("production");
 
}



async function generateQR() {

  if (!wsOrderId.value) {
    alert("Order not loaded");
    return;
  }

  if (!wsDesignerName.value.trim()) {
    alert("Designer Name required");
    return;
  }

  const machines = document.querySelectorAll(".machineChk:checked");
  if (machines.length === 0) {
    alert("Select machine");
    return;
  }

  if (activeJobId) {
    alert("QR already generated");
    return;
  }

  // 🔥 GET SHORT SEQUENCE FROM SERVER
  const res = await fetch("/api/job/next-seq");
  const data = await res.json();

  const year = new Date().getFullYear().toString().slice(-2);
  const seq = String(data.seq).padStart(3, "0");

  const jobId = `J${year}-${seq}`;
  const designId = `D${year}-${seq}`;

  activeJobId = jobId;

  document.getElementById("displayJobId").innerText = jobId;
  document.getElementById("displayDesignId").innerText = designId;

  // Generate QR
  new QRious({
    element: document.getElementById("qrCanvas"),
    size: 220,
    value: window.location.origin + "/operator.html?jobId=" + jobId
  });

  btnComplete.disabled = false;
}


async function openDesignWorkspace(orderId) {

  const res = await fetch("/api/orders/list");
  const orders = await res.json();
  const o = orders.find(x => x.orderId === orderId);

  wsOrderId.value = o.orderId;
  wsCustomer.value = o.customerName;
  wsRequirement.value = o.requirement;

  // 🔥 AUTO DATE
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("wsDesignDate").value = today;

  // 🔥 AUTO DESIGN ID
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random()*900)+100;
  document.getElementById("wsDesignNo").value = `D${year}-${random}`;

  showDesignerPage("design");
}


/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnComplete").disabled = true;
  showDesignerPage("assigned");
  loadDesignerDashboard();
});

