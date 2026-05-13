const URL = "https://script.google.com/macros/s/AKfycbxz1LzTv97BuJhZEps0ntTJ0YGqaMd9MkXSIdiygsEFUDJs0iv7dq1NY2kmY6sJfnWV/exec"; // APNI NAYI URL YAHAN DALEIN
let user = "";

let currentUserRole = "";
let currentUserName = "";
let currentUserEmail = "";
let allTicketsData = []; 
let activeChatTicketId = null;

// ESCAPE HTML FUNCTION (Additive)
function escapeHTML(str) {
    if (!str) return "";
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getFormattedDateTime() {
    let d = new Date();
    let pad = (n) => n < 10 ? '0' + n : n;
    return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function show(id) {
    ["view-login", "view-reg", "view-reset", "view-emp", "view-adm"].forEach(v => document.getElementById(v).style.display = "none");
    document.getElementById(id).style.display = "block";
}

function toggleTicketForm(s) {
    document.getElementById("ticket-form-section").style.display = s ? "block" : "none";
}

async function api(data) {
    return fetch(URL, { method: 'POST', body: new URLSearchParams(data) }).then(res => res.json());
}

// PERSISTENT SESSION (window.onload)
window.onload = function() {
    let session = localStorage.getItem("erp_session");
    if (session) {
        let d = JSON.parse(session);
        user = d.user; currentUserRole = d.role; currentUserName = d.name; currentUserEmail = d.email;
        currentUserRole === "Admin" ? show("view-adm") : show("view-emp");
        loadTickets(currentUserRole);
    } else {
        show("view-login");
    }
    initWheelLogic();
};

function doLogout() {
    localStorage.removeItem("erp_session");
    location.reload();
}

// LOGIN & REGISTRATION
async function doLogin() {
    let btn = document.getElementById("btn-login");
    user = document.getElementById("l-user").value;
    let pass = document.getElementById("l-pass").value;
    if(!user || !pass) return alert("Fill ID/Pass");
    btn.innerText = "Checking..."; btn.disabled = true;

    try {
        let res = await api({ action: "login", username: user, password: pass });
        if (res.status == "success") {
            currentUserRole = res.role.trim(); currentUserName = res.name.trim(); currentUserEmail = res.email;
            localStorage.setItem("erp_session", JSON.stringify({ user, role: currentUserRole, name: currentUserName, email: currentUserEmail }));
            res.role == "Admin" ? show("view-adm") : show("view-emp");
            loadTickets(res.role);
        } else alert("Error");
    } catch (e) { alert("Server Error"); }
    btn.innerText = "Login"; btn.disabled = false;
}

async function sendOTP() {
    let email = document.getElementById("r-email").value;
    let res = await api({ action: "sendOtp", email });
    if(res.status == "success") document.getElementById("otp-box").style.display = "block";
}

async function verifyOTP() {
    let res = await api({ action: "verifyOtp", email: document.getElementById("r-email").value, otp: document.getElementById("r-otp").value });
    if (res.status == "success") document.getElementById("btn-reg").disabled = false;
}

async function doRegister() {
    await api({
        action: "register", name: document.getElementById("r-name").value, coordinator: document.getElementById("r-coord").value,
        designation: document.getElementById("r-desig").value, password: document.getElementById("r-pass").value, email: document.getElementById("r-email").value
    });
    alert("Check Email for PIN"); show("view-login");
}

async function addTicket() {
    let title = document.getElementById("t-title").value;
    let issue = document.getElementById("t-issue").value;
    if(!title || !issue) return alert("Title and Issue are mandatory");

    let btn = document.getElementById("btn-submit-ticket");
    btn.innerText = "Saving..."; btn.disabled = true;

    let res = await api({ action: "createTicket", empName: currentUserName, email: currentUserEmail, title: title, issue: issue, date: getFormattedDateTime() });
    if(res.status == "success") {
        alert("Logged!"); toggleTicketForm(false); loadTickets("Employee");
    }
    btn.innerText = "Submit Ticket"; btn.disabled = false;
}

// LOAD TICKETS (Mobile & Desktop logic)
async function loadTickets(role) {
    let tableId = role == "Admin" ? "t-adm" : "t-emp";
    document.getElementById(tableId).innerHTML = "<tr><td colspan='6' align='center'>Fetching data...</td></tr>";

    try {
        allTicketsData = await fetch(URL).then(r => r.json());
        let html = `<tr><th>S.No</th><th>ID & Date</th><th>Title</th><th class="hide-mobile">User Info</th><th class="hide-mobile">Issue</th><th class="hide-mobile">Status</th>${role=='Admin'?'<th class="hide-mobile">Action</th>':''}</tr>`;
        
        let sno = 1;
        [...allTicketsData].reverse().forEach(t => {
            if (role == "Admin" || t.empName == currentUserName) {
                let statusClass = "status-" + t.status;
                html += `<tr onclick="openCapsule('${t.ticketId}')" style="cursor:pointer">
                    <td>${sno++}</td>
                    <td><b>${t.ticketId}</b><br><small>${t.date}</small></td>
                    <td>${escapeHTML(t.title || 'No Title')}</td>
                    <td class="hide-mobile">${t.empName}</td>
                    <td class="hide-mobile">${escapeHTML(t.issue).substring(0,30)}...</td>
                    <td class="${statusClass} hide-mobile">${t.status}</td>
                    ${role=='Admin'? `<td class="hide-mobile" onclick="event.stopPropagation()"><select onchange="update('${t.ticketId}', this.value)"><option ${t.status=='Pending'?'selected':''}>Pending</option><option ${t.status=='In Progress'?'selected':''}>In Progress</option><option ${t.status=='Completed'?'selected':''}>Completed</option></select></td>`:''}
                </tr>`;
            }
        });
        document.getElementById(tableId).innerHTML = html;
    } catch(e) { console.error(e); }
}

async function update(ticketId, newStatus) {
    await api({ action: "updateStatus", ticketId, newStatus });
    loadTickets("Admin");
}

// ----------------------------------------------------------------
// WHEEL CAPSULE INTERACTION (SMOOTH MOBILE UI)
// ----------------------------------------------------------------

let wheelStartX = 0;
let isDragging = false;

function initWheelLogic() {
    const wheel = document.getElementById("dragger-wheel");
    const bar = document.getElementById("wheel-bar");

    const start = (e) => {
        if(document.getElementById("capsule-wrapper").classList.contains("top-mode")) return;
        isDragging = true;
        wheelStartX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        wheel.style.transition = "none";
    };

    const move = (e) => {
        if(!isDragging) return;
        let x = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
        let delta = x - wheelStartX;
        if(delta < -90) delta = -90; if(delta > 90) delta = 90;
        wheel.style.left = `calc(50% + ${delta}px)`;
    };

    const end = (e) => {
        if(!isDragging) return;
        isDragging = false;
        let x = e.type.includes("mouse") ? e.clientX : e.changedTouches[0].clientX;
        let delta = x - wheelStartX;
        
        wheel.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        
        if(delta < -50) { // Drag Left -> Desc
            setCapsuleMode("left");
        } else if(delta > 50) { // Drag Right -> Chat
            setCapsuleMode("right");
        } else {
            wheel.style.left = "50%";
        }
    };

    wheel.addEventListener("mousedown", start); wheel.addEventListener("touchstart", start);
    window.addEventListener("mousemove", move); window.addEventListener("touchmove", move);
    window.addEventListener("mouseup", end); window.addEventListener("touchend", end);
}

function setCapsuleMode(mode) {
    const wrapper = document.getElementById("capsule-wrapper");
    const wheel = document.getElementById("dragger-wheel");
    wrapper.classList.add("top-mode");

    if(mode === "left") {
        wheel.style.left = "15%";
        document.getElementById("panel-desc").classList.add("active");
        document.getElementById("panel-chat").classList.remove("active");
    } else {
        wheel.style.left = "85%";
        document.getElementById("panel-chat").classList.add("active");
        document.getElementById("panel-desc").classList.remove("active");
        renderChats();
    }
}

function openCapsule(id) {
    activeChatTicketId = id;
    let t = allTicketsData.find(x => x.ticketId === id);
    document.getElementById("full-issue-text").innerText = t.issue;
    document.getElementById("chat-title").innerText = "Ticket: " + id;
    
    document.getElementById("capsule-modal").style.display = "flex";
    setTimeout(() => { document.getElementById("capsule-modal").style.opacity = "1"; }, 10);
    resetCapsuleUI();
}

function resetCapsuleUI() {
    const wrapper = document.getElementById("capsule-wrapper");
    const wheel = document.getElementById("dragger-wheel");
    wrapper.classList.remove("top-mode");
    wheel.style.left = "50%";
    document.getElementById("panel-desc").classList.remove("active");
    document.getElementById("panel-chat").classList.remove("active");
}

function closeCapsule() {
    document.getElementById("capsule-modal").style.opacity = "0";
    setTimeout(() => { document.getElementById("capsule-modal").style.display = "none"; }, 400);
}

// CHAT RENDER (RETAINED)
function renderChats() {
    let t = allTicketsData.find(x => x.ticketId === activeChatTicketId);
    let box = document.getElementById("chat-box");
    let html = `<div class="msg msg-other"><b>${t.empName}:</b><br>${escapeHTML(t.issue)}</div>`;
    
    if(t.chats) {
        JSON.parse(t.chats).forEach(c => {
            let side = c.senderRole == currentUserRole ? "msg-mine" : "msg-other";
            html += `<div class="msg ${side}"><b>${c.senderRole}:</b><br>${escapeHTML(c.msg)}</div>`;
        });
    }
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

async function sendReply() {
    let msg = document.getElementById("chat-msg").value;
    if(!msg) return;
    await api({ action: "addReply", ticketId: activeChatTicketId, senderRole: currentUserRole, msg, time: getFormattedDateTime() });
    document.getElementById("chat-msg").value = "";
    loadTickets(currentUserRole).then(() => renderChats());
}
