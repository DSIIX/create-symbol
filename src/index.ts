// SF Symbol SVG Template Generator
// Converts any SVG icon into a custom SF Symbol template SVG importable into Xcode

// --- Types ---

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedSvg {
  viewBox: ViewBox;
  paths: string[];
}

export interface VariantGroup {
  id: string;
  weight: string;
  scale: string;
  transform: string;
  paths: string[];
}

// --- Constants ---

const TEMPLATE_WIDTH = 3300;
const TEMPLATE_HEIGHT = 2200;

const WEIGHTS = [
  "Ultralight",
  "Thin",
  "Light",
  "Regular",
  "Medium",
  "Semibold",
  "Bold",
  "Heavy",
  "Black",
] as const;

const SCALES = ["S", "M", "L"] as const;

const WEIGHT_SPACING = 296.71;
const REGULAR_INDEX = 3; // "Regular" is index 3 in WEIGHTS

// Guide positions from Apple's SF Symbol v2.0 template
const GUIDES = {
  S: { baseline: 696, capline: 625.541 },
  M: { baseline: 1126, capline: 1055.54 },
  L: { baseline: 1556, capline: 1485.54 },
} as const;

// Weight scale factors: Ultralight is thinnest, Black is largest
const WEIGHT_SCALES: Record<string, number> = {
  Ultralight: 0.775,
  Thin: 0.805,
  Light: 0.835,
  Regular: 0.865,
  Medium: 0.895,
  Semibold: 0.925,
  Bold: 0.955,
  Heavy: 0.985,
  Black: 1.015,
};

const MARGIN_PADDING = 4.5;

// --- SVG Parsing ---

export function parseSvg(content: string): ParsedSvg {
  // Extract viewBox
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  let viewBox: ViewBox;

  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
    viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  } else {
    // Fall back to width/height attributes
    const widthMatch = content.match(/width="([^"]+)"/);
    const heightMatch = content.match(/height="([^"]+)"/);
    const w = widthMatch ? parseFloat(widthMatch[1]) : 24;
    const h = heightMatch ? parseFloat(heightMatch[1]) : 24;
    viewBox = { x: 0, y: 0, width: w, height: h };
  }

  // Extract all path d attributes
  const paths: string[] = [];
  const pathRegex = /<path[^>]*\bd="([^"]+)"[^>]*\/?>/g;
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }

  if (paths.length === 0) {
    throw new Error("No <path> elements found in SVG");
  }

  // Warn about transforms
  if (/<g[^>]*transform/.test(content)) {
    console.warn(
      "Warning: SVG contains <g> transforms which may affect positioning"
    );
  }

  return { viewBox, paths };
}

// --- Variant Generation ---

export function generateVariants(
  parsed: ParsedSvg,
  baseScale?: number
): VariantGroup[] {
  const { viewBox, paths } = parsed;
  const capHeightM = GUIDES.M.baseline - GUIDES.M.capline; // ~70.46
  const computedBaseScale = baseScale ?? (capHeightM / viewBox.height) * 1.7;

  const centerX = TEMPLATE_WIDTH / 2; // 1650
  const variants: VariantGroup[] = [];

  for (let wi = 0; wi < WEIGHTS.length; wi++) {
    const weight = WEIGHTS[wi];
    const weightScale = WEIGHT_SCALES[weight];

    for (const scale of SCALES) {
      const guide = GUIDES[scale];
      const capHeight = guide.baseline - guide.capline;
      const scaleRatio = capHeight / capHeightM;
      const finalScale = computedBaseScale * weightScale * scaleRatio;

      const scaledWidth = viewBox.width * finalScale;
      const scaledHeight = viewBox.height * finalScale;

      // X: offset from center based on weight index relative to Regular
      const x =
        centerX + (wi - REGULAR_INDEX) * WEIGHT_SPACING - scaledWidth / 2;
      // Y: centered between capline and baseline
      const midY = (guide.baseline + guide.capline) / 2;
      const y = midY - scaledHeight / 2;

      // Build transform: translate then scale, accounting for viewBox origin
      const tx = x - viewBox.x * finalScale;
      const ty = y - viewBox.y * finalScale;

      const id = `${weight}-${scale}`;
      variants.push({
        id,
        weight,
        scale,
        transform: `matrix(${finalScale} 0 0 ${finalScale} ${tx.toFixed(4)} ${ty.toFixed(4)})`,
        paths,
      });
    }
  }

  return variants;
}

