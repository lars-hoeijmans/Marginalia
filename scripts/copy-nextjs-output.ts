import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

// Find the views directory in the build output
function findViewsDir(): string | null {
  const buildDir = resolve("build");
  if (!existsSync(buildDir)) return null;

  function walk(dir: string): string | null {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (full.endsWith("/Resources/app/views")) return full;
      const found = walk(full);
      if (found) return found;
    }
    return null;
  }

  return walk(buildDir);
}

const viewsDir = findViewsDir();
if (!viewsDir) {
  console.log("Warning: Could not find views directory in build output");
  process.exit(0);
}

const src = resolve("out");
if (!existsSync(src)) {
  console.log("Warning: out/ directory not found. Run 'npm run build' first.");
  process.exit(0);
}

// Copy index.html and _next/ into views/app/ so absolute paths resolve
// (views://app/index.html references /_next/... which resolves to views://app/_next/...)
const appDir = join(viewsDir, "app");
mkdirSync(appDir, { recursive: true });
cpSync(join(src, "index.html"), join(appDir, "index.html"));
cpSync(join(src, "_next"), join(appDir, "_next"), { recursive: true });

// Copy favicon and other static assets into app/ alongside index.html
const skip = new Set(["_next", "index.html", "_not-found", "_not-found.html", "404.html"]);
for (const entry of readdirSync(src)) {
  if (skip.has(entry)) continue;
  const srcPath = join(src, entry);
  const destPath = join(appDir, entry);
  cpSync(srcPath, destPath, { recursive: true });
}

console.log(`Copied Next.js static export to ${viewsDir}`);
