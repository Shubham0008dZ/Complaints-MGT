const URL = "https://script.google.com/macros/s/AKfycbxz1LzTv97BuJhZEps0ntTJ0YGqaMd9MkXSIdiygsEFUDJs0iv7dq1NY2kmY6sJfnWV/exec"; // APNI NAYI URL YAHAN DALEIN
let user = "";

let currentUserRole = "";
let currentUserName = "";
let currentUserEmail = "";
let currentUserPhone = "";
let allTicketsData = []; 
let activeChatTicketId = null;

// SECURITY FIX: Prevent HTML Injection (Dropdown bug fix)
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
        document.getElementById("t-issue").value = "";
        document.getElementById("t-file").value = "";
    }
}

async function api(data) {
    let p = new URLSearchParams(data);
    return fetch(URL, { method: 'POST', body: p }).then(res => res.json());
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
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
            currentUserRole = res.role.trim(); // Trim added for safety
            currentUserName = res.name.trim();
            currentUserEmail = res.email;
            currentUserPhone = res.phone;
            
            res.role == "Admin" ? show("view-adm") : show("view-emp");
            loadTickets(res.role);
        } else { 
            alert("Invalid Login Credentials"); 
        }
    } catch (e) { 
        alert("Server Error! Check URL or Internet."); 
    }

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
            alert("Error: " + res.message);
            btn.innerText = "Verify Email"; btn.disabled = false;
        }
    } catch(e) {
        alert("Network Error!");
        btn.innerText = "Verify Email"; btn.disabled = false;
    }
}

async function verifyOTP() {
    let btn = document.getElementById("btn-verify-otp");
    btn.innerText = "Verifying..."; btn.disabled = true;

    try {
        let res = await api({ action: "verifyOtp", email: document.getElementById("r-email").value, otp: document.getElementById("r-otp").value });
        if (res.status == "success") {
            document.getElementById("btn-reg").disabled = false;
            btn.innerText = "Verified ✔";
            btn.style.color = "green";
            btn.style.borderColor = "green";
        } else {
            alert("Wrong OTP");
            btn.innerText = "Confirm OTP"; btn.disabled = false;
        }
    } catch(e) {
        alert("Network Error!");
        btn.innerText = "Confirm OTP"; btn.disabled = false;
    }
}

async function doRegister() {
    let btn = document.getElementById("btn-reg");
    btn.innerText = "Registering..."; btn.disabled = true;

    try {
        let res = await api({
            action: "register",
            name: document.getElementById("r-name").value,
            coordinator: document.getElementById("r-coord").value,
            designation: document.getElementById("r-desig").value,
            password: document.getElementById("r-pass").value,
            email: document.getElementById("r-email").value
        });

        if(res.status == "success") {
            alert("Registered successfully! Check your Email for User ID and PIN to login.");
            document.getElementById("view-reg").querySelectorAll('input').forEach(i => i.value = ''); 
            show("view-login");
        } else {
            alert("Error: " + res.message);
        }
    } catch (e) {
        alert("Server Error during Registration.");
    }

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
        document.getElementById("rs-new").value = "";
        show("view-login");
    } catch(e) {
        alert("Error updating password.");
    }

    btn.innerText = "Update & Login"; btn.disabled = false;
}

// ----------------------------------------------------------------
// TICKET LOGGING & LOADING
// ----------------------------------------------------------------

async function addTicket() {
    let issue = document.getElementById("t-issue").value;
    if(!issue) return alert("Please describe the issue.");
    
    let fileInput = document.getElementById("t-file");
    let btn = document.getElementById("btn-submit-ticket");
    let d = getFormattedDateTime();
    
    // OPTIMISTIC UI - Instant show in table
    let table = document.getElementById("t-emp");
    let currentRows = table.getElementsByTagName("tr").length;
    let tempSno = currentRows > 1 && !table.innerHTML.includes("No tickets") ? currentRows : 1; 
    
    // Safety check for UI preview
    let safeOptimisticIssue = escapeHTML(issue);

    let tempRow = `<tr style="background-color: #f8f9fa; opacity: 0.7;">
        <td>${tempSno}</td>
        <td><b>Saving...</b><br><span class="small-text">${d}</span></td>
        <td>${safeOptimisticIssue.length > 40 ? safeOptimisticIssue.substring(0,40)+'...' : safeOptimisticIssue}</td>
        <td>${fileInput.files.length > 0 ? 'Uploading...' : 'None'}</td>
        <td>-</td><td class="status-Pending">Pending</td></tr>`;

    let tableContent = table.innerHTML.replace(`<tr><td colspan="6" style="text-align:center;">No tickets found.</td></tr>`, "");
    if(tableContent.indexOf("</tr>") !== -1) {
        table.innerHTML = tableContent.slice(0, tableContent.indexOf("</tr>") + 5) + tempRow + tableContent.slice(tableContent.indexOf("</tr>") + 5);
    } else { table.innerHTML += tempRow; }

    toggleTicketForm(false);
    btn.innerText = "Submitting..."; btn.disabled = true;

    let payload = { action: "createTicket", empName: currentUserName, email: currentUserEmail, phone: currentUserPhone, issue: issue, date: d };

    try {
        if(fileInput.files.length > 0) {
            let file = fileInput.files[0];
            if(file.size > 2 * 1024 * 1024) {
                alert("File is too large. Max 2MB allowed.");
                btn.innerText = "Submit Ticket"; btn.disabled = false;
                loadTickets("Employee"); 
                return;
            }
            payload.fileName = file.name; payload.mimeType = file.type;
            payload.fileData = await getBase64(file);
        }
        
        let res = await api(payload);
        if(res.status == "success") {
            loadTickets("Employee"); 
        } else {
            alert("Error saving ticket.");
        }
    } catch(e) {
        alert("Upload failed. Try without attachment or check internet.");
        loadTickets("Employee"); 
    }
    
    btn.innerText = "Submit Ticket"; btn.disabled = false;
}

