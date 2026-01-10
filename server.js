import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

/* =====================
   PATH SETUP
===================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ECARDS_FILE = path.join(DATA_DIR, "ecards.json");
const TEMPLATE_DIR = path.join(__dirname, "templates", "master-ecard");

/* =====================
   ENSURE DATA FILES
===================== */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
if (!fs.existsSync(ECARDS_FILE)) fs.writeFileSync(ECARDS_FILE, "[]");

/* =====================
   HELPERS
===================== */
const readJSON = (file) =>
  JSON.parse(fs.readFileSync(file, "utf-8"));

const writeJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

/* =====================
   AUTH ROUTES
===================== */

// SIGNUP
app.post("/api/auth/signup", (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const users = readJSON(USERS_FILE);

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ message: "User already exists" });
  }

  const newUser = {
    id: Date.now().toString(),
    email,
    password, // demo only
    name,
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);

  res.json({ id: newUser.id, email, name });
});

// LOGIN
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  const users = readJSON(USERS_FILE);
  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({ id: user.id, email: user.email, name: user.name });
});

/* =====================
   ECARD API ROUTES
===================== */

// CREATE / UPDATE
app.post("/api/ecards", (req, res) => {
  const ecards = readJSON(ECARDS_FILE);
  const incoming = req.body;

  if (!incoming.id) {
    incoming.id = Date.now().toString();
    incoming.createdAt = new Date().toISOString();
    ecards.push(incoming);
  } else {
    const index = ecards.findIndex((e) => e.id === incoming.id);
    if (index !== -1) ecards[index] = { ...ecards[index], ...incoming };
    else ecards.push(incoming);
  }

  writeJSON(ECARDS_FILE, ecards);
  res.json(incoming);
});

// GET ALL
app.get("/api/ecards", (req, res) => {
  res.json(readJSON(ECARDS_FILE));
});

// GET SINGLE (JSON)
app.get("/api/ecards/:id", (req, res) => {
  const ecards = readJSON(ECARDS_FILE);
  const card = ecards.find((e) => e.id === req.params.id);

  if (!card) return res.status(404).json({ message: "Not found" });
  res.json(card);
});

// DELETE
app.delete("/api/ecards/:id", (req, res) => {
  const ecards = readJSON(ECARDS_FILE).filter(
    (e) => e.id !== req.params.id
  );
  writeJSON(ECARDS_FILE, ecards);
  res.json({ success: true });
});

/* =====================
   VIEW ECARD (HTML UI)
===================== */
app.get("/ecards/:id", (req, res) => {
  const ecards = readJSON(ECARDS_FILE);
  const card = ecards.find((e) => e.id === req.params.id);

  if (!card) return res.status(404).send("E-card not found");

  const htmlPath = path.join(TEMPLATE_DIR, "index.html");
  if (!fs.existsSync(htmlPath)) {
    return res.status(500).send("Template not found");
  }

  let html = fs.readFileSync(htmlPath, "utf-8");

  // Simple data injection (NO UI CHANGE)
  html = html.replace(/{{FULLNAME}}/g, card.fullName || "");
  html = html.replace(/{{DESIGNATION}}/g, card.designation || "");
  html = html.replace(/{{COMPANY}}/g, card.company || "");
  html = html.replace(/{{TAGLINE}}/g, card.tagline || "");

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

/* =====================
   EXPORT ECARD AS ZIP
===================== */
app.get("/api/ecards/:id/export", (req, res) => {
  const ecards = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "ecards.json"), "utf-8")
  );

  const card = ecards.find(e => e.id === req.params.id);
  if (!card) return res.status(404).send("Ecard not found");

  const templateDir = path.join(__dirname, "templates", "master-ecard");
  const indexPath = path.join(templateDir, "index.html");

  let html = fs.readFileSync(indexPath, "utf-8");

  // 🔥 THIS WAS NEVER HAPPENING BEFORE
  html = html.replace(
    "__CARD_DATA__",
    JSON.stringify(card)
  );

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${(card.fullName || "ecard")
      .replace(/\s+/g, "-")
      .toLowerCase()}.zip`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  // add modified index.html
  archive.append(html, { name: "index.html" });

  // add rest of template files
  archive.directory(templateDir, false, entry => {
    if (entry.name === "index.html") return false;
    return entry;
  });

  archive.finalize();
});


/* =====================
   START SERVER
===================== */
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
