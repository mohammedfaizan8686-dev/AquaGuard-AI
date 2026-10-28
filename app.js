/* =====================================================
   AQUAGUARD AI - COMPLETE FRONTEND
   C backend: POST /analyze
   Features: Analysis, Add Area Form, Ranking, Analytics,
   Interactive Map, Sample Data and Local Storage
   ===================================================== */

const $ = id => document.getElementById(id);

let areas = [];
let latestAnalysis = null;
let mapInstance = null;
let markers = [];

try {
    const stored = JSON.parse(
        localStorage.getItem("aquaguardAreas") || "[]"
    );

    if (Array.isArray(stored)) {
        areas = stored.filter(a =>
            a &&
            typeof a.area === "string" &&
            Number.isFinite(Number(a.score))
        );
    }
} catch (error) {
    areas = [];
}

/* ---------- BASIC HELPERS ---------- */

function scoreOf(a) {
    return Math.max(0, Math.min(100, Number(a.score) || 0));
}

function riskClass(priority) {
    const p = String(priority || "").toLowerCase();

    if (p === "critical") return "critical";
    if (p === "high") return "high";
    if (p === "moderate") return "moderate";

    return "low";
}

function sortedAreas() {
    return [...areas].sort(
        (a, b) => scoreOf(b) - scoreOf(a)
    );
}

function saveAreas() {
    try {
        localStorage.setItem(
            "aquaguardAreas",
            JSON.stringify(areas)
        );
    } catch (error) {
        $("status").textContent =
            "Could not save areas in browser storage.";
    }
}

/* ---------- CALL THE C BACKEND ---------- */

async function analyzeArea(data) {
    const response = await fetch("/analyze", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const output = await response.json();

    if (!response.ok || output.error) {
        throw new Error(
            output.error || "Backend analysis failed."
        );
    }

    if (!Number.isFinite(Number(output.score))) {
        throw new Error(
            "The backend did not return a valid risk score."
        );
    }

    return {
        ...output,
        ...data,
        score: scoreOf(output),
        priority: output.priority || "Unknown",
        reasons: Array.isArray(output.reasons)
            ? output.reasons
            : [],
        action: output.action ||
            "Verify readings and arrange follow-up."
    };
}

function validateReadings(data) {
    if (!data.area) {
        return "Please enter an area name.";
    }

    if (
        !Number.isFinite(data.ph) ||
        data.ph < 0 ||
        data.ph > 14
    ) {
        return "pH must be between 0 and 14.";
    }

    if (
        !Number.isFinite(data.turbidity) ||
        data.turbidity < 0
    ) {
        return "Turbidity cannot be negative.";
    }

    if (
        !Number.isFinite(data.oxygen) ||
        data.oxygen < 0
    ) {
        return "Dissolved oxygen cannot be negative.";
    }

    if (
        !Number.isInteger(data.complaints) ||
        data.complaints < 0
    ) {
        return "Complaint count must be a non-negative whole number.";
    }

    return "";
}

/* ---------- MAIN ANALYSIS FORM ---------- */

$("analysis-form").addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        area: $("area").value.trim(),
        ph: Number($("ph").value),
        turbidity: Number($("turbidity").value),
        oxygen: Number($("oxygen").value),
        complaints: Number($("complaints").value)
    };

    const error = validateReadings(data);

    if (error) {
        $("status").textContent = error;
        return;
    }

    const submit = $("analysis-form").querySelector(
        '[type="submit"]'
    );

    submit.disabled = true;
    $("save-area").disabled = true;
    $("status").textContent = "Analyzing readings...";

    try {
        latestAnalysis = await analyzeArea(data);

        displayResult(latestAnalysis);

        $("save-area").disabled = false;
        $("status").textContent =
            "Analysis complete. Click Add area to comparison to save it.";
    } catch (error) {
        latestAnalysis = null;

        $("status").textContent =
            "Analysis failed: " + error.message;
    } finally {
        submit.disabled = false;
    }
});

