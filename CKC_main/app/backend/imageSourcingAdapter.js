// Multi-version image-sourcing adapter dispatcher.
//
// Reads a task's spec_version (v00.19, future v00.20+, ...) and routes
// the ingestion to the matching handler. Each handler module is pure
// data-shaping (returns a plan); this dispatcher orchestrates the
// library calls (importImages, addCharacterScript, audit writes,
// app_sync_events.jsonl appends).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

const handlerV00_19 = require('./imageSourcingHandlers/v00_19');

// Registry of available handlers keyed by spec_version. Add v00.20
// here when its handler ships in a follow-up WP.
const HANDLERS = {
    [handlerV00_19.SPEC_VERSION]: handlerV00_19,
};

function readSpecVersion(taskRootPath) {
    const taskId = path.basename(String(taskRootPath || '').replace(/[\\/]+$/, ''));
    const stateFile = path.join(taskRootPath, `${taskId}.task_state.yaml`);
    if (!fs.existsSync(stateFile)) {
        throw new Error(`Missing task_state.yaml at ${stateFile}`);
    }
    const data = yaml.load(fs.readFileSync(stateFile, 'utf8')) || {};
    const sv = data.spec_version == null ? null : String(data.spec_version);
    if (!sv) throw new Error(`task_state.yaml at ${stateFile} has no spec_version`);
    return sv;
}

function resolveHandler(specVersion) {
    const handler = HANDLERS[specVersion];
    if (!handler) {
        throw new Error(`No image-sourcing handler registered for spec_version=${specVersion}. Known: ${Object.keys(HANDLERS).join(', ') || '(none)'}`);
    }
    return handler;
}

