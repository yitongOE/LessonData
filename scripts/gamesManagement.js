(() => {
  //#region ====== Variables ======

  let rvgames = [];
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

  async function hasGameContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/games/${game.key}/content.csv`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function loadGameContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/games/${game.key}/content.csv?t=${Date.now()}`;

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
    countEl.textContent = `(${rvgames.length})`;
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
          <button class="action-btn edit gameEditBtn" title="Edit">✏️</button>
          <button class="action-btn restore gameRestoreBtn" title="Restore">🔄</button>
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
    const rows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/GameElementRule.csv?t=" + Date.now());

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
      if (r.key === "block_highlight") field.type = "checkbox";

      if (r.key === "eduLevel") {
        field.type = "select";

        const key = game.key;

        if (key === "WordSplash" || key === "SentenceScramble") {
          field.options = [
            { value: 1, label: "Level 1 (Lesson 1–30)" },
            { value: 3, label: "Level 3 (Lesson 61–90)" }
          ];
        }

        if (key === "BubblePop" || key === "WordScramble") {
          field.options = [
            { value: 2, label: "Level 2 (Lesson 31–60)" },
            { value: 4, label: "Level 4 (Lesson 91–120)" }
          ];
        }
      }

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
        textarea.value = csvToTextarea(r.value);
        textarea.style.width = "100%";

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

  window.syncGameContentWithLevels = function (levelCount, readonlyMode = false) {
    const container = document.getElementById("edit-content");
    if (!container) return;

    container.innerHTML = "";

    const allContentRows = draftData.content || [];

    currentContentKeys.forEach(({ key, label }) => {
      const block = document.createElement("div");
      block.className = "content-block";

      const h4 = document.createElement("h4");
      h4.textContent = label;
      block.appendChild(h4);

      const eduLevel = Number(draftData.eduLevel || 1);
      const startIndex = (eduLevel - 1) * 6 + 1;
      const endIndex = startIndex + 5;

      for (let i = startIndex; i <= endIndex; i++) {
        const row = document.createElement("div");
        row.className = "content-row";
        row.style.marginBottom = "18px";

        // ===== Lesson header =====
        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.cursor = "pointer";

        const lessonTitle = document.createElement("div");
        lessonTitle.className = "lesson-range-title";
        const startLesson = (i - 1) * 5 + 1;
        const endLesson = startLesson + 4;
        lessonTitle.textContent = `Lesson ${startLesson}-${endLesson}`;
        lessonTitle.style.fontSize = "13px";
        lessonTitle.style.fontWeight = "600";
        lessonTitle.style.color = "#666";
        lessonTitle.style.margin = "0";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.textContent = "▾";
        toggleBtn.style.border = "none";
        toggleBtn.style.background = "transparent";
        toggleBtn.style.fontSize = "16px";
        toggleBtn.style.cursor = "pointer";

        header.appendChild(lessonTitle);
        header.appendChild(toggleBtn);

        // ===== Content =====
        const contentWrapper = document.createElement("div");
        contentWrapper.style.marginTop = "6px";

        const textarea = document.createElement("textarea");
        textarea.dataset.contentKey = key;
        textarea.dataset.level = i;
        textarea.rows = 3;
        textarea.style.width = "100%";

        const rowData = allContentRows.find(r => Number(r.level) === i);
        textarea.value = csvToTextarea(rowData?.value);

        // Split paragraph to sentences
        if (editingTarget?.key?.toLowerCase().includes("sentence")) {
          textarea.addEventListener("paste", function () {
            setTimeout(() => {
              const formatted = splitSentencesSmart(textarea.value);
              textarea.value = formatted;
            }, 0);
          });
          
          textarea.addEventListener("input", function (e) {
            if (!e.inputType || e.inputType !== "insertText") return;
            if (!e.data || !/\s/.test(e.data)) return;

            const value = textarea.value;

            if (/[.!?。！？…]\s$/.test(value)) {
              textarea.value = value.replace(/\s$/, "\n");
              textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            }
          });
        }

        const isSentenceScramble =
          window.currentEditingGameKey === "SentenceScramble";

        if (!isSentenceScramble || readonlyMode) {
          textarea.disabled = true;
        }

        textarea.oninput = e => {
          let existingRow = allContentRows.find(r => Number(r.level) === i);

          if (!existingRow) {
            existingRow = { level: i, value: "" };
            allContentRows.push(existingRow);
          }

          existingRow.value = textareaToCsv(e.target.value);
        };

        contentWrapper.appendChild(textarea);

        // ===== Fold-textbox Button =====
        let collapsed = true;
        contentWrapper.style.display = "none";
        toggleBtn.textContent = "▸";

        const toggle = () => {
          collapsed = !collapsed;
          contentWrapper.style.display = collapsed ? "none" : "block";
          toggleBtn.textContent = collapsed ? "▸" : "▾";
        };

        header.onclick = toggle;
        toggleBtn.onclick = e => {
          e.stopPropagation();
          toggle();
        };

        row.appendChild(header);
        row.appendChild(contentWrapper);
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

          const contentKeys = [];
          currentContentKeys = contentKeys;

          if (await hasGameContentCSV(game)) {
            let label = "Content";

            if (game.key.toLowerCase().includes("sentence")) label = "Sentences";
            else label = "Words";

            contentKeys.push({ key: "content", label });
          }

          const contents = {};

          if (contentKeys.length > 0) {
            const rows = await loadGameContentCSV(game);
            if (rows) contents["content"] = rows;
          }

          window.currentEditingGameKey = game.key;

          openEditModal({
            title: `Edit ${game.title}`,
            data: { ...game, content: contents["content"] },
            fields,
            onSave: async (updatedGame) => {
              try {
                await saveGamesToServer(updatedGame);

                rvgames = await loadGamesFromCSV();

                footer.setTotalItems(rvgames.length);
                drawGames();

                showFooterMessage("✓ Saved to CSV");
              } catch (e) {
                alert("Save failed. Check server.");
              }
            }
          });

          renderEditorContent(contents, contentKeys);
          syncGameContentWithLevels(draftData.levels, false);
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
            await restoreCSV(`games/${game.key}`);
          } catch (e) {
            alert("Restore failed. Check server.");
          }
        }
      });
    };

    // "Delete" Button
    // row.querySelector(".delete").onclick = () => {
    //   openActionModal({
    //     title: "Delete Game",
    //     desc: "This action cannot be undone. The deletion takes effect immediately.",
    //     onConfirm: () => {
    //       console.log("Delete", game.title);
    //       //TODO
    //     }
    //   });
    // };

    // "View" Button
    row.querySelector(".view").onclick = async() => {
      const fields = await getEditorFieldsFromRules(game);

      const contentKeys = [];
      currentContentKeys = contentKeys;

      if (await hasGameContentCSV(game)) {
        let label = "Content";

        if (game.key.toLowerCase().includes("sentence")) label = "Sentences";
        else label = "Words";

        contentKeys.push({ key: "content", label });
      }

      const contents = {};

      if (contentKeys.length > 0) {
        const rows = await loadGameContentCSV(game);
        if (rows) {
          contents["content"] = rows;
        }
      }

      window.currentEditingGameKey = game.key;

      openEditModal({
        title: `View ${game.title}`,
        data: game,
        fields,
        readonlyMode: true
      });

      renderEditorContent(contents, contentKeys, true);
      syncGameContentWithLevels(game.levels, true);
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
    const pageItems = rvgames.slice(start, end);

    // Create game rows
    pageItems.forEach((game, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = renderGamesRow(game, start + index);
      bindGamesInteractiveUI(tr, game);
      tbody.appendChild(tr); 
    })

    // Update UI
    updateGameCount();

    // Set button visibilities based on admin roles
    if (window.currentRole) {
      applyPermissions(window.currentRole);
    }
  }

  //#endregion

  // ====== Init ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.GAMES) return;

    async function initGamesPage() {
      await loadGameElementRules();
      rvgames = await loadGamesFromCSV();
      setupIndexUI({ gamesCount: rvgames.length });

      footer = createFooterController({
        onPageChange: drawGames
      });

      footer.setTotalItems(rvgames.length);
    }

    initGamesPage();
  })();

})();