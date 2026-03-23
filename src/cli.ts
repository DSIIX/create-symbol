#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { parseSvg, generateVariants, calculateMargins, buildTemplate } from "./index";

function parseArgs(): { input: string; name: string; output: string } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: create-symbol <input.svg> [--name <symbol-name>] [--output <output.svg>]

Input can be a file path or a URL (http/https).

Options:
  --name    Symbol name (defaults to input filename without extension)
  --output  Output file path (defaults to <name>.sfsymbol.svg)
  --help    Show this help message`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const input = args[0];
  let name: string | undefined;
  let output: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[++i];
    }
  }

  if (!name) {
    // Derive name from input filename or URL path
    const basename = input.split("/").pop()!.split("?")[0];
    name = basename.replace(/\.svg$/i, "");
  }

  if (!output) {
    output = `${name}.sfsymbol.svg`;
  }

  return { input, name, output };
}

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

async function readInput(input: string): Promise<string> {
  if (isUrl(input)) {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${input}: ${response.status} ${response.statusText}`
      );
    }
    return response.text();
  }

  return readFileSync(input, "utf-8");
}

async function main() {
  const { input, name, output } = parseArgs();

  const content = await readInput(input);
  const parsed = parseSvg(content);

  console.log(
    `Parsed SVG: ${parsed.viewBox.width}x${parsed.viewBox.height}, ${parsed.paths.length} path(s)`
  );

  // Generate variants and margins
  const variants = generateVariants(parsed);
  const margins = calculateMargins(parsed);

  console.log(
    `Generated ${variants.length} variants (9 weights × 3 scales)`
  );

  // Build and write template
  const template = buildTemplate(name, variants, margins.left, margins.right);
  writeFileSync(output, template);

  console.log(`Written to ${output}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
