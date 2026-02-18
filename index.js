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
const modalRequiredText = document.getElementById("modal-requiredText");
const passwordInput = document.getElementById("modal-password");
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

let currentPanel = null;
let pendingAction = null;

//#endregion

//#region ====== Login ======

async function checkLogin() {
  try {
    const res = await fetch(
      `${FUNCTION_BASE}/api/getCurrentUser`,
      { credentials: "include" }
    );

    if (!res.ok) {
      const redirect = encodeURIComponent(window.location.href);

      window.location.href =
        `${FUNCTION_BASE}/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(
          FUNCTION_BASE + "/api/loginRedirect?target=" + redirect
        )}`;
    }

    const user = await res.json();
    window.currentUser = user;

    const role = await determineUserRole(user);
    window.currentRole = role;

    if (!role) {
      alert("You are not authorized.");
      return;
    }

    console.log("User:", user);
    console.log("Role:", role);

    applyPermissions(role);
  } catch (err) {
    console.error("Login check failed:", err);
  }
}

async function determineUserRole(user) {

  const admins = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/AdminData.csv" + "?t=" + Date.now());

  const record = admins.find(a =>
    a.email.toLowerCase() === user.email.toLowerCase() &&
    a.active === "true"
  );

  // Ban external users
  if(!record) return null;

  return record?.role || "QA";
}

function toggle(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = show ? "" : "none";
}

function toggleGroup(className, show) {
  document.querySelectorAll(`.${className}`)
    .forEach(el => {
      el.style.display = show ? "" : "none";
    });
}

function applyPermissions(role) {
  const p = PERMISSIONS[role] || PERMISSIONS["QA"];
  const panel = getPanel(); 

  if (panel === PANEL.GAMES || panel === PANEL.MARKETPLACE) {
    toggle("panel-toggle-btn", p.adminPanel);
    toggleGroup("gameEditBtn", p.edit);
    toggleGroup("gameRestoreBtn", p.restore);
    toggleGroup("gameDeleteBtn", p.delete);
    toggleGroup("gameViewBtn", p.view);
  }
}

//#endregion

//#region ====== Panel Switch ======

// Detect current panel
function getPanel() {
  return new URLSearchParams(location.search).get("panel") || PANEL.GAMES;
}

// Update content according to selected panel
function setupIndexUI({ gamesCount = 0, adminsCount = 0, marketplaceCount = 0 }) {
  const panel = getPanel();

  btnGames.style.display = "";
  btnMarketplace.style.display = "";
  btnAdmins.style.display = "";

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
    titleText.textContent = "Marketplace";
    itemCount.textContent = `(${marketplaceCount})`;

    // Toggle button
    btnMarketplace.style.display = "none";

    // Table head
    theadGames.classList.add("hidden");
    theadAdmins.classList.add("hidden");
    theadMarketplace.classList.remove("hidden");
  }

  btnGames.onclick = () => {
    location.href = "index.html?panel=games";
  };

  btnMarketplace.onclick = () => {
    location.href = "index.html?panel=marketplace";
  };

  btnAdmins.onclick = () => {
    location.href = "index.html?panel=admins";
  };

  return panel;
}

//#endregion

