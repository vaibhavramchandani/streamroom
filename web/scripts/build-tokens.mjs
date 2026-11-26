// Generates src/styles/tokens.css from replica/design/tokens.json.
// Tailwind v4 reads the @theme block, so components use bg-surface, text-muted, rounded-md, etc.
// Run: node scripts/build-tokens.mjs  (also runs before dev and build)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, '../replica/design/tokens.json');
const out = resolve(root, 'src/styles/tokens.css');
const t = JSON.parse(readFileSync(src, 'utf8'));

const lines = [];
const px = (n) => `${n / 16}rem`;

for (const [k, v] of Object.entries(t.color)) lines.push(`  --color-${k}: ${v};`);
lines.push(`  --font-sans: ${t.font.sans};`, `  --font-mono: ${t.font.mono};`);
for (const [k, v] of Object.entries(t.type)) {
  lines.push(`  --text-${k}: ${px(v.size)};`);
  lines.push(`  --text-${k}--line-height: ${px(v.line)};`);
  lines.push(`  --text-${k}--font-weight: ${v.weight};`);
}
lines.push(`  --spacing: 0.25rem;`); // Tailwind's 4px base matches the 4/8 scale
for (const [k, v] of Object.entries(t.radius)) lines.push(`  --radius-${k}: ${v === 999 ? '9999px' : px(v)};`);
for (const [k, v] of Object.entries(t.shadow)) lines.push(`  --shadow-${k}: ${v};`);
lines.push(`  --duration-fast: ${t.motion.fast};`, `  --duration-base: ${t.motion.base};`, `  --ease-std: ${t.motion.ease};`);
for (const [k, v] of Object.entries(t.layout.breakpoints)) lines.push(`  --breakpoint-${k}: ${px(v)};`);

const layout = Object.entries(t.layout)
  .filter(([, v]) => typeof v === 'number')
  .map(([k, v]) => `  --layout-${k}: ${v}px;`);

const css = `/* Generated from replica/design/tokens.json. Do not edit by hand. */
@theme {
  --color-*: initial;
${lines.join('\n')}
}

:root {
${layout.join('\n')}
}
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`tokens.css: ${Object.keys(t.color).length} colours, ${Object.keys(t.type).length} type steps`);
