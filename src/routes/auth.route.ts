// src/routes/auth.route.ts
import { Router } from "express";
import { registerUser, loginUser } from "../services/auth.service";

export const authRouter = Router();

/**
 * Register
 * Body:
 *  - name, email, password
 *  - roles?: string[]   (e.g. ["author","reviewer"])
 *  - role?: string      (legacy single role)
 *  - contactNumber?: string (optional)
 */
authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password, roles, role, contactNumber } = req.body;
    const user = await registerUser(name, email, password, roles ?? role, contactNumber);
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
