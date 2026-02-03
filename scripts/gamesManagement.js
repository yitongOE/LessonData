(() => {
  // ====== Variables ======

  let games = [];

  let currentPage = 1;
  let rowsPerPage = 10;
  let pendingAction = null;

  // ====== CSV ======

  async function loadGamesFromCSV() {
    const res = await fetch("csv/GameData.csv");
    const text = await res.text();

    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(line => line.trim() !== "");
    
    const headers = lines[0].split(",").map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const raw = {};

      headers.forEach((h, i) => {
        raw[h] = values[i];
      });

      return {
        id: Number(raw.id),
        number: raw.number,
        title: raw.title,
        active: raw.active === "true",
        levels: Number(raw.levels),
        updatedAt: raw.updatedAt || "-",
        updatedBy: raw.updatedBy || "-"
      };
    });
  }

  //#region ====== Header Logics ======

  // Update game count in Head
  function updateGameCount() {
    const countEl = document.getElementById("item-count");
    countEl.textContent = `(${games.length})`;
  }

  //#endregion

  //#region ====== Table Logics ======

  // Bind button actions
  function bindActions(row, game) {
    // Edit
    row.querySelector(".edit").onclick = () => {
      openActionModal({
        title: "Modify Game",
        desc: "You are about to modify this game. This change will take effect immediately.",
        onConfirm: () => {
          console.log("Edit", game.id);
        }
      });
    };

    // Restore
    row.querySelector(".restore").onclick = () => {
      openActionModal({
        title: "Restore Latest Safe Version",
        desc: "This will restore the game to the most recent safe version. Any unsaved changes will be lost. This action takes effect immediately.",
        onConfirm: () => {
          console.log("Restore latest safe version:", game.id);

          // TODO: Get file
          // restoreGameToLatestSafeVersion(game.id);
        }
      });
    };

    // Delete
    row.querySelector(".delete").onclick = () => {
      openActionModal({
        title: "Delete Game",
        desc: "This action cannot be undone. The deletion takes effect immediately.",
        onConfirm: () => {
          console.log("Delete", game.id);
        }
      });
    };

    // Switch active/inactive
    const toggle = row.querySelector('.switch-yn input');
    if (toggle) {
      toggle.onchange = () => {
        game.active = toggle.checked;
        console.log("Game active changed:", game.id, game.active);
      };
    }
  }

  //#endregion

  //#region ====== Footer Logics ======

  function updateRowRange() {
    const total = games.length;
    const start = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, total);

    document.getElementById("row-range").textContent =
      `${start}–${end} of ${total}`;
  }

  function updateFooterButtons() {
    const totalPages = Math.ceil(games.length / rowsPerPage);

    document.getElementById("first-page").disabled = currentPage === 1;
    document.getElementById("prev-page").disabled = currentPage === 1;
    document.getElementById("next-page").disabled = currentPage === totalPages;
    document.getElementById("last-page").disabled = currentPage === totalPages;
  }

  document.getElementById("first-page").onclick = () => {
    currentPage = 1;
    draw();
  };

  document.getElementById("prev-page").onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      draw();
    }
  };

  document.getElementById("next-page").onclick = () => {
    const totalPages = Math.ceil(games.length / rowsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      draw();
    }
  };

  document.getElementById("last-page").onclick = () => {
    currentPage = Math.ceil(games.length / rowsPerPage);
    draw();
  };

  //#endregion

  // ====== Draw ======

  function draw() {
    const tbody = document.getElementById("item-tbody");
    tbody.innerHTML = "";

    // Find game rows in current page
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageItems = games.slice(start, end);

    // Create game rows
    pageItems.forEach((game, index) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${start + index + 1}</td>

        <!-- Actions -->
        <td>
          <div class="actions">
            <button class="action-btn edit" title="Edit">✏️</button>
            <button class="action-btn restore" title="Restore">🔄</button>
            <button class="action-btn delete" title="Delete">🗑️</button>
          </div>
        </td>

        <!-- Version -->
        <td>${game.number}</td>

        <!-- Title -->
        <td>${game.title}</td>

        <!-- Active -->
        <td>
          <label class="switch-yn">
            <input type="checkbox" ${game.active ? "checked" : ""}>
            <span class="switch-track">
              <span class="switch-label yes">YES</span>
              <span class="switch-label no">NO</span>
              <span class="switch-thumb"></span>
            </span>
          </label>
        </td>

        <!-- Levels -->
        <td>${game.levels}</td>

        <!-- Updated -->
        <td>${game.updatedAt}</td>
        <td>${game.updatedBy}</td>
      `;

      bindActions(tr, game);
      tbody.appendChild(tr); 
    })

    // Update UI
    updateGameCount();
    updateRowRange();
    updateFooterButtons();
  }

  //#region ====== Action Confirmation Models ======

  // Open a popup window when click on action buttons
  function openActionModal({ title, desc, onConfirm }) {
    const modal = document.getElementById("action-modal");
    const passwordInput = document.getElementById("modal-password");
    const awareCheckbox = document.getElementById("modal-aware");
    const confirmBtn = document.getElementById("modal-confirm");
    const errorEl = document.getElementById("modal-password-error");
    const passwordText = document.getElementById("modal-password-text");
    
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-desc").textContent = desc;

    // Reset password zone
    passwordInput.value = "";
    passwordText.value = "";
    passwordInput.classList.remove("is-hidden");
    passwordText.classList.add("is-hidden");
    passwordInput.type = "password";
    const toggleBtn = document.getElementById("toggle-password");
    toggleBtn.setAttribute("data-visible", "false");

    awareCheckbox.checked = false;
    confirmBtn.disabled = true;

    modal.classList.remove("hidden");
    errorEl.classList.add("hidden");

    const updateConfirmState = () => {
      const hasPassword = passwordInput.value.length > 0;
      const awareOk = awareCheckbox.checked;
      confirmBtn.disabled = !(hasPassword && awareOk);
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

  document.getElementById("toggle-password").onclick = () => {
    const hidden = document.getElementById("modal-password");
    const text = document.getElementById("modal-password-text");
    const btn = document.getElementById("toggle-password");

    const showing = btn.getAttribute("data-visible") === "true";

    if (showing) {
      // switch to hidden (password)
      text.classList.add("is-hidden");
      hidden.classList.remove("is-hidden");
      hidden.focus();
      hidden.selectionStart = hidden.selectionEnd = hidden.value.length;
      btn.setAttribute("data-visible", "false");
    } else {
      // switch to visible (text)
      hidden.classList.add("is-hidden");
      text.classList.remove("is-hidden");
      text.focus();
      text.selectionStart = text.selectionEnd = text.value.length;
      btn.setAttribute("data-visible", "true");
    }
  };

  const pwHidden = document.getElementById("modal-password");
  const pwText = document.getElementById("modal-password-text");

  // Keep values in sync
  pwHidden.addEventListener("input", () => {
    pwText.value = pwHidden.value;
  });
  pwText.addEventListener("input", () => {
    pwHidden.value = pwText.value;
  });

  //#endregion

  // ====== Execution ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.GAMES) return;

    async function initGamesPage() {
      games = await loadGamesFromCSV();
      setupIndexUI({ gamesCount: games.length });
      draw();
    }

    initGamesPage();
  })();

})();