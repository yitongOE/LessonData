// ====== Panel Constants ======
const PANEL = {
  GAMES: "games",
  ADMINS: "admins"
};
const ADMIN_PASSWORD = "admin123";

let currentPanel = null;

// ====== Panel Utils ======
function getPanel() {
  return new URLSearchParams(location.search).get("panel") || PANEL.GAMES;
}

// ====== Header & Layout ======
function setupIndexUI({ gamesCount = 0, adminsCount = 0 }) {
  const panel = getPanel();

  const toggleBtn = document.getElementById("panel-toggle-btn");
  const titleText = document.getElementById("header-title-text");
  const itemCount = document.getElementById("item-count");
  const theadGames = document.getElementById("thead-games");
  const theadAdmins = document.getElementById("thead-admins");

  if (panel === PANEL.GAMES) {
    // Header
    document.title = "Our English - Games Management";
    titleText.textContent = "Games";
    itemCount.textContent = `(${gamesCount})`;

    // Toggle button
    toggleBtn.textContent = "Admins Management";
    toggleBtn.onclick = () => {
      location.href = "index.html?panel=admins";
    };

    // Table head
    theadGames.classList.remove("hidden");
    theadAdmins.classList.add("hidden");
  } else {
    // Header
    document.title = "Our English - Admins Management";
    titleText.textContent = "Admins";
    itemCount.textContent = `(${adminsCount})`;

    // Toggle button
    toggleBtn.textContent = "Games Management";
    toggleBtn.onclick = () => {
      location.href = "index.html?panel=games";
    };

    // Table head
    theadGames.classList.add("hidden");
    theadAdmins.classList.remove("hidden");
  }

  return panel;
}