function fileSha256Hex(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

// Dispatch entry point. Library binds this through
// CKCLibrary.ingestImageSourcingTask which provides `lib` (self).
async function runIngestion({ lib, taskRootPath, characterId, sheetVersionId, lane, dryRun, copyScripts, dedupReasons }) {
    if (!taskRootPath) throw new Error('taskRootPath is required');
    if (!characterId) throw new Error('characterId is required');
    if (!sheetVersionId) throw new Error('sheetVersionId is required');

    // Verify the sheetVersionId belongs to this character before doing
    // any work. This is a cheap upfront check.
    const sheetVersion = await lib._getSheetVersionRow(characterId, sheetVersionId);
    if (!sheetVersion) {
        throw new Error(`sheetVersionId ${sheetVersionId} does not belong to characterId ${characterId}`);
    }

    const specVersion = readSpecVersion(taskRootPath);
    const handler = resolveHandler(specVersion);
    const plan = handler.buildIngestionPlan({ taskRootPath, lane });

    const reasons = Array.isArray(dedupReasons) && dedupReasons.length
        ? new Set(dedupReasons.map(String))
        : new Set(['content-hash', 'selection', 'url']);

    const isDryRun = !!dryRun;
    const wantScripts = copyScripts !== false; // default true

    const result = {
        ok: true,
        dryRun: isDryRun,
        specVersion,
        taskId: plan.taskId,
        datasetId: plan.datasetId,
        lane: plan.lane,
        laneDir: plan.laneDir,
        characterId,
        sheetVersionId,
        imported: [],
        skipped: [],
        rejected: [],
        scriptsImported: [],
        appSyncEventsAppended: 0,
        batchId: null,
    };

    let batchId = null;
    const ensureBatch = async () => {
        if (isDryRun) return null;
        if (batchId) return batchId;
        const created = await lib.createIngestionBatch({
            characterId,
            sheetVersionId,
            datasetId: plan.datasetId,
            taskId: plan.taskId,
            specVersion,
            lane: plan.lane,
            requirementsSnapshot: plan.requirementsText,
        });
        batchId = created.batchId;
        result.batchId = batchId;
        return batchId;
    };

    try {
        // ---- Lane: rejected ----
        if (plan.lane === 'rejected') {
            for (const item of plan.items) {
                if (isDryRun) {
                    result.rejected.push({
                        filePath: item.filePath,
                        sourceUrl: item.sourceUrl,
                        rejectionReason: item.rejectionReason || '',
                        plan: 'audit-only',
                    });
                    continue;
                }
                await ensureBatch();
                const rej = await lib.createIngestionRejection({
                    batchId,
                    characterId,
                    sourceUrl: item.sourceUrl,
                    sourcePath: item.filePath,
                    rejectionReason: item.rejectionReason || '',
                });
                result.rejected.push({
                    rejectionId: rej.rejectionId,
                    sourceUrl: item.sourceUrl,
                    sourcePath: item.filePath,
                    rejectionReason: item.rejectionReason || '',
                });
            }
        } else {
            // ---- Lanes: accepted, pending (and raw if explicitly requested) ----
            // Pre-filter: cross-batch dedup before calling importImages.
            const provenanceBase = {
                datasetId: plan.datasetId,
                taskId: plan.taskId,
                sheetVersionId,
            };
            for (const item of plan.items) {
                // dup-selection
                if (reasons.has('selection') && plan.datasetId && plan.taskId && item.contactSheetRef) {
                    const existing = await lib._findImageBySourceSelection(characterId, plan.datasetId, plan.taskId, item.contactSheetRef);
                    if (existing) {
                        result.skipped.push({
                            sourcePath: item.filePath,
                            reason: 'dup-selection',
                            existingImageId: existing.imageId,
                        });
                        continue;
                    }
                }
                // dup-url
                if (reasons.has('url') && item.sourceUrl) {
                    const existing = await lib._findImageBySourceUrl(characterId, item.sourceUrl);
                    if (existing) {
                        result.skipped.push({
                            sourcePath: item.filePath,
                            reason: 'dup-url',
                            existingImageId: existing.imageId,
                        });
                        continue;
                    }
                }
                // Pre-check content hashes before opening an audit batch so
                // re-running an already-ingested task is DB-idempotent.
                if (reasons.has('content-hash')) {
                    const fileHash = fileSha256Hex(item.filePath);
                    const existing = await lib._findImageByContentHash(characterId, fileHash);
                    if (existing) {
                        result.skipped.push({
                            sourcePath: item.filePath,
                            reason: 'dup-content-hash',
                            existingImageId: existing.imageId,
                        });
                        continue;
                    }
                }

                if (isDryRun) {
                    result.imported.push({
                        sourcePath: item.filePath,
                        sourceUrl: item.sourceUrl,
                        contactSheetRef: item.contactSheetRef,
                        plan: 'would-import',
                    });
                    continue;
                }

                await ensureBatch();
                // Real import via the existing importImages machinery
                // (handles content-hash dedup + hash-addressed filenames
                // per the identity-decoupling rule).
                const provenance = {
                    ...provenanceBase,
                    runId: item.runId,
                    contactSheetRef: item.contactSheetRef,
                };
                const importRes = await lib._importOneImageWithProvenance({
                    characterId,
                    filePath: item.filePath,
                    sourceUrl: item.sourceUrl,
                    provenance,
                    reviewStatus: plan.lane === 'pending' ? 'pending' : 'accepted',
                    addTags: plan.lane === 'pending' ? ['pending'] : [],
                });
                if (importRes.skipped && reasons.has('content-hash')) {
                    result.skipped.push({
                        sourcePath: item.filePath,
                        reason: 'dup-content-hash',
                        existingImageId: importRes.existingImageId || null,
                    });
                    continue;
                }
                result.imported.push({
                    imageId: importRes.imageId,
                    sourcePath: item.filePath,
                    sourceUrl: item.sourceUrl,
                    contactSheetRef: item.contactSheetRef,
                    relativePath: importRes.relativePath,
                    fileHash: importRes.fileHash,
                });
            }
        }

        // ---- Scripts (accepted lane only when requested) ----
        if (wantScripts && plan.lane === 'accepted' && plan.scriptFiles.length > 0) {
            for (const filePath of plan.scriptFiles) {
                if (isDryRun) {
                    result.scriptsImported.push({ filePath, plan: 'would-copy' });
                    continue;
                }
                await ensureBatch();
                const bytes = fs.readFileSync(filePath);
                const res = await lib.addCharacterScript({
                    characterId,
                    scriptName: path.basename(filePath),
                    scriptContent: bytes,
                    sourceTaskId: plan.taskId,
                });
                result.scriptsImported.push({
                    scriptId: res.scriptId,
                    deduped: res.deduped,
                    name: res.name,
                });
            }
        }

        // ---- app_sync_events.jsonl writeback ----
        if (!isDryRun && (result.imported.length > 0 || result.rejected.length > 0)) {
            const events = [];
            for (const imp of result.imported) {
                events.push({
                    schema_version: 1,
                    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                    event_kind: plan.lane === 'pending' ? 'media_pending' : 'media_accepted',
                    timestamp: new Date().toISOString(),
                    dataset_id: plan.datasetId,
                    task_id: plan.taskId,
                    app: 'castkit_codex',
                    lane: plan.lane,
                    media_id: imp.fileHash || null,
                    app_object_id: imp.imageId,
                    contact_sheet_ref: imp.contactSheetRef || null,
                });
            }
            for (const rej of result.rejected) {
                events.push({
                    schema_version: 1,
                    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                    event_kind: 'media_rejected',
                    timestamp: new Date().toISOString(),
                    dataset_id: plan.datasetId,
                    task_id: plan.taskId,
                    app: 'castkit_codex',
                    lane: plan.lane,
                    media_id: null,
                    app_object_id: rej.rejectionId || null,
                    rejection_reason: rej.rejectionReason || '',
                });
            }
            result.appSyncEventsAppended = handler.appendAppSyncEvents(plan.appSyncEventsPath, events);
        }

        if (!isDryRun && batchId) {
            await lib.finishIngestionBatch({
                batchId,
                importedCount: result.imported.length,
                skippedCount: result.skipped.length + result.rejected.length,
            });
        }
    } catch (err) {
        if (!isDryRun && batchId) {
            try {
                await lib.finishIngestionBatch({
                    batchId,
                    importedCount: result.imported.length,
                    skippedCount: result.skipped.length + result.rejected.length,
                    error: err instanceof Error ? err.message : String(err),
                });
            } catch { /* best-effort */ }
        }
        throw err;
    }

    return result;
}

module.exports = {
    HANDLERS,
    fileSha256Hex,
    readSpecVersion,
    resolveHandler,
    runIngestion,
};
