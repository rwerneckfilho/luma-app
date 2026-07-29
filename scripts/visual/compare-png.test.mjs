import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import pngjs from "pngjs";
import { comparePng } from "./compare-png.mjs";

const { PNG } = pngjs;

test("accepts identical PNG files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "luma-visual-"));
  const baseline = join(directory, "baseline.png");
  const actual = join(directory, "actual.png");
  const image = new PNG({ width: 1, height: 1 });
  image.data.set([0, 118, 128, 255]);
  const png = PNG.sync.write(image);
  await Promise.all([writeFile(baseline, png), writeFile(actual, png)]);

  const result = await comparePng({ baseline, actual, diff: null, threshold: 0.1, maxDiffPixels: 0 });
  assert.equal(result.passed, true);
  assert.equal(result.diffPixels, 0);
});
