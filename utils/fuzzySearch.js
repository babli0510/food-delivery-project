// Lightweight fuzzy text matching — no external dependency needed.
// MongoDB's $text search is stemmed/exact-token based, so it doesn't tolerate
// typos or partial keywords (e.g. "biriyani" vs "biryani"). This module adds
// edit-distance based fuzzy matching on top of it.

// Classic Levenshtein edit distance between two strings.
const levenshtein = (a, b) => {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    prevRow = currRow;
  }
  return prevRow[n];
};

// Similarity in [0, 1]; 1 = identical, tolerant of typos relative to word length.
const similarity = (a, b) => {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
};

const tokenize = (text) =>
  (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Scores how well a restaurant's searchable fields (name + cuisines) match a
 * free-text query, tolerating typos and partial keywords.
 * Returns a score in [0, 1]; 0 means "no reasonable match".
 */
const fuzzyMatchScore = (restaurant, query) => {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return 0;

  const candidateWords = tokenize(restaurant.name).concat(
    (restaurant.cuisine || []).flatMap((c) => tokenize(c))
  );
  if (!candidateWords.length) return 0;

  let totalScore = 0;
  for (const qToken of queryTokens) {
    let bestForToken = 0;
    for (const word of candidateWords) {
      // Substring/partial-keyword match scores highly outright
      if (word.includes(qToken) || qToken.includes(word)) {
        bestForToken = Math.max(bestForToken, 0.9);
        continue;
      }
      // Typo tolerance via edit distance, scaled by token length so short
      // words require closer matches than long ones.
      const sim = similarity(qToken, word);
      const allowedErrorRate = qToken.length <= 4 ? 0.25 : 0.4;
      if (1 - sim <= allowedErrorRate) {
        bestForToken = Math.max(bestForToken, sim);
      }
    }
    totalScore += bestForToken;
  }

  return totalScore / queryTokens.length;
};

// Minimum score to be considered a fuzzy match at all.
const FUZZY_MATCH_THRESHOLD = 0.55;

module.exports = { levenshtein, similarity, fuzzyMatchScore, FUZZY_MATCH_THRESHOLD };
