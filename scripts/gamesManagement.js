(() => {
  //#region ====== Variables ======

  let games = [];
  let footer = null;
  let allGameDataRows = [];

  //#endregion

  //#region ====== CSV ======

  async function loadGamesFromCSV() {
    const url =
      "https://lessondatamanagement.blob.core.windows.net/lessondata/current/GameData.csv"
      + "?t=" + Date.now();

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(l => l.trim() !== "");

    const headers = lines[0].split(",").map(h => h.trim());

    const rows = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => (obj[h] = values[i] ?? ""));
      return obj;
    });

    allGameDataRows = rows;

    return buildGamesFromRows(rows);
  }

  // Helpers

  function buildGamesFromRows(rows) {
    console.log("SAMPLE ROW:", rows[0]);
    const map = {};

    rows.forEach(r => {
      const id = Number(r.id);
      map[id] ??= { id };

      switch (r.element) {
        case "version":
          map[id].version = r.value;
          break;
        case "title":
          map[id].title = r.value;
          break;
        case "active":
          map[id].active = r.value === "true";
          break;
        case "levels":
          map[id].levels = r.value;
          break;
        case "updatedAt":
          map[id].updatedAt = r.value;
          break;
        case "updatedBy":
          map[id].updatedBy = r.value;
          break;
      }
    });

    return Object.values(map);
  }

  function inferFieldType(value) {
    if (value === "true" || value === "false") {
      return "checkbox";
    }

    if (!isNaN(value) && value !== "") {
      return "number";
    }

    return "text";
  }

  function buildEditableModel(gameId) {
    return {
      id: gameId,
      rows: allGameDataRows
        .filter(r =>
          Number(r.id) === gameId &&
          r.editable === "true"
        )
        .map(r => ({ ...r }))
    };
  }

  function buildFieldsFromEditableRows(editModel) {
    const fields = [];
    const grouped = {};
    editModel.rows.forEach(row => {
      grouped[row.element] ??= [];
      grouped[row.element].push(row);
    });

    Object.values(grouped).forEach(rows => {
      const elementLabel = rows[0].label || rows[0].element;

      rows
        .sort((a, b) => Number(a.level || 0) - Number(b.level || 0))
        .forEach(row => {
          const index = editModel.rows.indexOf(row);

          fields.push({
            key: `rows.${index}.value`,
            label: row.level ? `Level ${row.level}` : elementLabel,
            type: inferFieldType(row.value)
          });
        });
    });

    return fields;
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

          const editModel = buildEditableModel(game.id);

          openEditModal({
            title: `Edit Game #${game.id}`,
            data: editModel,
            fields: buildFieldsFromEditableRows(editModel),
            onSave: async () => {
              try {
                allGameDataRows = [
                  ...allGameDataRows.filter(r =>
                    Number(r.id) !== game.id || r.editable !== "true"
                  ),
                  ...editModel.rows
                ];

                await saveGameDataToServer(allGameDataRows);
                location.reload();
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
        desc: "This will restore ALL games to the most recent safe version. Any changes made since the last snapshot will be permanently lost. This action takes effect immediately.",
        onConfirm: async () => {
          try {
            await restoreCSV("GameData");
          } catch (e) {
            alert("Restore failed. Check server.");
          }
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