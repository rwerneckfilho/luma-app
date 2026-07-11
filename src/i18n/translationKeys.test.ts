import fs from "node:fs";
import path from "node:path";
import en from "./locales/en.json";
import es from "./locales/es.json";
import ptBR from "./locales/pt-BR.json";

const SOURCE_ROOT = path.resolve(__dirname, "..");
const LITERAL_TRANSLATION = /\bt\(\s*["']([^"']+)["']/g;

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [target] : [];
  });
}

function valueAtPath(resource: unknown, key: string) {
  return key.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object" || !(segment in value)) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, resource);
}

describe("literal translation keys", () => {
  const keys = new Set<string>();
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(LITERAL_TRANSLATION)) keys.add(match[1]);
  }

  it.each([
    ["pt-BR", ptBR],
    ["en", en],
    ["es", es],
  ])("uses leaf keys present in %s", (_locale, resource) => {
    const invalid = [...keys].filter((key) => {
      const value = valueAtPath(resource, key);
      return typeof value !== "string";
    });
    expect(invalid).toEqual([]);
  });
});
