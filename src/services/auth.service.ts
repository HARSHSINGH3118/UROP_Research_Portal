// src/services/auth.service.ts
import bcrypt from "bcrypt";
import { UserModel, CanonicalRole } from "../models/user.model";
import { signAccessToken, signRefreshToken } from "../utils/tokens";

// Map any legacy role labels to canonical ones
const CANONICALS: Record<string, CanonicalRole> = {
  author: "author",
  publisher: "author",       // legacy -> canonical
  reviewer: "reviewer",
  coordinator: "coordinator",
  admin: "coordinator"       // legacy -> canonical
};

function normalizeRoles(input?: string[] | string): CanonicalRole[] {
  if (!input) return ["author"];
  const list = Array.isArray(input) ? input : [input];
  const mapped = Array.from(
    new Set(
      list
        .map((r) => r?.toLowerCase().trim())
        .map((r) => CANONICALS[r])
        .filter(Boolean) as CanonicalRole[]
    )
  );
  return mapped.length ? mapped : ["author"];
}

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  rolesInput?: string[] | string,
  contactNumber?: string
) => {
  const existing = await UserModel.findOne({ email });
  if (existing) throw new Error("Email already registered");

  const roles = normalizeRoles(rolesInput);
  const hashed = await bcrypt.hash(password, 10);

  const user = await UserModel.create({ name, email, password: hashed, roles, contactNumber });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    contactNumber: user.contactNumber
  };
};

export const loginUser = async (email: string, password: string) => {
  const user = await UserModel.findOne({ email });
  if (!user) throw new Error("Invalid email or password");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid email or password");

  const payload = { userId: user._id.toString(), roles: user.roles };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      contactNumber: user.contactNumber
    }
  };
};