/* ---------- DISPLAY ANALYSIS RESULT ---------- */

function displayResult(a) {
    $("empty-state").hidden = true;
    $("result").hidden = false;

    $("score").textContent = scoreOf(a);

    $("priority").textContent = a.priority;
    $("priority").className =
        "priority " + riskClass(a.priority);

    $("meter-fill").style.width =
        scoreOf(a) + "%";

    $("meter-fill").className =
        riskClass(a.priority);

    $("result-area").textContent =
        "Area analyzed: " + a.area;

    $("action").textContent = a.action;

    $("reasons").replaceChildren();

    const reasons = a.reasons.length
        ? a.reasons
        : ["No explanation details were returned by the backend."];

    reasons.forEach(reason => {
        const li = document.createElement("li");
        li.textContent = String(reason);
        $("reasons").appendChild(li);
    });
}

/* ---------- ADD ANOTHER AREA FORM ---------- */

/*
 Clicking "Add area to comparison" opens a form
 directly below the current analysis result.
 It does not immediately save the same area again.
*/

function createAdditionalAreaForm() {
    let form = $("add-area-form");

    if (form) {
        form.hidden = false;
        form.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
        return form;
    }

    form = document.createElement("section");
    form.id = "add-area-form";
    form.className = "panel";
    form.style.marginTop = "22px";
    form.style.padding = "22px";
    form.style.border = "1px solid #cfe5e2";
    form.style.borderRadius = "16px";
    form.style.background = "#f5fbfa";

    form.innerHTML = `
        <p class="eyebrow">MULTI-AREA ANALYSIS</p>
        <h2>Analyze another area</h2>
        <p class="muted">
            Enter separate readings for a different location.
        </p>

        <label for="new-area-name">Area / location name</label>
        <input
            id="new-area-name"
            type="text"
            maxlength="80"
            placeholder="e.g. Hostel Zone"
        >

        <div class="field-grid">
            <label for="new-ph">
                pH (0–14)
                <input
                    id="new-ph"
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    value="7.0"
                >
            </label>

            <label for="new-turbidity">
                Turbidity (NTU)
                <input
                    id="new-turbidity"
                    type="number"
                    min="0"
                    step="0.1"
                    value="2.0"
                >
            </label>

            <label for="new-oxygen">
                Dissolved oxygen (mg/L)
                <input
                    id="new-oxygen"
                    type="number"
                    min="0"
                    step="0.1"
                    value="6.0"
                >
            </label>

            <label for="new-complaints">
                Complaints (count)
                <input
                    id="new-complaints"
                    type="number"
                    min="0"
                    step="1"
                    value="1"
                >
            </label>
        </div>

        <div class="actions">
            <button
                id="analyze-new-area"
                class="primary"
                type="button"
            >
                Analyze and add area
            </button>

            <button
                id="cancel-new-area"
                class="secondary"
                type="button"
            >
                Cancel
            </button>
        </div>

        <p
            id="new-area-status"
            class="status"
            role="status"
        ></p>
    `;

    /*
      Place the new form immediately after the
      analysis result panel, inside the main layout.
    */

    $("result").parentElement.appendChild(form);

    $("cancel-new-area").addEventListener("click", () => {
        form.hidden = true;
        $("status").textContent =
            "Additional area form closed.";
    });

    $("analyze-new-area").addEventListener(
        "click",
        async () => {
            const name = $("new-area-name").value.trim();
            const message = $("new-area-status");
            const button = $("analyze-new-area");

            const data = {
                area: name,
                ph: Number($("new-ph").value),
                turbidity: Number($("new-turbidity").value),
                oxygen: Number($("new-oxygen").value),
                complaints: Number($("new-complaints").value)
            };

            const error = validateReadings(data);

            if (error) {
                message.textContent = error;
                return;
            }

            const duplicate = areas.some(
                a => a.area.trim().toLowerCase() ===
                    name.toLowerCase()
            );

            if (duplicate) {
                message.textContent =
                    "This area is already in the comparison. " +
                    "Choose another name.";
                return;
            }

            button.disabled = true;
            message.textContent =
                "Analyzing " + name + "...";

            try {
                const result = await analyzeArea(data);

                areas.push(result);

                saveAreas();
                renderAll();

                message.textContent =
                    name + " analyzed and added successfully.";

                $("status").textContent =
                    name + " added to comparison, analytics and map.";

                $("new-area-name").value = "";

                /*
                  Keep the form open so another location
                  can be entered immediately.
                */
                form.hidden = false;
            } catch (error) {
                message.textContent =
                    "Analysis failed: " + error.message;
            } finally {
                button.disabled = false;
            }
        }
    );

    form.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    return form;
}

