import "dotenv/config";
import nodemailer from "nodemailer";
import { defaultFromEmail, smtpPassword } from "../services/contactEmailService.js";

const host = process.env.CONTACT_SMTP_HOST?.trim() || process.env.SMTP_HOST?.trim();
const port = Number(process.env.CONTACT_SMTP_PORT ?? process.env.SMTP_PORT ?? 587);
const user = process.env.CONTACT_SMTP_USER?.trim() || process.env.SMTP_USER?.trim();
const pass = smtpPassword();
const secureSetting = process.env.CONTACT_SMTP_SECURE ?? process.env.SMTP_SECURE;
const secure = secureSetting ? secureSetting.toLowerCase() === "true" : port === 465;
const from = defaultFromEmail(user || "not-set");

console.log({
  cwd: process.cwd(),
  host,
  port,
  user,
  hasPass: Boolean(pass),
  passLength: pass.length,
  secure,
  from
});

if (!host || !user || !pass) {
  console.error("SMTP config is incomplete. Check backend/.env.");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  requireTLS: port === 587
});

try {
  await transport.verify();
  console.log("SMTP LOGIN WORKS");
} catch (error) {
  console.error("SMTP LOGIN FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
