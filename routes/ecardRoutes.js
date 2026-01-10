router.get("/:id/export", (req, res) => {
  const { id } = req.params;

  const TEMPLATE_PATH = path.join(
    process.cwd(),
    "templates",
    "master-ecard"
  );

  const DATA_FILE = path.join(
    process.cwd(),
    "data",
    "ecards.json"
  );

  const ecards = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const card = ecards.find((c) => c.id === id);

  if (!card) {
    return res.status(404).send("E-card not found");
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${(card.fullName || "ecard")
      .replace(/\s+/g, "-")
      .toLowerCase()}.zip`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  // 🔥 READ MASTER HTML
  const indexPath = path.join(TEMPLATE_PATH, "index.html");
  let html = fs.readFileSync(indexPath, "utf-8");

  // 🔥 INJECT CARD DATA (THIS WAS MISSING)
  html = html.replace(
    "__CARD_DATA__",
    JSON.stringify(card)
  );

  // 🔥 ADD MODIFIED INDEX.HTML
  archive.append(html, { name: "index.html" });

  // 🔥 ADD REST OF FILES (EXCEPT ORIGINAL INDEX)
  archive.directory(TEMPLATE_PATH, false, (entry) => {
    if (entry.name === "index.html") return false;
    return entry;
  });

  archive.finalize();
});