/* ---------- SAVE CURRENT ANALYSIS ---------- */

$("save-area").addEventListener("click", () => {
    if (!latestAnalysis) {
        $("status").textContent =
            "Run an analysis before adding an area.";
        return;
    }

    const key = latestAnalysis.area.trim().toLowerCase();

    const existing = areas.some(
        a => a.area.trim().toLowerCase() === key
    );

    if (existing) {
        $("status").textContent =
            latestAnalysis.area +
            " is already in the comparison. " +
            "Use the form below to analyze a different area.";

        createAdditionalAreaForm();
        return;
    }

    areas.push({ ...latestAnalysis });

    saveAreas();
    renderAll();

    $("status").textContent =
        latestAnalysis.area + " added to comparison successfully.";

    createAdditionalAreaForm();
});

/* ---------- COMPARISON RANKING TABLE ---------- */

function renderRanking(list) {
    $("area-count").textContent =
        list.length + (list.length === 1 ? " AREA" : " AREAS");

    $("comparison-empty").hidden = list.length > 0;
    $("comparison-table-wrap").hidden = list.length === 0;

    $("comparison-body").replaceChildren();

    list.forEach((a, index) => {
        const row = document.createElement("tr");

        function cell(text, className = "") {
            const td = document.createElement("td");
            td.textContent = text;

            if (className) {
                td.className = className;
            }

            row.appendChild(td);
        }

        cell(String(index + 1), "rank-cell");
        cell(a.area);
        cell(scoreOf(a) + "/100", "table-score");

        cell(
            a.priority || "Unknown",
            "table-priority " + riskClass(a.priority)
        );

        cell(
            Array.isArray(a.reasons)
                ? String(a.reasons.length)
                : "0"
        );

        cell(a.action || "Review readings");

        const manage = document.createElement("td");
        const remove = document.createElement("button");

        remove.textContent = "Remove";
        remove.className = "remove-area";
        remove.type = "button";

        remove.addEventListener("click", () => {
            areas = areas.filter(item => item !== a);

            saveAreas();
            renderAll();

            $("status").textContent =
                a.area + " removed from comparison.";
        });

        manage.appendChild(remove);
        row.appendChild(manage);

        $("comparison-body").appendChild(row);
    });
}

/* ---------- ANALYTICS ---------- */

function renderAnalytics(list) {
    $("stat-total").textContent = list.length;

    $("stat-high").textContent = list.filter(a =>
        ["high", "critical"].includes(
            String(a.priority).toLowerCase()
        )
    ).length;

    $("stat-average").textContent = list.length
        ? Math.round(
            list.reduce((sum, a) => sum + scoreOf(a), 0) /
            list.length
        )
        : 0;

    const chart = $("risk-chart");
    chart.replaceChildren();

    if (!list.length) {
        const message = document.createElement("p");
        message.className = "muted";
        message.textContent =
            "Load sample areas or analyze an area to display the chart.";

        chart.appendChild(message);
        return;
    }

    list.forEach(a => {
        const row = document.createElement("div");
        row.className = "chart-row";

        const name = document.createElement("div");
        name.className = "chart-name";
        name.textContent = a.area;

        const track = document.createElement("div");
        track.className = "chart-track";

        const bar = document.createElement("div");
        bar.className = "chart-bar " + riskClass(a.priority);
        bar.style.width = scoreOf(a) + "%";

        track.appendChild(bar);

        const value = document.createElement("div");
        value.className = "chart-value";
        value.textContent = scoreOf(a) + "/100";

        row.append(name, track, value);
        chart.appendChild(row);
    });
}

