//#region ====== Variables ======

const PANEL = {
  GAMES: "games",
  ADMINS: "admins"
};
const ADMIN_PASSWORD = "admin123";

let currentPanel = null;
let pendingAction = null;

//#endregion

//#region ====== Panel Switch ======

// Detect current panel
function getPanel() {
  return new URLSearchParams(location.search).get("panel") || PANEL.GAMES;
}

// Update content according to selected panel
function setupIndexUI({ gamesCount = 0, adminsCount = 0 }) {
  const panel = getPanel();

  const toggleBtn = document.getElementById("panel-toggle-btn");
  const titleText = document.getElementById("header-title-text");
  const itemCount = document.getElementById("item-count");
  const theadGames = document.getElementById("thead-games");
  const theadAdmins = document.getElementById("thead-admins");

  if (panel === PANEL.GAMES) {
    // Header
    document.title = "Our English - Games Management";
    titleText.textContent = "Games";
    itemCount.textContent = `(${gamesCount})`;

    // Toggle button
    toggleBtn.textContent = "Admins Management";
    toggleBtn.onclick = () => {
      location.href = "index.html?panel=admins";
    };

    // Table head
    theadGames.classList.remove("hidden");
    theadAdmins.classList.add("hidden");
  } else {
    // Header
    document.title = "Our English - Admins Management";
    titleText.textContent = "Admins";
    itemCount.textContent = `(${adminsCount})`;

    // Toggle button
    toggleBtn.textContent = "Games Management";
    toggleBtn.onclick = () => {
      location.href = "index.html?panel=games";
    };

    // Table head
    theadGames.classList.add("hidden");
    theadAdmins.classList.remove("hidden");
  }

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

function openActionModal({ title, desc, onConfirm }) {
    const modal = document.getElementById("action-modal");
    const passwordInput = document.getElementById("modal-password");
    const awareCheckbox = document.getElementById("modal-aware");
    const confirmBtn = document.getElementById("modal-confirm");
    const errorEl = document.getElementById("modal-password-error");

    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-desc").textContent = desc;

    passwordInput.value = "";
    awareCheckbox.checked = false;
    confirmBtn.disabled = true;
    errorEl.classList.add("hidden");

    modal.classList.remove("hidden");

    const updateConfirmState = () => {
      confirmBtn.disabled = !(
        passwordInput.value.length > 0 && awareCheckbox.checked
      );
      errorEl.classList.add("hidden");
    };

    passwordInput.oninput = updateConfirmState;
    awareCheckbox.onchange = updateConfirmState;

    pendingAction = onConfirm;
  }

  document.getElementById("modal-cancel").onclick = () => {
    document.getElementById("action-modal").classList.add("hidden");
  };

  document.getElementById("modal-confirm").onclick = () => {
    const passwordInput = document.getElementById("modal-password");
    const errorEl = document.getElementById("modal-password-error");

    if (passwordInput.value !== ADMIN_PASSWORD) {
      errorEl.classList.remove("hidden");
      return;
    }

    document.getElementById("action-modal").classList.add("hidden");
    if (pendingAction) pendingAction();
  };

  //#endregion

//#region ====== Edit Modal ======

let editingTarget = null;
let draftData = null;

function openEditModal({ title, data, fields, onSave }) {
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
  document.getElementById("edit-save").onclick = () => {
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

//#endregion

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
