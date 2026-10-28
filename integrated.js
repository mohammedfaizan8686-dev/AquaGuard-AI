
(() => {
    const widgetId = "ag-community-widget";

    // Prevent duplicate widgets if the script loads more than once.
    if (document.getElementById(widgetId)) return;

    const root = document.createElement("div");
    root.id = widgetId;

    root.innerHTML = `
        <button id="ag-open" class="ag-fab" aria-label="Open community reports">
            💧 Community reports
        </button>

        <div id="ag-panel" class="ag-panel" hidden>
            <div class="ag-head">
                <div>
                    <b>AquaGuard Community</b>
                    <small>Water complaints and follow-up</small>
                </div>
                <button id="ag-close" class="ag-iconbtn" aria-label="Close">×</button>
            </div>

            <div class="ag-tabs">
                <button data-view="home" class="active">Home</button>
                <button data-view="report">Report</button>
                <button data-view="track">Track</button>
                <button data-view="admin">Admin</button>
            </div>

            <section data-section="home">
                <h3>How would you like to continue?</h3>
                <p class="ag-muted">Choose a role to report a water-related problem.</p>

                <div class="ag-rolegrid">
                    <button data-role="Student">🎓 Student</button>
                    <button data-role="Staff">🧑‍💼 Staff</button>
                    <button data-role="Guest">👋 Guest / Visitor</button>
                </div>

                <p class="ag-muted">
                    Do not include passwords, student ID numbers, or sensitive personal information.
                </p>

                <button class="ag-primary" data-goto="report">Continue to report</button>
            </section>

            <section data-section="report" hidden>
                <h3>Submit a complaint</h3>

                <form id="ag-form">
                    <label>Name (optional)
                        <input name="name" maxlength="80" placeholder="Your name">
                    </label>

                    <label>Role
                        <select name="role">
                            <option>Student</option>
                            <option>Staff</option>
                            <option>Guest</option>
                        </select>
                    </label>

                    <label>Location / area
                        <input name="area" required maxlength="80"
                               placeholder="e.g. Hostel Zone, Block A">
                    </label>

                    <label>Category
                        <select name="category">
                            <option>Leakage</option>
                            <option>Bad smell</option>
                            <option>Unusual colour</option>
                            <option>Low water supply</option>
                            <option>Dirty water</option>
                            <option>Other</option>
                        </select>
                    </label>

                    <label>Urgency
                        <select name="urgency">
                            <option>Normal</option>
                            <option>Low</option>
                            <option>Urgent</option>
                        </select>
                    </label>

                    <label>Describe the problem
                        <textarea name="description" required minlength="8"
                                  maxlength="500" rows="3"
                                  placeholder="Describe what happened and where."></textarea>
                    </label>

                    <button class="ag-primary" type="submit">Submit complaint</button>
                    <p id="ag-form-msg" class="ag-msg" role="status"></p>
                </form>
            </section>

            <section data-section="track" hidden>
                <div class="ag-row">
                    <h3>Recent complaints</h3>
                    <button id="ag-refresh" class="ag-secondary" type="button">Refresh</button>
                </div>

                <p class="ag-muted">
                    Recent reports are visible in this demonstration.
                </p>
                <div id="ag-list">Select Refresh to load complaints.</div>
            </section>

            <section data-section="admin" hidden>
                <div id="ag-admin-login">
                    <h3>Admin login</h3>
                    <p class="ag-muted">
                        Administrator access is verified by the C server.
                    </p>

                    <form id="ag-login-form">
                        <label>Admin password
                            <input name="password" type="password" required
                                   autocomplete="current-password">
                        </label>
                        <button class="ag-primary" type="submit">Log in</button>
                        <p id="ag-login-msg" class="ag-msg" role="status"></p>
                    </form>
                </div>

                <div id="ag-admin-view" hidden>
                    <div class="ag-row">
                        <h3>Manage complaints</h3>
                        <button id="ag-logout" class="ag-secondary" type="button">
                            Log out
                        </button>
                    </div>

                    <button id="ag-admin-refresh" class="ag-secondary" type="button">
                        Refresh complaints
                    </button>
                    <div id="ag-admin-list"></div>
                </div>
            </section>

            <p class="ag-foot">
                Educational prototype, not an emergency service. For immediate health risks,
                contact campus management.
            </p>
        </div>
    `;

    document.body.appendChild(root);

    const $ = selector => root.querySelector(selector);
    const $$ = selector => [...root.querySelectorAll(selector)];

    let adminToken = "";

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function showView(viewName) {
        $$("[data-section]").forEach(section => {
            section.hidden = section.dataset.section !== viewName;
        });

        $$("[data-view]").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.view === viewName
            );
        });

        if (viewName === "track") loadComplaints();
        if (viewName === "admin" && adminToken) loadAdminComplaints();
    }

    async function api(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            // The server did not return JSON.
        }

        if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }

        return data;
    }

    $("#ag-open").addEventListener("click", () => {
        $("#ag-panel").hidden = false;
        $("#ag-open").hidden = true;
    });

    $("#ag-close").addEventListener("click", () => {
        $("#ag-panel").hidden = true;
        $("#ag-open").hidden = false;
    });

    $$("[data-view]").forEach(button => {
        button.addEventListener("click", () => showView(button.dataset.view));
    });

    $$("[data-goto]").forEach(button => {
        button.addEventListener("click", () => showView(button.dataset.goto));
    });

    $$("[data-role]").forEach(button => {
        button.addEventListener("click", () => {
            $("#ag-form").elements.role.value = button.dataset.role;
            showView("report");
        });
    });

    // Submit a complaint. Keep a direct reference to the form before awaiting fetch.
    $("#ag-form").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const message = $("#ag-form-msg");
        const submitButton = form.querySelector('button[type="submit"]');

        const payload = Object.fromEntries(new FormData(form).entries());

        message.textContent = "Submitting complaint…";
        submitButton.disabled = true;

        try {
            const data = await api("/complaints", {
                method: "POST",
                body: JSON.stringify(payload)
            });

            message.textContent =
                `Complaint #${data.id} submitted. Status: ${data.status}. Save this ID for reference.`;

            // Fix: use the saved form reference, not event.currentTarget after await.
            form.reset();

            // Restore the selected role after resetting the fields.
            form.elements.role.value = payload.role;

            // Show the new complaint in the tracking panel.
            await loadComplaints();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            submitButton.disabled = false;
        }
    });

    function createComplaintCard(complaint, isAdmin = false) {
        const card = document.createElement("article");
        card.className = "ag-card";

        card.innerHTML = `
            <div class="ag-row">
                <b>Complaint #${escapeHTML(complaint.id)}</b>
                <span class="ag-pill">${escapeHTML(complaint.urgency)}</span>
            </div>
            <p>
                <b>${escapeHTML(complaint.category)}</b>
                · ${escapeHTML(complaint.area)}
            </p>
            <p>${escapeHTML(complaint.description)}</p>
            <small>
                ${escapeHTML(complaint.name || "Anonymous")}
                · ${escapeHTML(complaint.role)}
                · Status: <b>${escapeHTML(complaint.status)}</b>
            </small>
        `;

        if (isAdmin) {
            const row = document.createElement("div");
            row.className = "ag-row ag-status";

            const select = document.createElement("select");

            ["Submitted", "Under Review", "Resolved"].forEach(status => {
                const option = document.createElement("option");
                option.value = status;
                option.textContent = status;
                option.selected = status === complaint.status;
                select.appendChild(option);
            });

            const saveButton = document.createElement("button");
            saveButton.className = "ag-primary";
            saveButton.type = "button";
            saveButton.textContent = "Save status";

            saveButton.addEventListener("click", async () => {
                saveButton.disabled = true;
                saveButton.textContent = "Saving…";

                try {
                    await api("/admin/status", {
                        method: "POST",
                        headers: { "X-Admin-Token": adminToken },
                        body: JSON.stringify({
                            id: complaint.id,
                            status: select.value
                        })
                    });

                    await loadAdminComplaints();
                } catch (error) {
                    alert(error.message);
                    saveButton.disabled = false;
                    saveButton.textContent = "Save status";
                }
            });

            row.append(select, saveButton);
            card.appendChild(row);
        }

        return card;
    }

    async function loadComplaints() {
        const container = $("#ag-list");
        container.textContent = "Loading complaints…";

        try {
            const data = await api("/complaints");
            container.replaceChildren();

            if (!data.complaints || data.complaints.length === 0) {
                container.textContent = "No complaints yet.";
                return;
            }

            data.complaints.forEach(complaint => {
                container.appendChild(createComplaintCard(complaint));
            });
        } catch (error) {
            container.textContent = error.message;
        }
    }

    $("#ag-refresh").addEventListener("click", loadComplaints);

    $("#ag-login-form").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const message = $("#ag-login-msg");
        const password = new FormData(form).get("password");

        message.textContent = "Checking credentials…";

        try {
            const data = await api("/admin/login", {
                method: "POST",
                body: JSON.stringify({ password })
            });

            adminToken = data.token;

            $("#ag-admin-login").hidden = true;
            $("#ag-admin-view").hidden = false;
            message.textContent = "";

            form.reset();
            await loadAdminComplaints();
        } catch (error) {
            message.textContent = error.message;
        }
    });

    async function loadAdminComplaints() {
        const container = $("#ag-admin-list");
        container.textContent = "Loading complaints…";

        try {
            const data = await api("/admin/complaints", {
                headers: { "X-Admin-Token": adminToken }
            });

            container.replaceChildren();

            if (!data.complaints || data.complaints.length === 0) {
                container.textContent = "No complaints yet.";
                return;
            }

            data.complaints.forEach(complaint => {
                container.appendChild(createComplaintCard(complaint, true));
            });
        } catch (error) {
            container.textContent = error.message;

            if (
                error.message.toLowerCase().includes("admin login") ||
                error.message.includes("401") ||
                error.message.includes("403")
            ) {
                adminToken = "";
                $("#ag-admin-login").hidden = false;
                $("#ag-admin-view").hidden = true;
            }
        }
    }

    $("#ag-admin-refresh").addEventListener("click", loadAdminComplaints);

    $("#ag-logout").addEventListener("click", () => {
        adminToken = "";
        $("#ag-admin-login").hidden = false;
        $("#ag-admin-view").hidden = true;
        $("#ag-login-form").reset();
        $("#ag-login-msg").textContent = "";
        showView("admin");
    });
})();