/* ---------- INTERACTIVE WATER RISK MAP ---------- */

/* Demonstration coordinates only, not verified infrastructure. */

const knownCoordinates = {
    "hostel zone": [12.9716, 79.1590],
    "campus block a": [12.9725, 79.1610],
    "sports complex": [12.9698, 79.1625],
    "library wing": [12.9735, 79.1575]
};

function coordinatesFor(a, index) {
    const known =
        knownCoordinates[a.area.trim().toLowerCase()];

    if (known) return known;

    const angle = index * 2.39996;
    const radius = 0.0015 + (index % 5) * 0.0003;

    return [
        12.9716 + Math.cos(angle) * radius,
        79.1590 + Math.sin(angle) * radius
    ];
}

function showMapDetails(a) {
    const box = $("map-details");
    box.replaceChildren();

    const title = document.createElement("strong");
    title.textContent = a.area;

    const score = document.createElement("p");
    score.textContent =
        "Risk score: " + scoreOf(a) +
        "/100 | Priority: " + (a.priority || "Unknown");

    const action = document.createElement("p");
    action.textContent =
        "Recommended action: " +
        (a.action || "Review readings and arrange follow-up.");

    box.append(title, score, action);
}

/* ---------- FALLBACK MAP ---------- */

function renderFallbackMap(list) {
    const map = $("water-risk-map");

    map.className = "fallback-map";
    map.replaceChildren();

    const note = document.createElement("div");
    note.className = "fallback-note";
    note.textContent =
        "Schematic map — not to geographic scale";

    map.appendChild(note);

    if (!list.length) {
        const message = document.createElement("div");
        message.className = "fallback-note";
        message.style.top = "55px";
        message.textContent =
            "Load sample areas to show markers.";

        map.appendChild(message);

        $("map-status").textContent =
            "Offline schematic mode. Load sample areas to show markers.";

        return;
    }

    const positions = [
        [35, 36], [68, 31], [57, 70], [26, 72],
        [79, 56], [45, 51], [18, 48], [72, 80]
    ];

    list.forEach((a, index) => {
        const marker = document.createElement("button");

        marker.type = "button";
        marker.className =
            "fallback-marker " + riskClass(a.priority);

        marker.textContent = scoreOf(a);
        marker.title =
            a.area + " — " + scoreOf(a) + "/100";

        const pos = positions[index % positions.length];

        marker.style.left = pos[0] + "%";
        marker.style.top = pos[1] + "%";

        marker.addEventListener("click", () => {
            showMapDetails(a);
        });

        map.appendChild(marker);
    });

    $("map-status").textContent =
        "Schematic map. Marker positions are illustrative.";
}

/* ---------- LEAFLET MAP ---------- */

