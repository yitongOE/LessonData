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

  async function hasMarketplaceContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/content.csv`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function loadMarketplaceContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/content.csv?t=${Date.now()}`;

    try {
      return await loadCSV(url);
    } catch (e) {
      return null;
    }
  }

  async function loadMarketplaceSelectedCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/selected.csv?t=${Date.now()}`;

    try {
      return await loadCSV(url);
    } catch {
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
      if (r.key === "block_highlight") field.type = "checkbox";

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

  window.syncMarketplaceContentWithLevels = function (levelCount, readonlyMode = false) {
    const container = document.getElementById("edit-content");
    if (!container) return;

    if (!draftData.chapterMap) draftData.chapterMap = {};
    if (!draftData.savedMergedMap) draftData.savedMergedMap = {};
    if (!draftData.previewDirty) draftData.previewDirty = {};

    container.innerHTML = "";

    const chapterWrapper = document.createElement("div");
    chapterWrapper.className = "chapter-sections";

    for (let i = 1; i <= levelCount; i++) {
      if (!draftData.chapterMap[i]) {
        draftData.chapterMap[i] = [false, false, false, false, false, false];
      }

      const section = document.createElement("div");
      section.className = "level-section";
      section.style.marginBottom = "25px";

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.cursor = "pointer";

      const title = document.createElement("h4");
      title.textContent = `Level ${i}`;
      title.style.margin = "0";

      const toggleBtn = document.createElement("button");
      toggleBtn.textContent = "▾";   // 默认展开箭头
      toggleBtn.style.border = "none";
      toggleBtn.style.background = "transparent";
      toggleBtn.style.fontSize = "16px";
      toggleBtn.style.cursor = "pointer";

      header.appendChild(title);
      header.appendChild(toggleBtn);
      section.appendChild(header);

      const previewTextarea = document.createElement("textarea");
      previewTextarea.rows = 4;
      previewTextarea.style.width = "100%";
      previewTextarea.style.marginTop = "10px";
      previewTextarea.readOnly = true;

      const hasSavedValue =
        draftData.savedMergedMap[i] !== undefined &&
        draftData.savedMergedMap[i] !== null;

      if (hasSavedValue && !draftData.previewDirty[i]) {
        previewTextarea.value = formatMarketplacePreview(
          draftData.savedMergedMap[i]
        );
      } else {
        previewTextarea.value = formatMarketplacePreview(
          generateLevelMergedString(i)
        );
      }

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "20px";
      row.style.marginBottom = "20px";

      for (let c = 0; c < 6; c++) {
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "5px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = draftData.chapterMap[i][c];
        checkbox.disabled = readonlyMode;

        checkbox.onchange = () => {
          draftData.chapterMap[i][c] = checkbox.checked;
          draftData.previewDirty[i] = true;

          const merged = generateLevelMergedString(i);
          previewTextarea.value = formatMarketplacePreview(merged);

          draftData.savedMergedMap[i] = merged;
        };

        label.appendChild(checkbox);

        const startLesson = c * 5 + 1;
        const endLesson = startLesson + 4;
        label.appendChild(
          document.createTextNode(`Lesson ${startLesson}-${endLesson}`)
        );

        row.appendChild(label);
      }

      const contentWrapper = document.createElement("div");
      contentWrapper.appendChild(row);
      contentWrapper.appendChild(previewTextarea);

      section.appendChild(contentWrapper);

      let collapsed = true;
      contentWrapper.style.display = "none";
      toggleBtn.textContent = "▸";

      header.onclick = () => {
        collapsed = !collapsed;

        contentWrapper.style.display = collapsed ? "none" : "block";
        toggleBtn.textContent = collapsed ? "▸" : "▾";
      };
      chapterWrapper.appendChild(section);
    }

    container.appendChild(chapterWrapper);
  };

  function generateLevelMergedString(level) {
    if (!draftData.chapterMap || !draftData.contentMap) return "";

    const selectedChapters = draftData.chapterMap[level] || [];
    let merged = [];

    selectedChapters.forEach((checked, index) => {
      if (checked) {
        const chapter = index + 1;
        const content = draftData.contentMap[chapter];
        if (content) merged.push(content);
      }
    });

    return merged.join("|");
  }

  function collectSelectedCSV() {
    if (!draftData.chapterMap) return "level,selected,value\n";

    const rows = [];

    for (let level = 1; level <= draftData.levels; level++) {
      const arr = draftData.chapterMap[level] || [false, false, false, false, false, false];
      const selected = arr
        .map((checked, index) => checked ? index + 1 : null)
        .filter(Boolean)
        .join("|");

      const merged = generateLevelMergedString(level);
      rows.push(`${level},${selected},"${merged}"`);
    }

    return "level,selected,value\n" + rows.join("\n");
  }


  // Bind actions with interactctive UI components
  function bindMarketplaceInteractiveUI(row, game) {
    // "Edit" Button
    row.querySelector(".edit").onclick = async () => {
      openActionModal({
        title: "Modify Game",
        desc: "You are about to modify this game. This change will take effect immediately.",
        onConfirm: async () => {
          const fields = await getEditorFieldsFromRules(game);
          const contentKeys = [];
          currentContentKeys = contentKeys;

          openEditModal({
            title: `Edit ${game.title}`,
            data: game,
            fields,
            onSave: async (updatedGame) => {
              try {
                await saveMarketplaceToServer(updatedGame, collectSelectedCSV());

                mpgames = await loadMarketplaceFromCSV();

                footer.setTotalItems(mpgames.length);
                drawMarketplace();

                showFooterMessage("✓ Saved to CSV");
              } catch (e) {
                alert("Save failed. Check server.");
              }
            }
          });

          let selectedRows = await loadMarketplaceSelectedCSV(game);

          if (selectedRows) {
            draftData.chapterMap = {};
            draftData.savedMergedMap = {};

            selectedRows.forEach(r => {
              const level = Number(r.level);
              const selectedArr = (r.selected || "")
                .split("|")
                .map(n => Number(n));

              draftData.chapterMap[level] =
                [false, false, false, false, false, false];

              selectedArr.forEach(ch => {
                if (ch >= 1 && ch <= 6) {
                  draftData.chapterMap[level][ch - 1] = true;
                }
              });

              // Remove "" outside string if any
              let raw = r.value || "";
              if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
              draftData.savedMergedMap[level] = raw;
            });
          }

          let contentRows = await loadMarketplaceContentCSV(game);

          if (contentRows) {
            draftData.contentMap = {};

            contentRows.forEach(r => {
              const chapter = Number(r.chapter);
              draftData.contentMap[chapter] = r.value || "";
            });
          }

          syncMarketplaceContentWithLevels(draftData.levels);
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
            await restoreCSV(`marketplace/${game.key}`);
            mpgames = await loadMarketplaceFromCSV();
            drawMarketplace();
            showFooterMessage("✓ Restored to Safe Version");
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

      if (await hasMarketplaceContentCSV(game)) {
        let label = "Content";

        if (game.key.toLowerCase().includes("sentence")) label = "Sentences";
        else label = "Words";

        contentKeys.push({ key: "content", label });
      }

      const contents = {};

      if (contentKeys.length > 0) {
        const rows = await loadMarketplaceContentCSV(game);
        if (rows) {
          contents["content"] = rows;
        }
      }

      openEditModal({
        title: `View ${game.title}`,
        data: game,
        fields,
        readonlyMode: true
      });

      renderEditorContent(contents, contentKeys, true);
      syncMarketplaceContentWithLevels(game.levels, true);
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