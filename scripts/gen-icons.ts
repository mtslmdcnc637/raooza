// Generate PWA icons from SVG using sharp
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

const svgPath = join(import.meta.dir, "icon.svg");
const svgBuffer = readFileSync(svgPath);

const outDir = "/home/z/my-project/public/icons";

Promise.all([
  sharp(svgBuffer).resize(192, 192).png().toFile(join(outDir, "icon-192.png")),
  sharp(svgBuffer).resize(512, 512).png().toFile(join(outDir, "icon-512.png")),
  sharp(svgBuffer).resize(180, 180).png().toFile(join(outDir, "icon-180.png")),
  sharp(svgBuffer).resize(32, 32).png().toFile(join(outDir, "favicon-32.png")),
])
  .then(() => console.log("Icons generated"))
  .catch((e) => { console.error(e); process.exit(1); });
