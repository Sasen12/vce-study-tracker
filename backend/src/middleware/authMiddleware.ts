import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "../utils/http.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
  };
};

type AccessPayload = {
  sub: string;
  email: string;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  const token = header.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? "dev_secret") as AccessPayload;
    (req as AuthenticatedRequest).user = {
      id: decoded.sub,
      email: decoded.email
    };
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
};

export const signAccessToken = (user: { id: string; email: string }) =>
  jwt.sign({ email: user.email }, process.env.JWT_SECRET ?? "dev_secret", {
    subject: user.id,
    expiresIn: "15m"
  });

export const signRefreshToken = (user: { id: string; email: string }) =>
  jwt.sign({ email: user.email }, process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret", {
    subject: user.id,
    expiresIn: "7d"
  });

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret") as AccessPayload;

