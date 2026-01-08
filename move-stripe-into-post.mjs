import fs from "node:fs";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "app", "api");

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile() && (p.endsWith("route.ts") || p.endsWith("route.js"))) out.push(p);
  }
  return out;
}

function stripTopLevelStripeInit(src) {
  const lines = src.split("\n");
  const out = [];
  let skipping = false;

  for (const line of lines) {
    // start skipping when we see top-level const stripe = new Stripe(
    if (!skipping && line.match(/^\s*const\s+stripe\s*=\s*new\s+Stripe\(/)) {
      skipping = true;
      out.push("// Stripe init moved inside POST() for Vercel build safety");
      continue;
    }
    // stop skipping once we hit the end of the Stripe init block
    if (skipping) {
      // common endings: "})", "});", "}) as any", etc.
      if (line.includes("})") || line.includes("});")) {
        skipping = false;
      }
      continue;
    }
    out.push(line);
  }

  return out.join("\n");
}

function injectStripeInitIntoPost(src) {
  // If file doesn't import Stripe, don't try to inject anything.
  if (!src.match(/from\s+['"]stripe['"]/)) return src;

  // If Stripe init already exists inside POST, skip
  if (src.match(/POST\s*\([^)]*\)\s*\{[\s\S]*const\s+stripe\s*=\s*new\s+Stripe\(/)) return src;

  const snippet =
`  // Stripe is initialized inside the handler (prevents build-time crashes)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
  })`;

  // Insert right after the opening { of POST handler
  const re = /(export\s+async\s+function\s+POST\s*\([^)]*\)\s*\{\s*)/m;
  if (re.test(src)) {
    return src.replace(re, `$1\n${snippet}\n\n`);
  }

  // Also support: export function POST(...)
  const re2 = /(export\s+function\s+POST\s*\([^)]*\)\s*\{\s*)/m;
  if (re2.test(src)) {
    return src.replace(re2, `$1\n${snippet}\n\n`);
  }

  return src;
}

const files = walk(API_DIR);

let changed = 0;
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");

  // only touch files that have top-level stripe init
  if (!original.match(/^\s*const\s+stripe\s*=\s*new\s+Stripe\(/m)) continue;

  const backedUp = file + ".bak";
  if (!fs.existsSync(backedUp)) fs.writeFileSync(backedUp, original);

  let next = original;
  next = stripTopLevelStripeInit(next);
  next = injectStripeInitIntoPost(next);

  if (next !== original) {
    fs.writeFileSync(file, next);
    changed++;
    console.log("✅ patched:", file.replace(process.cwd() + "/", ""));
  }
}

console.log(`\nDone. Patched ${changed} file(s). Backups saved as *.bak`);
