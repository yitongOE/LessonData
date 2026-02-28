//#region ====== DOM References ======

// Panel Switch
const btnGames = document.getElementById("btn-games");
const btnMarketplace = document.getElementById("btn-marketplace");
const btnAdmins = document.getElementById("btn-admins");
const titleText = document.getElementById("header-title-text");
const itemCount = document.getElementById("item-count");
const theadGames = document.getElementById("thead-games");
const theadAdmins = document.getElementById("thead-admins");
const theadMarketplace = document.getElementById("thead-marketplace");

// Action Modal
const modal = document.getElementById("action-modal");
const modalTitle = document.getElementById("modal-title");
const modalDesc = document.getElementById("modal-desc");
const awareCheckbox = document.getElementById("modal-aware");
const confirmBtn = document.getElementById("modal-confirm");
const cancelBtn = document.getElementById("modal-cancel");

//#endregion

//#region ====== Variables ======

const PANEL = {
  GAMES: "games",
  ADMINS: "admins",
  MARKETPLACE: "marketplace"
};
const PERMISSIONS = {
  Admin: {
    adminPanel: true,
    edit: true,
    restore: true,
    delete: true,
    view: false,
  },
  Editor: {
    adminPanel: false,
    edit: true,
    restore: true,
    delete: false,
    view: false,
  },
  QA: {
    adminPanel: false,
    edit: false,
    restore: false,
    delete: false,
    view: true,
  },
};
const FUNCTION_BASE = "https://oe-game-test-function-aqg4hed8gqcxb6ej.eastus-01.azurewebsites.net";

let pendingAction = null;

//#endregion

//#region ====== Login ======

// Check if current user is logged in using Azure Function
async function checkLogin() {
  try {
    const res = await fetch(
      `${FUNCTION_BASE}/api/getCurrentUser`,
      { credentials: "include" } // Send cookies
    );

    if (!res.ok) { // res.ok means HTTP 200-209, if not means not logged in
      const redirect = encodeURIComponent(window.location.href); // Make web jump back after log in

      window.location.href =
        `${FUNCTION_BASE}/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(
          FUNCTION_BASE + "/api/loginRedirect?target=" + redirect
        )}`; // log in portal of Azure Static Web App
    }

    // Get user email and admin role
    const user = await res.json();
    window.currentUser = user;
    const role = await determineUserRole(user);
    window.currentRole = role;

    // Ban unauthorized users
    if (!role) {
      alert("You are not authorized.");
      return;
    }

    console.log("User:", user);
    console.log("Role:", role);

    // Update UI according to admin level
    applyPermissions(role);
  } catch (err) {
    console.error("Login check failed:", err);
  }
}

// Determines the role of logged-in user
async function determineUserRole(user) {
  const admins = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/AdminData.csv" + "?t=" + Date.now());

  // Make sure email address matched and account is active
  const record = admins.find(a =>
    a.email.toLowerCase() === user.email.toLowerCase() &&
    a.active === "true"
  );

  // Ban external users
  if(!record) return null;

  return record?.role || "QA";
}

// Shows or hides a single DOM element by id
function toggle(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = show ? "" : "none";
}

// Shows or hides all elements with the specified class name
function toggleGroup(className, show) {
  document.querySelectorAll(`.${className}`)
    .forEach(el => {
      el.style.display = show ? "" : "none";
    });
}

// Applies UI visibility rules based on role permissions and panel
function applyPermissions(role) {
  const p = PERMISSIONS[role] || PERMISSIONS["QA"];
  const panel = getPanel(); 

  if (panel === PANEL.GAMES || panel === PANEL.MARKETPLACE) {
    toggle("panel-toggle-btn", p.adminPanel);
    toggleGroup("gameEditBtn", p.edit);
    toggleGroup("gameRestoreBtn", p.restore);
    toggleGroup("gameDeleteBtn", p.delete);
    toggleGroup("gameViewBtn", p.view);
    toggle("btn-admins", p.adminPanel);
  }
}

//#endregion

//#region ====== Panels ======

