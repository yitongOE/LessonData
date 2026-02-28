(() => {
  //#region ====== Variables ======

  const ADMIN_ROLES = ["Admin", "Editor", "QA"];

  let admins = [];
  let adminsController = null;

  //#endregion

  //#region ====== CSV ======

  // Loads AdminData.csv from Azure Blob Storage and parses it into structured admin objects
  async function loadAdminsFromCSV() {
    const url = "https://lessondatamanagement.blob.core.windows.net/lessondata/current/AdminData.csv" + "?t=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(line => line.trim() !== "");
    const headers = lines[0].split(",").map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const raw = {};

      headers.forEach((h, i) => {
        raw[h] = values[i];
      });

      return {
        id: Number(raw.id),
        username: raw.email ? raw.email.split("@")[0] : "",
        firstname: raw.firstname,
        lastname: raw.lastname,
        email: raw.email,
        role: raw.role || "Admin",
        active: raw.active === "true"
      };
    });
  }

  //#endregion

  //#region ====== Table ======

  // Create drop-down list for Role
  function renderRoleSelect(admin) {
    return `
      <select class="role-select" disabled>
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
          <input type="checkbox" ${admin.active ? "checked" : ""} disabled>
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
              { key: "firstname", label: "First Name" },
              { key: "lastname", label: "Last Name" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role", type: "select", options: ["Admin", "Editor", "QA"] },
              { key: "active", label: "Active", type: "checkbox" }
            ],
            onSave: async () => {
              try {
                await saveAdminsToServer(admins);
                await adminsController.reloadAndRedraw(async () => {
                  admins = await loadAdminsFromCSV();
                  return admins;
                });
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
            const ok = await restoreCSV("AdminData");
            if (ok) {
              await adminsController.reloadAndRedraw(async () => {
                admins = await loadAdminsFromCSV();
                return admins;
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
    //     title: "Delete Admin",
    //     desc: "This action cannot be undone. The deletion takes effect immediately.",
    //     onConfirm: () => {
    //       console.log("Delete admin:", admin.id);
    //       //TODO
    //     }
    //   });
    // };

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

  //#endregion

  // ====== Init ======

  (() => {
    const panel = getPanel();

    if (panel !== PANEL.ADMINS) return;

    async function initAdminsPage() {
      adminsController = createPanelController({
        panelName: "admins",
        loadRules: null,
        loadData: async () => {
          admins = await loadAdminsFromCSV();
          return admins;
        },
        drawRow: (admin, index) => renderAdminRow(admin, index),
        bindRowUI: (tr, admin) => bindInteractiveUI(tr, admin),
        onAfterDraw: null
      });

      await adminsController.init({adminsCount: admins.length});
    }

    initAdminsPage();
  })();
})();

