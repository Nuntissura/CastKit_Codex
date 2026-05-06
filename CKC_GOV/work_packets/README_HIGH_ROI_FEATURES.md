# High-ROI Features - Quick Reference

Date: 2026-02-15

This document provides a quick overview of the next-generation high-ROI features planned for CastKit Codex (WP-0083 through WP-0090).

## Priority Order (Recommended Implementation Sequence)

### Tier 1: Highest Impact
1. **WP-0083: Global Full-Text Search** — Core workflow multiplier
2. **WP-0084: AI-Assisted Image Tagging** — 10x organization speedup
3. **WP-0085: Character Templates & Cloning** — Lowers barrier to entry
4. **WP-0086: macOS Build Support** — 2-3x user base expansion
5. **WP-0087: Web Portfolio Export** — Viral growth potential

### Tier 2: Performance & Power User Features
6. **WP-0088: Performance Optimization** — Prevents user churn at scale
7. **WP-0089: Visual Similarity Search** — Discovery enhancement
8. **WP-0090: Batch Character Operations** — Power user essential

## Feature Summary

| WP | Feature | Key Benefit | Dependencies |
|---|---|---|---|
| WP-0083 | Global Search | Find anything across all content | SQLite FTS5 |
| WP-0084 | AI Tagging | Auto-tag images with CLIP/BLIP | @xenova/transformers, sharp |
| WP-0085 | Templates | Quick character creation | None |
| WP-0086 | macOS Build | Cross-platform support | electron-builder |
| WP-0087 | Web Export | Static HTML portfolio | sharp |
| WP-0088 | Performance | Scale to 1000+ chars, 10k+ images | react-window, better-sqlite3 |
| WP-0089 | Similarity Search | Visual image discovery | @xenova/transformers |
| WP-0090 | Batch Ops | Bulk character editing | None |

## Dependencies Installed

The following npm packages have been installed to support these features:

```json
{
  "dependencies": {
    "@xenova/transformers": "latest",  // AI models (CLIP, BLIP)
    "sharp": "latest",                 // Image processing
    "react-window": "latest"           // Virtualized lists
  },
  "devDependencies": {
    "better-sqlite3": "latest"         // Faster SQLite (optional migration)
  }
}
```

## Implementation Notes

### AI Model Storage
- Models download to: `<CKC_ROOT>/CKC_GOV/targets/cache/ai-models/`
- CLIP model: ~400MB (shared between WP-0084 and WP-0089)
- First-run download with progress UI

### Database Schema Changes
Multiple features require schema additions:
- **WP-0083**: FTS5 virtual tables + triggers
- **WP-0084**: `ImageAsset.suggested_tags_json`, `ImageAsset.auto_tagged_at`
- **WP-0089**: `ImageAsset.clip_embedding`, `ImageAsset.embedding_version`
- **WP-0090**: `Character.deleted_at` (soft delete)

### Cross-Platform Considerations
- **WP-0086 (macOS)**: Requires `.icns` icon (convert from `.ico`)
- File paths already use forward slashes (cross-platform compatible)
- Default `libraryRoot` paths differ per platform

## Spec Documentation

All features are fully documented in:
- **Spec**: `CKC_GOV/spec/CastKit_Codex_Spec_v00.052.md` → Section 12
- **Task Board**: `CKC_GOV/taskboard/TASK_BOARD.md` → WP-0083..WP-0090
- **Work Packets**: `CKC_GOV/work_packets/WP-00XX_*.md` (detailed implementation guides)

## Rebuild Capability

The spec file (v00.052) is now comprehensive enough to rebuild the entire product, including:
- All existing features (sections 1-11)
- All planned high-ROI features (section 12)
- Database schema
- UI/UX patterns
- Performance targets
- Implementation examples

---

## Next Steps

1. **Review work packets** — Read WP-0083 through WP-0090 for detailed acceptance criteria
2. **Choose priority** — Decide which features to implement first (recommend WP-0083, 0084, 0086)
3. **Allocate work** — Assign owners to work packets
4. **Update task board** — Move WP from BACKLOG → IN_PROGRESS as work begins
5. **Follow workflow** — Create WP → commit/push → implement → update spec → commit/push

## Estimated Effort

| Feature | Complexity | Estimated Effort |
|---|---|---|
| WP-0083 | Medium | 3-5 days |
| WP-0084 | High | 5-7 days (model integration) |
| WP-0085 | Low-Medium | 2-3 days |
| WP-0086 | Low | 1-2 days (mostly config) |
| WP-0087 | Medium | 3-4 days |
| WP-0088 | High | 5-7 days (many touchpoints) |
| WP-0089 | Medium | 2-3 days (reuses WP-0084 models) |
| WP-0090 | Medium | 3-4 days |

**Total estimated effort**: 24-35 developer-days for all 8 features.

---

*For detailed implementation guidance, refer to individual work packet files.*
