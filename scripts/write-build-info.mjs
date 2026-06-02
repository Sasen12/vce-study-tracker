import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
const googleVerificationFile = "google7265f1c8749174ff.html";

const routeSeo = [
  {
    path: "",
    filePath: join("dist", "index.html"),
    title: "VCE Forge | VCE Study Planner, SAC Tracker and AI Practice",
    description:
      "VCE Forge helps Australian VCE students track SACs and exams, plan study sessions, generate VCE-style practice questions, use AI coaching, manage notes and build study momentum.",
    changefreq: "weekly",
    priority: "1.0",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "VCE Forge",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "VCE Forge helps Australian VCE students track SACs and exams, plan study sessions, generate VCE-style practice questions, use AI coaching, manage notes and build study momentum.",
      audience: {
        "@type": "EducationalAudience",
        educationalRole: "student"
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "AUD"
      }
    },
    noscript: {
      title: "VCE Forge",
      lead: "A study command centre for Australian VCE students.",
      body:
        "Track SACs and exams, build study plans, run focus sessions, generate VCE-style practice questions, manage notes and see weak topics before they cost marks.",
      points: [
        "SAC and exam countdowns",
        "AI-generated VCE practice questions",
        "Adaptive study coaching and Student Map insights",
        "Focus timer, XP, streaks, badges and themes",
        "Subject squads, study rooms and community support"
      ]
    }
  },
  {
    path: "mission",
    filePath: join("dist", "mission", "index.html"),
    title: "Mission | VCE Forge Study Command Centre",
    description:
      "Why VCE Forge exists: help Australian VCE students turn SAC pressure, weak topics, notes and revision into a clear study plan.",
    changefreq: "monthly",
    priority: "0.7",
    noscript: {
      title: "Make VCE feel controllable",
      lead: "VCE Forge helps Australian VCE students turn scattered pressure into a clear study plan.",
      body:
        "The mission is to help students know what is due, what is weak, what to practise, and what to do tonight.",
      points: [
        "Track assessment pressure before a SAC hits",
        "Use evidence from sessions, notes and mistakes",
        "Turn weak topics into repair blocks",
        "Keep revision focused on the next useful move"
      ]
    }
  },
  {
    path: "contact",
    filePath: join("dist", "contact", "index.html"),
    title: "Contact VCE Forge | VCE Study App Questions and Support",
    description:
      "Ask VCE Forge about setup, subject support, school access, feature ideas or using the VCE study planner before creating an account.",
    changefreq: "monthly",
    priority: "0.7",
    noscript: {
      title: "Contact VCE Forge",
      lead: "Ask a setup question before making an account.",
      body:
        "Use the contact page for VCE Forge setup questions, subject support, school access, feature ideas, or anything you want cleared up before starting.",
      points: [
        "Questions about VCE subjects and study setup",
        "School access and student support questions",
        "Feature ideas or product feedback",
        "Help deciding whether VCE Forge fits your study workflow"
      ]
    }
  }
];

const routeUrl = (route) => (route.path ? `${siteUrl}/${route.path}` : `${siteUrl}/`);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const pageJsonLd = (route) =>
  route.jsonLd ?? {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: route.title,
    url: routeUrl(route),
    description: route.description,
    isPartOf: {
      "@type": "WebSite",
      name: "VCE Forge",
      url: siteUrl
    }
  };

const seoMeta = (route) => `
    <meta name="description" content="${escapeHtml(route.description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${routeUrl(route)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="VCE Forge" />
    <meta property="og:title" content="${escapeHtml(route.title)}" />
    <meta property="og:description" content="${escapeHtml(route.description)}" />
    <meta property="og:url" content="${routeUrl(route)}" />
    <meta property="og:image" content="${siteUrl}/favicon.ico" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(route.title)}" />
    <meta name="twitter:description" content="${escapeHtml(route.description)}" />
    <script type="application/ld+json">${JSON.stringify(pageJsonLd(route))}</script>`;

const seoNoscript = (route) => `
    <noscript>
      <main style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 820px; margin: 48px auto; padding: 0 24px; color: #0f172a; line-height: 1.6;">
        <h1 style="font-size: 40px; line-height: 1.05; margin: 0 0 16px;">${escapeHtml(route.noscript.title)}</h1>
        <p style="font-size: 20px; margin: 0 0 18px;">${escapeHtml(route.noscript.lead)}</p>
        <p>${escapeHtml(route.noscript.body)}</p>
        <ul>
          ${route.noscript.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("\n          ")}
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

const applyRouteSeo = (html, route) => {
  html = stripExistingSeo(html);

  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>${seoMeta(route)}`);
  } else {
    html = html.replace(/<head>/i, `<head>\n    <title>${escapeHtml(route.title)}</title>${seoMeta(route)}`);
  }

  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/i, seoNoscript(route));
  return html;
};

const patchHtmlFiles = () => {
  const sourcePath = join("dist", "index.html");
  if (!existsSync(sourcePath)) return;

  const sourceHtml = readFileSync(sourcePath, "utf8");
  for (const route of routeSeo) {
    const html = applyRouteSeo(sourceHtml, route);
    mkdirSync(dirname(route.filePath), { recursive: true });
    writeFileSync(route.filePath, html);
    console.log(`Patched ${route.filePath} SEO metadata and no-JS fallback`);
  }
};

const writeCrawlerFiles = () => {
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routeSeo
  .map(
    (route) => `  <url>
    <loc>${routeUrl(route)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
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

const writeVerificationFiles = () => {
  writeFileSync(
    join("dist", googleVerificationFile),
    `google-site-verification: ${googleVerificationFile}\n`
  );
  console.log(`Wrote dist/${googleVerificationFile}`);
};

mkdirSync("dist", { recursive: true });
patchHtmlFiles();
writeCrawlerFiles();
writeVerificationFiles();
writeFileSync(join("dist", "build-info.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote dist/build-info.json for ${payload.shortHash}`);
