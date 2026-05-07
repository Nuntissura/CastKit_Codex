import React from 'react';
import styles from './workflowView.module.css';

type WorkflowTab = 'prompts' | 'beats' | 'replay';

type WorkflowViewProps = {
  initialCharacterId: string | null;
  onSelectCharacter?: (characterId: string | null) => void;
};

function imageUrl(imageId: string | null | undefined): string {
  const id = String(imageId ?? '').trim();
  return id ? `ckc://image/${encodeURIComponent(id)}` : '';
}

function splitTags(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'not saved';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
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
  if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  setValue(tabs[next]);
  requestAnimationFrame(() => document.getElementById(`workflow-tab-${tabs[next]}`)?.focus());
}

export function WorkflowView({ initialCharacterId, onSelectCharacter }: WorkflowViewProps) {
  const [characters, setCharacters] = React.useState<CKCCharacterListItem[]>([]);
  const [characterId, setCharacterId] = React.useState<string | null>(initialCharacterId);
  const [character, setCharacter] = React.useState<CKCCharacter | null>(null);
  const [rigs, setRigs] = React.useState<CKCRig[]>([]);
  const [identityProfiles, setIdentityProfiles] = React.useState<CKCIdentityProfile[]>([]);
  const [selectedRigId, setSelectedRigId] = React.useState<string | null>(null);
  const [selectedIdentityProfileId, setSelectedIdentityProfileId] = React.useState<string | null>(null);
  const [prompts, setPrompts] = React.useState<CKCPrompt[]>([]);
  const [beats, setBeats] = React.useState<CKCStoryBeatItem[]>([]);
  const [workflowHistory, setWorkflowHistory] = React.useState<CKCWorkflowHistoryItem[]>([]);
  const [tab, setTab] = React.useState<WorkflowTab>('prompts');
  const [promptKind, setPromptKind] = React.useState<string>('positive');
  const [promptTitle, setPromptTitle] = React.useState<string>('');
  const [promptText, setPromptText] = React.useState<string>('');
  const [promptTags, setPromptTags] = React.useState<string>('');
  const [beatTitle, setBeatTitle] = React.useState<string>('');
  const [beatBody, setBeatBody] = React.useState<string>('');
  const [selectedPromptIds, setSelectedPromptIds] = React.useState<string[]>([]);
  const [selectedWorkflowImageId, setSelectedWorkflowImageId] = React.useState<string | null>(null);
  const [workflowText, setWorkflowText] = React.useState<string>('{}');
  const [comfyHost, setComfyHost] = React.useState<string>('http://127.0.0.1:8188');
  const [status, setStatus] = React.useState<string>('Ready');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);

  const selectedRig = React.useMemo(
    () => rigs.find((rig) => rig.rigId === selectedRigId) ?? rigs[0] ?? null,
    [rigs, selectedRigId]
  );

  const portraitImageId = selectedRig?.portraitImageId ?? character?.images?.[0]?.id ?? null;

  const refreshCharacters = React.useCallback(async () => {
    const list = await window.ckc.listCharacters({ queryText: '', tagFilters: [] });
    setCharacters(Array.isArray(list) ? list : []);
    if (!characterId && list.length) {
      const firstId = list[0].id;
      setCharacterId(firstId);
      onSelectCharacter?.(firstId);
    }
  }, [characterId, onSelectCharacter]);

  const refreshData = React.useCallback(async () => {
    const id = String(characterId ?? '').trim();
    if (!id) {
      setCharacter(null);
      setRigs([]);
      setIdentityProfiles([]);
      setPrompts([]);
      setBeats([]);
      setWorkflowHistory([]);
      return;
    }
    const [detail, rigList, profileList, promptList, beatList, historyList] = await Promise.all([
      window.ckc.getCharacter(id),
      window.ckc.listRigs({ characterId: id }),
      window.ckc.listIdentityProfiles({ characterId: id }),
      window.ckc.listPrompts({ characterId: id }),
      window.ckc.listStoryBeats({ characterId: id }),
      window.ckc.getWorkflowHistory({ characterId: id, limit: 50 }),
    ]);
    setCharacter(detail);
    setRigs(Array.isArray(rigList) ? rigList : []);
    setIdentityProfiles(Array.isArray(profileList) ? profileList : []);
    setPrompts(Array.isArray(promptList) ? promptList : []);
    setBeats(Array.isArray(beatList) ? beatList : []);
    const histories = Array.isArray(historyList) ? historyList : [];
    setWorkflowHistory(histories);
    setSelectedWorkflowImageId((current) => {
      if (current && histories.some((item) => item.imageId === current)) return current;
      return histories[0]?.imageId ?? null;
    });
    setWorkflowText((current) => {
      if (current && current !== '{}') return current;
      return histories[0]?.workflowJson || '{}';
    });
    setSelectedRigId((current) => {
      if (current && rigList.some((rig) => rig.rigId === current)) return current;
      return rigList[0]?.rigId ?? null;
    });
    setSelectedIdentityProfileId((current) => {
      if (current && profileList.some((profile) => profile.profileId === current)) return current;
      return profileList[0]?.profileId ?? null;
    });
  }, [characterId]);

  React.useEffect(() => {
    setCharacterId(initialCharacterId);
  }, [initialCharacterId]);

  React.useEffect(() => {
    refreshCharacters().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [refreshCharacters]);

  React.useEffect(() => {
    refreshData().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [refreshData]);

  async function savePrompt() {
    setBusy(true);
    setError(null);
    try {
      const result = await window.ckc.upsertPrompt({
        characterId,
        kind: promptKind,
        title: promptTitle,
        text: promptText,
        tags: splitTags(promptTags),
      });
      setStatus(`Prompt saved ${result.promptId}`);
      setPromptTitle('');
      setPromptText('');
      setPromptTags('');
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deletePrompt(promptId: string) {
    setBusy(true);
    setError(null);
    try {
      await window.ckc.deletePrompt({ promptId });
      setSelectedPromptIds((ids) => ids.filter((id) => id !== promptId));
      setStatus(`Prompt deleted ${promptId}`);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveBeat() {
    setBusy(true);
    setError(null);
    try {
      const result = await window.ckc.upsertStoryBeat({
        characterId,
        title: beatTitle,
        body: beatBody,
        promptIds: selectedPromptIds,
        orderIndex: beats.length,
      });
      setStatus(`Beat saved ${result.beatId}`);
      setBeatTitle('');
      setBeatBody('');
      setSelectedPromptIds([]);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteBeat(beatId: string) {
    setBusy(true);
    setError(null);
    try {
      await window.ckc.deleteStoryBeat({ beatId });
      setStatus(`Beat deleted ${beatId}`);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function extractWorkflowPrompts() {
    setBusy(true);
    setError(null);
    try {
      const result = await window.ckc.extractPromptFromWorkflow({ workflowJson: workflowText });
      setStatus(`Extracted ${result.positive.length} positive, ${result.negative.length} negative, ${result.loras.length} LoRA entries`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function replayWorkflow() {
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(workflowText || '{}');
      const result = await window.ckc.replayWorkflow({
        host: comfyHost,
        workflowJson: parsed,
        characterId,
        rigId: selectedRig?.rigId ?? null,
        identityProfileId: selectedIdentityProfileId,
      });
      setStatus(`Replay submitted ${result.promptId || result.clientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: WorkflowTab; label: string }> = [
    { id: 'prompts', label: 'Prompts' },
    { id: 'beats', label: 'Story beats' },
    { id: 'replay', label: 'Replay' },
  ];

  return (
    <section className={styles.root} data-testid="workflow-view">
      <header className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <span className={styles.kicker}>Workflow</span>
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
              setError(null);
            }}
            data-action="workflow-select-character"
          >
            <option value="">Select</option>
            {characters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectLabel}>
          <span>Rig</span>
          <select
            value={selectedRigId ?? ''}
            onChange={(event) => setSelectedRigId(event.target.value || null)}
            data-action="workflow-select-rig"
          >
            <option value="">None</option>
            {rigs.map((rig) => (
              <option key={rig.rigId} value={rig.rigId}>
                {rig.label || rig.rigId}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.button} onClick={() => refreshData()} disabled={busy} data-action="workflow-reload">
          Reload
        </button>
      </header>

      <div className={styles.workspace}>
        <div className={styles.leftPage}>
          <div className={styles.imageStage}>
            {portraitImageId ? <img src={imageUrl(portraitImageId)} alt={character?.displayName || 'Workflow image'} /> : <div className={styles.emptyStage}>No rig image</div>}
          </div>
          <div className={styles.summaryGrid}>
            <div>
              <span>Prompts</span>
              <strong>{prompts.length}</strong>
            </div>
            <div>
              <span>Beats</span>
              <strong>{beats.length}</strong>
            </div>
            <div>
              <span>Rigs</span>
              <strong>{rigs.length}</strong>
            </div>
            <div>
              <span>Runs</span>
              <strong>{workflowHistory.length}</strong>
            </div>
            <div>
              <span>Identities</span>
              <strong>{identityProfiles.length}</strong>
            </div>
          </div>
        </div>

        <aside className={styles.rightPage}>
          <div className={styles.tabs} role="tablist" aria-label="Workflow tabs">
            {tabs.map((item) => (
              <button
                key={item.id}
                id={`workflow-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`workflow-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={styles.tab}
                data-active={tab === item.id ? '1' : '0'}
                data-action={`workflow-tab-${item.id}`}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => onTabKey(event, tabs.map((entry) => entry.id), tab, setTab)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.panel} id={`workflow-panel-${tab}`} role="tabpanel" aria-labelledby={`workflow-tab-${tab}`} tabIndex={0}>
            {tab === 'prompts' ? (
              <div className={styles.stack}>
                <div className={styles.formGrid}>
                  <label className={styles.fieldLabel}>
                    <span>Kind</span>
                    <select value={promptKind} onChange={(event) => setPromptKind(event.target.value)} data-action="workflow-prompt-kind">
                      <option value="positive">Positive</option>
                      <option value="negative">Negative</option>
                      <option value="style">Style</option>
                      <option value="shot">Shot</option>
                    </select>
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Title</span>
                    <input value={promptTitle} onChange={(event) => setPromptTitle(event.target.value)} data-action="workflow-prompt-title" />
                  </label>
                </div>
                <label className={styles.fieldLabel}>
                  <span>Prompt</span>
                  <textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} rows={5} data-action="workflow-prompt-text" />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Tags</span>
                  <input value={promptTags} onChange={(event) => setPromptTags(event.target.value)} data-action="workflow-prompt-tags" />
                </label>
                <button type="button" className={styles.primaryButton} onClick={savePrompt} disabled={busy || !promptText.trim()} data-action="workflow-save-prompt">
                  Save prompt
                </button>
                <div className={styles.list}>
                  {prompts.map((prompt) => (
                    <div key={prompt.promptId} className={styles.listItem}>
                      <div>
                        <strong>{prompt.title || prompt.kind}</strong>
                        <p>{prompt.text}</p>
                        <span>{prompt.tags.join(', ') || formatDate(prompt.updatedAt)}</span>
                      </div>
                      <button type="button" className={styles.smallButton} onClick={() => deletePrompt(prompt.promptId)} disabled={busy} data-prompt-id={prompt.promptId}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'beats' ? (
              <div className={styles.stack}>
                <label className={styles.fieldLabel}>
                  <span>Title</span>
                  <input value={beatTitle} onChange={(event) => setBeatTitle(event.target.value)} data-action="workflow-beat-title" />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Body</span>
                  <textarea value={beatBody} onChange={(event) => setBeatBody(event.target.value)} rows={5} data-action="workflow-beat-body" />
                </label>
                <div className={styles.promptPicker}>
                  {prompts.slice(0, 12).map((prompt) => (
                    <label key={prompt.promptId} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={selectedPromptIds.includes(prompt.promptId)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedPromptIds((ids) => checked ? [...ids, prompt.promptId] : ids.filter((id) => id !== prompt.promptId));
                        }}
                      />
                      <span>{prompt.title || prompt.kind}</span>
                    </label>
                  ))}
                </div>
                <button type="button" className={styles.primaryButton} onClick={saveBeat} disabled={busy || !beatTitle.trim()} data-action="workflow-save-beat">
                  Save beat
                </button>
                <div className={styles.list}>
                  {beats.map((beat) => (
                    <div key={beat.beatId} className={styles.listItem}>
                      <div>
                        <strong>{beat.title}</strong>
                        <p>{beat.body}</p>
                        <span>{beat.promptIds.length} prompts</span>
                      </div>
                      <button type="button" className={styles.smallButton} onClick={() => deleteBeat(beat.beatId)} disabled={busy} data-beat-id={beat.beatId}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'replay' ? (
              <div className={styles.stack}>
                <div className={styles.dataRow}>
                  <span>Rig</span>
                  <strong>{selectedRig?.rigId || 'None'}</strong>
                </div>
                <div className={styles.dataRow}>
                  <span>Stored runs</span>
                  <strong>{workflowHistory.length}</strong>
                </div>
                <label className={styles.fieldLabel}>
                  <span>Identity profile</span>
                  <select
                    value={selectedIdentityProfileId ?? ''}
                    onChange={(event) => setSelectedIdentityProfileId(event.target.value || null)}
                    data-action="workflow-identity-profile-select"
                  >
                    <option value="">None</option>
                    {identityProfiles.map((profile) => (
                      <option key={profile.profileId} value={profile.profileId}>
                        {profile.name || profile.profileId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.fieldLabel}>
                  <span>Recent run</span>
                  <select
                    value={selectedWorkflowImageId ?? ''}
                    onChange={(event) => {
                      const imageId = event.target.value || null;
                      setSelectedWorkflowImageId(imageId);
                      const item = workflowHistory.find((entry) => entry.imageId === imageId);
                      setWorkflowText(item?.workflowJson || '{}');
                    }}
                    data-action="workflow-history-select"
                  >
                    <option value="">Manual JSON</option>
                    {workflowHistory.map((item) => (
                      <option key={item.imageId} value={item.imageId}>
                        {formatDate(item.addedAt)} {item.metadata?.title ? String(item.metadata.title) : item.imageId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.fieldLabel}>
                  <span>ComfyUI host</span>
                  <input value={comfyHost} onChange={(event) => setComfyHost(event.target.value)} data-action="workflow-comfyui-host" />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Workflow JSON</span>
                  <textarea value={workflowText} onChange={(event) => setWorkflowText(event.target.value)} rows={9} data-action="workflow-json-text" />
                </label>
                <div className={styles.actionRow}>
                  <button type="button" className={styles.button} onClick={extractWorkflowPrompts} disabled={busy || !workflowText.trim()} data-action="workflow-extract-prompts">
                    Extract prompts
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={replayWorkflow} disabled={busy || !workflowText.trim()} data-action="workflow-replay-comfyui">
                    Replay
                  </button>
                </div>
                <div className={styles.dataRow}>
                  <span>Status</span>
                  <strong>{status}</strong>
                </div>
                <div className={styles.list}>
                  {workflowHistory.slice(0, 8).map((item) => (
                    <button
                      key={item.imageId}
                      type="button"
                      className={styles.historyItem}
                      data-selected={selectedWorkflowImageId === item.imageId ? '1' : '0'}
                      data-image-id={item.imageId}
                      onClick={() => {
                        setSelectedWorkflowImageId(item.imageId);
                        setWorkflowText(item.workflowJson || '{}');
                      }}
                    >
                      <strong>{item.metadata?.title ? String(item.metadata.title) : item.imageId}</strong>
                      <span>{formatDate(item.addedAt)}</span>
                    </button>
                  ))}
                </div>
                {error ? <div className={styles.errorLine}>{error}</div> : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
