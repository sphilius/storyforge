export interface StorySentinelWarning {
  code: string;
  message: string;
}

// Module-level state (persists across calls within a session)
const recentInputs: string[] = [];
const recentGenericFlags: boolean[] = [];

// Helper functions
function normalizeInput(input: string): string {
  // lowercase, remove non-alphanumeric (except spaces), collapse whitespace
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(' '));
  const set2 = new Set(str2.split(' '));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function runStorySentinel(
  userInput: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  directorResponse: string // Kept for matching the interface although not used directly in current checks
): StorySentinelWarning[] {
  const warnings: StorySentinelWarning[] = [];
  const normalizedInput = normalizeInput(userInput);
  const words = normalizedInput.split(' ').filter(w => w.length > 0);

  // 1. duplicate_or_near_duplicate_intent
  let isDuplicate = false;
  for (const recentInput of recentInputs) {
    if (calculateJaccardSimilarity(normalizedInput, recentInput) >= 0.85) {
      isDuplicate = true;
      break;
    }
  }
  if (isDuplicate) {
    warnings.push({
      code: 'duplicate_or_near_duplicate_intent',
      message: 'This beat intent looks very similar to a recent beat.'
    });
  }

  // 2. likely_vague_beat_title
  const genericTitles = ['beat', 'scene', 'story', 'next', 'continue', 'idea', 'moment'];
  const isVagueTitle = words.length <= 2 || genericTitles.includes(normalizedInput);
  if (isVagueTitle) {
    warnings.push({
      code: 'likely_vague_beat_title',
      message: 'Beat intent may be too vague. Add a concrete subject or action.'
    });
  }

  // 3. likely_missing_context_signal
  const contextKeywords = ['who', 'where', 'when', 'because', 'after', 'before', 'during', 'inside', 'outside', 'city', 'room', 'forest', 'ship', 'king', 'detective'];
  const containsContextKeyword = words.some(word => contextKeywords.includes(word));
  const containsDigit = /\d/.test(userInput);

  if (words.length < 4 && !containsContextKeyword && !containsDigit) {
    warnings.push({
      code: 'likely_missing_context_signal',
      message: 'Beat may be missing context. Add who/where/when details.'
    });
  }

  // 4. likely_escalation_flatness
  const genericPatterns = ['continue', 'next beat', 'something happens', 'move forward', 'keep going', 'what happens next'];
  const isGenericPattern = genericPatterns.includes(normalizedInput);

  // Check if at least 2 of the last 3 recentGenericFlags are true
  const recentFlagsToCheck = recentGenericFlags.slice(-3);
  const genericFlagsCount = recentFlagsToCheck.filter(flag => flag).length;

  if (isGenericPattern && genericFlagsCount >= 2) {
    warnings.push({
      code: 'likely_escalation_flatness',
      message: 'Recent beats look structurally similar. Consider a sharper escalation.'
    });
  }

  // State Updates
  recentInputs.push(normalizedInput);
  if (recentInputs.length > 10) {
    recentInputs.shift(); // Keep max 10
  }

  recentGenericFlags.push(isGenericPattern);
  if (recentGenericFlags.length > 8) {
    recentGenericFlags.shift(); // Keep max 8
  }

  return warnings;
}
