export const MUTUALLY_EXCLUSIVE_TAG_GROUPS = [
  ['AM5', 'AM4', 'Intel'],
  ['50 Series', '40 Series', '30 Series', 'AMD'],
  ['ATX', 'mATX', 'ITX'],
  ['ATX', 'SFX'],
  ['DDR5', 'DDR4'],
  ['GEN5', 'GEN4', 'GEN3', 'SATA'],
  ['360mm', '280mm', '240mm', 'Air Cooler'],
  ['ATX 3.0 / 3.1', 'Standard'],
  ['Black', 'White'],
  ['RGB', 'Non-RGB']
];

export function enforceMutualExclusivity(tags: string[]): string[] {
  const finalTags: string[] = [];
  const usedGroups = new Set<number>();

  for (const tag of [...tags].reverse()) {
    const groupIndex = MUTUALLY_EXCLUSIVE_TAG_GROUPS.findIndex(group => group.includes(tag));
    if (groupIndex !== -1) {
      if (!usedGroups.has(groupIndex)) {
        finalTags.unshift(tag);
        usedGroups.add(groupIndex);
      }
    } else {
      finalTags.unshift(tag);
    }
  }
  return finalTags;
}

export function mergeComponentTagsNonDestructively(existingTags: string[], newTags: string[]): string[] {
  const combined = [...existingTags, ...newTags];
  const unique = Array.from(new Set(combined));
  return enforceMutualExclusivity(unique);
}
