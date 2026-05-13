const URL = "https://script.google.com/macros/s/AKfycbxz1LzTv97BuJhZEps0ntTJ0YGqaMd9MkXSIdiygsEFUDJs0iv7dq1NY2kmY6sJfnWV/exec"; // APNI NAYI URL YAHAN DALEIN
let user = "";

let currentUserRole = "";
let currentUserName = "";
let currentUserEmail = "";
let currentUserPhone = "";
let allTicketsData = []; 
let activeChatTicketId = null;

// SECURITY FIX: Prevent HTML Injection
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

// Retained legacy function as per instructions to not delete any previous functions
function getBase64(file) {
    console.log("Legacy attachment function retained.");
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// ----------------------------------------------------------------
// SESSION HANDLING
// ----------------------------------------------------------------

window.onload = function() {
    let sessionData = localStorage.getItem("erp_session");
    if (sessionData) {
        let data = JSON.parse(sessionData);
        user = data.user;
        currentUserRole = data.role;
        currentUserName = data.name;
        currentUserEmail = data.email;
        currentUserPhone = data.phone;
        
        currentUserRole === "Admin" ? show("view-adm") : show("view-emp");
        loadTickets(currentUserRole);
    } else {
        show("view-login");
    }
    
    initCapsuleEvents(); // Initialize smooth wheel events
};

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
            currentUserRole = res.role.trim(); 
            currentUserName = res.name.trim();
            currentUserEmail = res.email;
            currentUserPhone = res.phone;
            
            localStorage.setItem("erp_session", JSON.stringify({
                user: user, role: currentUserRole, name: currentUserName, email: currentUserEmail, phone: currentUserPhone
            }));

            res.role == "Admin" ? show("view-adm") : show("view-emp");
            loadTickets(res.role);
        } else { alert("Invalid Login Credentials"); }
    } catch (e) { alert("Server Error! Check URL or Internet."); }

    btn.innerText = "Login"; btn.disabled = false;
}

async function sendOTP() {
    let email = document.getElementById("r-email").value;
    if(!email) return alert("Please enter Email ID");
    let btn = document.getElementById("btn-otp");
    btn.innerText = "Sending OTP..."; btn.disabled = true;
    
    try {
        let res = await api({ action: "sendOtp", email: email });
        if (res.status == "success") {
            document.getElementById("otp-box").style.display = "block";
            btn.innerText = "OTP Sent!";
        } else {
            alert("Error: " + res.message); btn.innerText = "Verify Email"; btn.disabled = false;
        }
    } catch(e) { alert("Network Error!"); btn.innerText = "Verify Email"; btn.disabled = false; }
}

async function verifyOTP() {
    let btn = document.getElementById("btn-verify-otp");
    btn.innerText = "Verifying..."; btn.disabled = true;

    try {
        let res = await api({ action: "verifyOtp", email: document.getElementById("r-email").value, otp: document.getElementById("r-otp").value });
        if (res.status == "success") {
            document.getElementById("btn-reg").disabled = false;
            btn.innerText = "Verified ✔"; btn.style.color = "green"; btn.style.borderColor = "green";
        } else { alert("Wrong OTP"); btn.innerText = "Confirm OTP"; btn.disabled = false; }
    } catch(e) { alert("Network Error!"); btn.innerText = "Confirm OTP"; btn.disabled = false; }
}

async function doRegister() {
    let btn = document.getElementById("btn-reg");
    btn.innerText = "Registering..."; btn.disabled = true;

    try {
        let res = await api({
            action: "register", name: document.getElementById("r-name").value, coordinator: document.getElementById("r-coord").value,
            designation: document.getElementById("r-desig").value, password: document.getElementById("r-pass").value, email: document.getElementById("r-email").value
        });

        if(res.status == "success") {
            alert("Registered successfully! Check your Email for User ID and PIN to login.");
            document.getElementById("view-reg").querySelectorAll('input').forEach(i => i.value = ''); 
            show("view-login");
        } else { alert("Error: " + res.message); }
    } catch (e) { alert("Server Error during Registration."); }

    btn.innerText = "Register Account"; btn.disabled = false;
}

