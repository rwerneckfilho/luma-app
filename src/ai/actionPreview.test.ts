import { actionIsExpired, medicationActionPreview } from "./actionPreview";
import type { PendingAction } from "./contracts";

const action: PendingAction = {
  action_id: "00000000-0000-4000-8000-000000000001",
  capability_id: "medications.create-with-routines",
  confirmation_ref: "opaque-confirmation-reference",
  expires_at: "2026-07-18T15:10:00.000Z",
  presented_preview_hash: "1".repeat(64),
  preview: {
    body: "Medicamento: Exemplo\nRotina 1: manhã",
    canonical_sha256: "2".repeat(64),
    canonical_version: "luma.medication-proposal.v1",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    title: "Confirme o medicamento e as rotinas",
    warnings: [
      {
        code: "confirmation_required",
        message: "Revise todos os dados antes de confirmar.",
      },
    ],
  },
};

describe("medication confirmation preview", () => {
  it("accepts the exact bounded Core preview without returning confirmation secrets", () => {
    expect(medicationActionPreview(action)).toEqual({
      body: "Medicamento: Exemplo\nRotina 1: manhã",
      canonicalSha256: "2".repeat(64),
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      title: "Confirme o medicamento e as rotinas",
      warnings: [
        {
          code: "confirmation_required",
          message: "Revise todos os dados antes de confirmar.",
        },
      ],
    });
    expect(JSON.stringify(medicationActionPreview(action))).not.toContain(
      action.confirmation_ref,
    );
  });

  it.each([
    ["unknown capability", { ...action, capability_id: "profile.update" }],
    [
      "extra preview field",
      { ...action, preview: { ...action.preview, actor_user_id: "forged" } },
    ],
    [
      "wrong canonical version",
      {
        ...action,
        preview: {
          ...action.preview,
          canonical_version: "luma.medication-proposal.v2",
        },
      },
    ],
    [
      "duplicate warnings",
      {
        ...action,
        preview: {
          ...action.preview,
          warnings: [
            (action.preview as { warnings: unknown[] }).warnings[0],
            (action.preview as { warnings: unknown[] }).warnings[0],
          ],
        },
      },
    ],
  ])("fails closed for %s", (_name, candidate) => {
    expect(medicationActionPreview(candidate as PendingAction)).toBeNull();
  });

  it("treats invalid and elapsed expiries as expired", () => {
    const before = Date.parse("2026-07-18T15:09:59.999Z");
    const atExpiry = Date.parse(action.expires_at);
    expect(actionIsExpired(action, before)).toBe(false);
    expect(actionIsExpired(action, atExpiry)).toBe(true);
    expect(actionIsExpired({ ...action, expires_at: "invalid" }, before)).toBe(
      true,
    );
  });
});
