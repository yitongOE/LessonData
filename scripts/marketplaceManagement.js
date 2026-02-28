(() => {
  //#region ====== Variables ======

  let mpgames = [];
  let panelKeySet = new Set();
  let marketplaceController = null;

  //#endregion

  //#region ====== CSV ======

  // Loads MarketplaceElementRule.csv and extracts keys used in panel display
  async function loadMarketplaceElementRules() {
    const rows = await loadCSV("https://lessondatamanagement.blob.core.windows.net/lessondata/current/MarketplaceElementRule.csv?t=" + Date.now());

    panelKeySet.clear();

    rows.forEach(r => {
      if (r.inPanel === "true") {
        panelKeySet.add(r.key);
      }
    });
  }

  // Reads marketplace table header configuration from DOM and returns ordered keys
  function getPanelHeaderKeys() {
    const ths = document.querySelectorAll("#thead-marketplace th[data-key]");

    return Array.from(ths).map(th => th.dataset.key);
  }

  // Loads all marketplace config.csv files and converts them into structured game objects
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

  // Checks whether marketplace content.csv exists for the given game
  async function hasMarketplaceContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/content.csv`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Loads marketplace content.csv for the given game
  async function loadMarketplaceContentCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/content.csv?t=${Date.now()}`;

    try {
      return await loadCSV(url);
    } catch (e) {
      return null;
    }
  }

  // Loads selected.csv which stores round-level selection data
  async function loadMarketplaceSelectedCSV(game) {
    const url = `https://lessondatamanagement.blob.core.windows.net/lessondata/current/marketplace/${game.key}/selected.csv?t=${Date.now()}`;

    try {
      return await loadCSV(url);
    } catch {
      return null;
    }
  }

  //#endregion

  //#region ====== LessonMerge Layout ======

  // Pads a number to two digits with leading zero
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // Generates lesson code in format "level-lesson" (e.g., 1-01)
  function makeLessonCode(level, lesson) {
    return `${level}-${pad2(lesson)}`; // e.g. 1-01, 3-12
  }

  // Parses lesson code string into level and lesson numbers
  function parseLessonCode(code) {
    const [lv, ls] = (code || "").split("-");
    const level = Number(lv);
    const lesson = Number(ls);
    if (!level || !lesson) return null;
    return { level, lesson };
  }

  // Retrieves and splits stored lesson content into individual words
  function getLessonWords(level, lesson) {
    const raw = (draftData.lessonContentMap?.[level]?.[lesson] || "").trim();
    if (!raw) return [];

    return raw.split(/[|;\n,，；]+/g).map(s => s.trim()).filter(Boolean);
  }

  // Ensures roundMergedValue structure exists in draftData
  function ensureRoundMergedValue() {
    if (!draftData.roundMergedValue) draftData.roundMergedValue = {};
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

  // Generates editor field schema based on MarketplaceElementRule.csv
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
      if (r.key === "rounds") field.type = "number";
      if (r.key === "block_highlight") field.type = "checkbox";

      return field;
    });
  }

  // Renders simple round-based content editor UI
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
        const round = Number(r.round);
        const rowDiv = document.createElement("div");
        rowDiv.className = "content-row";
        const textarea = document.createElement("textarea");
        textarea.dataset.contentKey = key;
        textarea.dataset.round = r.round;
        textarea.rows = 3;
        textarea.value = csvToTextarea(r.value);

        if (readonlyMode) {
          textarea.disabled = true;
          textarea.classList.add("readonly-field");
        }

        rowDiv.appendChild(document.createElement("div")).textContent = `Round ${round}`;
        rowDiv.appendChild(textarea);
        block.appendChild(rowDiv);
      });

      container.appendChild(block);
    });
  }

  // Generates chapterMerge layout UI and updates round preview dynamically
  window.syncMarketplaceContentWithRounds = function (roundCount, readonlyMode = false) {
    const container = document.getElementById("edit-content");
    if (!container) return;

    if (!draftData.chapterMap) draftData.chapterMap = {};
    if (!draftData.savedMergedMap) draftData.savedMergedMap = {};
    if (!draftData.previewDirty) draftData.previewDirty = {};

    container.innerHTML = "";

    const chapterWrapper = document.createElement("div");
    chapterWrapper.className = "chapter-sections";

    for (let i = 1; i <= roundCount; i++) {
      if (!draftData.chapterMap[i]) {
        draftData.chapterMap[i] = [false, false, false, false, false, false];
      }

      // Create header elements
      const section = document.createElement("div");
      section.className = "round-section";
      const header = document.createElement("div");
      header.className = "round-header"
      const title = document.createElement("h4");
      title.textContent = `Round ${i}`;
      const toggleBtn = document.createElement("button");
      toggleBtn.textContent = "▾";
      toggleBtn.className = "round-toggle";

      header.appendChild(title);
      header.appendChild(toggleBtn);
      section.appendChild(header);

      // Create text box
      const previewTextarea = document.createElement("textarea");
      previewTextarea.className = "round-preview";
      previewTextarea.rows = 4;
      previewTextarea.readOnly = true;
      previewTextarea.tabIndex = 0;

      const hasSavedValue =
        draftData.savedMergedMap[i] !== undefined &&
        draftData.savedMergedMap[i] !== null;

      if (hasSavedValue && !draftData.previewDirty[i]) {
        previewTextarea.value = formatMarketplacePreview(
          draftData.savedMergedMap[i]
        );
      } else {
        previewTextarea.value = formatMarketplacePreview(
          generateRoundMergedString(i)
        );
      }

      // Create chapter checkbox
      const row = document.createElement("div");
      row.className = "chapter-checkbox-row";

      for (let c = 0; c < 6; c++) {
        const label = document.createElement("label");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = draftData.chapterMap[i][c];
        checkbox.disabled = readonlyMode;

        checkbox.onchange = () => {
          draftData.chapterMap[i][c] = checkbox.checked;
          draftData.previewDirty[i] = true;

          const merged = generateRoundMergedString(i);
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

      // Create folding
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "round-content";
      contentWrapper.appendChild(row);
      contentWrapper.appendChild(previewTextarea);

      section.appendChild(contentWrapper);

      let collapsed = true;
      toggleBtn.textContent = "▸";

      header.onclick = () => {
        collapsed = !collapsed;

        contentWrapper.classList.toggle("open");
        toggleBtn.textContent = collapsed ? "▸" : "▾";
      };
      chapterWrapper.appendChild(section);
    }

    container.appendChild(chapterWrapper);
  };

  // Generates lessonMerge layout UI with level and lesson grouping
  window.syncMarketplaceContentWithRounds_lessonMerge = function(roundCount, readonlyMode = false) {
    // if preview box is freely editable
    const isFreeEdit = !readonlyMode && editingTarget?.layout === "lessonMergeFree";
    
    const container = document.getElementById("edit-content");
    if (!container) return;
    if (!draftData.roundMap) draftData.roundMap = {};
    ensureRoundMergedValue();
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "lesson-merge-sections";

    const LEVELS = [1, 3];
    const LESSONS_PER_LEVEL = 30;
    const GROUP_SIZE = 5;

    for (let round = 1; round <= roundCount; round++) {
      if (!draftData.roundMap[round]) {
        draftData.roundMap[round] = { selectedLessons: [] };
      }

      // Create header elements
      const section = document.createElement("div");
      section.className = "round-section";
      const header = document.createElement("div");
      header.className = "round-header";
      const title = document.createElement("h4");
      title.textContent = `Round ${round}`;
      const toggleBtn = document.createElement("button");
      toggleBtn.textContent = "▸";
      toggleBtn.className = "round-toggle";

      header.appendChild(title);
      header.appendChild(toggleBtn);
      section.appendChild(header);

      const contentWrapper = document.createElement("div");
      contentWrapper.className = "round-content";

      // Create text box
      const previewTextarea = document.createElement("textarea");
      previewTextarea.rows = 4;
      previewTextarea.className = "round-preview";
      previewTextarea.spellcheck = false;

      function renderPreview() {
        const raw = draftData.roundMergedValue?.[round] || "";
        const lines = raw.split(";").map(s => s.trim()).filter(Boolean);
        previewTextarea.value = lines.join("\n");
      }

      // Double-click selection logic
      previewTextarea.ondblclick = (e) => {
        const v = previewTextarea.value;
        const caret = previewTextarea.selectionStart ?? 0;

        const lineStart = v.lastIndexOf("\n", caret - 1) + 1;
        let lineEnd = v.indexOf("\n", caret);
        if (lineEnd === -1) lineEnd = v.length;

        // Focus must be called before setSelectionRange for cross-browser consistency
        previewTextarea.focus(); 
        previewTextarea.setSelectionRange(lineStart, lineEnd);
      };

      // Keyboard deletion logic
      if (readonlyMode) {
        // View mode: fully read-only (no deletion, no typing)
        previewTextarea.readOnly = true;

        // Block all non-modifier keys to prevent deleting selected text
        previewTextarea.onkeydown = (e) => {
          // Allow copy/select-all shortcuts
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
        };

        // Extra safety: ignore any input event (some browsers can still trigger it)
        previewTextarea.oninput = null;

      } else if (!isFreeEdit) {
        // Edit mode (auto): allow only deleting whole selected lines, block other typing
        previewTextarea.onkeydown = (e) => {
          const selStart = previewTextarea.selectionStart ?? 0;
          const selEnd = previewTextarea.selectionEnd ?? 0;
          const hasSelection = selStart !== selEnd;

          // Allow modifier keys (Ctrl+C, Ctrl+A, etc.)
          if (e.ctrlKey || e.metaKey) return;

          if (e.key === "Delete" || e.key === "Backspace") {
            if (hasSelection) {
              e.preventDefault();

              const full = previewTextarea.value;
              const lines = full.split("\n");

              const startLine = full.slice(0, selStart).split("\n").length - 1;
              const endLine = full.slice(0, selEnd).split("\n").length - 1;

              const from = Math.min(startLine, endLine);
              const to = Math.max(startLine, endLine);

              lines.splice(from, to - from + 1);

              if (!draftData.roundMergedValue) draftData.roundMergedValue = {};
              draftData.roundMergedValue[round] = lines.length
                ? lines.map(w => `${w};`).join(" ")
                : "";

              renderPreview();
            } else {
              e.preventDefault();
            }
            return;
          }

          // Block all other typing
          e.preventDefault();
        };
      } else {
        // Edit mode (free): fully editable, update draft on input
        previewTextarea.oninput = () => {
          const lines = previewTextarea.value
            .split("\n")
            .map(s => s.trim())
            .filter(Boolean);

          draftData.roundMergedValue[round] = lines.length
            ? lines.map(w => `${w};`).join(" ")
            : "";
        };
      }

      renderPreview();
      
      // Two columns
      const layoutRow = document.createElement("div");
      layoutRow.className = "round-layout-row";

      const leftPanel = document.createElement("div");
      leftPanel.className = "round-left-panel";

      const rightPanel = document.createElement("div");
      rightPanel.className = "round-right-panel";

      LEVELS.forEach(level => {
        const levelBlock = document.createElement("div");
        levelBlock.className = "level-block";
        const levelHeader = document.createElement("div");
        levelHeader.className = "level-header";
        const levelTitle = document.createElement("div");
        levelTitle.textContent = `Lv ${level}`;
        levelTitle.className = "level-title";

        const levelToggle = document.createElement("span");
        levelToggle.textContent = "▸";

        levelHeader.appendChild(levelTitle);
        levelHeader.appendChild(levelToggle);
        levelBlock.appendChild(levelHeader);

        const levelContentWrapper = document.createElement("div");
        levelContentWrapper.className = "level-content";

        // Highlight this level if any its lesson is selected
        function updateLevelHighlight() {
          const selected = draftData.roundMap[round]?.selectedLessons || [];

          const hasSelection = selected.some(code => {
            const parsed = parseLessonCode(code);
            return parsed && parsed.level === level;
          });

          levelHeader.classList.toggle("has-selection", hasSelection);
        }

        levelHeader.onclick = () => {
          levelContentWrapper.classList.toggle("open");
          const isOpen = levelContentWrapper.classList.contains("open");
          levelToggle.textContent = isOpen ? "▾" : "▸";
        };

        for (let start = 1; start <= LESSONS_PER_LEVEL; start += GROUP_SIZE) {
          const end = start + GROUP_SIZE - 1;

          const groupHeader = document.createElement("div");
          groupHeader.className = "lesson-group-header";
          const groupTitle = document.createElement("div");
          groupTitle.textContent = `L${start}-${end}`;
          const groupToggle = document.createElement("span");
          groupToggle.textContent = "▸";

          groupHeader.appendChild(groupTitle);
          groupHeader.appendChild(groupToggle);

          groupHeader.onclick = () => {
            lessonRow.classList.toggle("open");
            const isOpen = lessonRow.classList.contains("open");
            groupToggle.textContent = isOpen ? "▾" : "▸";
          };

          const groupCodes = [];
          for (let l = start; l <= end; l++) groupCodes.push(makeLessonCode(level, l));

          const selectedSet = new Set(draftData.roundMap[round].selectedLessons);

          // Highlight this chapter if any its lesson is selected
          const hasGroupSelection = groupCodes.some(code => selectedSet.has(code));
          groupHeader.classList.toggle("has-selection", hasGroupSelection);

          // lesson checkbox row (hidden by default)
          const lessonRow = document.createElement("div");
          lessonRow.className = "lesson-group-row";

          for (let l = start; l <= end; l++) {
            const code = makeLessonCode(level, l);

            const label = document.createElement("label");

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.disabled = readonlyMode;
            cb.checked = selectedSet.has(code);

            cb.onchange = () => {
              const set = new Set(draftData.roundMap[round].selectedLessons);

              if (cb.checked) {
                set.add(code);
                const parsed = parseLessonCode(code);
                const words = parsed ? getLessonWords(parsed.level, parsed.lesson) : [];
                const cur = draftData.roundMergedValue[round] ? draftData.roundMergedValue[round].split(";").map(s => s.trim()).filter(Boolean)  : [];
                const merged = cur.concat(words);
                draftData.roundMergedValue[round] = merged.length ? merged.map(w => `${w};`).join(" ")  : "";
              } else {
                set.delete(code);

                const parsed = parseLessonCode(code);
                const removeWords = parsed
                  ? getLessonWords(parsed.level, parsed.lesson)
                  : [];

                const cur = draftData.roundMergedValue[round]
                  ? draftData.roundMergedValue[round]
                      .split(";")
                      .map(s => s.trim())
                      .filter(Boolean)
                  : [];

                const filtered = cur.filter(w => !removeWords.includes(w));

                draftData.roundMergedValue[round] =
                  filtered.length
                    ? filtered.map(w => `${w};`).join(" ")
                    : "";
              }

              draftData.roundMap[round].selectedLessons =
                Array.from(set).sort((a, b) => a.localeCompare(b));

              renderPreview();

              const hasGroup = groupCodes.some(c => set.has(c));
              groupHeader.classList.toggle("has-selection", hasGroup);
              updateLevelHighlight();
            };

            label.appendChild(cb);
            label.appendChild(document.createTextNode(`L${l}`));
            lessonRow.appendChild(label);
          }

          levelContentWrapper.appendChild(groupHeader);
          levelContentWrapper.appendChild(lessonRow);
        }
        
        levelBlock.appendChild(levelContentWrapper);
        leftPanel.appendChild(levelBlock);
        updateLevelHighlight();
      });

      rightPanel.appendChild(previewTextarea);
      layoutRow.appendChild(leftPanel);
      layoutRow.appendChild(rightPanel);
      contentWrapper.appendChild(layoutRow);
      section.appendChild(contentWrapper);

      header.onclick = () => {
        contentWrapper.classList.toggle("open");
        const isOpen = contentWrapper.classList.contains("open");
        toggleBtn.textContent = isOpen ? "▾" : "▸";
      };

      wrapper.appendChild(section);
    }

    container.appendChild(wrapper);
  };

  // Combine all word strings to output - Chapter Merge Layout
  function generateRoundMergedString(round) {
    if (!draftData.chapterMap || !draftData.contentMap) return "";

    const selectedChapters = draftData.chapterMap[round] || [];
    let merged = [];

    selectedChapters.forEach((checked, index) => {
      if (checked) {
        const chapter = index + 1;
        const content = draftData.contentMap[chapter];
        if (content) merged.push(content);
      }
    });

    return merged.length
      ? merged.flatMap(chunk => chunk.split(/[|;\n,，；]+/g).map(s => s.trim()).filter(Boolean)).map(w => `${w};`).join(" ")
      : "";
  }

  // Serializes chapterMerge selection data into selected.csv format
  function collectSelectedCSV() {
    if (!draftData.chapterMap) return "round,selected,value\n";

    const rows = [];

    for (let round = 1; round <= draftData.rounds; round++) {
      const arr = draftData.chapterMap[round] || [false, false, false, false, false, false];
      const selected = arr
        .map((checked, index) => checked ? index + 1 : null)
        .filter(Boolean)
        .join("|");

      const merged = generateRoundMergedString(round);
      rows.push(`${round},${selected},"${merged}"`);
    }

    return "round,selected,value\n" + rows.join("\n");
  }

  // Serializes lessonMerge selection data into selected.csv format
  function collectSelectedCSV_lessonMerge() {
    if (!draftData.roundMap) return "round,selected,value\n";

    const rows = [];
    const rounds = Object.keys(draftData.roundMap)
      .map(n => Number(n))
      .sort((a, b) => a - b);

    rounds.forEach(round => {
      const selected = (draftData.roundMap[round]?.selectedLessons || []).join("|");
      ensureRoundMergedValue();
      const merged = draftData.roundMergedValue?.[round] || "";
      rows.push(`${round},${selected},"${merged}"`);
    });

    return "round,selected,value\n" + rows.join("\n");
  }

  async function prepareMarketplaceDraftData(game) {
    draftData.rounds = game.rounds;

    // Load selected.csv
    let selectedRows = await loadMarketplaceSelectedCSV(game);

    if (selectedRows) {
      draftData.savedMergedMap = {};

      if (game.layout?.startsWith("lessonMerge")) {
        draftData.roundMap = {};
        draftData.roundMergedValue = {};

        selectedRows.forEach(r => {
          const round = Number(r.round);
          const selected = (r.selected || "")
            .split("|")
            .map(s => s.trim())
            .filter(Boolean);

          draftData.roundMap[round] = { selectedLessons: selected };

          let raw = r.value || "";
          if (raw.startsWith('"') && raw.endsWith('"')) {
            raw = raw.slice(1, -1);
          }

          draftData.roundMergedValue[round] = raw;
        });
      } else {
        draftData.chapterMap = {};

        selectedRows.forEach(r => {
          const round = Number(r.round);
          const selectedArr = (r.selected || "")
            .split("|")
            .map(n => Number(n));

          draftData.chapterMap[round] = [false, false, false, false, false, false];

          selectedArr.forEach(ch => {
            if (ch >= 1 && ch <= 6) {
              draftData.chapterMap[round][ch - 1] = true;
            }
          });

          draftData.savedMergedMap[round] = r.value || "";
        });
      }
    }

    // Load content.csv
    let contentRows = await loadMarketplaceContentCSV(game);

    if (contentRows) {
      if (game.layout?.startsWith("lessonMerge")) {
        draftData.lessonContentMap = {};

        contentRows.forEach(r => {
          const level = Number(r.level);
          const lesson = Number(r.lesson);

          if (!draftData.lessonContentMap[level]) {
            draftData.lessonContentMap[level] = {};
          }

          draftData.lessonContentMap[level][lesson] = r.value || "";
        });
      } else {
        draftData.contentMap = {};

        contentRows.forEach(r => {
          draftData.contentMap[Number(r.chapter)] = r.value || "";
        });
      }
    }
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

          // Open modal first
          openEditModal({
            title: `Edit ${game.title}`,
            data: game,
            fields,
            onSave: async (updatedGame) => {
              try {
                const finalGame = {
                  ...game,
                  ...updatedGame
                };

                const selectedCSV =
                  finalGame.layout?.startsWith("lessonMerge")
                    ? collectSelectedCSV_lessonMerge()
                    : collectSelectedCSV();

                await saveMarketplaceToServer(finalGame, selectedCSV);

                await marketplaceController.reloadAndRedraw(async () => {
                  mpgames = await loadMarketplaceFromCSV();
                  return mpgames;
                });

                showFooterMessage("✓ Saved to CSV");

              } catch (e) {
                alert("Save failed. Check server.");
              }
            }
          });

          // Unified initialization (replaces 150 lines of duplicated logic)
          await prepareMarketplaceDraftData(game);

          // Render layout after draftData is ready
          if (game.layout?.startsWith("lessonMerge")) {
            syncMarketplaceContentWithRounds_lessonMerge(draftData.rounds);
          } else {
            syncMarketplaceContentWithRounds(draftData.rounds);
          }
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
            const ok = await restoreCSV(`marketplace/${game.key}`);
            if (ok) {
              await marketplaceController.reloadAndRedraw(async () => {
                mpgames = await loadMarketplaceFromCSV();
                return mpgames;
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
    row.querySelector(".view").onclick = async () => {
      const fields = await getEditorFieldsFromRules(game);

      openEditModal({
        title: `View ${game.title}`,
        data: game,
        fields,
        readonlyMode: true
      });

      await prepareMarketplaceDraftData(game);

      if (game.layout?.startsWith("lessonMerge")) {
        syncMarketplaceContentWithRounds_lessonMerge(draftData.rounds, true);
      } else {
        syncMarketplaceContentWithRounds(draftData.rounds, true);
      }
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
    if (panel !== PANEL.MARKETPLACE) return;

    async function initMarketplacePage() {
      marketplaceController = createPanelController({
        panelName: "marketplace",
        loadRules: async () => {
          await loadMarketplaceElementRules();
        },
        loadData: async () => {
          mpgames = await loadMarketplaceFromCSV();
          return mpgames;
        },
        drawRow: (game, index) => renderMarketplaceRow(game, index),
        bindRowUI: (tr, game) => bindMarketplaceInteractiveUI(tr, game),
        onAfterDraw: () => {
        }
      });

      await marketplaceController.init({marketplaceCount: mpgames.length});
    }

    initMarketplacePage();
  })();

})();