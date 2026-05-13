const URL = "https://script.google.com/macros/s/AKfycbxz1LzTv97BuJhZEps0ntTJ0YGqaMd9MkXSIdiygsEFUDJs0iv7dq1NY2kmY6sJfnWV/exec"; // APNI NAYI URL YAHAN DALEIN
let user = "";

let currentUserRole = "";
let currentUserName = "";
let currentUserEmail = "";
let currentUserPhone = "";
let allTicketsData = []; 
let activeChatTicketId = null;

function escapeHTML(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

function toggleTicketForm(showForm) {
    document.getElementById("ticket-form-section").style.display = showForm ? "block" : "none";
    if(!showForm) {
        document.getElementById("t-title").value = "";
        document.getElementById("t-issue").value = "";
    }
}

async function api(data) {
    let p = new URLSearchParams(data);
    return fetch(URL, { method: 'POST', body: p }).then(res => res.json());
}

// Function kept intact to prevent deletion
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// ----------------------------------------------------------------
// SESSION HANDLING & WINDOW RESIZE FIX
// ----------------------------------------------------------------
window.onload = function() {
    let sessionData = localStorage.getItem("erp_session");
    if (sessionData) {
        let data = JSON.parse(sessionData);
        user = data.user; currentUserRole = data.role; currentUserName = data.name; currentUserEmail = data.email; currentUserPhone = data.phone;
        currentUserRole === "Admin" ? show("view-adm") : show("view-emp");
        loadTickets(currentUserRole);
    } else {
        show("view-login");
    }
    initCapsuleEvents(); // Initialize Mobile Capsule
};

// FIX FOR INSPECT MODE CLOSING (Mobile -> Desktop view switch)
window.addEventListener('resize', () => {
    if(window.innerWidth > 768 && document.getElementById("capsule-modal").style.display !== "none") {
        closeCapsuleModal();
    }
});

function doLogout() {
    localStorage.removeItem("erp_session"); 
    location.reload(); 
}

// ----------------------------------------------------------------
// LOGIN, REGISTER & OTP
// ----------------------------------------------------------------
async function doLogin() {
    let btn = document.getElementById("btn-login");
    user = document.getElementById("l-user").value;
    let pass = document.getElementById("l-pass").value;

    if(!user || !pass) return alert("Please enter User ID and Password");
    btn.innerText = "Logging in..."; btn.disabled = true;

    try {
        let res = await api({ action: "login", username: user, password: pass });
        if (res.status == "force_reset") {
            show("view-reset");
        } else if (res.status == "success") {
            currentUserRole = res.role.trim(); currentUserName = res.name.trim(); currentUserEmail = res.email; currentUserPhone = res.phone;
            localStorage.setItem("erp_session", JSON.stringify({ user: user, role: currentUserRole, name: currentUserName, email: currentUserEmail, phone: currentUserPhone }));
            res.role == "Admin" ? show("view-adm") : show("view-emp");
            loadTickets(res.role);
        } else { alert("Invalid Login Credentials"); }
    } catch (e) { alert("Server Error! Check URL or Internet."); }
    btn.innerText = "Login"; btn.disabled = false;
}

async function sendOTP() {
    let email = document.getElementById("r-email").value;
    if(!email) return alert("Please enter Email ID");
    let btn = document.getElementById("btn-otp"); btn.innerText = "Sending OTP..."; btn.disabled = true;
    try {
        let res = await api({ action: "sendOtp", email: email });
        if (res.status == "success") { document.getElementById("otp-box").style.display = "block"; btn.innerText = "OTP Sent!"; } 
        else { alert("Error: " + res.message); btn.innerText = "Verify Email"; btn.disabled = false; }
    } catch(e) { alert("Network Error!"); btn.innerText = "Verify Email"; btn.disabled = false; }
}

async function verifyOTP() {
    let btn = document.getElementById("btn-verify-otp"); btn.innerText = "Verifying..."; btn.disabled = true;
    try {
        let res = await api({ action: "verifyOtp", email: document.getElementById("r-email").value, otp: document.getElementById("r-otp").value });
        if (res.status == "success") { document.getElementById("btn-reg").disabled = false; btn.innerText = "Verified ✔"; btn.style.color = "green"; btn.style.borderColor = "green"; } 
        else { alert("Wrong OTP"); btn.innerText = "Confirm OTP"; btn.disabled = false; }
    } catch(e) { alert("Network Error!"); btn.innerText = "Confirm OTP"; btn.disabled = false; }
}

async function doRegister() {
    let btn = document.getElementById("btn-reg"); btn.innerText = "Registering..."; btn.disabled = true;
    try {
        let res = await api({
            action: "register", name: document.getElementById("r-name").value, coordinator: document.getElementById("r-coord").value,
            designation: document.getElementById("r-desig").value, password: document.getElementById("r-pass").value, email: document.getElementById("r-email").value
        });
        if(res.status == "success") {
            alert("Registered successfully! Check your Email for User ID and PIN to login.");
            document.getElementById("view-reg").querySelectorAll('input').forEach(i => i.value = ''); show("view-login");
        } else { alert("Error: " + res.message); }
    } catch (e) { alert("Server Error during Registration."); }
    btn.innerText = "Register Account"; btn.disabled = false;
}

async function doReset() {
    let btn = document.getElementById("btn-reset"); let newPass = document.getElementById("rs-new").value;
    if(!newPass) return alert("Enter new password"); btn.innerText = "Updating..."; btn.disabled = true;
    try {
        await api({ action: "resetPassword", userId: user, newPassword: newPass });
        alert("Password updated! Please Login again."); document.getElementById("rs-new").value = ""; show("view-login");
    } catch(e) { alert("Error updating password."); }
    btn.innerText = "Update & Login"; btn.disabled = false;
}

// ----------------------------------------------------------------
// TICKET LOGGING & LOADING
// ----------------------------------------------------------------
async function addTicket() {
    let title = document.getElementById("t-title").value.trim();
    let issue = document.getElementById("t-issue").value.trim();
    if(!title) return alert("Please enter a Ticket Title.");
    if(!issue) return alert("Please describe the issue.");
    
    let btn = document.getElementById("btn-submit-ticket");
    let d = getFormattedDateTime();
    let table = document.getElementById("t-emp");
    let currentRows = table.getElementsByTagName("tr").length;
    let tempSno = currentRows > 1 && !table.innerHTML.includes("Loading") && !table.innerHTML.includes("No tickets") ? currentRows : 1; 
    let safeTitle = escapeHTML(title); let safeIssue = escapeHTML(issue);

    let tempRow = `<tr style="background-color: #f8f9fa; opacity: 0.7;">
        <td>${tempSno}</td>
        <td><b>Saving...</b><br><span class="small-text">${d}</span></td>
        <td>${safeTitle.length > 20 ? safeTitle.substring(0,20)+'...' : safeTitle}</td>
        <td class="hide-on-mobile">${safeIssue.length > 30 ? safeIssue.substring(0,30)+'...' : safeIssue}</td>
        <td class="hide-on-mobile">-</td><td class="status-Pending hide-on-mobile">Pending</td></tr>`;

    let tableContent = table.innerHTML.replace(`<tr><td colspan="8" style="text-align:center; padding: 30px; font-size: 16px; color: #555;"><b>⏳ Loading your tickets... Please wait.</b></td></tr>`, "")
                                      .replace(`<tr><td colspan="8" style="text-align:center;">No tickets found.</td></tr>`, "");
    if(tableContent.indexOf("</tr>") !== -1) {
        table.innerHTML = tableContent.slice(0, tableContent.indexOf("</tr>") + 5) + tempRow + tableContent.slice(tableContent.indexOf("</tr>") + 5);
    } else { table.innerHTML += tempRow; }

    toggleTicketForm(false); btn.innerText = "Submitting..."; btn.disabled = true;
    let payload = { action: "createTicket", empName: currentUserName, email: currentUserEmail, phone: currentUserPhone, issue: issue, title: title, date: d };

    try {
        let res = await api(payload);
        if(res.status == "success") loadTickets("Employee"); 
        else alert("Error saving ticket.");
    } catch(e) { alert("Upload failed."); loadTickets("Employee"); }
    btn.innerText = "Submit Ticket"; btn.disabled = false;
}

async function loadTickets(role) {
    let tableId = role == "Admin" ? "t-adm" : "t-emp";
    let colSpan = role == 'Admin' ? 7 : 6;
    
    document.getElementById(tableId).innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding: 30px; font-size: 16px; color: #555;"><b>⏳ Loading your tickets... Please wait.</b></td></tr>`;

    try {
        allTicketsData = await fetch(URL).then(r => r.json());
        
        let html = `<tr><th>S.No.</th><th>ID & Date</th><th>Title</th>`;
        if(role == "Admin") html += `<th class="hide-on-mobile">User Info</th>`;
        html += `<th class="hide-on-mobile">Issue</th><th class="hide-on-mobile">Details</th><th class="hide-on-mobile">Status</th>${role == "Admin" ? "<th class='hide-on-mobile'>Action</th>" : ""}</tr>`;
        
        let sno = 1; 
        [...allTicketsData].reverse().forEach(t => {
            if (role == "Admin" || t.empName == currentUserName) {
                let statusClass = t.status ? "status-" + t.status.split(" ")[0] : "status-Pending";
                let safeTitle = t.title ? escapeHTML(t.title) : "No Title";
                let safeIssue = t.issue ? escapeHTML(t.issue) : "";

                // Desktop Read More Triggers
                let displayTitle = safeTitle.length > 20 
                    ? safeTitle.substring(0, 20) + `... <br><a href="#" onclick="viewFullText('Title', '${t.ticketId}')" class="hide-on-mobile" style="color:#0284c7; font-weight:bold; font-size:12px; margin-top:5px; display:inline-block;">Read More</a>` 
                    : safeTitle;

                let displayIssue = safeIssue.length > 40 
                    ? safeIssue.substring(0, 40) + `... <br><a href="#" onclick="viewFullText('Issue', '${t.ticketId}')" style="color:#0284c7; font-weight:bold; font-size:12px; margin-top:5px; display:inline-block;">Read More</a>` 
                    : safeIssue;

                html += `<tr onclick="if(window.innerWidth <= 768) openCapsule('${t.ticketId}')" style="cursor: pointer;">
                    <td>${sno++}</td>
                    <td><b>${t.ticketId}</b><br><span class="small-text">${t.date}</span></td>
                    <td>${displayTitle}<div class="mobile-tap-hint">Tap to view</div></td>`;
                
                if(role == "Admin") {
                    html += `<td class="hide-on-mobile"><b>${t.empName || '-'}</b><br><span class="small-text">${t.phone || '-'}</span></td>`;
                }

                // Desktop columns
                html += `<td class="hide-on-mobile">${displayIssue}</td>
                    <td class="hide-on-mobile"><a href="#" onclick="openChat('${t.ticketId}'); event.stopPropagation();"><b>View Details</b></a></td>
                    <td class="${statusClass} hide-on-mobile">${t.status || 'Pending'}</td>`;
                
                if (role == "Admin") {
                    let s1 = t.status == "Pending" ? "selected" : "";
                    let s2 = t.status == "In Progress" ? "selected" : "";
                    let s3 = t.status == "Completed" ? "selected" : "";
                    html += `<td class="hide-on-mobile" onclick="event.stopPropagation()">
                        <select onchange="update('${t.ticketId}', this.value)">
                        <option ${s1}>Pending</option><option ${s2}>In Progress</option><option ${s3}>Completed</option>
                    </select></td>`;
                }
                html += `</tr>`;
            }
        });

        if(sno === 1) html += `<tr><td colspan="${colSpan}" style="text-align:center;">No tickets found.</td></tr>`;
        document.getElementById(tableId).innerHTML = html;
        
    } catch(e) { 
        document.getElementById(tableId).innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding: 30px; font-size: 16px; color: red;"><b>❌ Error loading tickets. Check internet or refresh.</b></td></tr>`;
    }
}

async function update(id, s) {
    api({ action: "updateStatus", ticketId: id, newStatus: s });
    setTimeout(() => loadTickets("Admin"), 1000); 
}

// ----------------------------------------------------------------
// ORIGINAL DESKTOP MODAL LOGIC (Intact)
// ----------------------------------------------------------------

function viewFullText(type, ticketId) {
    let ticket = allTicketsData.find(t => t.ticketId === ticketId);
    if(ticket) {
        document.getElementById("issue-modal-title").innerText = type === 'Title' ? 'Ticket Title' : 'Issue Description';
        document.getElementById("full-issue-text").innerText = type === 'Title' ? ticket.title : ticket.issue;
        document.getElementById("issue-modal").style.display = "flex";
    }
}

function closeIssueModal() {
    document.getElementById("issue-modal").style.display = "none";
}

function openChat(ticketId) {
    activeChatTicketId = ticketId;
    document.getElementById("chat-title").innerText = `Ticket: ${ticketId}`;
    document.getElementById("chat-modal").style.display = "flex";
    renderChats();
}

function closeChat() {
    document.getElementById("chat-modal").style.display = "none";
    activeChatTicketId = null;
}

function renderChats() {
    let ticket = allTicketsData.find(t => t.ticketId === activeChatTicketId);
    let chatBox = document.getElementById("chat-box");
    
    let isMyTicket = (ticket.empName === currentUserName);
    let originalClass = isMyTicket ? "chat-mine" : "chat-other";
    
    let html = `
        <div class="chat-bubble ${originalClass}">
            <div class="chat-sender">${ticket.empName} (Original Issue)</div>
            ${escapeHTML(ticket.issue)}
            <span class="chat-time">${ticket.date}</span>
        </div>
    `;

    if(ticket.chats && ticket.chats !== "[]" && ticket.chats !== "") {
        let chatsArr = JSON.parse(ticket.chats);
        chatsArr.forEach(c => {
            let isMine = (c.senderRole.trim().toLowerCase() === currentUserRole.toLowerCase());
            let bubbleClass = isMine ? "chat-mine" : "chat-other";
            let senderName = (c.senderRole.trim().toLowerCase() === 'admin') ? 'Admin / Support' : ticket.empName;
            
            html += `<div class="chat-bubble ${bubbleClass}"><div class="chat-sender">${senderName}</div>${escapeHTML(c.msg)}<span class="chat-time">${c.time}</span></div>`;
        });
    }
    chatBox.innerHTML = html;
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendReply() {
    let msgInput = document.getElementById("chat-msg"); let msg = msgInput.value.trim(); if(!msg) return;
    let btn = document.getElementById("btn-send-reply"); btn.innerText = "..."; btn.disabled = true;
    let d = getFormattedDateTime();
    let chatBox = document.getElementById("chat-box");
    
    chatBox.innerHTML += `<div class="chat-bubble chat-mine" style="opacity:0.7;"><div class="chat-sender">Sending...</div>${escapeHTML(msg)}<span class="chat-time">${d}</span></div>`;
    chatBox.scrollTop = chatBox.scrollHeight; msgInput.value = "";

    try {
        await api({ action: "addReply", ticketId: activeChatTicketId, senderRole: currentUserRole, msg: msg, time: d });
        await loadTickets(currentUserRole); if(activeChatTicketId) renderChats(); 
    } catch(e) { alert("Failed to send reply"); }
    btn.innerText = "Send"; btn.disabled = false;
}

// ----------------------------------------------------------------
// NEW MOBILE CAPSULE LOGIC WITH DIRECT SLIDE & SPINNING WHEEL
// ----------------------------------------------------------------

let isDragging = false;
let startX = 0;
let dragOffset = 0; // Tracks if wheel is already at left/right before drag

function initCapsuleEvents() {
    const wheel = document.getElementById("wheel");
    const capsuleBar = document.getElementById("capsule-bar");

    wheel.addEventListener("touchstart", dragStart, {passive: true});
    window.addEventListener("touchmove", dragMove, {passive: true});
    window.addEventListener("touchend", dragEnd);
    
    // For PC testing if needed
    wheel.addEventListener("mousedown", dragStart);
    window.addEventListener("mousemove", dragMove);
    window.addEventListener("mouseup", dragEnd);

    capsuleBar.addEventListener("click", (e) => {
        if(!isDragging && document.getElementById("capsule-wrapper").classList.contains("top-mode")) resetCapsule();
    });
}

function dragStart(e) {
    // FIX: Removed the "if top-mode return" check so user can drag directly from sides!
    isDragging = true;
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    
    let wheel = document.getElementById("wheel");
    wheel.style.transition = "none";
    
    // Detect starting offset if it's already slid to left or right
    if (wheel.classList.contains("drag-left")) dragOffset = -80;
    else if (wheel.classList.contains("drag-right")) dragOffset = 80;
    else dragOffset = 0;
    
    // Remove the classes so we can manually translate it smoothly
    wheel.className = "wheel"; 
    wheel.style.transform = `translateX(calc(-50% + ${dragOffset}px)) rotate(${dragOffset * 3}deg)`;
}

function dragMove(e) {
    if(!isDragging) return;
    let deltaX = (e.type.includes("mouse") ? e.clientX : e.touches[0].clientX) - startX;
    let newX = dragOffset + deltaX;
    
    // The bar is smaller when in top-mode, limit the drag distance accordingly
    let maxDrag = document.getElementById("capsule-wrapper").classList.contains("top-mode") ? 70 : 100;
    if(newX < -maxDrag) newX = -maxDrag; 
    if(newX > maxDrag) newX = maxDrag;
    
    // FIX: Multiply by 3 for realistic wheel rotation effect while dragging!
    document.getElementById("wheel").style.transform = `translateX(calc(-50% + ${newX}px)) rotate(${newX * 3}deg)`;
}

function dragEnd(e) {
    if(!isDragging) return;
    isDragging = false;
    let wheel = document.getElementById("wheel");
    wheel.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), left 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
    
    let deltaX = (e.type.includes("mouse") ? e.clientX : e.changedTouches[0].clientX) - startX;
    let finalX = dragOffset + deltaX;
    
    if (finalX < -40) activateCapsuleState('left');
    else if (finalX > 40) activateCapsuleState('right');
    else resetCapsule(); // Snap back to center
}

function activateCapsuleState(direction) {
    const wheel = document.getElementById("wheel");
    const wrapper = document.getElementById("capsule-wrapper");
    const bar = document.getElementById("capsule-bar");
    
    wheel.style.transform = `translateX(0)`; // Reset translation as classes will handle layout
    wrapper.classList.add("top-mode");

    if(direction === 'left') {
        wheel.className = "wheel drag-left"; 
        bar.className = "capsule-bar left-active";
        document.getElementById("capsule-content-desc").classList.add("active");
        document.getElementById("capsule-content-chat").classList.remove("active");
    } else {
        wheel.className = "wheel drag-right"; 
        bar.className = "capsule-bar right-active";
        document.getElementById("capsule-content-chat").classList.add("active");
        document.getElementById("capsule-content-desc").classList.remove("active");
        renderCapsuleChats(); 
    }
}

function resetCapsule() {
    document.getElementById("wheel").className = "wheel";
    document.getElementById("wheel").style.transform = `translateX(-50%) rotate(0deg)`;
    document.getElementById("capsule-bar").className = "capsule-bar";
    document.getElementById("capsule-wrapper").classList.remove("top-mode");
    document.getElementById("capsule-content-desc").classList.remove("active");
    document.getElementById("capsule-content-chat").classList.remove("active");
}

function openCapsule(ticketId) {
    activeChatTicketId = ticketId;
    let ticket = allTicketsData.find(t => t.ticketId === ticketId);
    document.getElementById("capsule-desc-text").innerText = ticket.issue;
    
    document.getElementById("capsule-modal").style.display = "flex";
    setTimeout(() => { document.getElementById("capsule-modal").style.opacity = "1"; }, 10);
    resetCapsule();
}

function closeCapsuleModal() {
    document.getElementById("capsule-modal").style.opacity = "0";
    setTimeout(() => { document.getElementById("capsule-modal").style.display = "none"; }, 300);
    activeChatTicketId = null;
    resetCapsule();
}

function renderCapsuleChats() {
    let ticket = allTicketsData.find(t => t.ticketId === activeChatTicketId);
    let chatBox = document.getElementById("capsule-chat-box");
    let isMyTicket = (ticket.empName === currentUserName);
    let originalClass = isMyTicket ? "chat-mine" : "chat-other";
    
    let html = `<div class="chat-bubble ${originalClass}"><div class="chat-sender">${ticket.empName} (Original)</div>${escapeHTML(ticket.issue)}<span class="chat-time">${ticket.date}</span></div>`;

    if(ticket.chats && ticket.chats !== "[]" && ticket.chats !== "") {
        let chatsArr = JSON.parse(ticket.chats);
        chatsArr.forEach(c => {
            let isMine = (c.senderRole.trim().toLowerCase() === currentUserRole.toLowerCase());
            let bubbleClass = isMine ? "chat-mine" : "chat-other";
            let senderName = (c.senderRole.trim().toLowerCase() === 'admin') ? 'Admin' : ticket.empName;
            html += `<div class="chat-bubble ${bubbleClass}"><div class="chat-sender">${senderName}</div>${escapeHTML(c.msg)}<span class="chat-time">${c.time}</span></div>`;
        });
    }
    chatBox.innerHTML = html;
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendCapsuleReply() {
    let msgInput = document.getElementById("capsule-chat-msg"); let msg = msgInput.value.trim(); if(!msg) return;
    let btn = document.getElementById("capsule-btn-send-reply"); btn.innerText = "..."; btn.disabled = true;
    let d = getFormattedDateTime();
    let chatBox = document.getElementById("capsule-chat-box");
    
    chatBox.innerHTML += `<div class="chat-bubble chat-mine" style="opacity:0.7;"><div class="chat-sender">Sending...</div>${escapeHTML(msg)}<span class="chat-time">${d}</span></div>`;
    chatBox.scrollTop = chatBox.scrollHeight; msgInput.value = "";

    try {
        await api({ action: "addReply", ticketId: activeChatTicketId, senderRole: currentUserRole, msg: msg, time: d });
        await loadTickets(currentUserRole); if(activeChatTicketId) renderCapsuleChats(); 
    } catch(e) { alert("Failed to send reply"); }
    btn.innerText = "Send"; btn.disabled = false;
}
