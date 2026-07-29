export const VISUAL_TIME_ZONE = "America/Sao_Paulo";
export const VISUAL_NOW_ISO = "2026-06-18T12:00:00-03:00";

export type VisualClock = Readonly<{
  now: () => Date;
  nowIso: () => string;
  timeZone: string;
}>;

export function createVisualClock(
  iso = VISUAL_NOW_ISO,
  timeZone = VISUAL_TIME_ZONE,
): VisualClock {
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) throw new Error(`Invalid visual clock ISO value: ${iso}`);

  return Object.freeze({
    now: () => new Date(epoch),
    nowIso: () => iso,
    timeZone,
  });
}

export const visualClock = createVisualClock();

