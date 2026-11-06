# Changelog

## 1.8.0 (unreleased)

First release as its own package. The schemas were copied from cobblemon-addon-vscode (extension
0.11.0, commit 3f13889), with these fixes:

- Spawn pool files accept `"type": "empty"` spawns, which don't need an `id`. Cobblemon 1.8.2's own
  `0000_empty.json` uses them.
- Spawn bait effects no longer require `value`. Some stock berries leave it out.
- Bedrock posers accept `profilePokedexScale`, `profilePokedexTranslation`, `profileSummaryScale` and
  `profileSummaryTranslation`.
