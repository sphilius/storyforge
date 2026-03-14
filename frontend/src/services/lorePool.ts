import type { StorySentinelWarning } from './storySentinel';

export interface LorePool {
  character: string[];
  setting: string[];
  event: string[];
  theme: string[];
  backstory: string[];
  prop: string[];
}

const recentLoreTerms: Set<string>[] = []; // last 8 sets of lore terms

export function extractLorePool(userInput: string): LorePool {
  const pool: LorePool = {
    character: [],
    setting: [],
    event: [],
    theme: [],
    backstory: [],
    prop: [],
  };

  const regex = /(?:^|[,;])\s*(character|setting|event|theme|backstory|prop)\s*:\s*([^,;]+)/gi;
  let match;

  while ((match = regex.exec(userInput)) !== null) {
    const key = match[1].toLowerCase() as keyof LorePool;
    const value = match[2].trim();
    if (value) {
      pool[key].push(value);
    }
  }

  return pool;
}

export function runThreeClueRule(lorePool: LorePool): StorySentinelWarning[] {
  const warnings: StorySentinelWarning[] = [];
  let populatedAnchorCount = 0;
  const currentTerms = new Set<string>();

  for (const values of Object.values(lorePool)) {
    if (values && values.length > 0) {
      populatedAnchorCount++;
      for (const value of values) {
        currentTerms.add(value.toLowerCase());
      }
    }
  }

  if (populatedAnchorCount <= 1) {
    warnings.push({
      code: 'three_clue_underconnected',
      message: 'This beat may be underconnected. Consider adding another connective clue.'
    });
  }

  if (recentLoreTerms.length > 0) {
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
    recentLoreTerms.shift();
  }

  return warnings;
}
