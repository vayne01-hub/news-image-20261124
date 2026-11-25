// news-image-20261124 — v2 poster.
// Same seven verified stories as v1, re-set for legibility: every headline
// now runs at 4x on two lines (readable at ~300 px across), each deck cut to
// one line, numbers still inside their own discs. Software rasterizer with a
// hand-written 5x7 bitmap font; Node 22 stdlib only, no network, no
// randomness, no clock: two runs write identical bytes.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const buf = Buffer.alloc(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 231];
const INK: RGB = [20, 33, 61];
const NAVY: RGB = [20, 33, 61];
const GOLD: RGB = [198, 156, 66];
const RED: RGB = [178, 44, 36];
const GREY: RGB = [110, 110, 104];
const RULE: RGB = [214, 206, 190];
const WHITE: RGB = [250, 248, 243];

function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = c[0];
    buf[i * 3 + 1] = c[1];
    buf[i * 3 + 2] = c[2];
  }
}

function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) px(i, j, c);
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let j = cy - r; j <= cy + r; j++) {
    for (let i = cx - r; i <= cx + r; i++) {
      const dx = i - cx;
      const dy = j - cy;
      if (dx * dx + dy * dy <= r * r) px(i, j, c);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(x, y, c);
    px(x + 1, y, c);
    px(x, y + 1, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) px(x, y, c);
    }
  }
}

// ------------------------------------------------------------------- font
// 5x7 bitmap font, uppercase only. Each glyph: 7 rows of 5 bits ("1" = on).
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '01110', '00100', '00100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '1') {
          rect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

// ---------------------------------------------------------------- stories
// Seven stories, all verified in the v1 research log (AP, Reuters, WSJ,
// BBC, CNN, Xinhua, The Hindu; two independent publishers each). Headlines
// are the v1 headlines reflowed onto two lines — wording unchanged — and
// each deck is the v1 deck trimmed to one line, facts intact.
type Story = {
  tag: string;
  headline: [string, string];
  deck: string;
  accent: RGB;
  icon: string;
};

const STORIES: Story[] = [
  {
    tag: 'TRADE - WASHINGTON',
    headline: ['US PLANS NEW TARIFFS', 'ON CHINA AND EU'],
    deck: 'USTR TO UNVEIL SUBSIDY PROBE OF 16 ECONOMIES IN DAYS.',
    accent: [178, 44, 36],
    icon: 'bars',
  },
  {
    tag: 'MARKETS - NEW YORK',
    headline: ['NVIDIA SLIDES 6% AS', 'HUANG RALLY FADES'],
    deck: "LAWMAKERS QUESTION TRUMP'S ROLE IN THE CEO'S RETURN.",
    accent: [36, 98, 58],
    icon: 'down',
  },
  {
    tag: 'MIDDLE EAST - RIYADH',
    headline: ['HOUTHI DRONE HITS RIYADH', 'TOWER, 11 HURT'],
    deck: 'SECOND STRIKE ON THE PIF TOWER IN UNDER A WEEK, CIVIL DEFENCE SAYS.',
    accent: [150, 84, 22],
    icon: 'tower',
  },
  {
    tag: 'MIDDLE EAST - GAZA',
    headline: ['ISRAELI STRIKE KILLS', 'HAMAS SECURITY CHIEF'],
    deck: 'NAEEM ABU NAHEL KILLED IN GAZA CITY; SEVEN DEAD.',
    accent: [90, 60, 120],
    icon: 'burst',
  },
  {
    tag: 'AMERICAS - CARTAGENA',
    headline: ['GUNMEN HOLD 30 HOSTAGE', 'IN CARTAGENA'],
    deck: 'BOTCHED ARMOURED-TRUCK ROBBERY AT AN EXITO STORE.',
    accent: [26, 92, 128],
    icon: 'store',
  },
  {
    tag: 'SPACE - JIUQUAN',
    headline: ['CHINA NAMES FIRST', 'PAKISTANI ASTRONAUT'],
    deck: 'ALI JOINS SHENZHOU-24 CREW; FIRST FOREIGNER ABOARD TIANGONG.',
    accent: [30, 60, 140],
    icon: 'rocket',
  },
  {
    tag: 'ASIA - NEPAL',
    headline: ['5.6 QUAKE SHAKES NEPAL', 'NEAR TIBET'],
    deck: 'TREMOR FELT IN INDIA, BHUTAN AND BANGLADESH; NO CASUALTIES.',
    accent: [120, 70, 40],
    icon: 'quake',
  },
];