// Detect current panel
function getPanel() {
  return new URLSearchParams(location.search).get("panel") || PANEL.GAMES;
}

// Update content according to selected panel
function setupIndexUI({ gamesCount = 0, adminsCount = 0, marketplaceCount = 0 }) {
  const panel = getPanel();

  btnGames.classList.remove("hidden");
  btnMarketplace.classList.remove("hidden");
  btnAdmins.classList.remove("hidden");

  if (panel === PANEL.GAMES) {
    // Header
    document.title = "Our English - Review Management";
    titleText.textContent = "Review";
    itemCount.textContent = `(${gamesCount})`;

    // Toggle button
    btnGames.style.display = "none";

    // Table head
    theadGames.classList.remove("hidden");
    theadAdmins.classList.add("hidden");
    theadMarketplace.classList.add("hidden");
  } else if (panel === PANEL.ADMINS) {
    // Header
    document.title = "Our English - Admins Management";
    titleText.textContent = "Admins";
    itemCount.textContent = `(${adminsCount})`;

    // Toggle button
    btnAdmins.style.display = "none";

    // Table head
    theadGames.classList.add("hidden");
    theadAdmins.classList.remove("hidden");
    theadMarketplace.classList.add("hidden");
  } else {
    // Header
    document.title = "Our English - Marketplace Management";
    titleText.textContent = "Game Marketplace";
    itemCount.textContent = `(${marketplaceCount})`;

    // Toggle button
    btnMarketplace.style.display = "none";

    // Table head
    theadGames.classList.add("hidden");
    theadAdmins.classList.add("hidden");
    theadMarketplace.classList.remove("hidden");
  }

  // Button clicking binding
  btnGames.onclick = () => { location.href = "index.html?panel=games"; };
  btnMarketplace.onclick = () => { location.href = "index.html?panel=marketplace"; };
  btnAdmins.onclick = () => { location.href = "index.html?panel=admins"; };

  return panel;
}

// Create panel shell
function createPanelController({
  panelName,
  loadRules,
  loadData,
  drawRow,
  bindRowUI,
  onAfterDraw
}) {
  let items = [];
  let footer = null;

  // Updates the item count display in the header
  function updateCount() {
    const countEl = document.getElementById("item-count");
    if (countEl) {
      countEl.textContent = `(${items.length})`;
    }
  }

  // Renders current page rows into the table body
  function draw() {
    const tbody = document.getElementById("item-tbody");
    tbody.innerHTML = "";

    const [start, end] = footer.getPageSlice();
    const pageItems = items.slice(start, end);

    pageItems.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = drawRow(item, start + index);
      bindRowUI(tr, item);
      tbody.appendChild(tr);
    });

    updateCount();

    // Apply permissions
    if (window.currentRole) { applyPermissions(window.currentRole); }

    // Optional post-render logic
    if (onAfterDraw) { onAfterDraw({ items, footer }); }
  }

  // Initializes panel by loading rules and data
  async function init(setupCountsObj) {
    if (loadRules) await loadRules();
    items = await loadData();

    setupIndexUI(setupCountsObj);

    footer = createFooterController({onPageChange: draw});
    footer.setTotalItems(items.length);
  }

  // Reloads data from server and re-renders
  async function reloadAndRedraw(loadFn) {
    items = await (loadFn ? loadFn() : loadData());
    footer.setTotalItems(items.length);
    draw();
  }

  return { init, draw, reloadAndRedraw };
}

//#endregion

//#region ====== Footer ======

