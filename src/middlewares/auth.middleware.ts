import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/tokens";

export const requireAuth = (roles?: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, message: "No token" });
    }

    try {
      const token = header.split(" ")[1];
      const payload = verifyAccessToken(token);
      (req as any).user = payload;

      if (roles && !roles.includes(payload.role)) {
        return res.status(403).json({ ok: false, message: "Forbidden" });
      }
      next();
    } catch {
      return res.status(401).json({ ok: false, message: "Invalid token" });
    }
  };
};
