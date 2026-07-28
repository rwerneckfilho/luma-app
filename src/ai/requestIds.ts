export function createClientRequestId(random: () => number = Math.random) {
  const bytes = Array.from({ length: 16 }, () => {
    const candidate = random();
    const value = Number.isFinite(candidate) ? candidate : 0;
    return Math.floor(Math.max(0, Math.min(value, 0.999999999999)) * 256);
  });

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map((value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
