const API = "https://uniquecrm.onrender.com";

let timerInterval;
const timerEl = document.getElementById("timer");

function startTimer(startTime){
  clearInterval(timerInterval);

  timerInterval = setInterval(()=>{
    const diff = Date.now() - new Date(startTime).getTime();

    const hours = String(Math.floor(diff/3600000)).padStart(2,"0");
    const minutes = String(Math.floor((diff%3600000)/60000)).padStart(2,"0");
    const seconds = String(Math.floor((diff%60000)/1000)).padStart(2,"0");

    timerEl.innerText = `${hours}:${minutes}:${seconds}`;
  },1000);
}

function stopTimer(){
  clearInterval(timerInterval);
}

const jobDropdown = document.getElementById("jobDropdown");
const orderId = document.getElementById("orderId");
const customer = document.getElementById("customer");
const requirement = document.getElementById("requirement");
const operatorName = document.getElementById("operatorName");
const machineName = document.getElementById("machineName");

const startBtn = document.getElementById("startBtn");
const holdBtn = document.getElementById("holdBtn");
const resumeBtn = document.getElementById("resumeBtn");
const completeBtn = document.getElementById("completeBtn");
const statusBar = document.getElementById("statusBar");

// ================= LOAD JOBS =================
async function loadJobs(){
  const res = await fetch(API + "/api/jobs/list");
  const jobs = await res.json();

  jobDropdown.innerHTML = `<option value="">Select Job</option>`;

  jobs.forEach(j=>{
    const opt = document.createElement("option");
    opt.value = j.jobId;
    opt.textContent = j.jobId;
    opt.dataset.orderId = j.orderId;
    opt.dataset.customer = j.customer;
    opt.dataset.requirement = j.requirement;
    opt.dataset.machines = JSON.stringify(j.machines);
    jobDropdown.appendChild(opt);
  });
}

jobDropdown.addEventListener("change", async ()=>{
  const id = jobDropdown.value;
  if(!id) return;

  // 🔹 Get Job Details
  const jobRes = await fetch(API + `/api/jobs/details/${id}`);
  const job = await jobRes.json();
  if(!job.success) return;

  orderId.value = job.data.orderId;
  customer.value = job.data.customer;
  requirement.value = job.data.requirement;

  machineName.innerHTML = `<option value="">Select Machine</option>`;
  job.data.machines.forEach(m=>{
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    machineName.appendChild(opt);
  });

  // 🔹 Get Production Status
  const statusRes = await fetch(API + `/api/production/status/${id}`);
  const statusData = await statusRes.json();

  if(!statusData.success){
    updateUI("IDLE");
    stopTimer();
    timerEl.innerText="00:00:00";
    return;
  }

  if(statusData.status === "RUNNING"){
    updateUI("RUNNING");
    startTimer(statusData.startTime);
  }

  if(statusData.status === "HOLD"){
    updateUI("HOLD");
    stopTimer();
    startTimer(statusData.startTime);
  }

  if(statusData.status === "COMPLETED"){
    updateUI("COMPLETED");
    stopTimer();
  }
});



// ================= VALIDATION FUNCTION =================
function validateSelection(){
  if(!jobDropdown.value){
    alert("Select Job ID first");
    return false;
  }
  if(!operatorName.value){
    alert("Select Operator");
    return false;
  }
  if(!machineName.value){
    alert("Select Machine");
    return false;
  }
  return true;
}

// ================= STATUS CONTROL =================
function updateUI(status){
  currentStatus = status;

  statusBar.className = "status";
  statusBar.innerText = status;

  // Reset visibility first
  startBtn.style.display = "none";
  holdBtn.style.display = "none";
  resumeBtn.style.display = "none";
  completeBtn.style.display = "none";

  if(status === "IDLE"){
    startBtn.style.display = "inline-block";
    startBtn.disabled = false;
    timerEl.innerText = "00:00:00";
  }

  if(status === "RUNNING"){
    holdBtn.style.display = "inline-block";
    completeBtn.style.display = "inline-block";
    holdBtn.disabled = false;
    completeBtn.disabled = false;
    statusBar.classList.add("running");
  }

  if(status === "HOLD"){
    resumeBtn.style.display = "inline-block";
    statusBar.classList.add("hold");
  }

  if(status === "COMPLETED"){
    statusBar.classList.add("completed");
    stopTimer();
  }
}


// ================= START =================
startBtn.onclick = async ()=>{
  if(!jobDropdown.value || !operatorName.value || !machineName.value){
    alert("Fill all fields");
    return;
  }

  const res = await fetch(API + "/api/production/start",{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({
      jobId:jobDropdown.value,
      orderId:orderId.value,
      operator:operatorName.value,
      machine:machineName.value
    })
  });

  const result = await res.json();

  if(result.success){
    const statusRes = await fetch(`/api/production/status/${jobDropdown.value}`);
    const statusData = await statusRes.json();

    if(statusData.success){
      updateUI(statusData.status);
      startTimer(statusData.startTime);
    }
  } else {
    alert(result.message);
  }
};

// ================= HOLD =================
holdBtn.onclick = async ()=>{
  const reason = prompt("Hold reason?");
  if(!reason) return;

  const res = await fetch("/api/production/hold",{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({
      jobId:jobDropdown.value,
      reason
    })
  });

  const result = await res.json();
  if(result.success){
    updateUI("HOLD");
  }
};

// ================= RESUME =================
resumeBtn.onclick = async ()=>{
  const res = await fetch("/api/production/resume",{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({
      jobId:jobDropdown.value
    })
  });

  const result = await res.json();
  if(result.success){
    updateUI("RUNNING");
  }
};

// ================= COMPLETE =================
completeBtn.onclick = async ()=>{
  await fetch("/api/production/complete",{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({ jobId:jobDropdown.value })
  });

  updateUI("COMPLETED");
  stopTimer();

  // Remove from dropdown
  loadJobs();
};

window.addEventListener("DOMContentLoaded", () => {
  loadJobs();
});