// Creates pagination shell
function createFooterController({ onPageChange }) {
  let currentPage = 1;
  let rowsPerPage = 10;
  let totalItems = 0;

  const rowsSelect = document.getElementById("rows-per-page");
  const rowRange = document.getElementById("row-range");
  const btnFirst = document.getElementById("first-page");
  const btnPrev = document.getElementById("prev-page");
  const btnNext = document.getElementById("next-page");
  const btnLast = document.getElementById("last-page");

  // Calculates total number of pages based on item count and rows per page
  function getTotalPages() {
    return Math.max(1, Math.ceil(totalItems / rowsPerPage));
  }

  // Display row ranges of total (like: 1-10 of 20)
  function updateRowRange() {
    if (totalItems === 0) {
      rowRange.textContent = "0–0 of 0";
      return;
    }

    const start = (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(start + rowsPerPage - 1, totalItems);
    rowRange.textContent = `${start}–${end} of ${totalItems}`;
  }

  // Toggle buttons availability according to current page index
  function updateButtons() {
    const totalPages = getTotalPages();
    btnFirst.disabled = currentPage === 1;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    btnLast.disabled = currentPage === totalPages;
  }

  // Navigates to a specific page and triggers redraw callback
  function goToPage(page) {
    const totalPages = getTotalPages();
    currentPage = Math.min(Math.max(1, page), totalPages);
    onPageChange(currentPage, rowsPerPage);
    updateRowRange();
    updateButtons();
  }

  // Change display when dropdown changes
  rowsSelect.onchange = () => {
    rowsPerPage = Number(rowsSelect.value);
    currentPage = 1;
    goToPage(currentPage);
  };

  // Button clicking binding
  btnFirst.onclick = () => goToPage(1);
  btnPrev.onclick = () => goToPage(currentPage - 1);
  btnNext.onclick = () => goToPage(currentPage + 1);
  btnLast.onclick = () => goToPage(getTotalPages());

  return {
    setTotalItems(count) {
      totalItems = count;
      currentPage = 1;
      goToPage(1);
    },
    getPageSlice() {
      const start = (currentPage - 1) * rowsPerPage;
      return [start, start + rowsPerPage];
    }
  };
}

// Displays temporary footer message (success or error)
window.showFooterMessage = function(message, type = "success", duration = 2000) {
  const el = document.getElementById("footer-message");
  if (!el) return;

  el.textContent = message;
  el.classList.remove("hidden", "error");
  el.classList.add("show");

  if (type === "error") {
    el.classList.add("error");
  }

  clearTimeout(el._timer);

  el._timer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => {
      el.classList.add("hidden");
    }, 250);
  }, duration);
};

//#endregion

//#region ====== Action Confirmation Modal ======

// Opens confirmation modal before executing sensitive actions
function openActionModal({ title, desc, onConfirm }) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  awareCheckbox.checked = false;
  confirmBtn.disabled = true;
  modal.classList.remove("hidden");

  awareCheckbox.onchange = () => {
    confirmBtn.disabled = !awareCheckbox.checked;
  };

  pendingAction = onConfirm;
}

// Cancel Button action
cancelBtn.onclick = () => {
  modal.classList.add("hidden");
};

// Confirm Button action
confirmBtn.onclick = () => {
  if (confirmBtn.disabled) return;

  modal.classList.add("hidden");
  if (pendingAction) pendingAction();
};

//#endregion

//#region ====== Edit Modal ======

let editingTarget = null;
let draftData = null;

