#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function usage() {
  return "Usage: node scripts/visual/compare-png.mjs <baseline.png> <actual.png> [--diff <diff.png>] [--threshold <0..1>] [--max-diff-pixels <n>]";
}

function parseArgs(argv) {
  const positional = [];
  const options = { threshold: 0.1, maxDiffPixels: 0, diff: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--diff") options.diff = argv[++index];
    else if (value === "--threshold") options.threshold = Number(argv[++index]);
    else if (value === "--max-diff-pixels") options.maxDiffPixels = Number(argv[++index]);
    else positional.push(value);
  }
  if (positional.length !== 2) throw new Error(usage());
  if (!(options.threshold >= 0 && options.threshold <= 1)) throw new Error("--threshold must be between 0 and 1");
  if (!Number.isInteger(options.maxDiffPixels) || options.maxDiffPixels < 0) throw new Error("--max-diff-pixels must be a non-negative integer");
  return { actual: resolve(positional[1]), baseline: resolve(positional[0]), ...options };
}

async function loadPixelmatch() {
  try {
    const [{ PNG }, pixelmatchModule] = await Promise.all([import("pngjs"), import("pixelmatch")]);
    return { PNG, pixelmatch: pixelmatchModule.default ?? pixelmatchModule };
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

export async function comparePng(options) {
  const [baselineBuffer, actualBuffer] = await Promise.all([readFile(options.baseline), readFile(options.actual)]);
  const integration = await loadPixelmatch();

  if (!integration) {
    const equal = baselineBuffer.equals(actualBuffer);
    return { engine: "exact-bytes", passed: equal, diffPixels: equal ? 0 : null, dimensions: null, reason: equal ? null : "Install pixelmatch and pngjs to calculate a pixel diff." };
  }

  const { PNG, pixelmatch } = integration;
  const baseline = PNG.sync.read(baselineBuffer);
  const actual = PNG.sync.read(actualBuffer);
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return { engine: "pixelmatch", passed: false, diffPixels: null, dimensions: { baseline: [baseline.width, baseline.height], actual: [actual.width, actual.height] }, reason: "Image dimensions differ." };
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const diffPixels = pixelmatch(baseline.data, actual.data, diff.data, baseline.width, baseline.height, { threshold: options.threshold });
  if (options.diff) {
    await mkdir(dirname(options.diff), { recursive: true });
    await writeFile(options.diff, PNG.sync.write(diff));
  }
  return { engine: "pixelmatch", passed: diffPixels <= options.maxDiffPixels, diffPixels, dimensions: [baseline.width, baseline.height], reason: null };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await comparePng(options);
    process.stdout.write(`${JSON.stringify({ baseline: options.baseline, actual: options.actual, ...result }, null, 2)}\n`);
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) await main();

