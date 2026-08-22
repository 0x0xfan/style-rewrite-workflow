const lineAt = (text, index) => text.slice(0, index).split("\n").length;

const cleanHeading = (heading) => heading.replace(/\*|`/g, "").trim();

export const normalizeForComparison = (text) => text
  .toLowerCase()
  .replace(/[\s\p{P}\p{S}]/gu, "")
  .trim();

export const estimateSeconds = (characterCount, charsPerMinute = 240) => (
  Math.max(1, Math.round((characterCount / charsPerMinute) * 60))
);

// A source document can have one H1 label and many H2 spoken-script units.
// Only H2 is a unit boundary; this prevents the document title from becoming a ninth sample.
export const segmentMarkdownSpokenCorpus = (text, { corpusId, sourcePath, charsPerMinute = 240 }) => {
  const matches = [...text.matchAll(/^##\s+(.+?)\s*$/gm)];
  if (matches.length === 0) throw new Error("未找到 ## 口播单元标题；请先规范参考文案的分段。 ");

  const units = matches.map((match, index) => {
    const headingEnd = match.index + match[0].length;
    const nextStart = matches[index + 1]?.index ?? text.length;
    const body = text.slice(headingEnd, nextStart).trim();
    const characterCount = normalizeForComparison(body).length;
    return {
      id: `${corpusId}:u${String(index + 1).padStart(2, "0")}`,
      ordinal: index + 1,
      title: cleanHeading(match[1]),
      source_line_start: lineAt(text, match.index),
      source_line_end: lineAt(text, Math.max(headingEnd, nextStart - 1)),
      character_count: characterCount,
      estimated_seconds: estimateSeconds(characterCount, charsPerMinute),
      text: body,
    };
  });

  return {
    corpus_id: corpusId,
    source_path: sourcePath,
    segmentation: {
      strategy: "markdown_h2_spoken_units",
      title_counts_as_unit: false,
      chars_per_minute: charsPerMinute,
    },
    units,
  };
};

export const publicCorpusManifest = (corpus) => ({
  corpus_id: corpus.corpus_id,
  source_path: corpus.source_path,
  segmentation: corpus.segmentation,
  unit_count: corpus.units.length,
  units: corpus.units.map(({ text, ...unit }) => unit),
});
