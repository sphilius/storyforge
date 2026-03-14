export interface StorySentinelWarning {
  code: string;
  message: string;
}

const recentInputs: string[] = []; // last 10 normalized inputs
const recentGenericFlags: boolean[] = []; // last 8 generic pattern flags

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(' ').filter(Boolean));
  const set2 = new Set(str2.split(' ').filter(Boolean));
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

const GENERIC_TITLES = new Set([
  'beat', 'scene', 'story', 'next', 'continue', 'idea', 'moment'
]);

const CONTEXT_KEYWORDS = new Set([
  'who', 'where', 'when', 'because', 'after', 'before', 'during',
  'inside', 'outside', 'city', 'room', 'forest', 'ship', 'king', 'detective'
]);

const GENERIC_PATTERNS = new Set([
  'continue', 'next beat', 'something happens', 'move forward', 'keep going', 'what happens next'
]);

export function runStorySentinel(
  userInput: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  directorResponse: string
): StorySentinelWarning[] {
  const warnings: StorySentinelWarning[] = [];
  const normalized = normalizeInput(userInput);
  const words = normalized.split(' ').filter(Boolean);
  const wordCount = words.length;

  // 1. duplicate_or_near_duplicate_intent
  let hasDuplicate = false;
  for (const recent of recentInputs) {
    if (getJaccardSimilarity(normalized, recent) >= 0.85) {
      hasDuplicate = true;
      break;
    }
  }
  if (hasDuplicate) {
    warnings.push({
      code: 'duplicate_or_near_duplicate_intent',
      message: 'This beat intent looks very similar to a recent beat.'
    });
  }

  // 2. likely_vague_beat_title
  if (wordCount <= 2 || GENERIC_TITLES.has(normalized)) {
    warnings.push({
      code: 'likely_vague_beat_title',
      message: 'Beat intent may be too vague. Add a concrete subject or action.'
    });
  }

  // 3. likely_missing_context_signal
  const hasContextKeyword = words.some(w => CONTEXT_KEYWORDS.has(w));
  const hasDigit = /\d/.test(userInput);
  if (wordCount < 4 && !hasContextKeyword && !hasDigit) {
    warnings.push({
      code: 'likely_missing_context_signal',
      message: 'Beat may be missing context. Add who/where/when details.'
    });
  }

  // 4. likely_escalation_flatness
  const isGenericPattern = GENERIC_PATTERNS.has(normalized);

  // count how many of the last 3 are true
  const last3Flags = recentGenericFlags.slice(-3);
  const trueCount = last3Flags.filter(Boolean).length;

  if (isGenericPattern && trueCount >= 2) {
    warnings.push({
      code: 'likely_escalation_flatness',
      message: 'Recent beats look structurally similar. Consider a sharper escalation.'
    });
  }

  // Update module state
  recentInputs.push(normalized);
  if (recentInputs.length > 10) {
    recentInputs.shift();
  }

  recentGenericFlags.push(isGenericPattern);
  if (recentGenericFlags.length > 8) {
    recentGenericFlags.shift();
  }

  return warnings;
}
