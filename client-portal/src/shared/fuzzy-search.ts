/**
 * Typo-Tolerant Fuzzy Search Engine — BillDoor (§5.4)
 * 
 * Performs substring, token-level, Damerau-Levenshtein distance (with transposition),
 * and sliding window matching for catalog items.
 * Example: 'mufin' matches 'Muffin', 'bleu berry' matches 'Blueberry Cake'.
 */

function damerauLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const d: number[][] = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return d[a.length][b.length];
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s]/g, ' ')  // remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true if query fuzzy matches target text.
 */
export function fuzzyMatch(query: string, targetText: string): boolean {
  if (!query || !query.trim()) return true;
  if (!targetText) return false;

  const cleanQuery = normalize(query);
  const cleanTarget = normalize(targetText);

  // 1. Direct substring match
  if (cleanTarget.includes(cleanQuery)) return true;

  // 2. Tokenized matching
  const queryTokens = cleanQuery.split(' ').filter(Boolean);
  const targetTokens = cleanTarget.split(' ').filter(Boolean);

  if (queryTokens.length === 0) return true;

  // Every token in the query must match at least one token or sub-word in target
  return queryTokens.every((qToken) => {
    // Check direct substring in full target
    if (cleanTarget.includes(qToken)) return true;

    // Check token-by-token fuzzy distance
    return targetTokens.some((tToken) => {
      if (tToken.includes(qToken) || qToken.includes(tToken)) return true;

      // Allow distance based on word length
      const maxDist = qToken.length <= 3 ? 1 : 2;
      const dist = damerauLevenshteinDistance(qToken, tToken);
      if (dist <= maxDist) return true;

      // Sliding window sub-word check for compound words (e.g., bleu vs blueberry)
      if (tToken.length >= qToken.length) {
        const windowSize = qToken.length;
        for (let i = 0; i <= tToken.length - windowSize; i++) {
          const sub = tToken.substring(i, i + windowSize);
          if (damerauLevenshteinDistance(qToken, sub) <= 1) return true;
        }
      }

      return false;
    });
  });
}
