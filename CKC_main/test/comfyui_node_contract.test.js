const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('comfyui node contract: bridge module has ComfyUI mappings', { skip: process.env.CKC_SKIP_PYTHON_TESTS === '1' }, () => {
  const repoRoot = path.resolve(__dirname, '..');
  const code = [
    'import importlib.util, pathlib',
    "p = pathlib.Path('comfyui_node/castkit_codex_bridge.py')",
    "spec = importlib.util.spec_from_file_location('bridge', p)",
    'm = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(m)',
    "assert 'CastKitCodexBridge' in m.NODE_CLASS_MAPPINGS",
    "assert m.NODE_CLASS_MAPPINGS['CastKitCodexBridge'].RETURN_TYPES == ()",
    "assert m.NODE_CLASS_MAPPINGS['CastKitCodexBridge'].CATEGORY == 'CastKit-Codex'",
  ].join('; ');
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let result = null;
  for (const exe of candidates) {
    result = spawnSync(exe, ['-c', code], { cwd: repoRoot, encoding: 'utf8' });
    if (result.status === 0) break;
    if (result.error && result.error.code === 'ENOENT') continue;
    break;
  }
  if (result?.error?.code === 'ENOENT') {
    assert.ok(true, 'Python not available; skipped by environment');
    return;
  }
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
