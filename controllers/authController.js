import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// 🔑 ABSOLUTE PATHS (IMPORTANT)
const DATA_DIR = path.join(process.cwd(), "backend", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const JWT_SECRET = process.env.JWT_SECRET || "secretkey";

// ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ensure users.json exists
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]");
}

const readUsers = () =>
  JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));

const writeUsers = (users) =>
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

/* ======================
   SIGNUP
====================== */
export const signup = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email & password required" });

  const users = readUsers();

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
  };

  users.push(user);
  writeUsers(users);

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    id: user.id,
    email: user.email,
    token,
  });
};

/* ======================
   LOGIN
====================== */
export const login = async (req, res) => {
  const { email, password } = req.body;

  const users = readUsers();
  const user = users.find((u) => u.email === email);

  if (!user)
    return res.status(401).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    id: user.id,
    email: user.email,
    token,
  });
};