// Opens dynamic edit modal based on provided field schema
function openEditModal({ title, data, fields, onSave, readonlyMode = false }) {
  editingTarget = data;
  draftData = structuredClone(data);

  const modal = document.getElementById("edit-modal");
  const form = document.getElementById("edit-form");

  document.getElementById("edit-modal-title").textContent = title;
  form.innerHTML = "";

  fields.forEach(field => {
    const wrapper = document.createElement("div");
    wrapper.className = "edit-field";

    const label = document.createElement("label");
    label.textContent = field.label;

    let input;

    if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!draftData[field.key];
      input.onchange = e => {
        draftData[field.key] = e.target.checked;
      };

      // Disable checkbox in ReadOnly
      if (field.readonly || readonlyMode) {
        input.disabled = true;
        input.onclick = e => e.preventDefault();
      }
    } else if (field.type === "select") {
      input = document.createElement("select");

      field.options.forEach(option => {
        const opt = document.createElement("option");

        if (typeof option === "object") {
          opt.value = option.value;
          opt.textContent = option.label;

          if (Number(option.value) === Number(draftData[field.key])) {
            opt.selected = true;
          }
        } else {
          opt.value = option;
          opt.textContent = option;

          if (option === draftData[field.key]) {
            opt.selected = true;
          }
        }

        input.appendChild(opt);
      });

      input.onchange = e => {
        const value = e.target.value;

        // Only convert to number for numeric fields
        if (field.key === "levels" || field.key === "rounds" || field.key === "eduLevel") {
          draftData[field.key] = Number(value);
        } else {
          draftData[field.key] = value;
        }

        if (typeof syncGameContentWithLevels === "function") {
          syncGameContentWithLevels(draftData.levels);
        }
      };

      if (field.readonly || readonlyMode) {
        input.disabled = true;
        input.classList.add("readonly-field");
      }
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
      input.value = draftData[field.key] ?? "";
      
      if (field.key === "levels" || field.key === "rounds") {
        const onChange = e => {
        const v = Math.max(0, Number(e.target.value) || 0);
        draftData[field.key] = v;

        const panelNow = getPanel();

        if (panelNow === PANEL.GAMES && typeof syncGameContentWithLevels === "function") {
          syncGameContentWithLevels(v);
        } 
        else if (panelNow === PANEL.MARKETPLACE) {
          if (field.key === "levels" && typeof syncMarketplaceContentWithLevels === "function") {
            syncMarketplaceContentWithLevels(v);
          }
          if (field.key === "rounds") {
            if (editingTarget?.layout?.startsWith("lessonMerge") &&
                typeof syncMarketplaceContentWithRounds_lessonMerge === "function") {
              syncMarketplaceContentWithRounds_lessonMerge(v);
            }
            else if (typeof syncMarketplaceContentWithRounds === "function") {
              syncMarketplaceContentWithRounds(v);
            }
          }
        }
      };

      input.oninput = onChange;
      input.onchange = onChange;
      } else {
        input.oninput = e => {
          draftData[field.key] = e.target.value;
        };
      }

      // Read Only
      if (field.readonly || readonlyMode) {
        input.disabled = true;
        input.classList.add("readonly-field");
      }
    }

    label.appendChild(input);
    wrapper.appendChild(label);
    form.appendChild(wrapper);
  });

  // Educational content
  const contentContainer = document.createElement("div");
  contentContainer.id = "edit-content";
  form.appendChild(contentContainer);
  
  modal.classList.remove("hidden");

  // Discard editing
  document.getElementById("edit-cancel").onclick = () => {
    closeEditModal();
  };

  // Save editing
  const saveBtn = document.getElementById("edit-save");
  saveBtn.style.display = readonlyMode ? "none" : "";
  saveBtn.onclick = async() => {
    Object.assign(editingTarget, draftData);

    try {
      if (onSave) {
        await onSave(editingTarget);
      }
      closeEditModal();
    } catch (err) {
      console.error(err);
    }
  };
}

// Closes edit modal and clears temporary editing state
function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
  editingTarget = null;
  draftData = null;
}

// Fetches and parses a CSV file into an array of objects
async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(line => line.trim() !== "");

  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });
    return obj;
  });
}

