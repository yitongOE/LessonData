// ====== Variables ======

let currentPage = 1;
let rowsPerPage = 10;

// ====== Head Logics ======

// Update lesson count in Head
function updateLessonCount() {
  const countEl = document.getElementById("lesson-count");
  countEl.textContent = `(${lessons.length})`;
}

// ====== Table Logics ======

// Draw lesson bar
function renderLessons() {
  const tbody = document.getElementById("lesson-tbody");
  tbody.innerHTML = "";

  // Find lessons in current page
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageItems = lessons.slice(start, end);

  // Create lesson bar
  pageItems.forEach((lesson, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>

      <td>
        <div class="actions">
          <button class="action-btn edit" title="Edit">✏️</button>
          <button class="action-btn copy" title="Duplicate">📄</button>
          <button class="action-btn delete" title="Delete">🗑️</button>
        </div>
      </td>

      <td>${lesson.number}</td>
      <td>${lesson.title}</td>
      <td>${lesson.author}</td>
      <td>${lesson.activities}</td>
      <td>${lesson.updatedAt}</td>
      <td>${lesson.updatedBy}</td>
    `;

    bindActions(tr, lesson);
    tbody.appendChild(tr);
  });

  // Update lesson count
  updateLessonCount();
  updateRowRange();
  updateFooterButtons();
}

// Bind button actions
function bindActions(row, lesson) {
  row.querySelector(".edit").onclick = () => {
    console.log("Edit", lesson.id);
  };

  row.querySelector(".copy").onclick = () => {
    console.log("Duplicate", lesson.id);
  };

  row.querySelector(".delete").onclick = () => {
    if (confirm("Delete this lesson?")) {
      console.log("Delete", lesson.id);
    }
  };
}

// ====== Footer Logics ======

function updateRowRange() {
  const total = lessons.length;
  const start = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const end = Math.min(currentPage * rowsPerPage, total);

  document.getElementById("row-range").textContent =
    `${start}–${end} of ${total}`;
}


// ====== Execution ======

renderLessons();