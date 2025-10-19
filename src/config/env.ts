import * as dotenv from "dotenv";
dotenv.config();

const required = (key: string, fallback?: string) => {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env: ${key}`);
  return v;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  clientOrigin: required("CLIENT_ORIGIN", "http://localhost:3000"),
  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/urop"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access"),
    accessExpires: required("JWT_ACCESS_EXPIRES", "15m"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh"),
    refreshExpires: required("JWT_REFRESH_EXPIRES", "7d")
  }
};
