/**
 * 部署用建置腳本：把網站複製到 _site/，並把圖片轉成 WebP。
 *
 * repo 裡的原始 PNG/JPG 和 HTML 都不會被修改，本機開發照常使用原圖；
 * 只有部署出去的 _site/ 會：
 *   1. 依下方 IMAGES 設定，把圖片縮到「畫面最大顯示尺寸 ×2」並轉成 WebP
 *   2. 把 HTML / CSS 裡對這些圖片的引用改成 .webp
 *   3. 檢查所有引用到的圖片都確實存在，少一張就讓部署失敗
 *
 * 新增圖片時：直接把原圖放進 assets/images/，再到 IMAGES 加一行設定即可。
 * 沒寫進 IMAGES 的圖片會原封不動地部署（例如 social_preview.jpeg）。
 *
 * 用法：npm run build:site
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "_site");
const IMG_DIR = "assets/images";

/* width / height：輸出的最大尺寸（只縮不放大）；quality：WebP 品質，預設 80 */
const IMAGES = {
  "hero.jpg": { width: 1920 },
  "visit.png": { width: 1600 },
  "menu_portrait.png": { width: 600 },
  "logo_mark.png": { width: 480 },
  "logo_mark_2.png": { width: 128 },
  "dog_1.png": { height: 220 },
  "dog_2.png": { height: 220 },
  "dog_3.png": { height: 220 },
  "members_1.png": { quality: 95 }, // 大頭貼品質 80 會太糊
  "story_house.png": {},
  "story_sprite.png": {},
  "visit_sprite.png": {},
  "visit_bubble.png": { width: 640 },
};
const DEFAULT_QUALITY = 80;

/* 要部署的檔案與資料夾（其餘如 src/、node_modules、package.json 都不會上線） */
const DEPLOY = [
  "index.html",
  "booking.html",
  "robots.txt",
  "sitemap.xml",
  "google788a74dd51f04e29.html",
  "dist/output.css",
  "js",
  "assets/icons",
  IMG_DIR,
];
const SKIP = (name) => name.includes("_deprecated") || name === ".gitkeep" || name === ".DS_Store";

/* 這些地方必須維持原始格式：
 *   - favicon：部分瀏覽器不支援 WebP favicon
 *   - og:image / twitter:image：LINE、Facebook 等分享預覽不一定支援 WebP */
const KEEP_ORIGINAL_LINE = /rel="icon"|og:image|twitter:image/;

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function main() {
  await rm(OUT, { recursive: true, force: true });

  for (const entry of DEPLOY) {
    await cp(path.join(ROOT, entry), path.join(OUT, entry), {
      recursive: true,
      filter: (src) => !SKIP(path.basename(src)),
    });
  }

  /* 1. 轉檔 */
  let before = 0;
  let after = 0;
  for (const [file, opt] of Object.entries(IMAGES)) {
    const src = path.join(ROOT, IMG_DIR, file);
    const dest = path.join(OUT, IMG_DIR, file.replace(/\.(png|jpe?g)$/i, ".webp"));
    const img = sharp(src);
    if (opt.width || opt.height) {
      img.resize({ width: opt.width, height: opt.height, withoutEnlargement: true });
    }
    await img
      .webp({ quality: opt.quality ?? DEFAULT_QUALITY, alphaQuality: 90, effort: 6, smartSubsample: true })
      .toFile(dest);
    const a = (await stat(src)).size;
    const b = (await stat(dest)).size;
    before += a;
    after += b;
    console.log(`  ${file.padEnd(20)} ${kb(a).padStart(8)} → ${kb(b).padStart(7)}`);
  }
  console.log(`  ${"合計".padEnd(18)} ${kb(before).padStart(8)} → ${kb(after).padStart(7)}`);

  /* favicon 仍用 PNG，但縮小到 64px，不必下載 864px 的原圖 */
  await sharp(path.join(ROOT, IMG_DIR, "logo_mark_2.png"))
    .resize({ width: 64 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, IMG_DIR, "favicon.png"));

  /* 2. 改寫引用 */
  const names = Object.keys(IMAGES).map((f) => f.replace(/\./g, "\\."));
  const ref = new RegExp(`(assets/images/)(${names.join("|")})`, "g");
  const toWebp = (_, dir, file) => dir + file.replace(/\.(png|jpe?g)$/i, ".webp");

  const textFiles = ["index.html", "booking.html", "dist/output.css"];
  for (const rel of textFiles) {
    const p = path.join(OUT, rel);
    const lines = (await readFile(p, "utf8")).split("\n").map((line) => {
      if (/rel="icon"/.test(line)) return line.replace(/assets\/images\/logo_mark_2\.png/, "assets/images/favicon.png");
      if (KEEP_ORIGINAL_LINE.test(line)) return line;
      return line.replace(ref, toWebp);
    });
    await writeFile(p, lines.join("\n"));
  }

  /* 3. 檢查所有引用的圖片都存在 */
  const missing = [];
  for (const rel of textFiles) {
    const text = await readFile(path.join(OUT, rel), "utf8");
    for (const m of text.matchAll(/assets\/(?:images|icons)\/[\w.-]+\.(?:png|jpe?g|webp|svg)/g)) {
      if (!existsSync(path.join(OUT, m[0]))) missing.push(`${rel}: ${m[0]}`);
    }
  }
  if (missing.length) {
    console.error("\n找不到下列圖片，停止部署：\n  " + [...new Set(missing)].join("\n  "));
    process.exit(1);
  }

  /* 原圖已有 WebP 版本、且沒有任何地方再引用的，就不部署 */
  const allText = (await Promise.all(textFiles.map((f) => readFile(path.join(OUT, f), "utf8")))).join("\n");
  for (const file of await readdir(path.join(OUT, IMG_DIR))) {
    if (IMAGES[file] && !allText.includes(`${IMG_DIR}/${file}`)) {
      await rm(path.join(OUT, IMG_DIR, file));
    }
  }

  console.log("\n_site/ 建置完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
