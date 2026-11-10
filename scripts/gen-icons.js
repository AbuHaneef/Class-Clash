// Generates PWA icons for ClassClash using sharp (crown on gradient background).
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#241b3a"/>
      <stop offset="100%" stop-color="#171225"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5c518"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g transform="translate(256 262) scale(5.4) translate(-24 -24)">
    <path d="M4 18 L4 30 L44 30 L44 18 L35 24 L24 9 L13 24 Z" fill="url(#gold)" stroke="#b45309" stroke-width="0.8" stroke-linejoin="round"/>
    <circle cx="4" cy="17" r="3.4" fill="#f5c518"/>
    <circle cx="24" cy="6" r="3.4" fill="#f5c518"/>
    <circle cx="44" cy="17" r="3.4" fill="#f5c518"/>
    <rect x="7" y="33" width="34" height="4.5" rx="2.2" fill="url(#gold)"/>
  </g>
</svg>`;

(async () => {
  const iconsDir = path.join(process.cwd(), "public", "icons");
  fs.mkdirSync(iconsDir, { recursive: true });
  for (const size of [192, 512]) {
    await sharp(Buffer.from(SVG)).resize(size, size).png().toFile(path.join(iconsDir, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }
})();
