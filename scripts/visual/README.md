# Visual screenshot comparison

The comparator runs dependency-free in exact-byte mode. Once `pixelmatch` and `pngjs` are available to the app, it automatically decodes the PNGs, calculates differing pixels, and can write a visual diff.

```sh
node scripts/visual/compare-png.mjs baseline/home-full.png artifacts/home-full.png
node scripts/visual/compare-png.mjs baseline/home-full.png artifacts/home-full.png \
  --diff artifacts/diff/home-full.png --threshold 0.1 --max-diff-pixels 20
```

Exit codes: `0` match, `1` visual mismatch, `2` invalid invocation or runtime failure.

