import { Router } from "express";
import { registerUser, loginUser } from "../services/auth.service";

export const authRouter = Router();

// Register
authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await registerUser(name, email, password, role);
    res.status(201).json({ ok: true, user });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// Login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await loginUser(email, password);
    res.json({ ok: true, ...data });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});