// Splits paragraph text into sentences intelligently
function splitSentencesSmart(text) {
  if (!text) return "";

  return text
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .split(/(?<=[.!?。！？…])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join("\n");
}

// Converts semicolon-separated CSV values into multiline textarea format
function csvToTextarea(value) {
  return (value || "")
    .replace(/;\s*/g, "\n")
    .trim();
}

// Converts multiline textarea input back into semicolon-separated CSV format
function textareaToCsv(value) {
  return value
    .split("\n")
    .map(v => v.trim())
    .filter(v => v.length > 0)
    .join("; ") + "; ";
}

// Formats raw marketplace CSV value into a multiline preview string
function formatMarketplacePreview(value) {
  return (value || "")
    .replace(/\|/g, "\n")
    .replace(/;\s*/g, "\n")
    .trim();
}

// Transfer boolean and number to correct formats
window.parseValue = function(raw) {
  if (raw === "true" || raw === "false") return raw === "true";
  if (!isNaN(raw)) return Number(raw);
  return raw;
};

//#endregion

//#region ====== Replace CSV ====== 

// Serializes an array of objects into CSV format
function toCSV(headers, rows) {
  const headerLine = headers.join(",");

  const bodyLines = rows.map(row =>
    headers.map(h => {
      const value = row[h] ?? "";
      if (typeof value === "string" && value.includes(",")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(",")
  );

  return [headerLine, ...bodyLines].join("\n");
}

// Generates CSV content for a game's level data
function collectContentCSV(game) {
  const rows = (game.content || [])
    .sort((a, b) => Number(a.level) - Number(b.level));

  return "level,value\n" +
    rows.map(r => `${r.level},${r.value || ""}`).join("\n");
}

// Saves game configuration and content CSV to Azure backend
async function saveGamesToServer(game) {
  game.updatedAt = new Date().toLocaleString();
  game.updatedBy = window.currentUser?.email || "unknown";

  const configRows = [
    ["version", game.version],
    ["title", game.title],
    ["active", game.active ? "true" : "false"],
    ["eduLevel", game.eduLevel],
    ["updatedAt", game.updatedAt || "1/1/2000"],
    ["updatedBy", game.updatedBy || "testuser"],
    ["lightning_timer", game.lightning_timer || 90],
    ["max_wrong", game.max_wrong || 3],
  ];
  const configCSV = "key,value\n" + configRows.map(r => `${r[0]},${r[1]}`).join("\n");
  const contentCSV = collectContentCSV(game);
  const contentType = "content";

  const res = await fetch(
    "https://oe-game-test-function-aqg4hed8gqcxb6ej.eastus-01.azurewebsites.net/api/saveGamesCSV",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameKey: game.key,
        configCSV,
        contentCSV,
        contentType
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(text);
    throw new Error("Save failed");
  }
}

// Saves marketplace configuration and selected CSV content
async function saveMarketplaceToServer(game, selectedCSV) {
  game.updatedAt = new Date().toLocaleString();
  game.updatedBy = window.currentUser?.email || "unknown";

  const configRows = [
    ["version", game.version],
    ["title", game.title],
    ["active", game.active ? "true" : "false"],
    ["rounds", game.rounds],
    ["updatedAt", game.updatedAt || "1/1/2000"],
    ["updatedBy", game.updatedBy || "testuser"],
    ["lightning_timer", game.lightning_timer || 90],
    ["max_wrong", game.max_wrong || 3],
    ["layout", game.layout]
  ];
  const configCSV = "key,value\n" + configRows.map(r => `${r[0]},${r[1]}`).join("\n");

  const res = await fetch(
    "https://oe-game-test-function-aqg4hed8gqcxb6ej.eastus-01.azurewebsites.net/api/saveMarketplaceCSV",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameKey: game.key,
        configCSV,
        selectedCSV
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(text);
    throw new Error("Save failed");
  }
}

// Serializes admin list into CSV and uploads to server
async function saveAdminsToServer(admins) {
  const headers = [
    "id",
    "username",
    "firstname",
    "lastname",
    "email",
    "role",
    "active"
  ];
  const rows = admins.map(a => ({
    id: a.id,
    username: a.username,
    firstname: a.firstname,
    lastname: a.lastname,
    email: a.email,
    role: a.role,
    active: a.active ? "true" : "false"
  }));
  const csv = toCSV(headers, rows);

  const res = await fetch("https://oe-game-test-function-aqg4hed8gqcxb6ej.eastus-01.azurewebsites.net/api/saveAdminsCSV", {
    method: "POST",
    headers: {
      "Content-Type": "text/csv; charset=utf-8"
    },
    body: csv
  });

  if (!res.ok) {
    throw new Error("Failed to save AdminData.csv");
  }
}

// Restore Safe version and return success state
async function restoreCSV(target) {
  try {
    const res = await fetch(
      `${FUNCTION_BASE}/api/restoreSafeCSV`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      }
    );

    if (!res.ok) {
      throw new Error("Restore failed");
    }

    showFooterMessage("✓ Restored to Safe Version");
    return true;

  } catch (err) {
    console.error(err);
    showFooterMessage("Restore failed. Check server.", "error", 3000);
    return false;
  }
}

//#endregion

checkLogin();