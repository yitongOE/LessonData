(() => {
  // ====== Variables ======

  const ADMIN_ROLES = ["Admin", "QA", "Guest"];

  let admins = [];

  let currentPage = 1;
  let rowsPerPage = 10;
  let pendingAction = null;

  // ===== CSV Loader =====

  async function loadAdminsFromCSV() {
    const res = await fetch("csv/AdminData.csv");
    const text = await res.text();

    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(line => line.trim() !== "");

    const headers = lines[0].split(",").map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const raw = {};

      headers.forEach((h, i) => {
        raw[h] = values[i];
      });

      return {
        id: Number(raw.id),
        username: raw.username,
        firstname: raw.firstname,
        lastname: raw.lastname,
        email: raw.email,
        role: raw.role || "Admin",
        active: raw.active === "true"
      };
    });
  }


  // ====== Header ======

  function updateAdminCount() {
    const countEl = document.getElementById("item-count");
    countEl.textContent = `(${admins.length})`;
  }

  // ====== Row Render ======

  function renderRoleSelect(admin) {
    return `
      <select class="role-select">
        ${ADMIN_ROLES.map(role => `
          <option value="${role}" ${role === admin.role ? "selected" : ""}>
            ${role}
          </option>
        `).join("")}
      </select>
    `;
  }

  function renderAdminRow(admin, index) {
    return `
      <td>${index + 1}</td>

      <!-- Actions -->
      <td>
        <div class="actions">
          <button class="action-btn edit" title="Edit">✏️</button>
          <button class="action-btn delete" title="Delete">🗑️</button>
        </div>
      </td>

      <td>${admin.username}</td>
      <td>${admin.firstname}</td>
      <td>${admin.lastname}</td>
      <td>${admin.email}</td>

      <!-- Role -->
      <td>
        ${renderRoleSelect(admin)}
      </td>

      <!-- Active -->
      <td class="col-center">
        <label class="switch-yn">
          <input type="checkbox" ${admin.active ? "checked" : ""}>
          <span class="switch-track">
            <span class="switch-label yes">YES</span>
            <span class="switch-label no">NO</span>
            <span class="switch-thumb"></span>
          </span>
        </label>
      </td>
    `;
  }

  // ====== Bind Actions ======

  function bindAdminActions(row, admin) {
    // Edit
    row.querySelector(".edit").onclick = () => {
      openActionModal({
        title: "Modify Admin",
        desc: "You are about to modify this admin account. This change will take effect immediately.",
        onConfirm: () => {
          console.log("Edit admin:", admin.id);
        }
      });
    };

    // Delete
    row.querySelector(".delete").onclick = () => {
      openActionModal({
        title: "Delete Admin",
        desc: "This action cannot be undone. The deletion takes effect immediately.",
        onConfirm: () => {
          console.log("Delete admin:", admin.id);
        }
      });
    };

    // Active switch
    const toggle = row.querySelector(".switch-yn input");
    toggle.onchange = () => {
      admin.active = toggle.checked;
      console.log("Admin active changed:", admin.id, admin.active);
    };

    // Role select
    const roleSelect = row.querySelector(".role-select");
    roleSelect.onchange = () => {
      admin.role = roleSelect.value;
      console.log("Admin role updated:", admin.id, admin.role);
    };
  }

  // ====== Footer / Pagination ======

  function updateRowRange() {
    const total = admins.length;
    const start = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, total);

    document.getElementById("row-range").textContent =
      `${start}–${end} of ${total}`;
  }

  function updateFooterButtons() {
    const totalPages = Math.ceil(admins.length / rowsPerPage);

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
    const totalPages = Math.ceil(admins.length / rowsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      draw();
    }
  };

  document.getElementById("last-page").onclick = () => {
    currentPage = Math.ceil(admins.length / rowsPerPage);
    draw();
  };

  // ====== Draw ======

  function draw() {
    const tbody = document.getElementById("item-tbody");
    tbody.innerHTML = "";

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageItems = admins.slice(start, end);

    pageItems.forEach((admin, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = renderAdminRow(admin, start + index);
      bindAdminActions(tr, admin);
      tbody.appendChild(tr);
    });

    updateAdminCount();
    updateRowRange();
    updateFooterButtons();
  }

  // ====== Modal ======

  function openActionModal({ title, desc, onConfirm }) {
    const modal = document.getElementById("action-modal");
    const passwordInput = document.getElementById("modal-password");
    const awareCheckbox = document.getElementById("modal-aware");
    const confirmBtn = document.getElementById("modal-confirm");
    const errorEl = document.getElementById("modal-password-error");

    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-desc").textContent = desc;

    passwordInput.value = "";
    awareCheckbox.checked = false;
    confirmBtn.disabled = true;
    errorEl.classList.add("hidden");

    modal.classList.remove("hidden");

    const updateConfirmState = () => {
      confirmBtn.disabled = !(
        passwordInput.value.length > 0 && awareCheckbox.checked
      );
      errorEl.classList.add("hidden");
    };

    passwordInput.oninput = updateConfirmState;
    awareCheckbox.onchange = updateConfirmState;

    pendingAction = onConfirm;
  }

  document.getElementById("modal-cancel").onclick = () => {
    document.getElementById("action-modal").classList.add("hidden");
  };

  document.getElementById("modal-confirm").onclick = () => {
    const passwordInput = document.getElementById("modal-password");
    const errorEl = document.getElementById("modal-password-error");

    if (passwordInput.value !== ADMIN_PASSWORD) {
      errorEl.classList.remove("hidden");
      return;
    }

    document.getElementById("action-modal").classList.add("hidden");
    if (pendingAction) pendingAction();
  };

  // ====== Init ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.ADMINS) return;

    async function initAdminsPage() {
      admins = await loadAdminsFromCSV();
      setupIndexUI({ adminsCount: admins.length });
      draw();
    }

    initAdminsPage();
  })();
})();

