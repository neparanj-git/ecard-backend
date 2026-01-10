import mongoose from "mongoose";

const EcardSchema = new mongoose.Schema(
  {
    fullName: String,
    designation: String,
    company: String,
    tagline: String,

    phone: String,
    email: String,
    website: String,

    address: String,

    whatsapp: String,
    instagram: String,
    linkedin: String,
    twitter: String,
  },
  { timestamps: true }
);

export default mongoose.model("Ecard", EcardSchema);
