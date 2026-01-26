// Draw lesson bar
function renderLessons() {
  const tbody = document.getElementById("lesson-tbody");
  tbody.innerHTML = "";

  lessons.forEach((lesson, index) => {
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

// ====== Execution ======
renderLessons();