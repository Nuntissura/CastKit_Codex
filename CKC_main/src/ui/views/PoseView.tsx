import React from 'react';
import { Pose3DViewport } from '../components/Pose3DViewport';
import { detectPoseFromImage } from '../../posekit/poseDetectionClient';
import {
  BODY_18,
  HEAD_POSE_LIMITS,
  createDefaultCalibration,
  createHeadPose,
  getRigStats,
  normalizeHeadPose,
  openposeJsonText,
  renderRigToCanvas,
} from '../../posekit/core.mjs';
import styles from './poseView.module.css';

type RightTab = 'inspector' | 'tools' | 'library' | 'identity' | 'log';
type ToolTab = 'calibration' | 'markers' | 'reframer';

type PoseViewProps = {
  initialCharacterId: string | null;
  initialImageId: string | null;
  onSelectCharacter?: (characterId: string | null) => void;
  onSelectImage?: (imageId: string | null) => void;
};

type Calibration = ReturnType<typeof createDefaultCalibration>;
type HeadPose = ReturnType<typeof createHeadPose>;

function imageUrl(imageId: string | null | undefined): string {
  const id = String(imageId ?? '').trim();
  return id ? `ckc://image/${encodeURIComponent(id)}` : '';
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'not saved';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

function safeCalibration(value: unknown, headPose: HeadPose, toolTab: ToolTab): Calibration {
  const fallback = createDefaultCalibration();
  const src = value && typeof value === 'object' ? (value as Partial<Calibration> & { yaw?: number; activeTool?: string; headPose?: unknown }) : {};
  return {
    ...fallback,
    ...src,
    schemaVersion: 1,
    activeTool: toolTab,
    yaw: headPose.yaw,
    headPose,
    perKeypoint: src.perKeypoint && typeof src.perKeypoint === 'object' ? src.perKeypoint : {},
    reframer: {
      ...fallback.reframer,
      ...(src.reframer && typeof src.reframer === 'object' ? src.reframer : {}),
    },
    visibility: src.visibility && typeof src.visibility === 'object' ? src.visibility : {},
  } as Calibration;
}

function isPoseRig(value: unknown): boolean {
  return !!value && typeof value === 'object' && Array.isArray((value as { body?: unknown }).body);
}

function onTabKey<T extends string>(
  event: React.KeyboardEvent<HTMLButtonElement>,
  tabs: T[],
  value: T,
  setValue: (next: T) => void
) {
  const current = tabs.indexOf(value);
  if (current < 0) return;
  let next = current;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  setValue(tabs[next]);
  requestAnimationFrame(() => {
    document.getElementById(`pose-tab-${tabs[next]}`)?.focus();
    document.getElementById(`pose-tool-tab-${tabs[next]}`)?.focus();
  });
}

export function PoseView({ initialCharacterId, initialImageId, onSelectCharacter, onSelectImage }: PoseViewProps) {
  const [characters, setCharacters] = React.useState<CKCCharacterListItem[]>([]);
  const [characterId, setCharacterId] = React.useState<string | null>(initialCharacterId);
  const [character, setCharacter] = React.useState<CKCCharacter | null>(null);
  const [selectedImageId, setSelectedImageId] = React.useState<string | null>(initialImageId);
  const [rigs, setRigs] = React.useState<CKCRig[]>([]);
  const [identityProfiles, setIdentityProfiles] = React.useState<CKCIdentityProfile[]>([]);
  const [selectedRigId, setSelectedRigId] = React.useState<string | null>(null);
  const [latestWorkflow, setLatestWorkflow] = React.useState<CKCWorkflowHistoryItem | null>(null);
  const [draftRig, setDraftRig] = React.useState<unknown | null>(null);
  const [rightTab, setRightTab] = React.useState<RightTab>('inspector');
  const [toolTab, setToolTab] = React.useState<ToolTab>('calibration');
  const [headPose, setHeadPose] = React.useState<HeadPose>(() => createHeadPose());
  const [calibration, setCalibration] = React.useState<Calibration>(() => safeCalibration(null, createHeadPose(), 'calibration'));
  const [calibrationDirty, setCalibrationDirty] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>('Ready');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const selectedRig = React.useMemo(
    () => rigs.find((rig) => rig.rigId === selectedRigId) ?? rigs[0] ?? null,
    [rigs, selectedRigId]
  );

  const selectedImage = React.useMemo(() => {
    const images = character?.images || [];
    if (!images.length) return null;
    return images.find((image) => image.id === selectedImageId) ?? images[0] ?? null;
  }, [character, selectedImageId]);

  const activeRig = React.useMemo(() => {
    if (draftRig && isPoseRig(draftRig)) return draftRig;
    if (selectedRig?.pose && isPoseRig(selectedRig.pose)) return selectedRig.pose;
    return null;
  }, [draftRig, selectedRig?.pose]);

  const rigStats = React.useMemo(() => (activeRig ? getRigStats(activeRig) : null), [activeRig]);

  const refreshCharacters = React.useCallback(async () => {
    const list = await window.ckc.listCharacters({ queryText: '', tagFilters: [] });
    setCharacters(Array.isArray(list) ? list : []);
    if (!characterId && list.length) {
      const firstId = list[0].id;
      setCharacterId(firstId);
      onSelectCharacter?.(firstId);
    }
  }, [characterId, onSelectCharacter]);

  const refreshCharacter = React.useCallback(async () => {
    const id = String(characterId ?? '').trim();
    if (!id) {
      setCharacter(null);
      setRigs([]);
      setIdentityProfiles([]);
      setSelectedRigId(null);
      setDraftRig(null);
      return;
    }

    const [detail, rigList, profileList] = await Promise.all([
      window.ckc.getCharacter(id),
      window.ckc.listRigs({ characterId: id }),
      window.ckc.listIdentityProfiles({ characterId: id }),
    ]);
    setCharacter(detail);
    setRigs(Array.isArray(rigList) ? rigList : []);
    setIdentityProfiles(Array.isArray(profileList) ? profileList : []);
    setSelectedRigId((current) => {
      if (current && rigList.some((rig) => rig.rigId === current)) return current;
      return rigList[0]?.rigId ?? null;
    });
    setSelectedImageId((current) => {
      if (current && detail?.images?.some((image) => image.id === current)) return current;
      return detail?.images?.[0]?.id ?? null;
    });
  }, [characterId]);

  React.useEffect(() => {
    refreshCharacters().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [refreshCharacters]);

  React.useEffect(() => {
    refreshCharacter().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [refreshCharacter]);

  React.useEffect(() => {
    setCharacterId(initialCharacterId);
  }, [initialCharacterId]);

  React.useEffect(() => {
    setSelectedImageId(initialImageId);
  }, [initialImageId]);

  React.useEffect(() => {
    onSelectImage?.(selectedImage?.id ?? null);
  }, [onSelectImage, selectedImage?.id]);

  React.useEffect(() => {
    const id = String(characterId ?? '').trim();
    if (!id) {
      setLatestWorkflow(null);
      return;
    }
    window.ckc
      .getWorkflowHistory({ characterId: id, limit: 1 })
      .then((rows) => setLatestWorkflow(Array.isArray(rows) ? rows[0] ?? null : null))
      .catch(() => setLatestWorkflow(null));
  }, [characterId, status]);

  React.useEffect(() => {
    setDraftRig(null);
    const nextHeadPose = normalizeHeadPose(
      selectedRig?.calibration && typeof selectedRig.calibration === 'object'
        ? (selectedRig.calibration as { headPose?: unknown; yaw?: number }).headPose || { yaw: (selectedRig.calibration as { yaw?: number }).yaw || 0 }
        : null
    );
    setHeadPose(nextHeadPose);
    setCalibration(safeCalibration(selectedRig?.calibration, nextHeadPose, toolTab));
    setCalibrationDirty(false);
  }, [selectedRig?.rigId]);

  React.useEffect(() => {
    setCalibration((current) => ({ ...current, yaw: headPose.yaw, headPose, activeTool: toolTab }) as Calibration);
  }, [headPose, toolTab]);

  React.useEffect(() => {
    if (!activeRig) return;
    const overlay = overlayCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (overlay) renderRigToCanvas(overlay, activeRig, { headPose, calibration, background: 'transparent', alpha: true });
    if (preview) renderRigToCanvas(preview, activeRig, { headPose, calibration, background: '#000000' });
  }, [activeRig, headPose, calibration]);

  React.useEffect(() => {
    if (!selectedRig || !calibrationDirty) return;
    const timer = window.setTimeout(() => {
      window.ckc
        .updateRigCalibration({ rigId: selectedRig.rigId, calibrationJson: calibration })
        .then(() => {
          setCalibrationDirty(false);
          setStatus(`Calibration auto-saved ${formatDate(new Date().toISOString())}`);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [calibration, calibrationDirty, selectedRig]);

  async function createRig() {
    const cid = String(characterId ?? '').trim();
    const imageId = selectedImage?.id;
    if (!cid || !imageId) {
      setError('Select a character image first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.ckc.createRig({
        characterId: cid,
        portraitImageId: imageId,
        label: selectedImage.notes ? selectedImage.notes.slice(0, 48) : `Rig ${rigs.length + 1}`,
        calibrationJson: calibration,
      });
      setSelectedRigId(result.rigId);
      setStatus(`Rig saved ${formatDate(new Date().toISOString())}`);
      await refreshCharacter();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function detectPose() {
    const cid = String(characterId ?? '').trim();
    const imageId = selectedImage?.id;
    const image = imageRef.current;
    if (!cid || !imageId || !image) {
      setError('Select a loaded character image first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detection = await detectPoseFromImage({
        image,
        characterId: cid,
        portraitImageId: imageId,
        canvasWidth: 1024,
        canvasHeight: 1024,
      });
      setDraftRig(detection.rig);

      let rigId = selectedRig?.portraitImageId === imageId ? selectedRig.rigId : null;
      if (!rigId) {
        const created = await window.ckc.createRig({
          characterId: cid,
          portraitImageId: imageId,
          label: selectedImage.notes ? selectedImage.notes.slice(0, 48) : `Rig ${rigs.length + 1}`,
          poseJson: detection.rig,
          calibrationJson: calibration,
          status: detection.fallback ? 'fallback' : 'ready',
        });
        rigId = created.rigId;
      } else {
        await window.ckc.updateRigPose({ rigId, poseJson: detection.rig, status: detection.fallback ? 'fallback' : 'ready' });
      }
      setSelectedRigId(rigId);
      setRightTab('inspector');
      setStatus(`${detection.fallback ? 'Fallback rig' : 'Pose detected'} in ${detection.durationMs} ms`);
      await refreshCharacter();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveCalibration() {
    if (!selectedRig) {
      setError('Create a rig first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.ckc.updateRigCalibration({ rigId: selectedRig.rigId, calibrationJson: calibration });
      setCalibrationDirty(false);
      setStatus(`Calibration saved ${formatDate(new Date().toISOString())}`);
      await refreshCharacter();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function exportOpenpose() {
    if (!selectedRig) {
      setError('Create or select a rig first.');
      return;
    }
    if (!activeRig) {
      setError('Detect pose before exporting openpose.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      renderRigToCanvas(canvas, activeRig, { headPose, calibration, background: '#000000' });
      const pngBase64 = canvas.toDataURL('image/png');
      const result = await window.ckc.exportOpenposePng({ rigId: selectedRig.rigId, pngBase64, width: canvas.width, height: canvas.height });
      setStatus(`${result.deduped ? 'Openpose already saved' : 'Openpose saved'} ${result.imageId}`);
      await refreshCharacter();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function replayLatestWorkflow() {
    if (!latestWorkflow) {
      setError('No stored workflow for this character.');
      return;
    }
    if (!selectedRig) {
      setError('Select a rig before replay.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.ckc.replayWorkflow({
        workflowJson: latestWorkflow.workflow,
        characterId,
        rigId: selectedRig.rigId,
      });
      setStatus(`Replay submitted ${result.promptId || result.clientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createIdentityProfile() {
    const cid = String(characterId ?? '').trim();
    const imageId = selectedImage?.id;
    if (!cid || !imageId) {
      setError('Select a character image first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.ckc.createIdentityProfile({
        characterId: cid,
        sourceImageId: imageId,
        sourceRigId: selectedRig?.portraitImageId === imageId ? selectedRig.rigId : null,
        name: `identity_${identityProfiles.length + 1}`,
      });
      setRightTab('identity');
      setStatus(`Identity profile saved ${result.profileId}`);
      await refreshCharacter();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteIdentityProfile(profileId: string) {
    setBusy(true);
    setError(null);
    try {
      await window.ckc.deleteIdentityProfile({ profileId });
      setStatus(`Identity profile deleted ${profileId}`);
      await refreshCharacter();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function updateCalibration(mutator: (draft: Calibration) => Calibration) {
    setCalibration((current) => {
      const next = mutator(safeCalibration(current, headPose, toolTab));
      return next;
    });
    setCalibrationDirty(true);
  }

  function setHeadPoseAxis(axis: 'yaw' | 'pitch' | 'roll', value: number) {
    const limits = HEAD_POSE_LIMITS[axis] as readonly [number, number];
    const clamped = Math.min(limits[1], Math.max(limits[0], Number(value) || 0));
    setHeadPose((current) => createHeadPose({ ...current, [axis]: clamped }));
    setCalibrationDirty(true);
  }

  function resetHeadPoseAxis(axis: 'yaw' | 'pitch' | 'roll') {
    setHeadPoseAxis(axis, 0);
  }

  function setKeypointVisible(id: string, visible: boolean) {
    updateCalibration((current) => ({
      ...current,
      perKeypoint: {
        ...current.perKeypoint,
        [id]: {
          ...(current.perKeypoint as Record<string, Record<string, unknown>>)[id],
          visible,
        },
      },
    }));
  }

  function setKeypointOffset(id: string, axis: 0 | 1, value: number) {
    updateCalibration((current) => {
      const existing = ((current.perKeypoint as Record<string, { offsetXY?: [number, number] }>)[id]?.offsetXY || [0, 0]) as [number, number];
      const nextOffset: [number, number] = axis === 0 ? [value, existing[1]] : [existing[0], value];
      return {
        ...current,
        perKeypoint: {
          ...current.perKeypoint,
          [id]: {
            ...(current.perKeypoint as Record<string, Record<string, unknown>>)[id],
            offsetXY: nextOffset,
          },
        },
      };
    });
  }

  function setReframerField(field: 'scale' | 'offsetX' | 'offsetY' | 'anchor', value: number | string) {
    updateCalibration((current) => ({
      ...current,
      reframer: {
        ...current.reframer,
        [field]: value,
      },
    }));
  }

  const rightTabs: Array<{ id: RightTab; label: string }> = [
    { id: 'inspector', label: 'Inspector' },
    { id: 'tools', label: 'Tools' },
    { id: 'library', label: 'Library' },
    { id: 'identity', label: 'Identity' },
    { id: 'log', label: 'Log' },
  ];
  const toolTabs: Array<{ id: ToolTab; label: string }> = [
    { id: 'calibration', label: 'Calibration' },
    { id: 'markers', label: 'Markers' },
    { id: 'reframer', label: 'Reframer' },
  ];

  return (
    <section className={styles.root} data-testid="pose-view" data-calibration={rightTab === 'tools' && toolTab === 'calibration' ? '1' : '0'}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <span className={styles.kicker}>Pose</span>
          <strong>{character?.displayName || 'Library'}</strong>
        </div>
        <label className={styles.selectLabel}>
          <span>Character</span>
          <select
            value={characterId ?? ''}
            onChange={(event) => {
              const next = event.target.value || null;
              setCharacterId(next);
              onSelectCharacter?.(next);
              setSelectedRigId(null);
              setDraftRig(null);
              setError(null);
            }}
            data-action="pose-select-character"
          >
            <option value="">Select</option>
            {characters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.headPoseStrip} data-action="pose-head-pose-controls">
          {([
            ['yaw', 'Yaw', 15],
            ['pitch', 'Pitch', 5],
            ['roll', 'Roll', 5],
          ] as const).map(([axis, label, step]) => {
            const limits = HEAD_POSE_LIMITS[axis] as readonly [number, number];
            return (
              <label key={axis} className={styles.axisControl}>
                <span>{label}</span>
                <input
                  type="number"
                  min={limits[0]}
                  max={limits[1]}
                  step={step}
                  value={headPose[axis]}
                  onChange={(event) => setHeadPoseAxis(axis, Number(event.target.value) || 0)}
                  data-action={`pose-${axis}-input`}
                />
                <input
                  className={styles.headPoseRange}
                  type="range"
                  min={limits[0]}
                  max={limits[1]}
                  step={step}
                  value={headPose[axis]}
                  onChange={(event) => setHeadPoseAxis(axis, Number(event.target.value) || 0)}
                  aria-label={label}
                  data-action={`pose-${axis}-slider`}
                />
                <button type="button" className={styles.iconButton} onClick={() => resetHeadPoseAxis(axis)} data-action={`pose-${axis}-reset`} aria-label={`Reset ${label}`}>
                  0
                </button>
              </label>
            );
          })}
        </div>
        <button type="button" className={styles.button} onClick={() => refreshCharacter()} disabled={busy} data-action="pose-reload">
          Reload
        </button>
        <button type="button" className={styles.button} onClick={createRig} disabled={busy || !selectedImage} data-action="pose-create-rig">
          New rig
        </button>
        <button type="button" className={styles.primaryButton} onClick={detectPose} disabled={busy || !selectedImage} data-action="pose-detect">
          Detect pose
        </button>
        <button type="button" className={styles.button} onClick={exportOpenpose} disabled={busy || !activeRig || !selectedRig} data-action="pose-export-openpose">
          Export openpose
        </button>
        <button type="button" className={styles.button} onClick={createIdentityProfile} disabled={busy || !selectedImage} data-action="pose-create-identity-profile">
          Identity
        </button>
        <button type="button" className={styles.button} onClick={replayLatestWorkflow} disabled={busy || !latestWorkflow || !selectedRig} data-action="pose-replay-comfyui">
          Replay
        </button>
      </header>

      <div className={styles.workspace}>
        <div className={styles.leftPage}>
          <div className={styles.imageStage} data-action="pose-image-stage">
            {selectedImage ? (
              <>
                <img ref={imageRef} src={imageUrl(selectedImage.id)} alt={selectedImage.notes || 'Selected portrait'} />
                <canvas ref={overlayCanvasRef} className={styles.poseOverlay} data-action="pose-overlay-canvas" />
              </>
            ) : (
              <div className={styles.emptyStage}>No image selected</div>
            )}
            <div className={styles.stageOverlay}>
              <span>{headPose.yaw} / {headPose.pitch} / {headPose.roll} deg</span>
              <span>{selectedRig ? selectedRig.status : 'draft'}</span>
              <span>{rigStats ? `${rigStats.visibleBody}/${rigStats.bodyCount}` : 'no pose'}</span>
            </div>
          </div>
          <div className={styles.previewRow}>
            <div className={styles.openposePreview}>
              <canvas ref={previewCanvasRef} data-action="pose-openpose-preview" />
            </div>
            <div className={styles.previewData}>
              <span>Detector</span>
              <strong>{rigStats?.detectorStatus || 'none'}</strong>
              <span>Provider</span>
              <strong>{rigStats?.detectorProvider || 'none'}</strong>
            </div>
          </div>
          <div className={styles.filmstrip} aria-label="Images">
            {(character?.images || []).slice(0, 24).map((image) => (
              <button
                key={image.id}
                type="button"
                className={styles.thumb}
                data-selected={selectedImage?.id === image.id ? '1' : '0'}
                data-image-id={image.id}
                onClick={() => {
                  setSelectedImageId(image.id);
                  onSelectImage?.(image.id);
                  setDraftRig(null);
                  setError(null);
                }}
              >
                <img src={imageUrl(image.id)} alt={image.notes || image.id} />
              </button>
            ))}
          </div>
        </div>

        <aside className={styles.rightPage}>
          <div className={styles.tabs} role="tablist" aria-label="Pose data tabs">
            {rightTabs.map((tab) => (
              <button
                key={tab.id}
                id={`pose-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={rightTab === tab.id}
                aria-controls={`pose-panel-${tab.id}`}
                tabIndex={rightTab === tab.id ? 0 : -1}
                className={styles.tab}
                data-active={rightTab === tab.id ? '1' : '0'}
                data-action={`pose-tab-${tab.id}`}
                onClick={() => setRightTab(tab.id)}
                onKeyDown={(event) => onTabKey(event, rightTabs.map((item) => item.id), rightTab, setRightTab)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.panel} id={`pose-panel-${rightTab}`} role="tabpanel" aria-labelledby={`pose-tab-${rightTab}`} tabIndex={0}>
            {rightTab === 'inspector' ? (
              <div className={styles.stack}>
                <div className={styles.dataRow}>
                  <span>Character</span>
                  <strong>{character?.displayName || 'None'}</strong>
                </div>
                <div className={styles.dataRow}>
                  <span>Image</span>
                  <strong>{selectedImage?.id || 'None'}</strong>
                </div>
                <div className={styles.dataRow}>
                  <span>Rig</span>
                  <strong>{selectedRig?.rigId || 'None'}</strong>
                </div>
                <div className={styles.dataRow}>
                  <span>Updated</span>
                  <strong>{formatDate(selectedRig?.updatedAt)}</strong>
                </div>
                <pre className={styles.jsonBox}>{activeRig ? openposeJsonText(activeRig, { headPose, calibration }) : selectedRig ? JSON.stringify(selectedRig.pose, null, 2) : '{}'}</pre>
              </div>
            ) : null}

            {rightTab === 'tools' ? (
              <div className={styles.stack}>
                <div className={styles.subtabs} role="tablist" aria-label="Pose tools">
                  {toolTabs.map((tab) => (
                    <button
                      key={tab.id}
                      id={`pose-tool-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={toolTab === tab.id}
                      aria-controls={`pose-tool-panel-${tab.id}`}
                      tabIndex={toolTab === tab.id ? 0 : -1}
                      className={styles.subtab}
                      data-active={toolTab === tab.id ? '1' : '0'}
                      data-action={`pose-tool-${tab.id}`}
                      onClick={() => setToolTab(tab.id)}
                      onKeyDown={(event) => onTabKey(event, toolTabs.map((item) => item.id), toolTab, setToolTab)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className={styles.toolPanel} id={`pose-tool-panel-${toolTab}`} role="tabpanel" aria-labelledby={`pose-tool-tab-${toolTab}`}>
                  {toolTab === 'calibration' ? (
                    <>
                      <div className={styles.viewport3d} data-action="pose-3d-viewport">
                        {activeRig ? <Pose3DViewport rig={activeRig} headPose={headPose} /> : <div className={styles.emptyPanel}>No rig loaded</div>}
                      </div>
                      <div className={styles.poseReadout}>
                        <span>Order</span>
                        <strong>{headPose.order}</strong>
                        <span>Quaternion</span>
                        <code>{headPose.quaternion.map((n: number) => n.toFixed(4)).join(', ')}</code>
                      </div>
                      <button type="button" className={styles.primaryButton} onClick={saveCalibration} disabled={busy || !selectedRig} data-action="pose-save-calibration">
                        Save calibration
                      </button>
                    </>
                  ) : null}
                  {toolTab === 'markers' ? (
                    <div className={styles.markerList}>
                      {BODY_18.map((kp: { id: string }) => {
                        const cfg = (calibration.perKeypoint as Record<string, { visible?: boolean; offsetXY?: [number, number] }>)[kp.id] || {};
                        const offset = cfg.offsetXY || [0, 0];
                        return (
                          <div key={kp.id} className={styles.markerRow}>
                            <label className={styles.checkRow}>
                              <input type="checkbox" checked={cfg.visible !== false} onChange={(event) => setKeypointVisible(kp.id, event.target.checked)} />
                              <span>{kp.id.replaceAll('_', ' ')}</span>
                            </label>
                            <input aria-label={`${kp.id} X offset`} type="range" min="-80" max="80" step="1" value={offset[0]} onChange={(event) => setKeypointOffset(kp.id, 0, Number(event.target.value) || 0)} />
                            <input aria-label={`${kp.id} Y offset`} type="range" min="-80" max="80" step="1" value={offset[1]} onChange={(event) => setKeypointOffset(kp.id, 1, Number(event.target.value) || 0)} />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {toolTab === 'reframer' ? (
                    <>
                      <label className={styles.fieldLabel}>
                        <span>Scale</span>
                        <input type="range" min="0.3" max="2" step="0.05" value={Number(calibration.reframer.scale) || 1} onChange={(event) => setReframerField('scale', Number(event.target.value) || 1)} />
                      </label>
                      <label className={styles.fieldLabel}>
                        <span>Offset X</span>
                        <input type="range" min="-300" max="300" step="1" value={Number(calibration.reframer.offsetX) || 0} onChange={(event) => setReframerField('offsetX', Number(event.target.value) || 0)} />
                      </label>
                      <label className={styles.fieldLabel}>
                        <span>Offset Y</span>
                        <input type="range" min="-300" max="300" step="1" value={Number(calibration.reframer.offsetY) || 0} onChange={(event) => setReframerField('offsetY', Number(event.target.value) || 0)} />
                      </label>
                      <label className={styles.fieldLabel}>
                        <span>Anchor</span>
                        <select value={String(calibration.reframer.anchor || 'head')} onChange={(event) => setReframerField('anchor', event.target.value)}>
                          <option value="head">Head</option>
                          <option value="canvas_center">Canvas center</option>
                        </select>
                      </label>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {rightTab === 'library' ? (
              <div className={styles.stack}>
                {rigs.length ? (
                  rigs.map((rig) => (
                    <button
                      key={rig.rigId}
                      type="button"
                      className={styles.rigItem}
                      data-selected={selectedRig?.rigId === rig.rigId ? '1' : '0'}
                      data-rig-id={rig.rigId}
                      onClick={() => {
                        setSelectedRigId(rig.rigId);
                        setSelectedImageId(rig.portraitImageId);
                        setDraftRig(null);
                        setError(null);
                      }}
                    >
                      <strong>{rig.label || rig.rigId}</strong>
                      <span>{formatDate(rig.updatedAt)}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyPanel}>No rigs</div>
                )}
              </div>
            ) : null}

            {rightTab === 'identity' ? (
              <div className={styles.stack} data-action="pose-identity-panel">
                <button type="button" className={styles.primaryButton} onClick={createIdentityProfile} disabled={busy || !selectedImage} data-action="pose-identity-create">
                  Create from image
                </button>
                <div className={styles.dataRow}>
                  <span>Profiles</span>
                  <strong>{identityProfiles.length}</strong>
                </div>
                {identityProfiles.length ? (
                  identityProfiles.map((profile) => (
                    <div key={profile.profileId} className={styles.identityItem} data-profile-id={profile.profileId}>
                      <img src={imageUrl(profile.croppedFaceImageId)} alt={profile.name || profile.profileId} />
                      <div>
                        <strong>{profile.name || profile.profileId}</strong>
                        <span>{profile.sourceRigId || 'no rig'}</span>
                        <code>{profile.cropRelativePath || profile.croppedFaceImageId}</code>
                      </div>
                      <button type="button" className={styles.smallButton} onClick={() => deleteIdentityProfile(profile.profileId)} disabled={busy} data-action="pose-identity-delete">
                        Delete
                      </button>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyPanel}>No identity profiles</div>
                )}
              </div>
            ) : null}

            {rightTab === 'log' ? (
              <div className={styles.stack}>
                <div className={styles.statusLine}>{status}</div>
                {error ? <div className={styles.errorLine}>{error}</div> : null}
                <div className={styles.dataRow}>
                  <span>Rigs</span>
                  <strong>{rigs.length}</strong>
                </div>
                <div className={styles.dataRow}>
                  <span>Images</span>
                  <strong>{character?.images?.length || 0}</strong>
                </div>
                <div className={styles.dataRow}>
                  <span>Identities</span>
                  <strong>{identityProfiles.length}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
