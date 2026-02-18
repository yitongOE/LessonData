(() => {
  //#region ====== Variables ======

  let mpgames = [];
  let footer = null;
  let panelKeys = [];
  let panelKeySet = new Set();
  let currentContentKeys = [];

  //#endregion

  //#region ====== CSV ======

  async function loadMarketplaceElementRules() {
    const rows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/MarketplaceElementRule.csv?t=" + Date.now());

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
    .querySelectorAll("#thead-marketplace th[data-key]");

    return Array.from(ths).map(th => th.dataset.key);
  }

  async function loadMarketplaceFromCSV() {
    const gameDirs = [
      "WordSplash",
      "BubblePop",
      "SentenceScramble",
      "WordScramble"
    ];

    const games = [];

    for (const gameDir of gameDirs) {
      const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${gameDir}/config.csv?t=${Date.now()}`;
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
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/${key}.csv`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function loadMarketplaceContentCSV(game, key) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/${key}.csv?t=${Date.now()}`;

    try {
      return await loadCSV(url);
    } catch (e) {
      return null;
    }
  }

  //#endregion

  //#region ====== Header ======

  function updateMarketplaceCount() {
    const countEl = document.getElementById("item-count");
    countEl.textContent = `(${mpgames.length})`;
  }

  //#endregion

  //#region ====== Table ======

  // Create row for each game
  function renderMarketplaceRow(game, index){
    const headerKeys = getPanelHeaderKeys();

    let html = `
      <td>${index + 1}</td>

      <td>
        <div class="actions">
          <button class="action-btn edit gameEditBtn" title="Edit">✏️</button>
          <button class="action-btn restore gameRestoreBtn" title="Restore">🔄</button>
          <button class="action-btn delete gameDeleteBtn" title="Delete">🗑️</button>
          <button class="action-btn view gameViewBtn" title="View">🔎</button>
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
              <input type="checkbox" ${game.active ? "checked" : ""} disabled>
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
    const rows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/MarketplaceElementRule.csv?t=" + Date.now());

    return rows
    .filter(r => {
      if (!(r.key in game)) return false;
      return r.inEditor === "true" || r.canReadOnly === "true";
    })
    .map(r => {
      const field = {
        key: r.key,
        label: r.label,
        readonly: r.inEditor !== "true"
      };

      if (r.key === "active") field.type = "checkbox";
      if (r.key === "levels") field.type = "number";

      return field;
    });
  }

  function renderEditorContent(contents, contentKeys, readonlyMode = false) {
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

        const textarea = document.createElement("textarea");
        textarea.dataset.contentKey = key;
        textarea.dataset.level = r.level;
        textarea.rows = 3;
        textarea.value = r.value ?? "";

        if (readonlyMode) {
          textarea.disabled = true;
          textarea.classList.add("readonly-field");
        }

        rowDiv.appendChild(document.createElement("div")).textContent = `Level ${level}`;
        rowDiv.appendChild(textarea);

        block.appendChild(rowDiv);
      });

      container.appendChild(block);
    });
  }

  window.syncContentWithLevels = function (levelCount, readonlyMode = true) {
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

        const textarea = document.createElement("textarea");
        textarea.dataset.contentKey = key;
        textarea.dataset.level = i;
        textarea.rows = 3;
        textarea.value = existing[key]?.[i] ?? "";

        if (readonlyMode) {
          textarea.disabled = true;
        }

        row.appendChild(textarea);

        block.appendChild(row);
      }

      container.appendChild(block);
    });
  };

  // Bind actions with interactctive UI components
  function bindMarketplaceInteractiveUI(row, game) {
    // "Edit" Button
    row.querySelector(".edit").onclick = async () => {
      openActionModal({
        title: "Modify Game",
        desc: "You are about to modify this game. This change will take effect immediately.",
        requiredText: `Edit ${game.title}`,
        onConfirm: async () => {
          const fields = await getEditorFieldsFromRules(game);

          const ruleRows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/MarketplaceElementRule.csv?t=" + Date.now());
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
            const rows = await loadMarketplaceContentCSV(game, c.key);
            if (rows) contents[c.key] = rows;
          }

          openEditModal({
            title: `Edit ${game.title}`,
            data: game,
            fields,
            onSave: async (updatedGame) => {
              try {
                await saveMarketplaceToServer(updatedGame);
                drawMarketplace();
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
        requiredText: `Restore ${game.title}`,
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
        requiredText: `Delete ${game.title}`,
        onConfirm: () => {
          console.log("Delete", game.title);
          //TODO
        }
      });
    };

    // "View" Button
    row.querySelector(".view").onclick = async() => {
      const fields = await getEditorFieldsFromRules(game);

      const ruleRows = await loadCSV(
        "https://lessondatamanagement.blob.core.windows.net/lessondata/current/MarketplaceElementRule.csv?t=" + Date.now()
      );

      const contentKeys = [];
      currentContentKeys = contentKeys;

      for (const r of ruleRows) {
        if (r.isContent !== "true") continue;

        if (await hasContentCSV(game, r.key)) {
          contentKeys.push({ key: r.key, label: r.label });
        }
      }

      const contents = {};
      for (const c of contentKeys) {
        const rows = await loadMarketplaceContentCSV(game, c.key);
        if (rows) contents[c.key] = rows;
      }

      openEditModal({
        title: `View ${game.title}`,
        data: game,
        fields,
        readonlyMode: true
      });

      renderEditorContent(contents, contentKeys, true);
      syncContentWithLevels(game.levels);
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
  function drawMarketplace() {
    const tbody = document.getElementById("item-tbody");
    tbody.innerHTML = "";

    // Find game rows in current page
    const [start, end] = footer.getPageSlice();
    const pageItems = mpgames.slice(start, end);

    // Create game rows
    pageItems.forEach((game, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = renderMarketplaceRow(game, start + index);
      bindMarketplaceInteractiveUI(tr, game);
      tbody.appendChild(tr); 
    })

    // Update UI
    updateMarketplaceCount();

    // Set button visibilities based on admin roles
    if (window.currentRole) {
      applyPermissions(window.currentRole);
    }
  }

  //#endregion

  // ====== Init ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.MARKETPLACE) return;

    async function initMarketplacePage() {
      await loadMarketplaceElementRules();
      mpgames = await loadMarketplaceFromCSV();
      setupIndexUI({ marketplaceCount: mpgames.length });

      footer = createFooterController({
        onPageChange: drawMarketplace
      });

      footer.setTotalItems(mpgames.length);
    }

    initMarketplacePage();
  })();

})();