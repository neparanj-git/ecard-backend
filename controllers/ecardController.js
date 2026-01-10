import fs from "fs";
import path from "path";
import archiver from "archiver";

/* =====================
   CONSTANTS
===================== */

const DATA_DIR = path.join(process.cwd(), "data");
const TEMPLATE_DIR = path.join(process.cwd(), "templates", "master-ecard");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const safe = (v) => (v === undefined || v === null ? "" : String(v));

const makeSlug = (name = "") =>
  name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");

const fileForAdmin = (adminId) =>
  path.join(DATA_DIR, `ecards_admin_${adminId}.json`);

const readCards = (adminId) => {
  if (!fs.existsSync(fileForAdmin(adminId))) {
    fs.writeFileSync(fileForAdmin(adminId), "[]");
  }
  return JSON.parse(fs.readFileSync(fileForAdmin(adminId), "utf-8"));
};

const writeCards = (adminId, data) =>
  fs.writeFileSync(fileForAdmin(adminId), JSON.stringify(data, null, 2));

/* =====================
   CREATE / UPDATE
===================== */

export const createOrUpdateEcard = (req, res) => {
  const { adminId, ...card } = req.body;
  if (!adminId) return res.status(400).json({ message: "adminId required" });

  const cards = readCards(adminId);

  card.services = Array.isArray(card.services) ? card.services : [];
  card.testimonials = Array.isArray(card.testimonials)
    ? card.testimonials
    : [];

  card.slug = card.slug || makeSlug(card.fullName);
  card.shareMessage = card.shareMessage || "";

  if (card.id) {
    const i = cards.findIndex((c) => c.id === card.id);
    if (i !== -1) cards[i] = card;
  } else {
    card.id = Date.now().toString();
    cards.push(card);
  }

  writeCards(adminId, cards);
  res.json({ success: true });
};

/* =====================
   GET ALL
===================== */

export const getAllEcards = (req, res) => {
  res.json(readCards(req.query.adminId));
};

/* =====================
   DELETE
===================== */

export const deleteEcard = (req, res) => {
  const { adminId } = req.query;
  const { id } = req.params;

  const cards = readCards(adminId).filter((c) => c.id !== id);
  writeCards(adminId, cards);

  res.json({ success: true });
};

/* =====================
   PREVIEW (ADMIN)
===================== */

export const previewEcard = (req, res) => {
  const card = readCards(req.query.adminId).find(
    (c) => c.id === req.params.id
  );
  if (!card) return res.status(404).send("E-card not found");
  renderCard(card, res);
};

/* =====================
   PUBLIC PREVIEW BY SLUG
===================== */

export const previewEcardBySlug = (req, res) => {
  const { slug } = req.params;

  const files = fs.readdirSync(DATA_DIR);
  let card = null;

  for (const file of files) {
    const cards = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), "utf-8")
    );
    card = cards.find((c) => c.slug === slug);
    if (card) break;
  }

  if (!card) return res.status(404).send("E-card not found");
  renderCard(card, res);
};

/* =====================
   RENDER CARD (FIXED)
===================== */

function renderCard(card, res) {
  card.slug = card.slug || makeSlug(card.fullName);
  card.shareMessage = card.shareMessage || "";

  let html = fs.readFileSync(
    path.join(TEMPLATE_DIR, "index.html"),
    "utf-8"
  );

  /* -------- SIMPLE FIELDS -------- */
  html = html.split("{{FULLNAME}}").join(safe(card.fullName));
  html = html.split("{{TAGLINE}}").join(safe(card.tagline));
  html = html.split("{{DESIGNATION}}").join(safe(card.designation));
  html = html.split("{{COMPANY}}").join(safe(card.company));
  html = html.split("{{PHONE}}").join(safe(card.phones?.[0]));
  html = html.split("{{WHATSAPP}}").join(safe(card.whatsapps?.[0]));
  html = html.split("{{EMAIL}}").join(safe(card.emails?.[0]));
  html = html.split("{{INSTAGRAM}}").join(safe(card.instagram));
  html = html.split("{{FACEBOOK}}").join(safe(card.facebook));
  html = html.split("{{YOUTUBE}}").join(safe(card.youtube));
  html = html.split("{{LINKEDIN}}").join(safe(card.linkedin));
  html = html.split("{{TWITTER}}").join(safe(card.twitter));
  html = html.split("{{MAPLINK}}").join(safe(card.maps?.[0]));
  html = html.split("{{WEBSITE}}").join(safe(card.website));
  html = html.split("{{SLUG}}").join(safe(card.slug));
  html = html.split("{{SHARE_MESSAGE}}").join(safe(card.shareMessage));

  /* -------- ABOUT -------- */
  html = html
    .split("{{ABOUT}}")
    .join(safe(card.about).replace(/\n/g, "<br>"));

  /* -------- SERVICES -------- */
  const servicesHtml = (card.services || [])
    .map(
      (s) =>
        `<li>${safe(s.title)}${
          s.description ? " - " + safe(s.description) : ""
        }</li>`
    )
    .join("");
  html = html.split("{{SERVICES}}").join(servicesHtml);

  /* -------- TESTIMONIALS -------- */
  const testimonialsHtml = (card.testimonials || [])
    .map(
      (t) =>
        `<p><strong>${safe(t.name)}</strong><br>${safe(t.message)}</p>`
    )
    .join("<hr>");
  html = html.split("{{TESTIMONIALS}}").join(testimonialsHtml);

  res.send(html);
}

/* =====================
   EXPORT ZIP (UNCHANGED)
===================== */

export const exportEcardZip = (req, res) => {
  const card = readCards(req.query.adminId).find(
    (c) => c.id === req.params.id
  );
  if (!card) return res.status(404).send("E-card not found");

  const zip = archiver("zip");
  const safeName = safe(card.fullName || "ecard").replace(/\s+/g, "_");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${safeName}.zip`
  );

  zip.pipe(res);

  let html = fs.readFileSync(
    path.join(TEMPLATE_DIR, "index.html"),
    "utf-8"
  );

  zip.append(html, { name: "index.html" });
  zip.directory(TEMPLATE_DIR, false, (e) =>
    e.name === "index.html" ? false : e
  );

  zip.finalize();
};
