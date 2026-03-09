async function loadSupervisor() {

  const res = await fetch("/api/supervisor/dashboard");
  const d = await res.json();

  document.getElementById("kRun").innerText = d.kpi.running || 0;
  document.getElementById("kHold").innerText = d.kpi.hold || 0;
  document.getElementById("kDone").innerText = d.kpi.completed || 0;
  document.getElementById("kOp").innerText = d.kpi.operators || 0;

  const t = document.getElementById("prodTable");
  t.innerHTML = "";

  d.jobs.forEach(j => {

    const r = t.insertRow();

    let actionBtn = "";

    if (j.status === "COMPLETED") {
      actionBtn = `<button onclick="startQC('${j.jobId}', this)">START QC</button>`;
    }

    r.innerHTML = `
      <td>${j.jobId}</td>
      <td>${j.operator}</td>
      <td>${j.machine}</td>
      <td>${j.status}</td>
      <td>${j.startTime || "-"}</td>
      <td>${actionBtn}</td>
    `;
  });
}


function startQC(jobId, btn) {

  // remove existing QC row if open
  const old = document.getElementById("qcRow");
  if (old) old.remove();

  const row = btn.closest("tr");
  const qcRow = document.createElement("tr");
  qcRow.id = "qcRow";

  qcRow.innerHTML = `
    <td colspan="6">
      <div style="background:#111;padding:15px;border-radius:8px;color:white;">
        <h4>QC Inspection - ${jobId}</h4>

        <input placeholder="Actual Measurement" id="actual_${jobId}">
        <input placeholder="Surface (YES/NO)" id="surface_${jobId}">
        <input placeholder="Visual (OK/NOT OK)" id="visual_${jobId}">
        <input placeholder="Problem (if any)" id="problem_${jobId}">
        <input placeholder="Root Cause" id="root_${jobId}">
        <input placeholder="Corrective Action" id="correct_${jobId}">

        <br><br>

        <button onclick="submitQC('${jobId}','APPROVED')">APPROVE</button>
        <button onclick="submitQC('${jobId}','REJECTED')">REJECT</button>
      </div>
    </td>
  `;

  row.after(qcRow);
}


async function submitQC(jobId, result) {

  const actual = document.getElementById(`actual_${jobId}`).value.trim();
  const surface = document.getElementById(`surface_${jobId}`).value.trim();
  const visual = document.getElementById(`visual_${jobId}`).value.trim();
  const problem = document.getElementById(`problem_${jobId}`).value.trim();
  const root = document.getElementById(`root_${jobId}`).value.trim();
  const corrective = document.getElementById(`correct_${jobId}`).value.trim();

  if (!actual || !surface || !visual) {
    alert("Fill Actual, Surface and Visual first");
    return;
  }

  if (result === "REJECTED") {
    if (!problem || !root || !corrective) {
      alert("For rejection, fill problem, root cause and corrective action");
      return;
    }
  }

  await fetch("/api/qc/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      result,
      actual,
      surface,
      visual,
      problem,
      rootCause: root,
      corrective
    })
  });

  alert("QC Saved Successfully");

  document.getElementById("qcRow").remove();

  loadSupervisor();
}



loadSupervisor();