import type { StorySentinelWarning } from './storySentinel';

export interface LorePool {
  character: string[];
  setting: string[];
  event: string[];
  theme: string[];
  backstory: string[];
  prop: string[];
}

// Module-level state
const recentLoreTerms: Set<string>[] = [];

export function extractLorePool(userInput: string): LorePool {
  const pool: LorePool = {
    character: [],
    setting: [],
    event: [],
    theme: [],
    backstory: [],
    prop: []
  };

  const regex = /(?:^|[,;])\s*(character|setting|event|theme|backstory|prop)\s*:\s*([^,;]+)/gi;
  let match;

  while ((match = regex.exec(userInput)) !== null) {
    const type = match[1].toLowerCase() as keyof LorePool;
    const value = match[2].trim();
    if (value) {
      pool[type].push(value);
    }
  }

  return pool;
}

export function runThreeClueRule(lorePool: LorePool): StorySentinelWarning[] {
  const warnings: StorySentinelWarning[] = [];

  // 1. Count populated anchor types
  let populatedCount = 0;
  const currentTerms = new Set<string>();

  for (const [, values] of Object.entries(lorePool)) {
    if (values.length > 0) {
      populatedCount++;
      for (const val of values) {
        currentTerms.add(val.toLowerCase());
      }
    }
  }

  if (populatedCount <= 1) {
    warnings.push({
      code: 'three_clue_underconnected',
      message: 'This beat may be underconnected. Consider adding another connective clue.'
    });
  }

  // 2. Check overlap with recent lore terms
  if (recentLoreTerms.length > 0 && currentTerms.size > 0) {
    let hasOverlap = false;
    for (const recentSet of recentLoreTerms) {
      for (const term of currentTerms) {
        if (recentSet.has(term)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    if (!hasOverlap) {
      warnings.push({
        code: 'three_clue_no_thread_continuity',
        message: 'No lore threads connect to recent beats. Consider reusing a character or setting.'
      });
    }
  }

  // Update recent lore terms
  recentLoreTerms.push(currentTerms);
  if (recentLoreTerms.length > 8) {
    recentLoreTerms.shift(); // Keep max 8
  }

  return warnings;
}
