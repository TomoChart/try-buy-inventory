import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "YOUniversity Try & Buy API running" });
});

// Login endpoint
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ success: true, token: "fake-jwt-token" });
  }

  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Example protected route
app.get("/api/protected", (req, res) => {
  res.json({ data: "This is protected data" });
});

// Port handling (Fly.io uses env.PORT automatically)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
