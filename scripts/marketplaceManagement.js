(() => {
  //#region ====== Variables ======

  let mpgames = [];
  let panelKeys = [];
  let panelKeySet = new Set();
  let currentContentKeys = [];
  let marketplaceController = null;

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

  //#region ====== LessonMerge Layout ======

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function makeLessonCode(level, lesson) {
    return `${level}-${pad2(lesson)}`; // e.g. 1-01, 3-12
  }

  function parseLessonCode(code) {
    const [lv, ls] = (code || "").split("-");
    const level = Number(lv);
    const lesson = Number(ls);
    if (!level || !lesson) return null;
    return { level, lesson };
  }

  function getLessonWords(level, lesson) {
    const raw = (draftData.lessonContentMap?.[level]?.[lesson] || "").trim();
    if (!raw) return [];

    return raw
      .split(/[|;\n,，；]+/g)
      .map(s => s.trim())
      .filter(Boolean);
  }

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

  window.syncMarketplaceContentWithRounds_lessonMerge = function(roundCount, readonlyMode = false) {
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
      previewTextarea.readOnly = true;

      function renderPreview() {
        const raw = draftData.roundMergedValue?.[round] || "";
        previewTextarea.value = raw ? raw.split("|").join("\n") : "";
      }

      previewTextarea.ondblclick = () => {
        const v = previewTextarea.value;
        const caret = previewTextarea.selectionStart ?? 0;

        const lineStart = v.lastIndexOf("\n", caret - 1) + 1;
        let lineEnd = v.indexOf("\n", caret);
        if (lineEnd === -1) lineEnd = v.length;

        previewTextarea.setSelectionRange(lineStart, lineEnd);
      };

      previewTextarea.onkeydown = (e) => {
        if (e.key !== "Delete" && e.key !== "Backspace") return;

        const selStart = previewTextarea.selectionStart ?? 0;
        const selEnd = previewTextarea.selectionEnd ?? 0;
        if (selStart === selEnd) return;

        e.preventDefault();

        const full = previewTextarea.value;
        const lines = full.split("\n");

        const startLine = full.slice(0, selStart).split("\n").length - 1;
        const endLine = full.slice(0, selEnd).split("\n").length - 1;

        const from = Math.min(startLine, endLine);
        const to = Math.max(startLine, endLine);

        lines.splice(from, to - from + 1);

        draftData.roundMergedValue[round] = lines.join("|");
        renderPreview();
      };

      renderPreview();

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

                const cur = draftData.roundMergedValue[round]
                  ? draftData.roundMergedValue[round].split("|").filter(Boolean)
                  : [];

                draftData.roundMergedValue[round] = cur.concat(words).join("|");
              } else {
                set.delete(code);

                draftData.roundMergedValue[round] = generateRoundMergedString_lessonMerge(round);
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
        contentWrapper.appendChild(levelBlock);
        updateLevelHighlight();
      });

      contentWrapper.appendChild(previewTextarea);
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

    return merged.join("|");
  }

  // Combine all word strings to output - Lesson Merge Layout
  function generateRoundMergedString_lessonMerge(round) {
    if (!draftData.roundMap || !draftData.lessonContentMap) return "";

    const selected = draftData.roundMap[round]?.selectedLessons || [];
    const merged = [];

    selected.forEach(code => {
      const parsed = parseLessonCode(code);
      if (!parsed) return;

      const { level, lesson } = parsed;
      const content = draftData.lessonContentMap[level]?.[lesson];
      if (content) merged.push(content);
    });

    return merged.join("|");
  }

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
                const finalGame = {
                  ...game,
                  ...updatedGame
                };
                
                const selectedCSV =
                  finalGame.layout === "lessonMerge"
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

          draftData.rounds = game.rounds;

          let selectedRows = await loadMarketplaceSelectedCSV(game);

          if (selectedRows) {
            draftData.savedMergedMap = {};

            // lessonMerge: selected.csv uses lesson codes like 1-01|3-02
            if (game.layout === "lessonMerge") {
              draftData.roundMap = {};
              ensureRoundMergedValue();
              draftData.roundMergedValue = {};

              selectedRows.forEach(r => {
                const round = Number(r.round);

                const selected = (r.selected || "")
                  .split("|")
                  .map(s => s.trim())
                  .filter(Boolean);

                draftData.roundMap[round] = { selectedLessons: selected };

                let raw = r.value || "";
                if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
                draftData.roundMergedValue[round] = raw;
              });
            } 
            // chapterMerge: keep old behavior
            else {
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

                draftData.roundMap[round] = {
                  selectedLessons: selected
                };

                let raw = r.value || "";
                if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
                draftData.savedMergedMap[round] = raw;
              });
            }
          }

          let contentRows = await loadMarketplaceContentCSV(game);

          if (contentRows) {
            // lessonMerge: content.csv headers are level,lesson,value
            if (game.layout === "lessonMerge") {
              draftData.lessonContentMap = {};

              contentRows.forEach(r => {
                const level = Number(r.level);
                const lesson = Number(r.lesson);
                if (!level || !lesson) return;

                if (!draftData.lessonContentMap[level]) draftData.lessonContentMap[level] = {};
                draftData.lessonContentMap[level][lesson] = r.value || "";
              });
            } 
            // chapterMerge: keep old behavior (content.csv headers are chapter,value)
            else {
              draftData.contentMap = {};

              contentRows.forEach(r => {
                const chapter = Number(r.chapter);
                draftData.contentMap[chapter] = r.value || "";
              });
            }
          }

          if (game.layout === "lessonMerge") {
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
            await restoreCSV(`marketplace/${game.key}`);
            await marketplaceController.reloadAndRedraw(async () => {
              mpgames = await loadMarketplaceFromCSV();
              return mpgames;
            });
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
      
      if (game.layout === "lessonMerge") {
        syncMarketplaceContentWithRounds_lessonMerge(game.rounds, true);
      } else {
        syncMarketplaceContentWithRounds(game.rounds, true);
      }
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