async function doReset() {
    let btn = document.getElementById("btn-reset");
    let newPass = document.getElementById("rs-new").value;
    if(!newPass) return alert("Enter new password");
    btn.innerText = "Updating..."; btn.disabled = true;

    try {
        await api({ action: "resetPassword", userId: user, newPassword: newPass });
        alert("Password updated! Please Login again.");
        document.getElementById("rs-new").value = ""; show("view-login");
    } catch(e) { alert("Error updating password."); }

    btn.innerText = "Update & Login"; btn.disabled = false;
}

// ----------------------------------------------------------------
// TICKET LOGGING & LOADING
// ----------------------------------------------------------------

async function addTicket() {
    let title = document.getElementById("t-title").value.trim();
    let issue = document.getElementById("t-issue").value.trim();
    
    // Title is now mandatory
    if(!title) return alert("Please enter a Ticket Title.");
    if(!issue) return alert("Please describe the issue.");
    
    let btn = document.getElementById("btn-submit-ticket");
    let d = getFormattedDateTime();
    
    let table = document.getElementById("t-emp");
    let currentRows = table.getElementsByTagName("tr").length;
    let tempSno = currentRows > 1 && !table.innerHTML.includes("Loading") && !table.innerHTML.includes("No tickets") ? currentRows : 1; 
    
    let safeTitle = escapeHTML(title);

    // Optimistic row mapped to new columns (S.No, ID, Title, etc.)
    let tempRow = `<tr style="background-color: #f8f9fa; opacity: 0.7;">
        <td>${tempSno}</td>
        <td><b>Saving...</b><br><span class="small-text">${d}</span></td>
        <td><b>${safeTitle.length > 20 ? safeTitle.substring(0,20)+'...' : safeTitle}</b></td>
        <td class="hide-on-mobile">-</td><td class="hide-on-mobile">-</td><td class="status-Pending hide-on-mobile">Pending</td></tr>`;

    let tableContent = table.innerHTML.replace(`<tr><td colspan="8" style="text-align:center; padding: 30px; font-size: 16px; color: #555;"><b>⏳ Loading your tickets... Please wait.</b></td></tr>`, "")
                                      .replace(`<tr><td colspan="8" style="text-align:center;">No tickets found.</td></tr>`, "");
    if(tableContent.indexOf("</tr>") !== -1) {
        table.innerHTML = tableContent.slice(0, tableContent.indexOf("</tr>") + 5) + tempRow + tableContent.slice(tableContent.indexOf("</tr>") + 5);
    } else { table.innerHTML += tempRow; }

    toggleTicketForm(false);
    btn.innerText = "Submitting..."; btn.disabled = true;

    // Send title in payload, remove fileData
    let payload = { action: "createTicket", empName: currentUserName, email: currentUserEmail, phone: currentUserPhone, issue: issue, title: title, date: d };

    try {
        let res = await api(payload);
        if(res.status == "success") loadTickets("Employee"); 
        else alert("Error saving ticket.");
    } catch(e) {
        alert("Upload failed. Try without attachment or check internet.");
        loadTickets("Employee"); 
    }
    
    btn.innerText = "Submit Ticket"; btn.disabled = false;
}

