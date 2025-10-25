// src/utils/tokens.ts
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { CanonicalRole } from "../models/user.model";

export interface JwtPayload {
  userId: string;
  roles: CanonicalRole[];
}

export const signAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires });

export const signRefreshToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwt.accessSecret) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
