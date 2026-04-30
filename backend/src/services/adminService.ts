import { HttpError } from "../utils/http.js";
import type { AuthenticatedRequest } from "../middleware/authMiddleware.js";

const DEFAULT_ADMIN_EMAILS = ["sasenb@gmail.com"];

export const adminEmails = () =>
  new Set(
    [...DEFAULT_ADMIN_EMAILS, ...(process.env.ADMIN_EMAILS ?? "").split(",")]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

export const isAdminEmail = (email: string) => adminEmails().has(email.trim().toLowerCase());

export const requireAdmin = (user: AuthenticatedRequest["user"]) => {
  if (!isAdminEmail(user.email)) {
    throw new HttpError(403, "Admin only");
  }
};
