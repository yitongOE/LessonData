(() => {
  //#region ====== Variables ======

  let rvgames = [];
  let panelKeySet = new Set();
  let currentContentKeys = [];
  let gamesController = null;

  //#endregion

  //#region ====== CSV ======

  // Loads GameElementRule.csv and extracts keys used in panel display
  async function loadGameElementRules() {
    const rows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/GameElementRule.csv?t=" + Date.now());

    panelKeySet.clear();

    rows.forEach(r => {
      if (r.inPanel === "true") {
        panelKeySet.add(r.key);
      }
    });
  }

  // Reads table header configuration from DOM and returns ordered data keys
  function getPanelHeaderKeys() {
    const ths = document.querySelectorAll("#thead-games th[data-key]");

    return Array.from(ths).map(th => th.dataset.key);
  }

  // Loads all game config.csv files and converts them into structured game objects
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

  // Checks whether a content.csv file exists for a given game
  async function hasGameContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/games/${game.key}/content.csv`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Loads game content.csv and returns parsed rows
  async function loadGameContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/games/${game.key}/content.csv?t=${Date.now()}`;

    try {
      return await loadCSV(url);
    } catch (e) {
      return null;
    }
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

  // Generates editor field schema based on GameElementRule.csv
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

  // Renders content blocks inside edit modal based on loaded content data
  function renderEditorContent(contents, contentKeys, readonlyMode = false) {
    const container = document.getElementById("edit-content");
    if (!container) return;

    // Clear previous content and exit if empty
    container.innerHTML = "";
    if (Object.keys(contents).length === 0) return;

    // Create title for content section
    const title = document.createElement("h3");
    title.textContent = "Content";
    container.appendChild(title);

    // Render content blocks grouped by content key
    contentKeys.forEach(({ key, label }) => {
      const rows = contents[key];
      if (!rows) return;

      const block = document.createElement("div");
      block.className = "content-block";

      const h4 = document.createElement("h4");
      h4.textContent = label;
      block.appendChild(h4);

      // Create textarea rows for each level entry
      rows.forEach(r => {
        const level = Number(r.level);

        const rowDiv = document.createElement("div");
        rowDiv.className = "content-row";

        const textarea = document.createElement("textarea");
        textarea.dataset.contentKey = key;
        textarea.dataset.level = r.level;
        textarea.rows = 3;
        textarea.value = csvToTextarea(r.value);

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

  // Dynamically generates editable content UI based on selected level range
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

      // Generate collapsible lesson section
      for (let i = startIndex; i <= endIndex; i++) {
        const row = document.createElement("div");
        row.className = "content-row";
        row.classList.add("lesson-row");

        // Lesson header
        const header = document.createElement("div");
        header.classList.add("lesson-header");

        const lessonTitle = document.createElement("div");
        lessonTitle.className = "lesson-range-title";
        const startLesson = (i - 1) * 5 + 1;
        const endLesson = startLesson + 4;
        lessonTitle.textContent = `Lesson ${startLesson}-${endLesson}`;
        lessonTitle.className = "lesson-range-title";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.textContent = "▾";
        toggleBtn.classList.add("lesson-toggle-btn");

        header.appendChild(lessonTitle);
        header.appendChild(toggleBtn);

        // Content
        const contentWrapper = document.createElement("div");
        contentWrapper.classList.add("lesson-content-wrapper");

        const textarea = document.createElement("textarea");
        textarea.dataset.contentKey = key;
        textarea.dataset.level = i;
        textarea.rows = 3;

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

        const isSentenceScramble = window.currentEditingGameKey === "SentenceScramble";

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

        // Fold-textbox Button
        let collapsed = true;
        contentWrapper.classList.add("collapsed");
        toggleBtn.textContent = "▸";

        const toggle = () => {
          collapsed = !collapsed;
          contentWrapper.classList.toggle("collapsed", collapsed);
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

                await gamesController.reloadAndRedraw(async () => {
                  rvgames = await loadGamesFromCSV();
                  return rvgames;
                });

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
            const ok = await restoreCSV(`games/${game.key}`);
            if (ok) {
              await gamesController.reloadAndRedraw(async () => {
                rvgames = await loadGamesFromCSV();
                return rvgames;
              });
            }
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
        data: { ...game, content: contents["content"] },
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
      };
    }
  }

  //#endregion

  // ====== Init ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.GAMES) return;

    async function initGamesPage() {
      gamesController = createPanelController({
        panelName: "games",
        loadRules: async () => {
          await loadGameElementRules();
        },
        loadData: async () => {
          rvgames = await loadGamesFromCSV();
          return rvgames;
        },
        drawRow: (game, index) => renderGamesRow(game, index),
        bindRowUI: (tr, game) => bindGamesInteractiveUI(tr, game),
        onAfterDraw: () => {
          // Save space for future functions
        }
      });

      await gamesController.init({ gamesCount: (await loadGamesFromCSV()).length });
    }

    initGamesPage();
  })();

})();