function renderLeafletMap(list) {
    const mapElement = $("water-risk-map");

    if (!mapInstance) {
        mapInstance = L.map(mapElement).setView(
            [12.9716, 79.1590],
            15
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap contributors"
            }
        ).addTo(mapInstance);
    }

    markers.forEach(marker => {
        mapInstance.removeLayer(marker);
    });

    markers = [];

    list.forEach((a, index) => {
        const score = scoreOf(a);

        const icon = L.divIcon({
            className: "",
            html:
                '<div class="map-marker ' +
                riskClass(a.priority) +
                '">' + score + "</div>",
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        const marker = L.marker(
            coordinatesFor(a, index),
            { icon }
        ).addTo(mapInstance);

        const popup = document.createElement("div");

        const title = document.createElement("strong");
        title.textContent = a.area;

        const text = document.createElement("div");
        text.textContent =
            score + "/100 — " + (a.priority || "Unknown");

        popup.append(title, text);

        marker.bindPopup(popup);

        marker.on("click", () => {
            showMapDetails(a);
        });

        markers.push(marker);
    });

    if (markers.length) {
        mapInstance.fitBounds(
            L.featureGroup(markers).getBounds(),
            {
                padding: [30, 30],
                maxZoom: 16
            }
        );
    } else {
        mapInstance.setView([12.9716, 79.1590], 15);
    }

    requestAnimationFrame(() => {
        mapInstance.invalidateSize();
    });

    $("map-status").textContent =
        "Interactive map. Marker positions are illustrative placeholders.";
}

function renderMap(list) {
    if (typeof L === "undefined") {
        renderFallbackMap(list);
        return;
    }

    try {
        renderLeafletMap(list);
    } catch (error) {
        console.error("Leaflet map error:", error);
        renderFallbackMap(list);
    }
}

/* ---------- REFRESH THE DASHBOARD ---------- */

function renderAll() {
    const list = sortedAreas();

    renderRanking(list);
    renderAnalytics(list);
    renderMap(list);
    if (typeof window.refreshBfsGraph === "function") {
        window.refreshBfsGraph();
    }
}

/* ---------- LOAD SAMPLE AREAS ---------- */

$("load-samples").addEventListener("click", () => {
    areas = [
        {
            area: "Hostel",
            score: 100,
            priority: "Critical",
            reasons: [
                "pH outside demonstration range",
                "Turbidity above demonstration threshold",
                "Dissolved oxygen below demonstration threshold",
                "Complaint count elevated"
            ],
            action:
                "Prompt inspection and confirmatory testing."
        },
        {
            area: "Campus Block A",
            score: 57,
            priority: "High",
            reasons: [
                "pH outside demonstration range",
                "Complaint count elevated"
            ],
            action:
                "Prioritize an inspection and verify readings."
        },
        {
            area: "Laboratory",
            score: 32,
            priority: "Moderate",
            reasons: [
                "Complaint count elevated"
            ],
            action: "Schedule a follow-up check."
        },
        {
            area: "Campus Block B",
            score: 8,
            priority: "Low",
            reasons: [
                "No configured sensor anomaly rule triggered"
            ],
            action: "Continue routine monitoring."
        }
    ];

    saveAreas();
    renderAll();

    $("status").textContent =
        "Illustrative sample areas loaded.";
});

/* ---------- CLEAR COMPARISON ---------- */

$("clear-comparison").addEventListener("click", () => {
    areas = [];

    saveAreas();
    renderAll();

    $("status").textContent =
        "Comparison and map markers cleared.";
});

/* ---------- RESET INPUTS ---------- */

$("reset").addEventListener("click", () => {
    $("analysis-form").reset();

    $("area").value = "Campus Block A";
    $("ph").value = "5.8";
    $("turbidity").value = "2.4";
    $("oxygen").value = "6.2";
    $("complaints").value = "8";

    latestAnalysis = null;

    $("save-area").disabled = true;
    $("result").hidden = true;
    $("empty-state").hidden = false;

    const extraForm = $("add-area-form");

    if (extraForm) {
        extraForm.remove();
    }

    $("status").textContent =
        "Sample values restored. Run analysis again.";
});

/* ---------- START ---------- */

renderAll();

/* =========================================
   AQUAGUARD AI — DYNAMIC BFS GRAPH EXPLORER
   The graph reflects locations currently in comparison.
   Removing an area removes its node and connected edges.
   ========================================= */
(() => {
    "use strict";
    const byId = id => document.getElementById(id);
    const fullGraph = {
        A: ["B", "C"], B: ["A", "D", "E"], C: ["A", "F"],
        D: ["B"], E: ["B"], F: ["C"]
    };
    const names = {
        A: "Main Tank", B: "Campus Block A", C: "Campus Block B",
        D: "Hostel", E: "Cafeteria", F: "Laboratory"
    };
    const positions = {
        A: {x:360,y:55}, B: {x:220,y:155}, C: {x:500,y:155},
        D: {x:120,y:285}, E: {x:300,y:285}, F: {x:600,y:285}
    };
    const idForName = Object.fromEntries(Object.entries(names).map(([id, name]) => [name, id]));
    const svg = byId("bfs-graph"), startSelect = byId("bfs-start");
    const speedSelect = byId("bfs-speed"), runButton = byId("bfs-run");
    const resetButton = byId("bfs-reset");
    if (!svg || !startSelect || !speedSelect || !runButton || !resetButton) return;

    let timer = null;
    let graph = {};
    let activeNames = {};

    function svgEl(tag, attrs = {}) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
        Object.entries(attrs).forEach(([key,value]) => el.setAttribute(key, String(value)));
        return el;
    }
    function getActiveNodes() {
        const presentNames = new Set(areas.map(a => String(a.area || "").trim()));
        return Object.keys(names).filter(id => presentNames.has(names[id]));
    }
    function buildActiveGraph() {
        const active = new Set(getActiveNodes());
        graph = {};
        activeNames = {};
        active.forEach(id => {
            activeNames[id] = names[id];
            graph[id] = fullGraph[id].filter(neighbour => active.has(neighbour));
        });
    }
    function updateStartOptions() {
        const previous = startSelect.value;
        startSelect.replaceChildren();
        Object.keys(graph).forEach(id => {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = `${id} — ${names[id]}`;
            startSelect.appendChild(option);
        });
        if (graph[previous]) startSelect.value = previous;
        else if (graph.A) startSelect.value = "A";
        else startSelect.selectedIndex = 0;
        const hasNodes = Object.keys(graph).length > 0;
        startSelect.disabled = !hasNodes;
        runButton.disabled = !hasNodes;
        resetButton.disabled = !hasNodes;
        if (!hasNodes) {
            byId("bfs-step-title").textContent = "No analyzed locations";
            byId("bfs-step-message").textContent = "Analyze a location and add it to comparison. Its node will appear here.";
            byId("bfs-order").textContent = "Not started";
            byId("bfs-queue").textContent = "[ ]";
            byId("bfs-visited-count").textContent = "0 / 0";
            byId("bfs-distance-list").replaceChildren();
        }
    }
    function drawGraph() {
        svg.replaceChildren();
        const ids = Object.keys(graph);
        const seenEdges = new Set();
        ids.forEach(from => graph[from].forEach(to => {
            const key = [from,to].sort().join("-");
            if (seenEdges.has(key)) return;
            seenEdges.add(key);
            const p = positions[from], q = positions[to];
            svg.appendChild(svgEl("line", {x1:p.x,y1:p.y,x2:q.x,y2:q.y,class:"bfs-edge","data-edge":key}));
        }));
        ids.forEach(id => {
            const p = positions[id];
            const g = svgEl("g", {class:"bfs-node","data-node":id});
            g.appendChild(svgEl("circle", {cx:p.x,cy:p.y,r:27}));
            const letter = svgEl("text", {x:p.x,y:p.y+6,class:"node-letter"});
            letter.textContent = id;
            const name = svgEl("text", {x:p.x,y:p.y+48,class:"node-name"});
            name.textContent = names[id];
            g.append(letter,name); svg.appendChild(g);
        });
    }
    function calculate(start) {
        const queue=[start], visited=new Set([start]), distance={[start]:0}, order=[], steps=[];
        let head=0;
        steps.push({current:null,queue:[...queue],order:[],visited:new Set(visited),distance:{...distance},message:`Starting at ${start} — ${names[start]}. Add it to the queue.`});
        while (head < queue.length) {
            const current=queue[head++]; order.push(current);
            steps.push({current,queue:queue.slice(head),order:[...order],visited:new Set(visited),distance:{...distance},message:`Visit ${current} — ${names[current]}.`});
            for (const neighbour of graph[current]) {
                if (!visited.has(neighbour)) {
                    visited.add(neighbour); distance[neighbour]=distance[current]+1; queue.push(neighbour);
                    steps.push({current,queue:queue.slice(head),order:[...order],visited:new Set(visited),distance:{...distance},message:`Discover ${neighbour} — ${names[neighbour]}, at distance ${distance[neighbour]} edge(s) from the start.`});
                }
            }
        }
        steps.push({current:null,queue:[],order:[...order],visited:new Set(visited),distance:{...distance},message:`BFS complete. ${order.length} active node(s) reachable from ${start} have been visited.`});
        return steps;
    }
    function renderDistances(distance) {
        const box=byId("bfs-distance-list"); box.replaceChildren();
        Object.keys(graph).forEach(id => {
            const item=document.createElement("div"); item.className="bfs-distance-item";
            const label=document.createElement("div"); label.textContent=`${id} — ${names[id]}`;
            const value=document.createElement("strong"); value.textContent=distance[id]===undefined?"Not reached":`${distance[id]} edge(s)`;
            item.append(label,value); box.appendChild(item);
        });
    }
    function renderStep(step) {
        svg.querySelectorAll(".bfs-node").forEach(node => {
            const id=node.getAttribute("data-node");
            node.classList.toggle("node-visited",step.visited.has(id));
            node.classList.toggle("node-current",id===step.current);
        });
        svg.querySelectorAll(".bfs-edge").forEach(edge => {
            const [a,b]=edge.getAttribute("data-edge").split("-");
            edge.classList.toggle("edge-active",step.visited.has(a)&&step.visited.has(b));
        });
        byId("bfs-order").textContent=step.order.length?step.order.join(" → "):"Not started";
        byId("bfs-queue").textContent="[ "+step.queue.join(", ")+" ]";
        byId("bfs-visited-count").textContent=`${step.visited.size} / ${Object.keys(graph).length}`;
        byId("bfs-step-title").textContent=step.current?`Current node: ${step.current} — ${names[step.current]}`:(step.order.length?"BFS traversal complete":"Ready to explore");
        byId("bfs-step-message").textContent=step.message;
        renderDistances(step.distance);
    }
    function stop() {
        if (timer!==null) { clearInterval(timer); timer=null; }
        runButton.disabled=Object.keys(graph).length===0;
        startSelect.disabled=Object.keys(graph).length===0;
        speedSelect.disabled=false;
        runButton.textContent="Run BFS";
    }
    function reset() {
        stop(); drawGraph();
        if (!Object.keys(graph).length) { updateStartOptions(); return; }
        const start=startSelect.value;
        renderStep({current:null,queue:[],order:[],visited:new Set(),distance:{},message:`Ready. Starting location: ${start} — ${names[start]}. Click Run BFS.`});
        byId("bfs-order").textContent="Not started";
        byId("bfs-queue").textContent="[ ]";
        byId("bfs-visited-count").textContent=`0 / ${Object.keys(graph).length}`;
    }
    function refresh() {
        stop();
        buildActiveGraph();
        updateStartOptions();
        reset();
    }
    function run() {
        if (!Object.keys(graph).length) return;
        stop(); const steps=calculate(startSelect.value); let index=0;
        startSelect.disabled=true; speedSelect.disabled=true; runButton.disabled=true; runButton.textContent="BFS Running...";
        renderStep(steps[index]);
        timer=setInterval(() => {
            index++;
            if (index>=steps.length) { stop(); return; }
            renderStep(steps[index]);
            if (index===steps.length-1) { stop(); runButton.textContent="Run Again"; }
        }, Number(speedSelect.value)||700);
    }
    runButton.addEventListener("click",run);
    resetButton.addEventListener("click",reset);
    startSelect.addEventListener("change",reset);
    window.refreshBfsGraph = refresh;
    refresh();
})();
