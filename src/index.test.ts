import { test, expect, describe } from "bun:test";
import {
  parseSvg,
  generateVariants,
  buildTemplate,
  calculateMargins,
} from "./index";

describe("parseSvg", () => {
  test("extracts viewBox", () => {
    const svg = `<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`;
    const result = parseSvg(svg);
    expect(result.viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
  });

  test("falls back to width/height when no viewBox", () => {
    const svg = `<svg width="32" height="16"><path d="M0 0h32v16H0z"/></svg>`;
    const result = parseSvg(svg);
    expect(result.viewBox).toEqual({ x: 0, y: 0, width: 32, height: 16 });
  });

  test("extracts single path", () => {
    const svg = `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`;
    const result = parseSvg(svg);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toBe("M12 2L2 22h20z");
  });

  test("extracts multiple paths", () => {
    const svg = `<svg viewBox="0 0 24 24"><path d="M0 0h12v12H0z"/><path d="M12 12h12v12H12z"/></svg>`;
    const result = parseSvg(svg);
    expect(result.paths).toHaveLength(2);
  });

  test("throws on SVG with no paths", () => {
    const svg = `<svg viewBox="0 0 24 24"><rect width="24" height="24"/></svg>`;
    expect(() => parseSvg(svg)).toThrow("No <path> elements found");
  });

  test("parses claude.svg fixture", async () => {
    const content = await Bun.file("test-fixtures/claude.svg").text();
    const result = parseSvg(content);
    expect(result.viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(result.paths.length).toBeGreaterThan(0);
  });
});

describe("generateVariants", () => {
  const simpleSvg = parseSvg(
    `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`
  );

  test("produces 27 variants (9 weights × 3 scales)", () => {
    const variants = generateVariants(simpleSvg);
    expect(variants).toHaveLength(27);
  });

  test("variant IDs follow Weight-Scale pattern", () => {
    const variants = generateVariants(simpleSvg);
    expect(variants[0].id).toBe("Ultralight-S");
    expect(variants[1].id).toBe("Ultralight-M");
    expect(variants[2].id).toBe("Ultralight-L");
    expect(variants[9].id).toBe("Regular-S");
  });

  test("scaling increases per weight", () => {
    const variants = generateVariants(simpleSvg);
    const ultralightM = variants.find((v) => v.id === "Ultralight-M")!;
    const blackM = variants.find((v) => v.id === "Black-M")!;

    const getScale = (t: string) =>
      parseFloat(t.match(/matrix\(([^ ]+)/)![1]);
    expect(getScale(blackM.transform)).toBeGreaterThan(
      getScale(ultralightM.transform)
    );
  });

  test("all variants contain the source paths", () => {
    const variants = generateVariants(simpleSvg);
    for (const v of variants) {
      expect(v.paths).toEqual(simpleSvg.paths);
    }
  });
});

describe("calculateMargins", () => {
  test("margins are symmetric around center", () => {
    const parsed = parseSvg(
      `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`
    );
    const margins = calculateMargins(parsed);
    const center = 3300 / 2;
    const leftDist = center - margins.left;
    const rightDist = margins.right - center;
    expect(Math.abs(leftDist - rightDist)).toBeLessThan(0.01);
  });
});

describe("buildTemplate", () => {
  test("produces valid SVG with correct dimensions", () => {
    const parsed = parseSvg(
      `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`
    );
    const variants = generateVariants(parsed);
    const margins = calculateMargins(parsed);
    const template = buildTemplate("test", variants, margins.left, margins.right);

    expect(template).toContain('width="3300"');
    expect(template).toContain('height="2200"');
    expect(template).toContain('viewBox="0 0 3300 2200"');
  });

  test("contains template-version element", () => {
    const parsed = parseSvg(
      `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`
    );
    const variants = generateVariants(parsed);
    const margins = calculateMargins(parsed);
    const template = buildTemplate("test", variants, margins.left, margins.right);

    expect(template).toMatch(/id="template-version"[^>]*>Template v\.2\.0<\/text>/);
  });

  test("contains all required group IDs", () => {
    const parsed = parseSvg(
      `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`
    );
    const variants = generateVariants(parsed);
    const margins = calculateMargins(parsed);
    const template = buildTemplate("test", variants, margins.left, margins.right);

    expect(template).toContain('id="Notes"');
    expect(template).toContain('id="Guides"');
    expect(template).toContain('id="Symbols"');
  });

  test("contains all 27 variant group IDs", () => {
    const parsed = parseSvg(
      `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`
    );
    const variants = generateVariants(parsed);
    const margins = calculateMargins(parsed);
    const template = buildTemplate("test", variants, margins.left, margins.right);

    const weights = [
      "Ultralight", "Thin", "Light", "Regular", "Medium",
      "Semibold", "Bold", "Heavy", "Black",
    ];
    const scales = ["S", "M", "L"];
    for (const w of weights) {
      for (const s of scales) {
        expect(template).toContain(`id="${w}-${s}"`);
      }
    }
  });

  test("contains guide lines at correct positions", () => {
    const parsed = parseSvg(
      `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>`
    );
    const variants = generateVariants(parsed);
    const margins = calculateMargins(parsed);
    const template = buildTemplate("test", variants, margins.left, margins.right);

    expect(template).toContain('id="Baseline-M"');
    expect(template).toContain('y1="1126"');
    expect(template).toContain('id="Capline-M"');
    expect(template).toContain('y1="1055.54"');
  });
});

describe("integration", () => {
  test("end-to-end with claude.svg fixture", async () => {
    const content = await Bun.file("test-fixtures/claude.svg").text();
    const parsed = parseSvg(content);
    const variants = generateVariants(parsed);
    const margins = calculateMargins(parsed);
    const template = buildTemplate("claude", variants, margins.left, margins.right);

    expect(template).toStartWith('<?xml version="1.0"');
    expect(template).toContain('id="template-version"');
    expect(template).toContain("Template v.2.0");
    expect(template).toContain(">claude</text>");
    expect(variants).toHaveLength(27);

    const openSvg = (template.match(/<svg/g) || []).length;
    const closeSvg = (template.match(/<\/svg>/g) || []).length;
    expect(openSvg).toBe(closeSvg);
  });
});