//#region ====== Footer ======

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

  function getTotalPages() {
    return Math.max(1, Math.ceil(totalItems / rowsPerPage));
  }

  function updateRowRange() {
    if (totalItems === 0) {
      rowRange.textContent = "0–0 of 0";
      return;
    }

    const start = (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(start + rowsPerPage - 1, totalItems);
    rowRange.textContent = `${start}–${end} of ${totalItems}`;
  }

  function updateButtons() {
    const totalPages = getTotalPages();
    btnFirst.disabled = currentPage === 1;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    btnLast.disabled = currentPage === totalPages;
  }

  function goToPage(page) {
    const totalPages = getTotalPages();
    currentPage = Math.min(Math.max(1, page), totalPages);
    onPageChange(currentPage, rowsPerPage);
    updateRowRange();
    updateButtons();
  }

  rowsSelect.onchange = () => {
    rowsPerPage = Number(rowsSelect.value);
    currentPage = 1;
    goToPage(currentPage);
  };

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

//#endregion

//#region ====== Action Confirmation Modal ======

function openActionModal({ title, desc, requiredText, onConfirm }) {
  // Initialization
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  modalRequiredText.textContent = `Type "${requiredText}" to confirm.`;
  passwordInput.value = "";
  awareCheckbox.checked = false;
  confirmBtn.disabled = true;
  modal.classList.remove("hidden");

  // Confirm Button only active when input is correct and aware is checked
  const updateConfirmState = () => {confirmBtn.disabled = !(passwordInput.value === requiredText && awareCheckbox.checked);};
  passwordInput.oninput = updateConfirmState;
  awareCheckbox.onchange = updateConfirmState;

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
        opt.value = option;
        opt.textContent = option;
        if (option === draftData[field.key]) {
          opt.selected = true;
        }
        input.appendChild(opt);
      });

      input.onchange = e => {
        draftData[field.key] = e.target.value;
      };

    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
      input.value = draftData[field.key] ?? "";
      
      if (field.key === "levels") {
        input.oninput = e => {
          const onLevelChange = e => {
            const v = Math.max(0, Number(e.target.value) || 0);
            draftData.levels = v;
            syncContentWithLevels(v);
          };

          input.oninput = onLevelChange;
          input.onchange = onLevelChange;
        }
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
  saveBtn.onclick = () => {
    Object.assign(editingTarget, draftData);
    if (onSave) onSave(editingTarget);
    closeEditModal();
  };
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
  editingTarget = null;
  draftData = null;
}

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

//#endregion

//#region ====== Replace CSV ====== 

function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

// For Games Panel
function collectContentCSV() {
  const rows = [];
  document.querySelectorAll("#edit-content textarea")
    .forEach(t => {
      const level = t.dataset.level;
      const value = t.value.trim();
      rows.push([level, value]);
    });

  return "level,value\n" +
         rows.map(r => `${r[0]},${r[1]}`).join("\n");
}

async function saveGamesToServer(game) {

  const configRows = [
    ["version", game.version],
    ["title", game.title],
    ["active", game.active ? "true" : "false"],
    ["levels", game.levels],
    ["updatedAt", game.updatedAt || "1/1/2000"],
    ["updatedBy", game.updatedBy || "testuser"],
    ["lightning_timer", game.lightning_timer || 90],
    ["max_wrong", game.max_wrong || 3]
  ];

  const configCSV =
    "key,value\n" +
    configRows.map(r => `${r[0]},${r[1]}`).join("\n");

  const contentCSV = collectContentCSV();

  const contentType =
    game.key.includes("Sentence")
      ? "sentences"
      : "words";

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

// For Marketplace Panel
async function saveMarketplaceToServer(game) {

  const configRows = [
    ["version", game.version],
    ["title", game.title],
    ["active", game.active ? "true" : "false"],
    ["levels", game.levels],
    ["updatedAt", game.updatedAt || "1/1/2000"],
    ["updatedBy", game.updatedBy || "testuser"],
    ["lightning_timer", game.lightning_timer || 90],
    ["max_wrong", game.max_wrong || 3]
  ];

  const configCSV =
    "key,value\n" +
    configRows.map(r => `${r[0]},${r[1]}`).join("\n");

  const contentCSV = collectContentCSV();

  const contentType =
    game.key.includes("Sentence")
      ? "sentences"
      : "words";

  const res = await fetch(
    "https://oe-game-test-function-aqg4hed8gqcxb6ej.eastus-01.azurewebsites.net/api/saveMarketplaceCSV",
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

// For Admins Panel
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

// Restore Safe version
async function restoreCSV(target) {
  const res = await fetch(
    "https://oe-game-test-function-aqg4hed8gqcxb6ej.eastus-01.azurewebsites.net/api/restoreSafeCSV",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ target })
    }
  );

  if (!res.ok) {
    alert("Restore failed");
    return;
  }

  location.reload();
}

//#endregion

checkLogin();