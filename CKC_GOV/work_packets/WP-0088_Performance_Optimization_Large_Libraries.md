# Work Packet: WP-0088 — Performance optimization for large libraries

Date: 2026-02-15
Owner: TBD
Status: BACKLOG

## Summary
Optimize CKC for large libraries (1000+ characters, 10,000+ images) with virtualized lists, lazy loading, pagination, and database indexing improvements.

## Why
- Current implementation may slow down with large libraries (no virtualization).
- Users with 500+ characters or 5000+ images will experience lag.
- Performance issues cause user churn (if it's slow, they abandon the tool).
- Gallery scroll, character list rendering, and search need to scale.
- Spec: `CastKit_Codex_Spec_v00.052.md` §12.6 "Performance & Scalability".

## Scope
### In
- Virtualized lists:
  - Character library grid/list (render only visible rows)
  - Image gallery thumbnails (render only visible thumbs)
  - Notes/Stories lists
  - Use `react-window` or `react-virtualized` for efficient rendering
- Lazy loading:
  - Thumbnail images load on scroll (not all at once)
  - Use Intersection Observer API
  - Placeholder/skeleton while loading
- Pagination (fallback for massive lists):
  - Character list: 100 per page
  - Image gallery: 200 per page
  - "Load more" or infinite scroll
- Database indexing:
  - Index `Character.public_id`, `Character.created_at`, `Character.updated_at`
  - Index `ImageAsset.character_id`, `ImageAsset.created_at`, `ImageAsset.tags_json`
  - Index `CharacterField.character_id`, `CharacterField.field_id`
  - Verify indexes exist with `EXPLAIN QUERY PLAN`
- Query optimization:
  - Use `SELECT` column subsets (not `SELECT *`)
  - Batch IPC queries (fewer round-trips)
  - Cache frequently-accessed data (character list, tag list)
- Thumbnail pre-generation:
  - Generate thumbnails on import (don't wait for first render)
  - Background worker for thumbnail queue
  - Progress UI for bulk thumbnail generation

### Out
- Server-side rendering (keep it Electron-local)
- Database sharding (SQLite is fast enough for expected scale)
- Cloud sync (separate feature, not performance-related)

## Dependencies
- `react-window` — virtualized list rendering (or `react-virtualized`)
- `better-sqlite3` — potentially faster than `sqlite3` (consider migration)

## Acceptance criteria
- [ ] Character library with 1000 characters scrolls smoothly (60fps)
- [ ] Image gallery with 10,000 images loads in <2s (virtualized)
- [ ] Database queries remain <50ms for 10k+ row tables
- [ ] Thumbnail generation for 100 images completes in <30s
- [ ] Memory usage stays under 500MB for large libraries

## Test plan
- [ ] Performance benchmark: create 1000 characters, measure render time
- [ ] Performance benchmark: import 10,000 images, measure gallery scroll FPS
- [ ] Database benchmark: measure query time for 10k+ character library
- [ ] Manual: open large library, verify smooth scrolling
- [ ] Manual: monitor memory usage (Task Manager / Activity Monitor)
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md` §12.6).

## Implementation notes
- Key files to modify:
  - `CKC_main/src/ui/components/LibraryGrid.tsx` — Add virtualization
  - `CKC_main/src/ui/components/MediaPane.tsx` — Virtualize thumbnail grid
  - `CKC_main/app/db/schema.js` — Add database indexes
  - `CKC_main/app/lib/thumbnails.js` — Background thumbnail generation
- Virtualization example (react-window):
  ```tsx
  import { FixedSizeGrid } from 'react-window';

  const LibraryGrid = ({ characters }) => (
    <FixedSizeGrid
      columnCount={4}
      columnWidth={250}
      height={window.innerHeight - 100}
      rowCount={Math.ceil(characters.length / 4)}
      rowHeight={300}
      width={window.innerWidth}
    >
      {({ columnIndex, rowIndex, style }) => {
        const index = rowIndex * 4 + columnIndex;
        const char = characters[index];
        return <CharacterCard character={char} style={style} />;
      }}
    </FixedSizeGrid>
  );
  ```
- Lazy image loading:
  ```tsx
  const LazyImage = ({ src }) => {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef();

    useEffect(() => {
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setLoaded(true);
          observer.disconnect();
        }
      });
      observer.observe(imgRef.current);
      return () => observer.disconnect();
    }, []);

    return <img ref={imgRef} src={loaded ? src : placeholder} />;
  };
  ```
- Database indexes (add to schema):
  ```sql
  CREATE INDEX IF NOT EXISTS idx_character_public_id ON Character(public_id);
  CREATE INDEX IF NOT EXISTS idx_image_character_id ON ImageAsset(character_id);
  CREATE INDEX IF NOT EXISTS idx_image_created_at ON ImageAsset(created_at);
  CREATE INDEX IF NOT EXISTS idx_field_character_id ON CharacterField(character_id);
  ```

## Notes
- Consider migrating from `sqlite3` to `better-sqlite3` (synchronous API, faster)
- Thumbnail size: 256px max (balance between quality and file size)
- Cache thumbnail paths in memory (avoid repeated filesystem checks)
- Background thumbnail generation: use worker threads if needed (avoid blocking main thread)
- Do NOT touch `D:`.