// --- Margin Calculation ---

export function calculateMargins(
  parsed: ParsedSvg,
  baseScale?: number
): { left: number; right: number } {
  const capHeightM = GUIDES.M.baseline - GUIDES.M.capline;
  const computedBaseScale =
    baseScale ?? (capHeightM / parsed.viewBox.height) * 1.7;
  const regularScale = computedBaseScale * WEIGHT_SCALES.Regular;
  const scaledWidth = parsed.viewBox.width * regularScale;

  const centerX = TEMPLATE_WIDTH / 2;
  const left = centerX - scaledWidth / 2 - MARGIN_PADDING;
  const right = centerX + scaledWidth / 2 + MARGIN_PADDING;

  return { left, right };
}

// --- Template Building ---

function buildNotes(symbolName: string): string {
  // Weight labels positioned above each weight column
  const centerX = TEMPLATE_WIDTH / 2;
  const weightLabels = WEIGHTS.map((w, i) => {
    const x = centerX + (i - REGULAR_INDEX) * WEIGHT_SPACING;
    return `    <text x="${x.toFixed(2)}" y="400" text-anchor="middle" font-size="12" fill="#000000">${w}</text>`;
  }).join("\n");

  // Scale labels on the left
  const scaleLabels = SCALES.map((s) => {
    const guide = GUIDES[s];
    const midY = (guide.baseline + guide.capline) / 2;
    return `    <text x="200" y="${midY.toFixed(2)}" text-anchor="middle" font-size="12" fill="#000000">${s}</text>`;
  }).join("\n");

  return `  <g id="Notes">
    <rect id="artboard" x="0" y="0" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" fill="white"/>
    <text id="template-version" style="stroke:none;fill:black;font-family:sans-serif;font-size:13;text-anchor:end;" transform="matrix(1 0 0 1 3036 1933)">Template v.2.0</text>
    <text id="descriptive-name" style="stroke:none;fill:black;font-family:sans-serif;font-size:13;text-anchor:end;" transform="matrix(1 0 0 1 3036 1953)">${symbolName}</text>
${weightLabels}
${scaleLabels}
  </g>`;
}

function buildGuides(leftMargin: number, rightMargin: number): string {
  const guideLines: string[] = [];

  // Horizontal guides for each scale
  for (const scale of SCALES) {
    const guide = GUIDES[scale];
    guideLines.push(
      `    <line id="Baseline-${scale}" x1="0" y1="${guide.baseline}" x2="${TEMPLATE_WIDTH}" y2="${guide.baseline}" stroke="#27AAE1" stroke-width="0.5"/>`,
      `    <line id="Capline-${scale}" x1="0" y1="${guide.capline}" x2="${TEMPLATE_WIDTH}" y2="${guide.capline}" stroke="#27AAE1" stroke-width="0.5"/>`
    );
  }

  // Vertical margin guides
  guideLines.push(
    `    <line id="left-margin" x1="${leftMargin.toFixed(2)}" y1="0" x2="${leftMargin.toFixed(2)}" y2="${TEMPLATE_HEIGHT}" stroke="#27AAE1" stroke-width="0.5"/>`,
    `    <line id="right-margin" x1="${rightMargin.toFixed(2)}" y1="0" x2="${rightMargin.toFixed(2)}" y2="${TEMPLATE_HEIGHT}" stroke="#27AAE1" stroke-width="0.5"/>`
  );

  return `  <g id="Guides">
${guideLines.join("\n")}
  </g>`;
}

function buildSymbols(variants: VariantGroup[]): string {
  const groups = variants
    .map((v) => {
      const pathElements = v.paths
        .map((d) => `      <path d="${d}"/>`)
        .join("\n");
      return `    <g id="${v.id}" transform="${v.transform}">
${pathElements}
    </g>`;
    })
    .join("\n");

  return `  <g id="Symbols">
${groups}
  </g>`;
}

export function buildTemplate(
  symbolName: string,
  variants: VariantGroup[],
  leftMargin: number,
  rightMargin: number
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" viewBox="0 0 ${TEMPLATE_WIDTH} ${TEMPLATE_HEIGHT}">
${buildNotes(symbolName)}
${buildGuides(leftMargin, rightMargin)}
${buildSymbols(variants)}
</svg>
`;
}