async function loadTickets(role) {
    try {
        allTicketsData = await fetch(URL).then(r => r.json());
        
        let html = "<tr><th>S.No.</th><th>ID & Date</th>";
        if(role == "Admin") html += "<th>User Info</th>";
        html += "<th>Issue</th><th>Attachment</th><th>Details</th><th>Status</th>" + (role == "Admin" ? "<th>Action</th>" : "") + "</tr>";
        
        let sno = 1; 
        [...allTicketsData].reverse().forEach(t => {
            if (role == "Admin" || t.empName == currentUserName) {
                
                let attachmentHtml = t.attachment !== "No Attachment" && t.attachment !== "" && t.attachment !== undefined
                    ? `<a href="${t.attachment}" target="_blank">View File</a>` : "None";
                
                let statusClass = t.status ? "status-" + t.status.split(" ")[0] : "status-Pending";

                // READ MORE LOGIC WITH ESCAPE HTML FIX
                let safeIssue = t.issue ? escapeHTML(t.issue) : "";
                let displayIssue = safeIssue.length > 40 
                    ? safeIssue.substring(0, 40) + `... <br><a href="#" onclick="viewFullIssue('${t.ticketId}')" style="color:#0284c7; font-weight:bold; font-size:12px; margin-top:5px; display:inline-block;">Read More</a>` 
                    : safeIssue;

                html += `<tr>
                    <td>${sno++}</td>
                    <td><b>${t.ticketId}</b><br><span class="small-text">${t.date}</span></td>`;
                
                if(role == "Admin") {
                    html += `<td><b>${t.empName || '-'}</b><br><span class="small-text">${t.email || '-'}</span><br><span class="small-text">${t.phone || '-'}</span></td>`;
                }

                html += `<td>${displayIssue}</td>
                    <td>${attachmentHtml}</td>
                    <td><a href="#" onclick="openChat('${t.ticketId}')"><b>View Chat</b></a></td>
                    <td class="${statusClass}">${t.status || 'Pending'}</td>`;
                
                if (role == "Admin") {
                    let s1 = t.status == "Pending" ? "selected" : "";
                    let s2 = t.status == "In Progress" ? "selected" : "";
                    let s3 = t.status == "Completed" ? "selected" : "";
                    html += `<td><select onchange="update('${t.ticketId}', this.value)">
                        <option ${s1}>Pending</option><option ${s2}>In Progress</option><option ${s3}>Completed</option>
                    </select></td>`;
                }
                html += `</tr>`;
            }
        });

        if(sno === 1) html += `<tr><td colspan="${role == 'Admin' ? 8 : 7}" style="text-align:center;">No tickets found.</td></tr>`;
        document.getElementById(role == "Admin" ? "t-adm" : "t-emp").innerHTML = html;
    } catch(e) { console.error(e); }
}

async function update(id, s) {
    api({ action: "updateStatus", ticketId: id, newStatus: s });
    setTimeout(() => loadTickets("Admin"), 1000); 
}

// ----------------------------------------------------------------
// BADA ISSUE (READ MORE) & CHAT SYSTEM
// ----------------------------------------------------------------

function viewFullIssue(ticketId) {
    let ticket = allTicketsData.find(t => t.ticketId === ticketId);
    if(ticket) {
        // innerText is naturally safe from HTML injection
        document.getElementById("full-issue-text").innerText = ticket.issue;
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
    
    // FIX 100% BULLETPROOF ALIGNMENT:
    // Agar ticket aapka hai, toh Original Issue hamesha Right (chat-mine) me dikhega.
    // Agar Admin dekh raha hai, toh use Left (chat-other) me dikhega.
    let isMyTicket = (ticket.empName === currentUserName);
    let originalClass = isMyTicket ? "chat-mine" : "chat-other";
    
    // ESCAPE HTML FUNCTION USED HERE
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
            // FIX ALIGNMENT FOR REPLIES (Ignoring case sensitivity and spaces)
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
    
    // Naya message hamesha meri taraf (Right) dikhega, aur HTML escape hoke render hoga
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
