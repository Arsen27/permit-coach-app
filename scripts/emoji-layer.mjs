// The concept→emoji layer shared by every state's conversational course
// generator: the concept map, the pictographic test, and the injector with
// its sparsity rules (one insertion per concept, at most two emoji per line).
// Kept in one place so a California and a Texas build mark the same concepts
// the same way.

export const EMOJI_CONCEPTS = [
  [/\bred curb\b/i, '🔴'],
  [/\byellow curb\b/i, '🟡'],
  [/\bwhite curb\b/i, '⚪'],
  [/\bgreen curb\b/i, '🟢'],
  [/\bblue curb\b/i, '🔵'],
  [/\bred lights?\b/i, '🔴'],
  [/\byellow lights?\b/i, '🟡'],
  [/\bgreen lights?\b/i, '🟢'],
  [/\bschool bus(?:es)?\b/i, '🚌'],
  [/\blight-rail|light rail\b/i, '🚈'],
  [/\brailroad\b|\btrains?\b/i, '🚆'],
  [/\bemergency vehicles?\b|\bambulances?\b/i, '🚑'],
  [/\bfire (?:station|hose|department)\b/i, '🚒'],
  [/\bpolice officers?\b|\bpeace officers?\b|\bpolice\b|\bofficers?\b/i, '👮'],
  [/\bpedestrians?\b/i, '🚶'],
  [/\bcrosswalks?\b/i, '🦓'],
  [/\bbicycles?\b|\b(?:bi)?cyclists?\b|\bbike lanes?\b/i, '🚲'],
  [/\bmotorcycles?\b|\bmotorcyclists?\b/i, '🏍️'],
  [/\btrucks?\b/i, '🚚'],
  [/\bbus(?:es)?\b/i, '🚌'],
  [/\bwork zones?\b/i, '🚧'],
  [/\bschool (?:zones?|areas?|crossings?)\b/i, '🏫'],
  [/\bstop signs?\b/i, '🛑'],
  [/\btraffic (?:lights?|signals?)\b/i, '🚦'],
  [/\bT[- ]intersections?\b/, '𝗧'],
  [/\bintersections?\b/i, '✛'],
  [/\broundabouts?\b/i, '🔄'],
  [/\bU-turns?\b/, '↩️'],
  [/\bcrash(?:es)?\b|\bcollisions?\b/i, '💥'],
  [/\bphones?\b/i, '📱'],
  [/\balcohol(?:ic)?\b/i, '🍺'],
  [/\bcannabis\b/i, '🌿'],
  [/\brain\b/i, '🌧️'],
  [/\bfog\b/i, '🌫️'],
  [/\bsmoke\b/i, '💨'],
  [/\bdust\b/i, '💨'],
  [/\bwind\b/i, '💨'],
  [/\bsnow(?:y|ing|fall)?\b/i, '❄️'],
  [/\bsun glare\b|\bsunlight\b|\bsun\b/i, '☀️'],
  [/\bnight\b/i, '🌙'],
  [/\bflaggers?\b/i, '👷'],
  [/\bhorn\b/i, '📢'],
  [/\bkeys\b/i, '🔑'],
  [/\brear-facing\b/i, '👶'],
  [/\bchildren\b|\bchild\b/i, '🧒'],
  [/\banimals?\b|\blivestock\b|\bdeer\b/i, '🦌'],
  [/\bmirrors?\b/i, '🪞'],
  [/\bblind spots?\b/i, '👀'],
  [/\bfreeways?\b/i, '🛣️'],
  [
    /\bvehicle traffic\b|\btraffic\b(?! (?:lights?|signals?))|(?<!emergency )(?<!slow-moving )\bvehicles?\b|\bcars?\b(?! seats?)/i,
    '🚗',
  ],
];
export const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

export const injectEmoji = (text, budget, usedEmoji) => {
  if (budget.count <= 0) return text;
  let result = text;
  for (const [pattern, emoji] of EMOJI_CONCEPTS) {
    if (budget.count <= 0) break;
    if (usedEmoji.has(emoji)) continue;
    const match = result.match(pattern);
    if (match == null) continue;
    // Keep any single line at two emoji at most (count the whole line — an
    // earlier pass may already have injected after the match position).
    const lineStart = result.lastIndexOf('\n', match.index - 1) + 1;
    const lineEndBreak = result.indexOf('\n', match.index);
    const line = result.slice(
      lineStart,
      lineEndBreak === -1 ? result.length : lineEndBreak,
    );
    const lineEmoji = [...line].filter(ch => EMOJI_PATTERN.test(ch)).length;
    if (lineEmoji >= 2) continue;
    result =
      result.slice(0, match.index) + `${emoji} ` + result.slice(match.index);
    usedEmoji.add(emoji);
    budget.count -= 1;
  }
  return result;
};

// Dense variant used by the skeleton builder: every mention of a concept gets
// its emoji, not only the first, with exactly one space between the emoji and
// the word (and a space before the emoji when it would otherwise touch a
// letter). Overlaps are resolved in vocabulary order — "school bus" wins over
// "bus", "traffic light" over "traffic" — and a word already carrying its
// emoji is left alone. Recall rules, questions and titles never get emoji.
export const injectEmojiEverywhere = text => {
  if (text == null || text.length === 0) return text;
  const taken = [];
  const inserts = [];
  const overlaps = (start, end) =>
    taken.some(([s, e]) => start < e && end > s);
  for (const [pattern, emoji] of EMOJI_CONCEPTS) {
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    const global = new RegExp(pattern.source, flags);
    for (const match of text.matchAll(global)) {
      const start = match.index;
      const end = start + match[0].length;
      if (match[0].length === 0 || overlaps(start, end)) continue;
      // Already marked in the source text.
      const before = text.slice(Math.max(0, start - emoji.length - 1), start);
      if (before === `${emoji} `) {
        taken.push([start, end]);
        continue;
      }
      taken.push([start, end]);
      inserts.push({ at: start, emoji });
    }
  }
  inserts.sort((a, b) => a.at - b.at);
  let out = '';
  let cursor = 0;
  for (const { at, emoji } of inserts) {
    out += text.slice(cursor, at);
    const previous = out.at(-1);
    if (previous != null && /[\p{L}\p{N}]/u.test(previous)) out += ' ';
    out += `${emoji} `;
    cursor = at;
  }
  out += text.slice(cursor);
  return out;
};
