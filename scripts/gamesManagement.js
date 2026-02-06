(() => {
  //#region ====== Variables ======

  let games = [];
  let footer = null;

  //#endregion

  //#region ====== CSV ======

  async function loadGamesFromCSV() {
    const url = "https://lessondatamanagement.blob.core.windows.net/lessondata/current/GameData.csv" + "?t=" + Date.now();
    
    const res = await fetch(url, { cache: "no-store" });
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
        version: raw.version,
        title: raw.title,
        active: raw.active === "true",
        levels: Number(raw.levels),
        updatedAt: raw.updatedAt || "-",
        updatedBy: raw.updatedBy || "-"
      };
    });
  }

  //#endregion

  //#region ====== Header ======

  function updateGameCount() {
    const countEl = document.getElementById("item-count");
    countEl.textContent = `(${games.length})`;
  }

  //#endregion

  //#region ====== Table ======

  // Create row for each game
  function renderGamesRow(game, index){
    return `
      <td>${index + 1}</td>

      <!-- Actions -->
      <td>
        <div class="actions">
          <button class="action-btn edit" title="Edit">✏️</button>
          <button class="action-btn restore" title="Restore">🔄</button>
          <button class="action-btn delete" title="Delete">🗑️</button>
        </div>
      </td>

      <!-- Version -->
      <td>${game.version}</td>

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
  }

  // Bind actions with interactctive UI components
  function bindGamesInteractiveUI(row, game) {
    // "Edit" Button
    row.querySelector(".edit").onclick = () => {
      openActionModal({
        title: "Modify Game",
        desc: "You are about to modify this game. This change will take effect immediately.",
        onConfirm: () => {
          openEditModal({
            title: `Edit Game #${game.id}`,
            data: game,
            fields: [
              { key: "version", label: "Version" },
              { key: "title", label: "Title" },
              { key: "active", label: "Active", type: "checkbox" },
              { key: "levels", label: "Levels", type: "number" }
            ],
            onSave: async () => {
              try {
                await saveGamesToServer(games);
                drawGames();
                showFooterMessage("✓ Saved to CSV");
              } catch (e) {
                alert("Save failed. Check server.");
              }
            }
          });
        }
      });
    };

    // "Restore" Button
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

    // "Delete" Button
    row.querySelector(".delete").onclick = () => {
      openActionModal({
        title: "Delete Game",
        desc: "This action cannot be undone. The deletion takes effect immediately.",
        onConfirm: () => {
          console.log("Delete", game.id);
          //TODO
        }
      });
    };

    // "Active" Switch
    const toggle = row.querySelector('.switch-yn input');
    if (toggle) {
      toggle.onchange = () => {
        game.active = toggle.checked;
        console.log("Game active changed:", game.id, game.active);
      };
    }
  }

  // Draw 
  function drawGames() {
    const tbody = document.getElementById("item-tbody");
    tbody.innerHTML = "";

    // Find game rows in current page
    const [start, end] = footer.getPageSlice();
    const pageItems = games.slice(start, end);

    // Create game rows
    pageItems.forEach((game, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = renderGamesRow(game, start + index);
      bindGamesInteractiveUI(tr, game);
      tbody.appendChild(tr); 
    })

    // Update UI
    updateGameCount();
  }

  //#endregion

  // ====== Init ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.GAMES) return;

    async function initGamesPage() {
      games = await loadGamesFromCSV();
      setupIndexUI({ gamesCount: games.length });

      footer = createFooterController({
        onPageChange: drawGames
      });

      footer.setTotalItems(games.length);
    }

    initGamesPage();
  })();

})();