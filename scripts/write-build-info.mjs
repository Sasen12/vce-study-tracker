import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const git = (args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
};

const buildId = process.env.COMMIT_REF || git(["rev-parse", "HEAD"]) || `local-${Date.now()}`;
const publicMessage = process.env.PUBLIC_RELEASE_MESSAGE || "Study Tracker was updated";
const publicChanges = (process.env.PUBLIC_RELEASE_CHANGES || "App improvements and fixes are ready after reload")
  .split("|")
  .map((message) => message.trim())
  .filter(Boolean);
const payload = {
  buildId,
  shortHash: buildId.slice(0, 7),
  message: publicMessage,
  changes: publicChanges.length ? publicChanges.slice(0, 5) : [publicMessage],
  committedAt: git(["log", "-1", "--pretty=%cI"]) || null,
  builtAt: new Date().toISOString()
};

const siteUrl = "https://www.vceforge.space";
const seoTitle = "VCE Forge | VCE Study Planner, SAC Tracker and AI Practice";
const seoDescription =
  "VCE Forge helps Australian VCE students track SACs and exams, plan study sessions, generate VCE-style practice questions, use AI coaching, manage notes and build study momentum.";
const seoKeywords =
  "VCE study planner, VCE SAC tracker, VCE practice questions, VCE study app, VCE exams, ATAR study tools, VCE notes, VCE AI tutor";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "VCE Forge",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description: seoDescription,
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "student"
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "AUD"
  }
};

const seoMeta = `
    <meta name="description" content="${seoDescription}" />
    <meta name="keywords" content="${seoKeywords}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${siteUrl}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VCE Forge" />
    <meta property="og:title" content="${seoTitle}" />
    <meta property="og:description" content="${seoDescription}" />
    <meta property="og:url" content="${siteUrl}/" />
    <meta property="og:image" content="${siteUrl}/favicon.ico" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${seoTitle}" />
    <meta name="twitter:description" content="${seoDescription}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

const seoNoscript = `
    <noscript>
      <main style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 820px; margin: 48px auto; padding: 0 24px; color: #0f172a; line-height: 1.6;">
        <h1 style="font-size: 40px; line-height: 1.05; margin: 0 0 16px;">VCE Forge</h1>
        <p style="font-size: 20px; margin: 0 0 18px;">A study command centre for Australian VCE students.</p>
        <p>Track SACs and exams, build study plans, run focus sessions, generate VCE-style practice questions, manage notes and see weak topics before they cost marks.</p>
        <ul>
          <li>SAC and exam countdowns</li>
          <li>AI-generated VCE practice questions</li>
          <li>Adaptive study coaching and Student Map insights</li>
          <li>Focus timer, XP, streaks, badges and themes</li>
          <li>Subject squads, study rooms and community support</li>
        </ul>
        <p>JavaScript is required to use the interactive app. Open VCE Forge in a modern browser to start studying.</p>
      </main>
    </noscript>`;

const stripExistingSeo = (html) =>
  html
    .replace(/\s*<meta name="description"[^>]*>\s*/gi, "\n")
    .replace(/\s*<meta name="keywords"[^>]*>\s*/gi, "\n")
    .replace(/\s*<meta name="robots"[^>]*>\s*/gi, "\n")
    .replace(/\s*<link rel="canonical"[^>]*>\s*/gi, "\n")
    .replace(/\s*<meta property="og:[^"]+"[^>]*>\s*/gi, "\n")
    .replace(/\s*<meta name="twitter:[^"]+"[^>]*>\s*/gi, "\n")
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "\n");

const patchIndexHtml = () => {
  const indexPath = join("dist", "index.html");
  if (!existsSync(indexPath)) return;

  let html = readFileSync(indexPath, "utf8");
  html = stripExistingSeo(html);

  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${seoTitle}</title>${seoMeta}`);
  } else {
    html = html.replace(/<head>/i, `<head>\n    <title>${seoTitle}</title>${seoMeta}`);
  }

  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/i, seoNoscript);
  writeFileSync(indexPath, html);
  console.log("Patched dist/index.html SEO metadata and no-JS fallback");
};

const writeCrawlerFiles = () => {
  const today = new Date().toISOString().slice(0, 10);
  const routes = ["", "mission", "contact"];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${siteUrl}/${route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route ? "monthly" : "weekly"}</changefreq>
    <priority>${route ? "0.7" : "1.0"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
  const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

  writeFileSync(join("dist", "robots.txt"), robots);
  writeFileSync(join("dist", "sitemap.xml"), sitemap);
  console.log("Wrote dist/robots.txt and dist/sitemap.xml");
};

mkdirSync("dist", { recursive: true });
patchIndexHtml();
writeCrawlerFiles();
writeFileSync(join("dist", "build-info.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote dist/build-info.json for ${payload.shortHash}`);
