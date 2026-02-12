(() => {
  //#region ====== Variables ======

  const ADMIN_ROLES = ["Admin", "QA", "Guest"];

  let admins = [];
  let footer = null;

  //#endregion

  //#region ====== CSV ======

  async function loadAdminsFromCSV() {
    const url = "https://lessondatamanagement.blob.core.windows.net/lessondata/current/AdminData.csv" + "?t=" + Date.now();
    
    const res = await fetch(url, { cache: "no-store" });
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

  //#endregion

  //#region ====== Header ======

  function updateAdminCount() {
    const countEl = document.getElementById("item-count");
    countEl.textContent = `(${admins.length})`;
  }

  //#endregion

  //#region ====== Table ======

  // Create drop-down list for Role
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

  // Create row for each admin account
  function renderAdminRow(admin, index) {
    return `
      <td>${index + 1}</td>

      <!-- Actions -->
      <td>
        <div class="actions">
          <button class="action-btn edit" title="Edit">✏️</button>
          <button class="action-btn restore" title="Restore">🔄</button>
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

  // Bind actions with interactctive UI components
  function bindInteractiveUI(row, admin) {
    // "Edit" Button
    row.querySelector(".edit").onclick = () => {
      openActionModal({
        title: "Modify Admin",
        desc: "You are about to modify this admin account. This change will take effect immediately.",
        onConfirm: () => {
          openEditModal({
            title: `Edit Admin`,
            data: admin,
            fields: [
              { key: "username", label: "Username" },
              { key: "firstname", label: "First Name" },
              { key: "lastname", label: "Last Name" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role", type: "select", options: ["Admin", "QA", "Guest"] },
              { key: "active", label: "Active", type: "checkbox" }
            ],
            onSave: async () => {
              try {
                await saveAdminsToServer(admins);
                drawAdmins();
                showFooterMessage?.("✓ Saved to CSV");
              } catch (e) {
                alert("Save failed. Check server.");
              }
            }
          });
        }
      });
    };

    // "Restore" Button
    row.querySelector(".restore").onclick = () => {
      openActionModal({
        title: "Restore Latest Safe Version",
        desc: "This will restore ALL the admin accounts to the most recent safe version. ALL changes since last safe version will be lost. This action takes effect immediately.",
        onConfirm: async () => {
          try {
            await restoreCSV("AdminData");
          } catch (e) {
            alert("Restore failed. Check server.");
          }
        }
      });
    };

    // "Delete" Button
    row.querySelector(".delete").onclick = () => {
      openActionModal({
        title: "Delete Admin",
        desc: "This action cannot be undone. The deletion takes effect immediately.",
        onConfirm: () => {
          console.log("Delete admin:", admin.id);
          //TODO
        }
      });
    };

    // "Active" Switch
    const toggle = row.querySelector(".switch-yn input");
    toggle.onchange = () => {
      admin.active = toggle.checked;
      console.log("Admin active changed:", admin.id, admin.active);
    };

    // "Role" Drop-down List
    const roleSelect = row.querySelector(".role-select");
    roleSelect.onchange = () => {
      admin.role = roleSelect.value;
      console.log("Admin role updated:", admin.id, admin.role);
    };
  }

  // Draw
  function drawAdmins() {
    const tbody = document.getElementById("item-tbody");
    tbody.innerHTML = "";

    const [start, end] = footer.getPageSlice();
    const pageItems = admins.slice(start, end);

    pageItems.forEach((admin, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = renderAdminRow(admin, start + index);
      bindInteractiveUI(tr, admin);
      tbody.appendChild(tr);
    });

    updateAdminCount();
  }

  //#endregion

  // ====== Init ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.ADMINS) return;

    async function initAdminsPage() {
      admins = await loadAdminsFromCSV();
      setupIndexUI({ adminsCount: admins.length });

      footer = createFooterController({
        onPageChange: drawAdmins
      });

      footer.setTotalItems(admins.length);
    }

    initAdminsPage();
  })();
})();

