import fs from "fs";
import path from "path";
import archiver from "archiver";

/* =====================
   CONSTANTS
===================== */

const DATA_DIR = path.join(process.cwd(), "data");
const TEMPLATE_DIR = path.join(process.cwd(), "templates", "master-ecard");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const fileForAdmin = (id) =>
  path.join(DATA_DIR, `ecards_admin_${id}.json`);

const readCards = (id) => {
  if (!fs.existsSync(fileForAdmin(id))) {
    fs.writeFileSync(fileForAdmin(id), "[]");
  }
  return JSON.parse(fs.readFileSync(fileForAdmin(id), "utf-8"));
};

const writeCards = (id, data) =>
  fs.writeFileSync(fileForAdmin(id), JSON.stringify(data, null, 2));

const safe = (v) => {
  if (v === undefined || v === null) return "";
  return String(v);
};

/* =====================
   DELETE
===================== */

export const deleteEcard = (req, res) => {
  const { adminId } = req.query;
  const { id } = req.params;

  if (!adminId) {
    return res.status(400).json({ message: "adminId required" });
  }

  const cards = readCards(adminId).filter((c) => c.id !== id);
  writeCards(adminId, cards);

  res.json({ success: true });
};

/* =====================
   CREATE / UPDATE
===================== */

export const createOrUpdateEcard = (req, res) => {
  const { adminId, ...card } = req.body;
  const cards = readCards(adminId);

  // SAFETY: ensure arrays always exist
  card.services = Array.isArray(card.services) ? card.services : [];
  card.testimonials = Array.isArray(card.testimonials)
    ? card.testimonials
    : [];

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
   GET
===================== */

export const getAllEcards = (req, res) => {
  res.json(readCards(req.query.adminId));
};

/* =====================
   PREVIEW
===================== */

export const previewEcard = (req, res) => {
  const card = readCards(req.query.adminId).find(
    (c) => c.id === req.params.id
  );

  if (!card) {
    return res.status(404).send("E-card not found");
  }

  let html = fs.readFileSync(
    path.join(TEMPLATE_DIR, "index.html"),
    "utf-8"
  );

  /* ---------------------
     SIMPLE FIELDS
  --------------------- */
  Object.entries(card).forEach(([k, v]) => {
    if (Array.isArray(v)) return;
    html = html.replaceAll(`{{${k.toUpperCase()}}}`, safe(v));
  });

  /* ---------------------
     SERVICES → HTML
  --------------------- */
  const servicesHtml = (card.services || [])
    .map(
      (s) => `
        <div class="service">
          <h4>${safe(s.title)}</h4>
          <p>${safe(s.description)}</p>
        </div>
      `
    )
    .join("");

  /* ---------------------
     TESTIMONIALS → HTML  ✅ FIX
  --------------------- */
  const testimonialsHtml = (card.testimonials || [])
    .map(
      (t) => `
        <div class="service">
          <h4>${safe(t.name)}</h4>
          <p>${safe(t.message)}</p>
        </div>
      `
    )
    .join("");

  html = html.replaceAll("{{SERVICES}}", servicesHtml);
  html = html.replaceAll("{{TESTIMONIALS}}", testimonialsHtml);

  res.send(html);
};

/* =====================
   EXPORT ZIP
===================== */

export const exportEcardZip = (req, res) => {
  const card = readCards(req.query.adminId).find(
    (c) => c.id === req.params.id
  );

  if (!card) {
    return res.status(404).send("E-card not found");
  }

  const zip = archiver("zip");

  const displayName = safe(card.fullName || card.name || "ecard");
  const safeName = displayName.replace(/\s+/g, "_");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${safeName}.zip`
  );

  zip.pipe(res);

  let html = fs.readFileSync(
    path.join(TEMPLATE_DIR, "index.html"),
    "utf-8"
  );

  /* SIMPLE FIELDS */
  Object.entries(card).forEach(([k, v]) => {
    if (Array.isArray(v)) return;
    html = html.replaceAll(`{{${k.toUpperCase()}}}`, safe(v));
  });

  /* SERVICES */
  const servicesHtml = (card.services || [])
    .map(
      (s) => `
        <div class="service">
          <h4>${safe(s.title)}</h4>
          <p>${safe(s.description)}</p>
        </div>
      `
    )
    .join("");

  /* TESTIMONIALS */
  const testimonialsHtml = (card.testimonials || [])
    .map(
      (t) => `
        <div class="service">
          <h4>${safe(t.name)}</h4>
          <p>${safe(t.message)}</p>
        </div>
      `
    )
    .join("");

  html = html.replaceAll("{{SERVICES}}", servicesHtml);
  html = html.replaceAll("{{TESTIMONIALS}}", testimonialsHtml);

  zip.append(html, { name: "index.html" });

  /* STATIC FILES */
  zip.directory(TEMPLATE_DIR, false, (e) =>
    ["index.html", "template.vcf"].includes(e.name) ? false : e
  );

  /* VCARD */
  const vcf = `BEGIN:VCARD
VERSION:3.0
FN:${displayName}
TEL:${safe(card.phone)}
EMAIL:${safe(card.email)}
END:VCARD`;

  zip.append(vcf, { name: `${safeName}.vcf` });

  zip.finalize();
};
