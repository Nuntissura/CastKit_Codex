# WP-0098: Fix MainApp Hook Order Blank Window

## Status
DONE

## Scope
- Fix the CKC GUI blank window caused by a React hook-order violation in `CKC_main/src/ui/App.tsx`.
- Verify with the visual debugger path by checking rendered output and renderer console/runtime errors.
- Run focused local validation relevant to the UI startup path.

## Out of Scope
- Redesigning app startup.
- Changing database provider behavior beyond the already-applied local PostgreSQL port fix.
- Refactoring unrelated UI views.

## Implementation Notes
- Keep hooks in `MainApp` unconditional across loading and ready renders.
- Preserve existing loading/error UI behavior.
- Do not alter CKC template bytes, field IDs, or user-entered data handling.

## Acceptance Criteria
- CKC no longer renders a blank root after successful initialization.
- Renderer console no longer reports `Rendered more hooks than during the previous render`.
- Visual debugger capture shows real CKC UI content.
- `npx tsc --noEmit` passes or any failure is documented.

## Test Plan
- Launch CKC with PostgreSQL on the active local port.
- Use Electron/CDP visual debugger capture and console inspection.
- Run `npx tsc --noEmit`.

## Validation
- CKC rendered real UI content after a clean Electron restart.
- Electron/CDP console inspection found no renderer runtime errors after the fix.
- Visual capture written to `CKC_GOV/targets/CKC/automation_captures/electron-cdp-after-postgres-translate-fix-1777966672401.png`.
- `node --test test/backend_postgres_provider.test.js` passed.
- `npx tsc --noEmit` passed.
