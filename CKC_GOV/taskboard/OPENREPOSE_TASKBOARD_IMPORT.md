# OpenRepose Taskboard Import

Date: 2026-05-07
Owner: Codex
Status: CKC governance import ledger

## Source

This file imports the complete historical OpenRepose taskboard into CKC governance as a backlog/disposition ledger for **PoseKit**, the CKC-native rebuild of the pose/openpose/workflow capability set. It does not make the OpenRepose repo canonical again and does not authorize copying Python/Qt source into CKC.

Source taskboard: `D:\Projects\LLM projects\OpenRepose\.gov\workflow\TASKBOARD.md`

Key source sections:

- Summary and counts: `TASKBOARD.md:7-20`
- Pending review: `TASKBOARD.md:29-44`
- Deferred: `TASKBOARD.md:55-61`
- Draft backlog: `TASKBOARD.md:63-82`
- Recently done: `TASKBOARD.md:84-125`
- Iteration pipeline and future themes: `TASKBOARD.md:198-227`

## Import Rule

Every historical item is imported as one of these dispositions:

- **CKC WP**: active or planned CKC work packet already owns the feature.
- **Folded into CKC**: CKC already has the platform capability or the scope is folded into an existing CKC WP.
- **Future concept**: preserved as backlog, not currently scheduled.
- **Deferred / skipped**: intentionally not active, with reason.

When a future CKC WP derives implementation detail from a historical OpenRepose work packet, the CKC WP must cite the historical WP file and any relevant `.product` file/line ranges. This ledger is the backlog import, not sufficient implementation authority by itself.

## Core Pose / Viewport Import

| OpenRepose WP | Historical title/status | CKC disposition |
|---|---|---|
| WP-I0-001 | Rig And Rotation Core / DONE | CKC WP-0108 owns the TypeScript rig/yaw rebuild. |
| WP-I0-003 | Snapshot Subsystem / DONE | Folded into CKC live-verification and automation-capture rules; Pose/Workflow WPs add captures when they ship. |
| WP-I0-004 | Double Viewport GUI / DONE | CKC WP-0108 owns 3D + 2D Pose viewports. |
| WP-I1-001 | Per-Avatar Calibration Overlay / DONE | CKC WP-0108 owns calibration schema, marker offsets, and viewport editing. |
| WP-I1-002 | Orbital camera in 3D viewport / REVIEW | CKC WP-0108 owns Three.js orbital camera behavior. |
| WP-I1-017 | Per-Body-Part Visibility Toggles / DONE | CKC WP-0108 owns marker/body visibility controls. |
| WP-I1-023 | Frame Reframing / DONE | CKC WP-0108 owns Reframer baseline; CKC WP-0114 owns synchronized framing polish. |
| WP-I1-026 | Feature 2 Calibration Overlay Spec / DONE | Folded into CKC WP-0108 as historical calibration design input. |
| WP-I1-028 | Calibration Tab UX / DONE | CKC WP-0108 owns zoom/pan/calibration overlay behavior where it matches CKC UI. |
| WP-I1-029 | Per-Marker Visibility / DONE | CKC WP-0108 owns per-marker visibility and defensive render behavior. |
| WP-I1-031 | Tools Tab Reorganization / DONE | CKC WP-0108 owns Calibration / Markers / Reframer panels in CKC layout. |
| WP-I1-034 | Calibration overview mode + drag/delete + add-marker workflow / DONE | CKC WP-0108 owns marker editing and missing-detection recovery. |

## Pose Workflow Polish Import