async function loadTickets(role) {
    let tableId = role == "Admin" ? "t-adm" : "t-emp";
    let colSpan = role == 'Admin' ? 7 : 6;
    
    document.getElementById(tableId).innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding: 30px; font-size: 16px; color: #555;"><b>⏳ Loading your tickets... Please wait.</b></td></tr>`;

    try {
        allTicketsData = await fetch(URL).then(r => r.json());
        
        // Hide specific columns on mobile via CSS classes
        let html = "<tr><th>S.No.</th><th>ID & Date</th><th>Title</th>";
        if(role == "Admin") html += "<th class='hide-on-mobile'>User Info</th>";
        html += "<th class='hide-on-mobile'>Issue</th><th class='hide-on-mobile'>Details</th><th class='hide-on-mobile'>Status</th>" + (role == "Admin" ? "<th class='hide-on-mobile'>Action</th>" : "") + "</tr>";
        
        let sno = 1; 
        [...allTicketsData].reverse().forEach(t => {
            if (role == "Admin" || t.empName == currentUserName) {
                let statusClass = t.status ? "status-" + t.status.split(" ")[0] : "status-Pending";

                // Backward compatibility for old tickets without title
                let safeTitle = (t.title && t.title !== "No Attachment" && !t.title.startsWith("http")) ? escapeHTML(t.title) : "Ticket Issue";
                let safeIssue = t.issue ? escapeHTML(t.issue) : "";
                let displayIssue = safeIssue.length > 30 ? safeIssue.substring(0, 30) + `...` : safeIssue;

                html += `<tr onclick="openCapsule('${t.ticketId}')" style="cursor:pointer;">
                    <td>${sno++}</td>
                    <td><b>${t.ticketId}</b><br><span class="small-text">${t.date}</span></td>
                    <td><b>${safeTitle}</b><br><span class="small-text" style="color:#007bff;">Tap to view</span></td>`;
                
                if(role == "Admin") {
                    html += `<td class="hide-on-mobile"><b>${t.empName || '-'}</b><br><span class="small-text">${t.phone || '-'}</span></td>`;
                }

                html += `<td class="hide-on-mobile">${displayIssue}</td>
                    <td class="hide-on-mobile"><span style="color:#0284c7; font-weight:bold;">View Details</span></td>
                    <td class="${statusClass} hide-on-mobile">${t.status || 'Pending'}</td>`;
                
                if (role == "Admin") {
                    let s1 = t.status == "Pending" ? "selected" : "";
                    let s2 = t.status == "In Progress" ? "selected" : "";
                    let s3 = t.status == "Completed" ? "selected" : "";
                    // Stop propagation so changing status doesn't open capsule
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
// NEW: CAPSULE WHEEL INTERACTION LOGIC
// ----------------------------------------------------------------

let isDragging = false;
let startX = 0;
let currentTransform = 0;

function initCapsuleEvents() {
    const wheel = document.getElementById("wheel");
    const capsuleBar = document.getElementById("capsule-bar");

    // Touch Events for Mobile
    wheel.addEventListener("touchstart", dragStart, {passive: true});
    window.addEventListener("touchmove", dragMove, {passive: true});
    window.addEventListener("touchend", dragEnd);

    // Mouse Events for Desktop Testing
    wheel.addEventListener("mousedown", dragStart);
    window.addEventListener("mousemove", dragMove);
    window.addEventListener("mouseup", dragEnd);

    capsuleBar.addEventListener("click", (e) => {
        // If clicking the bar (not sliding the wheel), return to center
        if(!isDragging && document.getElementById("capsule-container").classList.contains("top-mode")) {
            resetCapsule();
        }
    });
}

function dragStart(e) {
    if(document.getElementById("capsule-container").classList.contains("top-mode")) return; // Don't drag if already open
    isDragging = true;
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    document.getElementById("wheel").style.transition = "none"; // Disable CSS transition for smooth drag
}

function dragMove(e) {
    if(!isDragging) return;
    let currentX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    let deltaX = currentX - startX;
    
    // Restrict drag boundaries
    if(deltaX < -110) deltaX = -110;
    if(deltaX > 110) deltaX = 110;
    
    document.getElementById("wheel").style.transform = `translateX(calc(-50% + ${deltaX}px))`;
}

function dragEnd(e) {
    if(!isDragging) return;
    isDragging = false;
    let wheel = document.getElementById("wheel");
    wheel.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), left 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
    
    let currentX = e.type.includes("mouse") ? e.clientX : e.changedTouches[0].clientX;
    let deltaX = currentX - startX;

    // Trigger threshold is 50px
    if (deltaX < -50) {
        activateCapsuleState('left');
    } else if (deltaX > 50) {
        activateCapsuleState('right');
    } else {
        // Snap back to center
        wheel.style.transform = `translateX(-50%)`;
    }
}

function activateCapsuleState(direction) {
    const wheel = document.getElementById("wheel");
    const container = document.getElementById("capsule-container");
    const bar = document.getElementById("capsule-bar");
    
    wheel.style.transform = `translateX(0)`; // Reset translation as we use 'left' class
    
    if(direction === 'left') {
        wheel.className = "wheel drag-left";
        bar.className = "capsule-bar left-active";
        container.classList.add("top-mode");
        document.getElementById("capsule-content-desc").classList.add("active");
        document.getElementById("capsule-content-chat").classList.remove("active");
    } else {
        wheel.className = "wheel drag-right";
        bar.className = "capsule-bar right-active";
        container.classList.add("top-mode");
        document.getElementById("capsule-content-chat").classList.add("active");
        document.getElementById("capsule-content-desc").classList.remove("active");
        renderChats(); // Load chat dynamic HTML
    }
}

function resetCapsule() {
    document.getElementById("wheel").className = "wheel";
    document.getElementById("wheel").style.transform = `translateX(-50%)`;
    document.getElementById("capsule-bar").className = "capsule-bar";
    document.getElementById("capsule-container").classList.remove("top-mode");
    document.getElementById("capsule-content-desc").classList.remove("active");
    document.getElementById("capsule-content-chat").classList.remove("active");
}

function openCapsule(ticketId) {
    activeChatTicketId = ticketId;
    let ticket = allTicketsData.find(t => t.ticketId === ticketId);
    
    // Set Description safely
    document.getElementById("full-issue-text").innerText = ticket.issue;
    
    // Open Modal and Reset State
    document.getElementById("capsule-modal").classList.add("active");
    resetCapsule();
}

function closeCapsuleModal() {
    document.getElementById("capsule-modal").classList.remove("active");
    activeChatTicketId = null;
    resetCapsule();
}

// Kept legacy function references for completeness, mapping them to the new unified capsule UI
function viewFullIssue(ticketId) { openCapsule(ticketId); activateCapsuleState('left'); }
function openChat(ticketId) { openCapsule(ticketId); activateCapsuleState('right'); }
function closeIssueModal() { closeCapsuleModal(); }
function closeChat() { closeCapsuleModal(); }

// Mapping external close button on modals to unified close function
document.querySelectorAll(".close-btn").forEach(btn => {
    btn.onclick = closeCapsuleModal;
});

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
            
            html += `
                <div class="chat-bubble ${bubbleClass}">
                    <div class="chat-sender">${senderName}</div>
                    ${escapeHTML(c.msg)}
                    <span class="chat-time">${c.time}</span>
                </div>
            `;
        });
    }
    chatBox.innerHTML = html;
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendReply() {
    let msgInput = document.getElementById("chat-msg");
    let msg = msgInput.value.trim();
    if(!msg) return;

    let btn = document.getElementById("btn-send-reply");
    btn.innerText = "..."; btn.disabled = true;

    let d = getFormattedDateTime();
    let chatBox = document.getElementById("chat-box");
    
    chatBox.innerHTML += `
        <div class="chat-bubble chat-mine" style="opacity:0.7;">
            <div class="chat-sender">Sending...</div>
            ${escapeHTML(msg)}
            <span class="chat-time">${d}</span>
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;
    msgInput.value = "";

    try {
        await api({ action: "addReply", ticketId: activeChatTicketId, senderRole: currentUserRole, msg: msg, time: d });
        await loadTickets(currentUserRole);
        if(activeChatTicketId) renderChats(); 
    } catch(e) { 
        alert("Failed to send reply"); 
    }

    btn.innerText = "Send"; btn.disabled = false;
}
