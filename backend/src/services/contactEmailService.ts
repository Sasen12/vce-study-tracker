import type nodemailer from "nodemailer";

export type ContactMessage = {
  name: string;
  email: string;
  yearLevel?: string | null;
  school?: string | null;
  subject?: string | null;
  question: string;
};

type EmailResult =
  | {
      sent: true;
      reason: null;
    }
  | {
      sent: false;
      reason: "smtp_missing" | "mailer_unavailable";
    };

type NodemailerApi = Pick<typeof nodemailer, "createTransport">;

let nodemailerApi: NodemailerApi | null | undefined;

const loadNodemailer = async () => {
  if (nodemailerApi !== undefined) return nodemailerApi;

  try {
    const module = await import("nodemailer");
    nodemailerApi = module.default ?? module;
    return nodemailerApi;
  } catch (error) {
    console.warn("Nodemailer is not installed. Contact messages will be saved without email delivery.", error);
    nodemailerApi = null;
    return null;
  }
};

const recipientEmail = () => process.env.CONTACT_RECIPIENT_EMAIL?.trim() || "techsavvy356@gmail.com";

const smtpTransport = async () => {
  const mailer = await loadNodemailer();
  if (!mailer) return null;

  const smtpUrl = process.env.CONTACT_SMTP_URL?.trim() || process.env.SMTP_URL?.trim();
  if (smtpUrl) {
    return mailer.createTransport(smtpUrl);
  }

  const host = process.env.CONTACT_SMTP_HOST?.trim() || process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.CONTACT_SMTP_PORT ?? process.env.SMTP_PORT ?? 587);
  const user = process.env.CONTACT_SMTP_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass = process.env.CONTACT_SMTP_PASS || process.env.SMTP_PASS;
  const secureSetting = process.env.CONTACT_SMTP_SECURE ?? process.env.SMTP_SECURE;
  const secure = secureSetting ? secureSetting.toLowerCase() === "true" : port === 465;

  return mailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  });
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const field = (label: string, value?: string | null) => `${label}: ${value?.trim() || "Not provided"}`;

export const sendContactEmail = async (message: ContactMessage): Promise<EmailResult> => {
  const transport = await smtpTransport();
  if (!transport) {
    const hasSmtpConfig = Boolean(process.env.CONTACT_SMTP_URL || process.env.SMTP_URL || process.env.CONTACT_SMTP_HOST || process.env.SMTP_HOST);
    return { sent: false, reason: hasSmtpConfig ? "mailer_unavailable" : "smtp_missing" };
  }

  const to = recipientEmail();
  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    process.env.CONTACT_SMTP_USER?.trim() ||
    process.env.SMTP_USER?.trim() ||
    to;

  const text = [
    "A student sent a pre-account question from the VCE Forge contact page.",
    "",
    field("Name", message.name),
    field("Email", message.email),
    field("Year level", message.yearLevel),
    field("School", message.school),
    field("Subject or area", message.subject),
    "",
    "Question:",
    message.question
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2>VCE Forge contact question</h2>
      <p>A student sent a pre-account question from the VCE Forge contact page.</p>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(message.name)}</li>
        <li><strong>Email:</strong> ${escapeHtml(message.email)}</li>
        <li><strong>Year level:</strong> ${escapeHtml(message.yearLevel || "Not provided")}</li>
        <li><strong>School:</strong> ${escapeHtml(message.school || "Not provided")}</li>
        <li><strong>Subject or area:</strong> ${escapeHtml(message.subject || "Not provided")}</li>
      </ul>
      <p><strong>Question</strong></p>
      <p>${escapeHtml(message.question).replace(/\n/g, "<br />")}</p>
    </div>
  `;

  await transport.sendMail({
    to,
    from,
    replyTo: message.email,
    subject: `VCE Forge question from ${message.name}`,
    text,
    html
  });

  return { sent: true, reason: null };
};