| OpenRepose WP | Historical title/status | CKC disposition |
|---|---|---|
| WP-I1-003 | Settings persistence / REVIEW | Skipped as a separate import; CKC already owns settings through `ckc-config.json` and existing app config. |
| WP-I1-004 | Extended keyboard shortcuts / DRAFT | CKC WP-0116. |
| WP-I1-005 | Drag-and-drop portrait import / REVIEW | CKC WP-0114. |
| WP-I1-006 | GUI theme refinements / DRAFT | Skipped as a direct import; CKC keeps its own design language. Relevant polish can be folded into CKC UI WPs. |
| WP-I1-010 | Multi-angle automation / REVIEW | CKC WP-0114. |
| WP-I1-016 | Clear workspace command + toolbar button / REVIEW | CKC WP-0114. |
| WP-I1-022 | Read OpenPose JSON as alternate input / DRAFT | CKC WP-0114. |
| WP-I1-024 | Synchronized viewport zoom / DRAFT | CKC WP-0114. |
| WP-I1-027 | Export folder picker and persistence / DONE | Fold into CKC export UX only where compatible; CKC export artifacts remain content-hash addressed. |
| WP-I1-030 | Export polish / DONE | CKC WP-0108 and WP-0114 own deterministic PNG/JSON output; do not carry forward avatar-slug naming. |
| WP-I1-032 | GUI Polish Bundle / DONE | Fold into CKC WP-0108 / WP-0114 only where it fits CKC UI. |
| WP-I1-036 | Multi-file workspace spec / DONE | CKC WP-0115. |
| WP-I1-037 | Multi-file workspace implementation / REVIEW | CKC WP-0115. |

## Feature Expansion Import

| OpenRepose WP | Historical title/status | CKC disposition |
|---|---|---|
| WP-I1-007 | Pitch / roll rotation extension / DRAFT | CKC WP-0110. |
| WP-I1-008 | Alternative landmark detector research / DRAFT | CKC WP-0117. |
| WP-I1-009 | Identity-export profiles / DRAFT | CKC WP-0111. |
| WP-I1-011 | Multi-subject scenes / DRAFT | CKC WP-0112. |
| WP-I1-012 | Garment locks / DEFERRED | Preserve as future concept only; revisit as garment polyline / secondary-ControlNet workflow if it becomes real. |
| WP-I1-014 | MediaPipe Tasks API migration / DRAFT | Folded into CKC WP-0108; CKC starts with MediaPipe Tasks Vision instead of migrating later. |
| WP-I1-015 | Floating reference portrait window / DRAFT | Skipped as separate OpenRepose import; CKC already has its own ReferenceWindow work. |
| WP-I1-018 | Hand detection + OpenPose hand output / REVIEW | CKC WP-0113. |
| WP-I1-019 | Joint manipulation chain / RESERVED | Future concept; no CKC WP drafted. |
| WP-I1-020 | Joint manipulation chain / RESERVED | Future concept; no CKC WP drafted. |
| WP-I1-021 | Joint manipulation chain / RESERVED | Future concept; no CKC WP drafted. |

## Library / ComfyUI / Database Import

| OpenRepose WP | Historical title/status | CKC disposition |
|---|---|---|
| WP-I1-033 | Feature 3 Spec: Library + ComfyUI + PostgreSQL / DONE | Folded into CKC WP-0107 schema and WP-0109 bridge/workflow design, adjusted to CKC's database and image library. |
| WP-I2-001 | PostgreSQL setup + migration runner / DONE | Folded into CKC existing database provider and WP-0107 schema work. |
| WP-I2-002 | Settings extension: library config / DONE | Skipped as separate import; CKC config path already exists. |
| WP-I2-003 | Library entries CRUD + tags + smart-tag extractor / DONE | CKC library is canonical; only pose/workflow fields are imported through WP-0107. |
| WP-I2-004 | Library LLM commands + library_search / DONE | Folded into CKC automation/manual discipline; prompts/story beats are imported through WP-0107. |
| WP-I2-005 | ComfyUI bridge custom node / DONE | CKC WP-0109, rewritten as CKC bridge. |
| WP-I2-006 | Library tab GUI / DONE | Skipped as separate import; CKC already owns Library UI. |
| WP-I2-007 | Library snapshot targets / DONE | Folded into CKC live-verification capture practice. |
| WP-I2-008 | Library multi-operator tests + setup doc / DONE | Future CKC hardening input only; not a current pose/workflow WP. |

## AMood / Intake / Requirements Import

These items are imported into CKC governance as a preserved backlog cluster, but they are outside the immediate WP-0107..WP-0117 pose/workflow rebuild unless a future CKC WP explicitly opens them.

