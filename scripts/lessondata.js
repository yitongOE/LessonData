// ====== Variables ======

let currentPage = 1;
let rowsPerPage = 10;

// ====== Head Logics ======

// Update game count in Head
function updateGameCount() {
  const countEl = document.getElementById("game-count");
  countEl.textContent = `(${games.length})`;
}

// ====== Table Logics ======

// Bind button actions
function bindActions(row, game) {
  // Edit
  row.querySelector(".edit").onclick = () => {
    console.log("Edit", game.id);
  };

  // Duplicate
  row.querySelector(".copy").onclick = () => {
    console.log("Duplicate", game.id);
  };

  // Delete
  row.querySelector(".delete").onclick = () => {
    if (confirm("Delete this lesson?")) {
      console.log("Delete", game.id);
    }
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

// ====== Footer Logics ======

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

// ====== Draw ======

function draw() {
  const tbody = document.getElementById("game-tbody");
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
          <button class="action-btn copy" title="Duplicate">📄</button>
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

// ====== Execution ======

draw();