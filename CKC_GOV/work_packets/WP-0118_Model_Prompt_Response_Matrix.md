# Work Packet: WP-0118 - Model × Prompt response matrix

Date: 2026-05-07
Owner: Codex
Status: CONCEPT (brainstorm-only; not for current work; not implementation-grade)

> **Stage marker.** This file is a thinking document. It is NOT a ready-to-implement WP. The research-first methodology (PROJECT_CODEX) has not been run; design open questions are unresolved; storage shape, capture surface, and inference loop are all undecided. Promote to DRAFT only after a brainstorm pass with the operator + a prior-art research pass per the codex rule.

---

## The idea (one paragraph)

CKC stores generated images alongside their full ComfyUI workflow + metadata + prompts (WP-0109). That dataset is, accidentally, a record of how each diffusion model reacts to specific prompt tokens. A **Model × Prompt Response Matrix** would surface that latent knowledge — making it queryable, comparable across models, and useful for the operator's next prompt. "When I add `(8k, ultra-detailed)` to model X, what actually changes? Does adding `low quality` to negative on model Y do anything?" Today the answer is "operator memory + screenshots in a folder." It should be CKC-native data.

This is explicitly about **positive and negative prompts** across ComfyUI or any other generator CKC later ingests. The future design should record the prompt input, the model/runtime context, the output image, and the observed behavior so the operator can build a per-model prompting playbook from evidence instead of memory.

## Why this might be valuable

- **Prompt portability is already a known pain point**: a prompt that nails the look on SDXL Pony often does nothing or wrong things on SDXL Illustrious / Flux / Chroma / Flux.2. Every model has a tokenizer + training-distribution fingerprint that the operator currently rediscovers manually.
- **CKC has the substrate without extra work**: every generated image has `comfyui_workflow_json`, `comfyui_metadata_json`, `prompts_json`, the resulting bytes (perceptual hash), the operator's rating, the operator's notes. All keyed by model + sampler + seed.
- **Force multiplier with WP-0109 / WP-0111**: replay-the-recipe and identity-bundle work both benefit from "this prompt token reliably preserves the eyes on model X but blows them out on model Y" data.
- **Aligns with Handshake's pillar 16** (LLM-friendly data, Bronze/Silver/Gold) — this is exactly what the Gold tier of an image-gen knowledge base would look like for one operator.

## What "matrix" might mean (open: this is the brainstorm part)

Several plausible shapes; not yet picked:

### Shape A — Per-token effect table
- Rows: prompt tokens / phrases ("8k", "intricate", "amateur", "low quality"…).
- Columns: models (SDXL Pony v6, Illustrious v0.1, Flux Schnell, Flux Dev, Flux.2, Chroma, SD3, SD3.5, …).
- Cells: "effect score" — how much adding/removing this token changed the resulting image, measured by a perceptual / CLIP / SSIM delta against a paired control.
- Bonus: a "common pitfalls per model" auto-derived list — "on Pony, omitting `score_9, score_8_up` reliably loses lighting quality."

### Shape B — Per-model prompt fingerprint
- For each model, an empirical distribution: "what prompt tokens appear most often in 5★-rated outputs vs 1★-rated outputs?"
- Computed from the operator's existing rating + `prompts_json`.
- Output: a per-model recommended-tokens / avoid-tokens shortlist.

### Shape C — Auto-bench mode
- CKC drives ComfyUI: one fixed seed + base prompt + control image, then sweeps a grid of (model × added-token × added-negative).
- Stores the N×M output grid + perceptual deltas.
- Promote to A or B with concrete data instead of operator memory.

### Shape D — Hybrid / progressive
- Start with B (free; uses data CKC already has).
- Add A as the operator manually tags interesting deltas in the Workflow tab.
- Add C as a "weekend bench" mode the operator can fire off to sweep an interesting axis automatically.

The shape isn't picked because B-then-A-then-C is the obvious progression but C might dominate if compute is cheap and the operator wants the matrix dense. Brainstorm.

## Data substrate that already exists (post-WP-0109)

- `ImageAsset.comfyui_workflow_json` — the full workflow (nodes, models, samplers, all inputs).
- `ImageAsset.comfyui_metadata_json` — model, sampler, seed, cfg, steps, prompts.
- `ImageAsset.rating` (1–5★), `favorite`, `notes`.
- `ImageAsset.file_hash`, `dhash_hex` — perceptual + exact identity.
- `ImageAsset.tags_json` — operator-tagged.
- `Prompt` table (WP-0107) — operator-curated reusable prompts.
- `WorkflowTemplate` (WP-0109) — saved workflows.

