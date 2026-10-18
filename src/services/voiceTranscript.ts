// Recognition engines may replay a finalized prefix after updating or restarting.
// Merge only overlapping result boundaries; preserve repetitions inside an utterance.
export function mergeVoiceSegments(segments: Iterable<string>): string {
  let words: string[] = [];
  const key = (word: string) => word.toLocaleLowerCase('pt-BR').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  for (const segment of segments) {
    const next = segment.trim().split(/\s+/).filter(Boolean);
    if (!next.length) continue;
    let overlap = Math.min(words.length, next.length);
    while (overlap > 0 && !next.slice(0, overlap).every((word, i) => key(word) === key(words[words.length - overlap + i]))) overlap -= 1;
    words = [...words, ...next.slice(overlap)];
  }
  return words.join(' ');
}
