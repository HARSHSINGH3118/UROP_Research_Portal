import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/tokens";

/**
 * Legacy aliases so old route guards still work:
 *  - "publisher" ≈ "author"
 *  - "admin"     ≈ "coordinator"
 */
const ROLE_ALIASES: Record<string, string[]> = {
  author: ["author", "publisher"],
  publisher: ["author", "publisher"], // legacy input
  reviewer: ["reviewer"],
  coordinator: ["coordinator", "admin"],
  admin: ["coordinator", "admin"] // legacy input
};

export const requireAuth = (roles?: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, message: "No token" });
    }

    try {
      const token = header.split(" ")[1];
      const payload: any = verifyAccessToken(token); // may contain .roles[] or .role
      (req as any).user = payload;

      // ✅ normalize: always have array of roles
      const userRoles = Array.isArray(payload.roles)
        ? payload.roles
        : payload.role
        ? [payload.role]
        : [];

      if (roles && roles.length > 0) {
        const allowed = new Set(roles.flatMap((r) => ROLE_ALIASES[r] ?? [r]));
        const has = userRoles.some((r) => allowed.has(r));
        if (!has) {
          return res.status(403).json({ ok: false, message: "Forbidden" });
        }
      }

      next();
    } catch {
      return res.status(401).json({ ok: false, message: "Invalid token" });
    }
  };
};