| OpenRepose WP | Historical title/status | CKC disposition |
|---|---|---|
| WP-I3-001 | AMood + Intake + Requirements Spec Lock / DONE | Future concept cluster; compare against CKC image-sourcing and requirements governance before drafting product work. |
| WP-I3-002 | LLM stance acknowledgement primitives / DONE | Preserve as governance/source-policy input; no CKC product WP opened here. |
| WP-I3-003 | I3 PostgreSQL schema migrations / DONE | Future concept cluster; do not import schema directly. |
| WP-I3-004 | Intake + project + task command surface / DONE | Compare against CKC image-sourcing intake before any future import. |
| WP-I3-005 | Default-staging ComfyUI bridge / DONE | Relevant to future CKC intake staging; WP-0109 only imports the ComfyUI workflow bridge surface. |
| WP-I3-006 | AMood data-model commands + dedupe service / DONE | Future concept cluster; no current CKC product WP opened. |
| WP-I3-007 | Requirements editor + target tree commands / DONE | Future concept cluster; compare against CKC task/requirements needs. |
| WP-I3-008 | Triage GUI tab + snapshot targets / DONE | Future concept cluster; compare against CKC intake/review surfaces. |
| WP-I3-009 | Audit script extension / REVIEW | Future CKC governance-hardening input. |
| WP-I3-010 | End-to-end EXP120 verification / REVIEW | Future verification input for any AMood/intake import. |
| WP-I3-011 | OpenRepose AMood GPT + Claude Skill Wrappers / DRAFT | Future concept only; do not open until CKC has the matching DB/dispatcher/intake surfaces. |

## Infrastructure Import

| OpenRepose WP | Historical title/status | CKC disposition |
|---|---|---|
| WP-I0-002 | LLM Control Surface / DONE | Folded into CKC automation/manual command discipline; no direct import. |
| WP-I1-013 | Installer build + release / DRAFT | Skipped as separate import; CKC ships via its own NSIS/build pipeline. |
| WP-I1-025 | Quarterly Governance Audit / DONE | Folded into CKC governance process. |
| WP-I1-035 | In-app manual + manual-impact governance rule / DONE | Already a binding CKC rule; pose/workflow WPs must update the manual when commands/surfaces ship. |
| WP-I4-001 | Intake scale + DB hardening / DONE | Future CKC intake hardening input; compare against WP-0106 and image-sourcing ingestion rules before drafting. |
| WP-I4-002 | Orstart codex contract banner / REVIEW | Skipped as separate import; CKC uses `ckcstart.cmd`, `AGENTS.md`, and `PROJECT_CODEX.md`. |

## Future Themes Imported From Iteration Pipeline

| Historical theme | CKC disposition |
|---|---|
| Code signing for distributables | Future infrastructure concept. |
| macOS / Linux builds | Future infrastructure concept. |
| GitHub Actions CI for automated test + build | Future infrastructure concept. |
| Per-feature-group calibration mixing | Future pose concept after WP-0108. |
| Animated yaw-sweep video export | Future pose/export concept. |
| Read OpenPose PNG image by reverse-engineering rendered colors | Future research concept; do not implement without a research WP. |
| Garment polyline -> secondary ControlNet input | Future concept replacing deferred garment locks if production workflow needs it. |

## Current CKC PoseKit Extraction Set

The immediate CKC PoseKit extraction from this import is:

- WP-0107: PoseKit schema + Pose / Workflow tab shells.
- WP-0108: PoseKit pipeline.
- WP-0109: PoseKit ComfyUI bridge + workflow storage + replay.
- WP-0110: Pitch / roll head pose extension.
- WP-0111: Identity export profiles.
- WP-0112: Multi-subject scenes.
- WP-0113: Hand detection + openpose hand keypoints.
- WP-0114: Pose tab polish carry-over.
- WP-0115: Multi-rig workspace tabs.
- WP-0116: Extended keyboard shortcuts.
- WP-0117: Stylized-portrait landmark detector research.
- WP-0118: Model prompt-response matrix, CKC-origin concept, not an OpenRepose import.
