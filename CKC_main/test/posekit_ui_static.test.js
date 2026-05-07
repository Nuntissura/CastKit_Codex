const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const APP_DIR = path.resolve(__dirname, '..', 'app');

function read(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf8');
}

test('pose and workflow routes are wired for renderer automation and drawer navigation', () => {
  const app = read(path.join('ui', 'App.tsx'));
  const drawer = read(path.join('ui', 'components', 'Drawer.tsx'));
  const commandMap = fs.readFileSync(path.join(APP_DIR, 'backend', 'automationCommandMap.js'), 'utf8');

  assert.match(app, /type Page = 'library' \| 'character' \| 'exports' \| 'intake' \| 'pose' \| 'workflow'/);
  assert.match(app, /command === 'openPose'/);
  assert.match(app, /command === 'openWorkflow'/);
  assert.match(app, /<PoseView/);
  assert.match(app, /<WorkflowView/);
  assert.match(drawer, /onNavigate\('pose'\)/);
  assert.match(drawer, /onNavigate\('workflow'\)/);
  assert.match(commandMap, /'openPose'/);
  assert.match(commandMap, /'openWorkflow'/);
  assert.match(commandMap, /'updateRigPose'/);
  assert.match(commandMap, /'exportOpenposePng'/);
  assert.match(commandMap, /'getWorkflowHistory'/);
  assert.match(commandMap, /'replayWorkflow'/);
});

test('pose and workflow tabs use ARIA tab semantics and stable automation selectors', () => {
  const pose = read(path.join('ui', 'views', 'PoseView.tsx'));
  const workflow = read(path.join('ui', 'views', 'WorkflowView.tsx'));

  for (const source of [pose, workflow]) {
    assert.match(source, /role="tablist"/);
    assert.match(source, /role="tab"/);
    assert.match(source, /role="tabpanel"/);
    assert.match(source, /aria-selected=/);
    assert.match(source, /aria-controls=/);
  }

  assert.match(pose, /data-testid="pose-view"/);
  assert.match(pose, /data-action="pose-create-rig"/);
  assert.match(pose, /data-action="pose-detect"/);
  assert.match(pose, /data-action="pose-export-openpose"/);
  assert.match(pose, /data-action="pose-replay-comfyui"/);
  assert.match(pose, /data-action="pose-openpose-preview"/);
  assert.match(pose, /data-action="pose-save-calibration"/);
  assert.match(workflow, /data-testid="workflow-view"/);
  assert.match(workflow, /data-action="workflow-save-prompt"/);
  assert.match(workflow, /data-action="workflow-save-beat"/);
  assert.match(workflow, /data-action="workflow-history-select"/);
  assert.match(workflow, /data-action="workflow-extract-prompts"/);
  assert.match(workflow, /data-action="workflow-replay-comfyui"/);
});
