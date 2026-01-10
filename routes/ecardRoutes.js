import express from "express";
import {
  getAllEcards,
  createOrUpdateEcard,
  deleteEcard,
  previewEcard,
  exportEcardZip,
} from "../controllers/ecardController.js";

const router = express.Router();

router.get("/", getAllEcards);
router.post("/", createOrUpdateEcard);
router.delete("/:id", deleteEcard);
router.get("/preview/:id", previewEcard);
router.get("/export/:id", exportEcardZip);

export default router;