// ------------------------------------------------------------------- icons
// Each icon draws inside a 96x96 box whose top-left is (bx, by).
function drawIcon(kind: string, bx: number, by: number, c: RGB): void {
  const cx = bx + 48;
  const cy = by + 48;
  if (kind === 'bars') {
    rect(bx + 14, by + 58, 16, 24, c);
    rect(bx + 40, by + 42, 16, 40, c);
    rect(bx + 66, by + 24, 16, 58, c);
    line(bx + 8, by + 86, bx + 88, by + 86, INK);
  } else if (kind === 'down') {
    line(bx + 10, by + 22, bx + 34, by + 40, c);
    line(bx + 34, by + 40, bx + 52, by + 34, c);
    line(bx + 52, by + 34, bx + 86, by + 70, c);
    tri(bx + 74, by + 70, bx + 88, by + 70, bx + 86, by + 56, c);
    line(bx + 8, by + 86, bx + 88, by + 86, INK);
  } else if (kind === 'tower') {
    rect(cx - 16, by + 26, 32, 56, c);
    rect(cx - 2, by + 12, 4, 14, c);
    disc(cx, by + 10, 3, c);
    for (let r = 0; r < 4; r++) rect(cx - 12, by + 34 + r * 12, 24, 4, WHITE);
    line(bx + 8, by + 86, bx + 88, by + 86, INK);
  } else if (kind === 'burst') {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const x1 = Math.round(cx + Math.cos(a) * 12);
      const y1 = Math.round(cy + Math.sin(a) * 12);
      const x2 = Math.round(cx + Math.cos(a) * 38);
      const y2 = Math.round(cy + Math.sin(a) * 38);
      line(x1, y1, x2, y2, c);
    }
    disc(cx, cy, 12, c);
    disc(cx, cy, 5, WHITE);
  } else if (kind === 'store') {
    rect(bx + 12, by + 30, 72, 52, c);
    for (let k = 0; k < 4; k++) {
      rect(bx + 12 + k * 18, by + 30, 9, 12, WHITE);
      rect(bx + 21 + k * 18, by + 30, 9, 12, GOLD);
    }
    rect(bx + 40, by + 56, 16, 26, WHITE);
    line(bx + 8, by + 86, bx + 88, by + 86, INK);
  } else if (kind === 'rocket') {
    tri(cx, by + 8, cx - 12, by + 34, cx + 12, by + 34, c);
    rect(cx - 12, by + 34, 24, 26, c);
    rect(cx - 20, by + 48, 8, 16, c);
    rect(cx + 12, by + 48, 8, 16, c);
    tri(cx, by + 84, cx - 8, by + 60, cx + 8, by + 60, GOLD);
    disc(cx, by + 44, 4, WHITE);
  } else if (kind === 'quake') {
    tri(bx + 10, by + 78, bx + 30, by + 34, bx + 50, by + 78, c);
    tri(bx + 44, by + 78, bx + 66, by + 46, bx + 86, by + 78, GOLD);
    line(bx + 8, by + 84, bx + 30, by + 70, INK);
    line(bx + 30, by + 70, bx + 52, by + 84, INK);
    line(bx + 52, by + 84, bx + 74, by + 72, INK);
    line(bx + 74, by + 72, bx + 88, by + 84, INK);
  }
}

// -------------------------------------------------------------------- png
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ render
// Row geometry (row height 118): tag at +10, headline lines at +30 and +62
// (scale 4, 28 px glyphs), deck at +96 (scale 2). Number disc centred at
// +59, clear of every glyph: the number sits inside its own circle and no
// line or icon ever overlaps it.
function render(): void {
  fill(PAPER);

  // Header band.
  rect(0, 0, W, 150, NAVY);
  drawText('THE WORLD IN ONE DAY', 44, 24, 2, GOLD);
  drawText('TUESDAY 24 NOVEMBER 2026', 44, 50, 6, WHITE);
  drawText('SEVEN STORIES THAT DEFINED THE DAY', 44, 116, 2, GOLD);
  rect(44, 138, 936, 3, GOLD);

  // Story rows.
  const rowTop = 150;
  const rowH = 118;
  STORIES.forEach((s, i) => {
    const y = rowTop + i * rowH;
    if (i > 0) rect(44, y, 936, 2, RULE);
    // Number disc.
    const cy = y + 59;
    disc(74, cy, 30, s.accent);
    const num = String(i + 1);
    drawText(num, 74 - Math.floor(textWidth(num, 4) / 2), cy - 14, 4, WHITE);
    // Tag, two-line headline, one-line deck.
    drawText(s.tag, 122, y + 10, 2, s.accent);
    drawText(s.headline[0], 122, y + 30, 4, INK);
    drawText(s.headline[1], 122, y + 62, 4, INK);
    drawText(s.deck, 122, y + 96, 2, GREY);
    // Pictogram, right side, inside its own box.
    drawIcon(s.icon, 896, y + 11, s.accent);
  });

  // Footer band.
  rect(0, 976, W, 48, NAVY);
  const foot = 'SOURCES: AP - REUTERS - WSJ - BBC - CNN - XINHUA - THE HINDU';
  drawText(foot, Math.floor((W - textWidth(foot, 2)) / 2), 993, 2, WHITE);
}

// -------------------------------------------------------------------- main
function main(): void {
  render();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'entry.png');
  fs.writeFileSync(outPath, png);
  console.log('wrote ' + outPath + ' ' + png.length + ' bytes');
}

main();
