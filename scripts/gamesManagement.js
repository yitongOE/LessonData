(() => {
  //#region ====== Variables ======

  let games = [];
  let footer = null;
  let panelKeys = [];
  let panelKeySet = new Set();
  let currentContentKeys = [];

  //#endregion

  //#region ====== CSV ======

  async function loadGameElementRules() {
    const rows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/GameElementRule.csv?t=" + Date.now());

    panelKeys = [];
    panelKeySet.clear();

    rows.forEach(r => {
      if (r.inPanel === "true") {
        panelKeys.push(r.key);
        panelKeySet.add(r.key);
      }
    });
  }

  function getPanelHeaderKeys() {
  const ths = document
    .querySelectorAll("#thead-games th[data-key]");

    return Array.from(ths).map(th => th.dataset.key);
  }

  async function loadGamesFromCSV() {
    const gameDirs = [
      "WordSplash",
      "BubblePop",
      "SentenceScramble",
      "WordScramble"
    ];

    const games = [];

    for (const gameDir of gameDirs) {
      const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/games/${gameDir}/config.csv?t=${Date.now()}`;
      const rows = await loadCSV(url);

      const game = {};
      rows.forEach(r => {
        game[r.key] = parseValue(r.value);
      });

      game.key = gameDir;
      games.push(game);
    }

    return games;
  }

  function parseValue(raw) {
    if (raw === "true" || raw === "false") return raw === "true";
    if (!isNaN(raw)) return Number(raw);
    return raw;
  }

  async function hasContentCSV(game, key) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/games/${game.key}/${key}.csv`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function loadGameContentCSV(game, key) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/games/${game.key}/${key}.csv?t=${Date.now()}`;

    try {
      return await loadCSV(url);
    } catch (e) {
      return null;
    }
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
    const headerKeys = getPanelHeaderKeys();

    let html = `
      <td>${index + 1}</td>

      <td>
        <div class="actions">
          <button class="action-btn edit" title="Edit">✏️</button>
          <button class="action-btn restore" title="Restore">🔄</button>
          <button class="action-btn delete" title="Delete">🗑️</button>
        </div>
      </td>
    `;

    headerKeys.forEach(key => {
      if (!panelKeySet.has(key)) {
        html += `<td>-</td>`;
        return;
      }

      if (key === "active") {
        html += `
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
        `;
        return;
      }

      html += `<td>${game[key] ?? "-"}</td>`;
    });

    return html;
  }

  async function getEditorFieldsFromRules(game) {
    const rows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/GameElementRule.csv?t=" + Date.now());

    return rows
      .filter(r => {
        if (r.inEditor !== "true") return false;

        const key = r.key;

        if (key in game) return true;

        return false;
      })
      .map(r => {
        const field = {
          key: r.key,
          label: r.label
        };

        if (r.key === "active") field.type = "checkbox";
        if (r.key === "levels") field.type = "number";

        return field;
      });
  }

  function renderEditorContent(contents, contentKeys) {
    const container = document.getElementById("edit-content");
    if (!container) return;

    container.innerHTML = "";
    if (Object.keys(contents).length === 0) return;

    const title = document.createElement("h3");
    title.textContent = "Content";
    container.appendChild(title);

    contentKeys.forEach(({ key, label }) => {
      const rows = contents[key];
      if (!rows) return;

      const block = document.createElement("div");
      block.className = "content-block";

      const h4 = document.createElement("h4");
      h4.textContent = label;
      block.appendChild(h4);

      rows.forEach(r => {
        const level = Number(r.level);

        const rowDiv = document.createElement("div");
        rowDiv.className = "content-row";

        rowDiv.innerHTML = `
          <div>Level ${level}</div>
          <textarea
            data-content-key="${key}"
            data-level="${r.level}"
            rows="3"
          >${r.value ?? ""}</textarea>
        `;

        block.appendChild(rowDiv);
      });

      container.appendChild(block);
    });
  }

  window.syncContentWithLevels = function (levelCount) {
    const container = document.getElementById("edit-content");
    if (!container) return;

    const existing = {};
    container.querySelectorAll("textarea").forEach(t => {
      const key = t.dataset.contentKey;
      const level = Number(t.dataset.level);
      if (!existing[key]) existing[key] = {};
      existing[key][level] = t.value;
    });

    container.innerHTML = "";

    currentContentKeys.forEach(({ key, label }) => {
      const block = document.createElement("div");
      block.className = "content-block";

      const h4 = document.createElement("h4");
      h4.textContent = label;
      block.appendChild(h4);

      for (let i = 1; i <= levelCount; i++) {
        const row = document.createElement("div");
        row.className = "content-row";

        row.innerHTML = `
          <div>Level ${i}</div>
          <textarea
            data-content-key="${key}"
            data-level="${i}"
            rows="3"
          >${existing[key]?.[i] ?? ""}</textarea>
        `;

        block.appendChild(row);
      }

      container.appendChild(block);
    });
  };

  // Bind actions with interactctive UI components
  function bindGamesInteractiveUI(row, game) {
    // "Edit" Button
    row.querySelector(".edit").onclick = async () => {
      openActionModal({
        title: "Modify Game",
        desc: "You are about to modify this game. This change will take effect immediately.",
        onConfirm: async () => {
          const fields = await getEditorFieldsFromRules(game);

          const ruleRows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/GameElementRule.csv?t=" + Date.now());
          const contentKeys = [];
          currentContentKeys = contentKeys;

          for (const r of ruleRows) {
            if (r.inEditor !== "true") continue;
            if (r.isContent !== "true") continue;

            if (await hasContentCSV(game, r.key)) {
              contentKeys.push({ key: r.key, label: r.label });
            }
          }
          const contents = {};
          for (const c of contentKeys) {
            const rows = await loadGameContentCSV(game, c.key);
            if (rows) contents[c.key] = rows;
          }

          openEditModal({
            title: `Edit ${game.title}`,
            data: game,
            fields,
            onSave: async (updatedGame) => {
              try {
                await saveGamesToServer(updatedGame);
                drawGames();
                showFooterMessage("✓ Saved to CSV");
              } catch (e) {
                alert("Save failed. Check server.");
              }
            }
          });

          renderEditorContent(contents, contentKeys);
          syncContentWithLevels(draftData.levels);
        }
      });
    };

    // "Restore" Button
    row.querySelector(".restore").onclick = () => {
      openActionModal({
        title: "Restore Latest Safe Version",
        desc: "This will restore the game to the most recent safe version. Any unsaved changes will be lost. This action takes effect immediately.",
        onConfirm: async () => {
          try {
            await restoreCSV(game.key);
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
          console.log("Delete", game.title);
          //TODO
        }
      });
    };

    // "Active" Switch
    const toggle = row.querySelector('.switch-yn input');
    if (toggle) {
      toggle.onchange = () => {
        game.active = toggle.checked;
        console.log("Game active changed:", game.title, game.active);
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
      await loadGameElementRules();
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