What's missing for the matrix:
- A canonical "model identity" key (more durable than the operator-typed `model` string in metadata; needs normalization).
- Pairwise delta computation (image A vs image B with one prompt token swapped).
- A way to capture "what changed about the image" beyond a single perceptual distance — face? hands? composition? color? Per-region deltas.
- Storage for derived stats (don't recompute per query).

## Candidate matrix record (brainstorm seed)

Each row might eventually need enough context to make the prompt/result comparison defensible:

- **Generator/runtime**: ComfyUI first, but leave room for A1111, Fooocus, Forge, cloud generators, or any future CKC intake adapter.
- **Model identity**: display name, normalized alias, checkpoint hash, model family, base architecture, VAE, and optional CivitAI / HuggingFace reference.
- **Generation controls**: seed, sampler, scheduler, steps, cfg/guidance, resolution, denoise, clip-skip, refiner, and batch index.
- **Positive prompt unit**: token, phrase, prompt block, full prompt, or curated prompt slot.
- **Negative prompt unit**: token, phrase, block, full negative prompt, or known anti-pattern bundle.
- **Stack context**: LoRAs, embeddings, IPAdapter / PuLID / face-swap inputs, ControlNet / openpose / depth / hand refs, and strength values.
- **Observed output**: image hash, perceptual hash, operator rating, favorite flag, notes, tags, failure labels, and optional auto-metrics.
- **Comparison anchor**: paired control output where only one prompt unit changed, or a passive cohort where similar settings can be grouped.

## Open questions (the brainstorm agenda)

1. **What's the unit of analysis?** A single token? A token in context? A whole prompt? Sentence-level slot?
2. **Effect measurement?** CLIP image delta? Per-region SSIM? A small judge model rating? Operator pairwise vote? All of the above?
3. **Model identity normalization**: how do we canonicalize "SDXL Pony v6" vs "ponyDiffusionV6XL" vs "pony_v6_xl"? Hash of the safetensors file? CivitAI ID? Operator-curated alias table?
4. **Capture surface**: passive (mine the existing library) vs active (drive ComfyUI to fill gaps in the matrix) vs hybrid?
5. **Sampler / cfg / steps as confounding variables** — does the matrix marginalize over them, or are they axes too?
6. **Negative prompts**: do they get their own matrix, or are they columns alongside positives?
7. **LoRA / IPAdapter / ControlNet stacking** as confounders — same prompt at the same model behaves very differently with PuLID layered in.
8. **Privacy / portability**: is the matrix per-operator or shareable? An "operator's prompt fingerprint" might be export-pack-worthy.
9. **Storage**: a new `PromptResponseMeasurement` table? A materialized view over `ImageAsset`? A DuckDB sidecar a la Handshake's Flight Recorder pillar?
10. **UI surface**: a new tab? An overlay in Workflow tab? A widget in the Prompts panel that highlights "this token rarely helps on model X"?
11. **Could this just be a notebook / one-off report** rather than a product surface? When does it pay to invest in real UI?

## What this WP is NOT (scope guard)

- Not a "prompt suggestion / autocomplete" feature. That's downstream — a ML model trained on the matrix, not the matrix itself.
- Not a generic "evaluate diffusion models" benchmark. Operator-private, opinionated, narrow.
- Not LoRA training data extraction (that's Handshake's pillar 20 / a future WP).
- Not a marketplace export. The matrix is internal until a separate WP designs portability.

## Adjacent prior art (one-line cites only — full pass deferred)

- **CivitAI prompt-galleries + auto-tags** — shape inspiration; community-curated, not operator-private.
- **PromptHero, Lexica, OpenArt** — searchable prompt corpora; closer to "library" than "matrix".
- **PromptIDE / Promptable / various LLM "prompt IDE" tools** — for text models, but the dimensionality + metric story is similar.
- **Anthropic "Constitutional AI" / RLHF rating pipelines** — analogous data shape (prompt → response → operator score).
- **ComfyUI custom nodes that auto-rate outputs** (Aesthetic Score Predictor, ImageReward) — useful as a measurement primitive when promoted to DRAFT.

A real research pass per the codex rule is required before promotion.

## Path forward (no commitment)

When this gets promoted to DRAFT later:

1. Brainstorm session with operator: pick Shape (A / B / C / D / something else). Lock the unit of analysis.
2. Field-research pass per the codex rule: CivitAI + PromptHero + arXiv (prompt steering, prompt gradient, prompt embedding analysis) + ComfyUI rating-node ecosystem + Anthropic / OpenAI / Stability blog posts on prompt-response analysis.
3. Decide measurement basis (CLIP / SSIM / region-aware / judge-model / operator vote).
4. Decide capture surface (passive / active / hybrid).
5. Decide storage (new table vs view vs DuckDB sidecar).
6. Then draft the implementation-grade WP.

## Why "not for current work"

Implementation-grade promotion blocks on:
- WP-0109 shipping (the data substrate isn't fully populated until ComfyUI workflow JSON is captured at intake).
- Enough generated-image volume to make any matrix non-empty (CKC currently has Aeri's 10 reference images and a smattering of test outputs — not enough rows to compute a fingerprint that isn't noise).
- A real brainstorm session with the operator about which Shape to pursue.

Reasonable timing: revisit after WP-0109 ships AND after the operator has run a few real ComfyUI batches through the bridge — then there's enough data to dogfood the simplest Shape (B: per-model fingerprint over the ratings already in the DB) and see if it's worth the more ambitious shapes.
