import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { segmentMarkdownSpokenCorpus, publicCorpusManifest } from "../corpus/segment-markdown.mjs";
import { assessSpokenSampleHealth } from "../health/sample-health.mjs";
import { analyzeSevenLayers } from "../analyzers/seven-layers.mjs";
import { buildDraftSpokenDna } from "../fusion/build-draft-dna.mjs";
import { renderDraftMarkdown } from "../render/draft-markdown.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...rest] = argument.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));

if (!options.source || !options["corpus-id"] || !options["style-id"] || !options.name) {
  throw new Error("用法：node style-engine/cli/build-spoken-dna.mjs --source=<路径> --corpus-id=<ID> --style-id=<ID> --name=<显示名> [--out=<目录>]");
}

const sourcePath = resolve(String(options.source));
const outputDirectory = resolve(options.out || `style-engine/profiles/${options["style-id"]}/draft`);
const text = await readFile(sourcePath, "utf8");
const frameworkMap = options["framework-map"]
  ? JSON.parse(await readFile(resolve(String(options["framework-map"])), "utf8"))
  : { frameworks: [] };
if (frameworkMap.profile_id && frameworkMap.profile_id !== options["style-id"]) {
  throw new Error("框架库 profile_id 与 --style-id 不一致。 ");
}
const corpus = segmentMarkdownSpokenCorpus(text, { corpusId: options["corpus-id"], sourcePath });
const health = assessSpokenSampleHealth(corpus);
const analysis = analyzeSevenLayers(corpus);
const dna = buildDraftSpokenDna({ corpus, health, analysis, styleId: options["style-id"], displayName: options.name, frameworks: frameworkMap.frameworks || [] });

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, "corpus-manifest.json"), `${JSON.stringify(publicCorpusManifest(corpus), null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDirectory, "sample-health.json"), `${JSON.stringify(health, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDirectory, "seven-layer-observations.json"), `${JSON.stringify(analysis.layers, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDirectory, "style-dna.draft.json"), `${JSON.stringify(dna, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDirectory, "Style-DNA.draft.md"), renderDraftMarkdown(dna), "utf8"),
]);

process.stdout.write(`${JSON.stringify({ ok: true, status: dna.status, approval: dna.approval, output_directory: outputDirectory, unit_count: corpus.units.length, candidate_rule_count: dna.rules.length, framework_count: dna.frameworks.length, health_grade: health.grade }, null, 2)}\n`);
