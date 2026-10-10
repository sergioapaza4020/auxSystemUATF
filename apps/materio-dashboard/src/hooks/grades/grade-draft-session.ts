import { getGradeChanges, type GradeDrafts, type GradeOriginals } from './grade-matrix-state';

export function readGradeDraftSession(value: string | null): { originals: GradeOriginals; drafts: GradeDrafts } {
  const empty = { originals: {}, drafts: {} };

  if (!value) return empty;

  try {
    const stored: unknown = JSON.parse(value);

    if (!stored || typeof stored !== 'object' || !('drafts' in stored) || !('originals' in stored)) return empty;
    if (
      !stored.drafts ||
      typeof stored.drafts !== 'object' ||
      !stored.originals ||
      typeof stored.originals !== 'object'
    )
      return empty;

    const originals: GradeOriginals = {};
    const drafts: GradeDrafts = {};

    for (const [key, value] of Object.entries(stored.drafts)) {
      const original: unknown = Object.getOwnPropertyDescriptor(stored.originals, key)?.value;

      if (
        !/^[1-9]\d*:[1-9]\d*$/.test(key) ||
        typeof value !== 'string' ||
        value.length > 100 ||
        !(
          original === null ||
          (typeof original === 'number' && Number.isFinite(original) && original >= 0 && original <= 100)
        )
      )
        continue;
      drafts[key] = value;
      originals[key] = original;
    }

    return { originals, drafts };
  } catch {
    return empty;
  }
}

export function serializeGradeDraftSession(originals: GradeOriginals, drafts: GradeDrafts): string | null {
  const changes = getGradeChanges(originals, drafts);

  if (!changes.length) return null;

  return JSON.stringify({
    drafts: Object.fromEntries(changes.map((change) => [change.key, drafts[change.key]])),
    originals: Object.fromEntries(changes.map((change) => [change.key, originals[change.key] ?? null])),
  });
}
