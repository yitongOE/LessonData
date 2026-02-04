// ====== Variables ======
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ====== Logics ======

// Send json
app.use(express.json());
app.use(cors());

// Save Game CSV 
app.post("/api/save-games", (req, res) => {
  try {
    const csvText = req.body.csv;
    if (!csvText) {
      return res.status(400).json({ error: "Missing csv data" });
    }

    const filePath = path.join(__dirname, "csv", "GameData.csv");

    fs.writeFileSync(filePath, csvText, "utf8");

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to write GameData.csv" });
  }
});

// Save Admin CSV
app.post("/api/save-admins", (req, res) => {
  try {
    const csvText = req.body.csv;
    if (!csvText) {
      return res.status(400).json({ error: "Missing csv data" });
    }

    const filePath = path.join(__dirname, "csv", "AdminData.csv");

    fs.writeFileSync(filePath, csvText, "utf8");

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to write AdminData.csv" });
  }
});

app.listen(PORT, () => {
  console.log(`CSV admin server running at http://localhost:${PORT}`);
});