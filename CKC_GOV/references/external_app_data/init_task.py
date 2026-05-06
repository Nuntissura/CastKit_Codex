"""init_task.py - mechanical task initializer for image_sourcing_init_spec.

Stdlib only. No external dependencies. Portable: drop on any drive, run from any
directory, point at any spec file and any operator workspace root via absolute or
relative paths.

RUNTIME:
  Python 3.8+ recommended. No pip install required. Use "python", "py -3", or
  "python3" depending on the machine.

USAGE:
  python init_task.py \\
      --spec PATH/TO/image_sourcing_init_spec-idol_v00.19.json \\
      --operator-workspace-root PATH/TO/nickname_folder \\
      [--request PATH/TO/task_request.json] \\
      [--task-id task_cwb_isrc_0007_01K9Z8Y7X6W5V4T3S2R1Q0P9N8] \\
      [--project-code cwb_isrc] \\
      [--task-ordinal 7] \\
      [--dataset-ordinal 1] \\
      [--subject SUBJECT_NAME] \\
      [--group GROUP_NAME] \\
      [--subject-slug subject_slug] \\
      [--dry-run]

LLM FLOW:
  Run the command above. If the request file is missing, init_task.py prints
  TARGET FILE TO EDIT and writes that JSON file. Fill that file with the task
  id and criteria, then rerun the same command. Do not edit the init spec.

PORTABLE PATH RULE:
  When --spec is a relative path, init_task.py first looks for that spec next
  to this script, then falls back to the shell's current working directory. This
  prevents a moved/copy-pasted initializer from binding to an older same-named
  spec in a stale terminal directory. Relative --request paths resolve next to
  the selected spec. Use absolute paths when you intentionally want some other
  location.

The script:
  1. Parses the JSON spec.
  2. If no --request is supplied and task_request.json is missing next to the
     spec, writes that editable request template and exits.
  3. If a request exists, computes parent_init_spec_sha256.
  4. Resolves DATASET_ID, TASK_ID, BATCH_ID from the request/CLI.
  5. Creates the inner task_root subfolder named exactly after TASK_ID.
  6. Acquires run_state_lock atomically (refuses if already held).
  7. Creates the folder topology declared by the spec.
  8. Writes every required artifact with placeholder substitution.
  9. Generates JSON Schema exports (one per schemas[*] entry).
  10. Renders start_here.md.
  11. Writes initial validation_report.
  12. Releases the lock.
  Rolls back (deletes task_root) on any failure before lock release.

Exit codes:
  0 = success
  2 = preflight failure (bad CLI args, spec not parseable, target exists, etc.)
  3 = init failure (rollback performed)
"""
from __future__ import annotations

import argparse
import datetime as _dt
import errno
import hashlib
import json
import os
import re
import secrets
import shutil
import sys
import time
import uuid
from pathlib import Path
from typing import Any


# --- ID + timestamp helpers --------------------------------------------------

CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
PROJECT_CODE_RE = re.compile(r"^[a-z0-9_]{3,24}$")
TASK_ID_RE = re.compile(r"^task_([a-z0-9_]{3,24})_([0-9]{4})_([A-HJKMNP-TV-Z0-9]{26})$")
DATASET_ID_RE = re.compile(r"^dataset_[a-z0-9_]{3,24}_[0-9]{4}_[A-HJKMNP-TV-Z0-9]{26}$")
BATCH_ID_RE = re.compile(r"^batch_[a-z0-9_]{3,24}_[0-9]{4}_[0-9]{4}_[A-HJKMNP-TV-Z0-9]{26}$")
CONCRETE_ID_RE = re.compile(
    r"\b(?:task|dataset)_[a-z0-9_]{3,24}_[0-9]{4}_[A-HJKMNP-TV-Z0-9]{26}\b"
    r"|\bbatch_[a-z0-9_]{3,24}_[0-9]{4}_[0-9]{4}_[A-HJKMNP-TV-Z0-9]{26}\b"
)
ABSOLUTE_PATH_RE = re.compile(r"[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+")
SCRIPT_DIR = Path(__file__).resolve().parent


def now_utc_iso() -> str:
    """RFC 3339 UTC with trailing Z, second precision. Matches RID-TIME-001."""
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def now_utc_iso_compact() -> str:
    """RFC 3339 UTC with colons replaced by hyphens. Matches RID-HANDOFF-001."""
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def make_ulid() -> str:
    """26-char Crockford base32 ULID. Time-prefixed, sortable.
    48 bits of millisecond timestamp + 80 bits of randomness = 128 bits total."""
    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand = secrets.randbits(80)
    value = (ms << 80) | rand  # 128 bits
    chars = []
    for _ in range(26):
        chars.append(CROCKFORD_ALPHABET[value & 0x1F])
        value >>= 5
    return "".join(reversed(chars))


def make_uuidv7() -> str:
    """UUIDv7 - time-ordered. 48-bit ms timestamp, version 7, 74 bits random."""
    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)
    # Layout: 48-bit ms | 4-bit version (7) | 12-bit rand_a | 2-bit variant (10) | 62-bit rand_b
    high = (ms << 16) | (0x7 << 12) | rand_a
    low = (0b10 << 62) | rand_b
    return str(uuid.UUID(int=(high << 64) | low))


def make_uuidv4() -> str:
    return str(uuid.uuid4())


# --- Request + neutrality helpers -------------------------------------------

def default_request_path_for_spec(spec_path: Path) -> Path:
    return spec_path.with_name("task_request.json")


def resolve_spec_path(raw_path: Path) -> Path:
    """Resolve --spec portably.

    A bare spec filename should travel with init_task.py. If the caller runs an
    absolute script path from an unrelated cwd, preferring the script-adjacent
    spec avoids silently selecting an older same-named spec in that cwd.
    """
    if raw_path.is_absolute():
        return raw_path.resolve()
    script_candidate = (SCRIPT_DIR / raw_path).resolve()
    if script_candidate.is_file():
        return script_candidate
    return raw_path.resolve()


def resolve_request_path(raw_path: Path | None, spec_path: Path) -> Path:
    if raw_path is None:
        return default_request_path_for_spec(spec_path)
    if raw_path.is_absolute():
        return raw_path.resolve()
    return (spec_path.parent / raw_path).resolve()


def build_request_template(spec: dict[str, Any]) -> dict[str, Any]:
    project_code = get_request_value(spec, "canonical_ids.default_project_code", "cwb_isrc")
    return {
        "_llm_read_me": {
            "target_file_to_edit": "task_request.json (this file)",
            "what_this_file_is": "Editable task init request. This is the target file for the LLM/operator to fill before rerunning init_task.py.",
            "portable_use": [
                "This initializer is repo-neutral: copy init_task.py and image_sourcing_init_spec-idol_v00.19.json into any folder/project and run them there.",
                "The default target request file is always task_request.json next to the --spec file you pass.",
                "If --spec is relative, init_task.py first resolves it next to init_task.py, then falls back to the current working directory.",
                "If --request is relative, init_task.py resolves it next to the selected --spec file.",
                "The generated task root is always created inside --operator-workspace-root, not beside the script unless that is the workspace you choose.",
                "No external Python packages are required."
            ],
            "runtime_commands": {
                "windows_common": "py -3 init_task.py --spec image_sourcing_init_spec-idol_v00.19.json --operator-workspace-root PATH\\TO\\operator_workspace",
                "windows_from_any_cwd": "py -3 PATH\\TO\\init_task.py --spec image_sourcing_init_spec-idol_v00.19.json --operator-workspace-root PATH\\TO\\operator_workspace",
                "windows_if_python_on_path": "python init_task.py --spec image_sourcing_init_spec-idol_v00.19.json --operator-workspace-root PATH\\TO\\operator_workspace",
                "macos_linux": "python3 init_task.py --spec image_sourcing_init_spec-idol_v00.19.json --operator-workspace-root /path/to/operator_workspace",
                "macos_linux_from_any_cwd": "python3 /path/to/init_task.py --spec image_sourcing_init_spec-idol_v00.19.json --operator-workspace-root /path/to/operator_workspace"
            },
            "what_not_to_edit": [
                "Do not edit image_sourcing_init_spec-idol_v00.19.json to add a subject, criteria, paths, task_id, dataset_id, or batch_id.",
                "Do not edit generated task folders to change ids after init.",
                "Do not invent artifact filenames. The initializer derives artifact filenames from task_id and artifact_kind."
            ],
            "run_flow": [
                "First run: init_task.py writes this target file and exits.",
                "Fill project_code, task_id, and task criteria in this file.",
                "Second run: init_task.py consumes this file and creates operator_workspace_root/{task_id}/.",
                "After init, read the generated {task_id}.start_here.md first."
            ],
            "minimum_required_edits": [
                "project_code",
                "task_id",
                "accepted_count_target",
                "identity.target_subject or subject",
                "subject_slug"
            ],
            "naming_convention": {
                "project_code": "^[a-z0-9_]{3,24}$",
                "task_id": "task_{project_code}_{task_ordinal_4}_{ULID26}",
                "dataset_id": "dataset_{project_code}_{dataset_ordinal_4}_{ULID26}",
                "batch_id": "batch_{project_code}_{task_ordinal_4}_{batch_ordinal_4}_{ULID26}",
                "artifact_files": "{task_id}.{artifact_kind}.{ext}",
                "media_files": "{task_id}.b{batch_ordinal_4}.i{item_sequence_7}.s{sha256_prefix}.{ext}"
            },
            "task_id_instructions": [
                "Replace REPLACE_WITH_TASK_ID with one concrete id matching task_{project_code}_{ordinal4}_{ULID26}.",
                "The project_code segment inside task_id must equal project_code.",
                "If task_ordinal is null, the initializer derives it from task_id.",
                "If task_ordinal is filled, it must match the 4-digit ordinal segment inside task_id.",
                "The initializer generates dataset_id and batch_id; do not add those ids here."
            ],
            "valid_task_id_example": f"task_{project_code}_0007_01K9Z8Y7X6W5V4T3S2R1Q0P9N8",
            "criteria_instructions": [
                "Put identity and outcome requirements here, not in the neutral spec.",
                "Use inclusion_criteria for positive requirements.",
                "Use exclusion_criteria.excluded_contexts for contexts that must be rejected.",
                "Use source_preferences only for source-family preferences, not downstream use.",
                "Leave arrays empty when no rule is known yet."
            ],
            "leave_null_when_unused": [
                "task_ordinal",
                "identity.group",
                "identity.target_subject"
            ],
            "rerun_command": "Rerun the exact first command after filling this file. The script will consume this request file because it lives next to the selected spec."
        },
        "project_code": project_code,
        "task_id": "REPLACE_WITH_TASK_ID",
        "task_ordinal": None,
        "dataset_ordinal": 1,
        "batch_ordinal": 1,
        "subject": "UNSET",
        "subject_slug": "subject",
        "accepted_count_target": 0,
        "identity": {
            "target_subject": None,
            "group": None,
            "other_members": [],
            "same_name_people": [],
            "excluded_eras": []
        },
        "inclusion_criteria": [],
        "exclusion_criteria": {
            "excluded_contexts": [],
            "excluded_source_families": []
        },
        "diversity_targets": {
            "enabled": False,
            "diversity_overflow_factor": 1.5,
            "buckets": {
                "pose": {},
                "expression": {},
                "setting": {}
            }
        },
        "source_preferences": {
            "preferred_source_families": [],
            "blocked_source_families": []
        }
    }


def write_request_template(path: Path, spec: dict[str, Any]) -> None:
    write_json_atomic(path, build_request_template(spec))


def load_request(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    req_path = path.resolve()
    if not req_path.is_file():
        raise ValueError(f"request file not found: {req_path}")
    with req_path.open("r", encoding="utf-8-sig") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("request file must contain a JSON object")
    return data


def is_unfilled_template_value(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("REPLACE_WITH")


def find_unfilled_template_values(value: Any, path: str = "") -> list[str]:
    if is_unfilled_template_value(value):
        return [path or "<root>"]
    if isinstance(value, dict):
        out: list[str] = []
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            out.extend(find_unfilled_template_values(child, child_path))
        return out
    if isinstance(value, list):
        out = []
        for i, child in enumerate(value):
            out.extend(find_unfilled_template_values(child, f"{path}[{i}]"))
        return out
    return []


def validate_request_ready(request: dict[str, Any], request_path: Path, require_concrete_task_id: bool) -> None:
    unfilled = find_unfilled_template_values(request)
    if unfilled:
        joined = ", ".join(unfilled[:10])
        raise ValueError(f"{request_path} still contains unfilled template values at: {joined}")

    if require_concrete_task_id:
        project_code = request.get("project_code")
        if not isinstance(project_code, str) or not PROJECT_CODE_RE.fullmatch(project_code):
            raise ValueError(f"{request_path} must define project_code matching ^[a-z0-9_]{{3,24}}$")
        task_id = request.get("task_id")
        if not isinstance(task_id, str):
            raise ValueError(f"{request_path} must define a concrete task_id")
        parsed_project_code, _, _ = parse_task_id(task_id)
        if project_code != parsed_project_code:
            raise ValueError(f"{request_path} project_code conflicts with task_id")


def get_request_value(request: dict[str, Any], dotted_key: str, default: Any = None) -> Any:
    current: Any = request
    for part in dotted_key.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def coalesce(*values: Any, default: Any = None) -> Any:
    for value in values:
        if value is not None:
            return value
    return default


def first_meaningful(*values: Any, default: Any = None) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and value.strip() in ("", "UNSET", "null"):
            continue
        return value
    return default


def parse_task_id(task_id: str) -> tuple[str, str, str]:
    m = TASK_ID_RE.fullmatch(task_id)
    if not m:
        raise ValueError(
            "task_id must match task_{project_code}_{ordinal4}_{ULID26}, "
            "for example task_cwb_isrc_0007_01K9Z8Y7X6W5V4T3S2R1Q0P9N8"
        )
    return m.group(1), m.group(2), m.group(3)


def validate_ordinal(name: str, value: Any) -> int:
    try:
        out = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be an integer") from None
    if out < 0 or out > 9999:
        raise ValueError(f"{name} must be between 0 and 9999")
    return out


def iter_skeleton_strings(value: Any, path: str = "") -> list[tuple[str, str]]:
    if isinstance(value, str):
        return [(path, value)]
    if isinstance(value, dict):
        out: list[tuple[str, str]] = []
        for k, v in value.items():
            child_path = f"{path}.{k}" if path else str(k)
            out.extend(iter_skeleton_strings(v, child_path))
        return out
    if isinstance(value, list):
        out = []
        for i, v in enumerate(value):
            out.extend(iter_skeleton_strings(v, f"{path}[{i}]"))
        return out
    return []


def check_spec_neutrality(spec: dict[str, Any], spec_path: Path, workspace_root: Path) -> list[str]:
    """Detect common ways generated task data leaks back into the neutral spec."""
    errors: list[str] = []
    spec_text = json.dumps(spec, ensure_ascii=False)

    if workspace_root.is_dir():
        for child in workspace_root.iterdir():
            if child.is_dir() and TASK_ID_RE.fullmatch(child.name) and child.name in spec_text:
                errors.append(f"spec contains an existing generated task folder id: {child.name}")

    schemas = spec.get("schemas", {})
    if isinstance(schemas, dict):
        for schema_name, schema in schemas.items():
            if not isinstance(schema, dict):
                continue
            for key in ("skeleton", "skeleton_record", "file_layout_template"):
                if key not in schema:
                    continue
                for path, text in iter_skeleton_strings(schema[key], f"schemas.{schema_name}.{key}"):
                    if CONCRETE_ID_RE.search(text):
                        errors.append(f"concrete generated id appears in executable spec skeleton: {path}")
                    if ABSOLUTE_PATH_RE.search(text):
                        errors.append(f"absolute filesystem path appears in executable spec skeleton: {path}")

    if errors:
        return [f"{spec_path}: {err}" for err in errors]
    return []


def apply_requirement_request(task_requirements: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
    """Overlay task-specific criteria from a request file after placeholder rendering."""
    if not request:
        return task_requirements

    deliverable = task_requirements.setdefault("deliverable", {})
    accepted_count = coalesce(
        request.get("accepted_count_target"),
        get_request_value(request, "deliverable.accepted_count_target"),
    )
    if accepted_count is not None:
        deliverable["accepted_count_target"] = int(accepted_count)
    deadline = coalesce(request.get("deadline"), get_request_value(request, "deliverable.deadline"))
    if deadline is not None:
        deliverable["deadline"] = deadline
    status = get_request_value(request, "deliverable.status")
    if status is not None:
        deliverable["status"] = status

    identity = task_requirements.setdefault("identity", {})
    request_identity = request.get("identity")
    if isinstance(request_identity, dict):
        for key in ("target_subject", "group", "other_members", "same_name_people", "excluded_eras"):
            if key in request_identity and request_identity[key] is not None:
                identity[key] = request_identity[key]

    for key in ("inclusion_criteria", "diversity_targets", "source_preferences"):
        if key in request:
            task_requirements[key] = request[key]

    if "exclusion_criteria" in request and isinstance(request["exclusion_criteria"], dict):
        existing = task_requirements.setdefault("exclusion_criteria", {})
        if isinstance(existing, dict):
            existing.update(request["exclusion_criteria"])
        else:
            task_requirements["exclusion_criteria"] = request["exclusion_criteria"]

    return task_requirements


# --- Placeholder substitution ------------------------------------------------

PLACEHOLDER_RE = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")


def substitute(value: Any, ctx: dict[str, str]) -> Any:
    """Recursively replace {{NAME}} placeholders in any nested str/dict/list."""
    if isinstance(value, str):
        def _r(m: re.Match[str]) -> str:
            name = m.group(1)
            if name in ctx:
                return str(ctx[name])
            # Generators that compute at-use
            if name == "ISO_TIMESTAMP":
                return now_utc_iso()
            if name == "ISO_TIMESTAMP_COMPACT":
                return now_utc_iso_compact()
            if name in ("UUIDV7", "UUID"):
                return make_uuidv7()
            if name == "RUN_ID":
                return ctx.get("RUN_ID", make_uuidv7())
            if name == "RUN_ID_OR_NULL":
                return "null"
            # Leave operator-input placeholders intact
            return m.group(0)
        return PLACEHOLDER_RE.sub(_r, value)
    if isinstance(value, dict):
        return {k: substitute(v, ctx) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute(v, ctx) for v in value]
    return value


# --- Atomic write ------------------------------------------------------------

def write_atomic(path: Path, content: str) -> None:
    """Write file via temp-then-rename. UTF-8, no BOM, LF endings."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        f.write(content)
        f.flush()
        os.fsync(f.fileno())
    os.replace(str(tmp), str(path))


def write_json_atomic(path: Path, obj: Any) -> None:
    write_atomic(path, json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def write_yaml_atomic(path: Path, obj: Any) -> None:
    """Minimal YAML writer using JSON syntax (valid YAML 1.2 subset).
    Avoids PyYAML dependency. Output is JSON formatted, which is legal YAML."""
    write_atomic(path, json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


# --- File-format dispatcher --------------------------------------------------

def write_artifact(path: Path, fmt: str, obj_or_text: Any) -> None:
    """Write an artifact based on its declared format."""
    if fmt == "yaml":
        write_yaml_atomic(path, obj_or_text)
    elif fmt == "json":
        write_json_atomic(path, obj_or_text)
    elif fmt == "jsonl":
        # Empty JSONL on init; or one record per line if obj is a list
        if isinstance(obj_or_text, list):
            content = "".join(json.dumps(rec, ensure_ascii=False) + "\n" for rec in obj_or_text)
        else:
            content = ""
        write_atomic(path, content)
    elif fmt in ("markdown", "markdown_with_yaml_frontmatter"):
        if isinstance(obj_or_text, str):
            write_atomic(path, obj_or_text if obj_or_text.endswith("\n") else obj_or_text + "\n")
        else:
            # Rendered from a skeleton dict that has a 'body' field
            body = obj_or_text.get("body", "")
            write_atomic(path, body if body.endswith("\n") else body + "\n")
    else:
        raise ValueError(f"Unknown artifact format: {fmt}")


# --- File extension by format -----------------------------------------------

EXT_BY_FORMAT = {
    "yaml": "yaml",
    "json": "json",
    "jsonl": "jsonl",
    "markdown": "md",
    "markdown_with_yaml_frontmatter": "md",
}


# --- Locking -----------------------------------------------------------------

def acquire_lock(lock_path: Path, run_id: str, command: str) -> None:
    """Create the lock file with exclusive create. Refuses if it already exists."""
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    skeleton = {
        "artifact_kind": "run_state_lock",
        "artifact_id": "ART-RUN-LOCK",
        "active": True,
        "run_id": run_id,
        "pid": os.getpid(),
        "command": command,
        "started_at": now_utc_iso(),
        "finished_at": None,
        "exit_code": None,
        "log": None,
        "stderr": None,
        "expected_output_root": "intake/raw",
        "output_lane": "raw",
        "last_heartbeat_at": now_utc_iso(),
    }
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_BINARY"):
        flags |= os.O_BINARY
    try:
        fd = os.open(str(lock_path), flags, 0o644)
    except FileExistsError:
        raise RuntimeError(f"lock already held: {lock_path}")
    with os.fdopen(fd, "wb") as f:
        f.write((json.dumps(skeleton, indent=2) + "\n").encode("utf-8"))


def release_lock(lock_path: Path, dataset_id: str, task_id: str, exit_code: int = 0) -> None:
    """Update lock to inactive via temp-then-rename."""
    finished = {
        "artifact_kind": "run_state_lock",
        "artifact_id": "ART-RUN-LOCK",
        "artifact_handle": f"{task_id}/run_state_lock",
        "dataset_id": dataset_id,
        "task_id": task_id,
        "active": False,
        "run_id": None,
        "pid": None,
        "command": None,
        "started_at": None,
        "finished_at": now_utc_iso(),
        "exit_code": exit_code,
        "log": None,
        "stderr": None,
        "expected_output_root": "intake/raw",
        "output_lane": "raw",
        "last_heartbeat_at": None,
    }
    write_json_atomic(lock_path, finished)


# --- topology + validation helpers ------------------------------------------

def normalize_topology(topo: dict[str, Any]) -> dict[str, Any]:
    """Keep the generated topology aligned with logical names used elsewhere."""
    files = topo.get("files")
    if isinstance(files, dict):
        if "schemas" not in files and "schema_exports" in files:
            files["schemas"] = files.pop("schema_exports")
        elif "schemas" in files and "schema_exports" in files and files["schemas"] == files["schema_exports"]:
            files.pop("schema_exports")
    return topo


def iter_topology_files(files_map: dict[str, Any]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for logical_name, rel in files_map.items():
        if isinstance(rel, str):
            out.append((logical_name, rel))
        elif isinstance(rel, dict):
            for child_name, child_rel in rel.items():
                if isinstance(child_rel, str):
                    out.append((f"{logical_name}.{child_name}", child_rel))
    return out


def is_safe_relative_path(rel: str) -> bool:
    path = rel.replace("\\", "/")
    if rel != path:
        return False
    if path.startswith("/") or path.startswith("../") or "/../" in path or path == "..":
        return False
    if re.match(r"^[A-Za-z]:", path):
        return False
    if path.startswith("//"):
        return False
    return True


def read_json_subset(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_validation_report(
    spec: dict[str, Any],
    ctx: dict[str, str],
    task_root: Path,
    topo: dict[str, Any],
    artifact_manifest: dict[str, Any],
    parent_sha256: str,
    init_run_id: str,
) -> dict[str, Any]:
    """Validate the freshly initialized task enough for deploy/import gating."""
    report = substitute(spec["schemas"]["validation_report_schema"]["skeleton"], ctx)
    report["validated_at"] = now_utc_iso()

    files_map = topo.get("files", {})
    folders_map = topo.get("folders", {})
    checked = sorted(files_map.keys())
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    parsed: dict[str, Any] = {}

    def add_error(code: str, message: str, rel_path: str | None = None) -> None:
        item = {"code": code, "message": message}
        if rel_path:
            item["path"] = rel_path
        errors.append(item)

    for folder_logical, rel in folders_map.items():
        if not isinstance(rel, str) or not is_safe_relative_path(rel):
            add_error("unsafe_folder_path", f"Unsafe folder path for {folder_logical}", str(rel))
            continue
        if not (task_root / rel).is_dir():
            add_error("missing_folder", f"Missing folder for {folder_logical}", rel)

    for logical_name, rel in iter_topology_files(files_map):
        if not is_safe_relative_path(rel):
            add_error("unsafe_file_path", f"Unsafe file path for {logical_name}", rel)
            continue
        path = task_root / rel
        if not path.is_file():
            add_error("missing_file", f"Missing file for {logical_name}", rel)
            continue
        suffix = path.suffix.lower()
        try:
            if suffix in (".json", ".yaml"):
                parsed[logical_name] = read_json_subset(path)
            elif suffix == ".jsonl":
                records = []
                for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                    if line.strip():
                        records.append(json.loads(line))
                parsed[logical_name] = records
        except Exception as exc:
            add_error("parse_error", f"Could not parse {logical_name}: {exc}", rel)

    manifest_logicals = set()
    for entry in artifact_manifest.get("artifacts", []):
        if entry.get("created_per_operation") or entry.get("required") is False:
            continue
        logical_name = entry.get("logical_name")
        if logical_name:
            manifest_logicals.add(logical_name)

    for entry in spec.get("required_artifacts", {}).get("artifacts", []):
        if entry.get("created_per_operation") or entry.get("required") is False:
            continue
        logical_name = entry.get("logical_name")
        if logical_name:
            manifest_logicals.add(logical_name)

    for logical_name in sorted(manifest_logicals):
        if logical_name not in files_map:
            add_error("missing_topology_entry", f"Missing task_topology.files entry for {logical_name}")

    task_state = parsed.get("task_state", {})
    task_rules = parsed.get("task_rules", {})
    run_state_lock = parsed.get("run_state_lock", {})

    if task_state.get("task_id") != ctx["TASK_ID"]:
        add_error("task_id_mismatch", "task_state.task_id does not match generated task_id")
    if task_state.get("dataset_id") != ctx["DATASET_ID"]:
        add_error("dataset_id_mismatch", "task_state.dataset_id does not match generated dataset_id")
    if task_root.name != ctx["TASK_ID"]:
        add_error("task_root_name_mismatch", "task_root basename does not equal task_id")

    embedded_parent = task_rules.get("parent_init_spec", {})
    if isinstance(embedded_parent, dict) and embedded_parent.get("sha256") != parent_sha256:
        add_error("parent_spec_hash_mismatch", "task_rules.parent_init_spec.sha256 does not match parent spec")

    if isinstance(run_state_lock, dict) and run_state_lock.get("active") is True:
        if run_state_lock.get("run_id") != init_run_id:
            add_error("lock_held", "run_state_lock is active for a different run")

    manifest_by_logical = {
        entry.get("logical_name"): entry
        for entry in artifact_manifest.get("artifacts", [])
        if entry.get("logical_name")
    }
    for logical_name, obj in parsed.items():
        if logical_name.startswith("schemas.") or logical_name.endswith(".schema"):
            continue
        if not isinstance(obj, dict):
            continue
        if logical_name in ("start_here",):
            continue
        entry = manifest_by_logical.get(logical_name)
        expected_kind = entry.get("kind") if entry else logical_name
        expected_id = entry.get("id") if entry else None
        if obj.get("dataset_id") != ctx["DATASET_ID"]:
            add_error("artifact_dataset_id_mismatch", f"{logical_name}.dataset_id mismatch")
        if obj.get("task_id") != ctx["TASK_ID"]:
            add_error("artifact_task_id_mismatch", f"{logical_name}.task_id mismatch")
        if expected_kind and obj.get("artifact_kind") != expected_kind:
            add_error("artifact_kind_mismatch", f"{logical_name}.artifact_kind mismatch")
        if expected_id and obj.get("artifact_id") != expected_id:
            add_error("artifact_id_mismatch", f"{logical_name}.artifact_id mismatch")
        if obj.get("artifact_handle") and obj.get("artifact_handle") != f"{ctx['TASK_ID']}/{expected_kind}":
            add_error("artifact_handle_mismatch", f"{logical_name}.artifact_handle mismatch")

    start_here_rel = files_map.get("start_here")
    if isinstance(start_here_rel, str) and (task_root / start_here_rel).is_file():
        body = (task_root / start_here_rel).read_text(encoding="utf-8")
        for heading in ("## Read in this order", "## Must-know rules", "## Live status", "## Handoffs"):
            if heading not in body:
                warnings.append({"code": "start_here_heading_missing", "message": f"Missing heading: {heading}"})

    report["checked_artifacts"] = checked
    report["errors"] = errors
    report["warnings"] = warnings

    if errors:
        codes = {e["code"] for e in errors}
        if "missing_file" in codes or "missing_folder" in codes or "missing_topology_entry" in codes:
            report["validation_state"] = "blocked_missing_artifact"
            report["next_required_action"] = "initialize_missing_artifacts"
        elif "parse_error" in codes:
            report["validation_state"] = "blocked_parse_error"
            report["next_required_action"] = "reparse_artifact"
        elif "lock_held" in codes:
            report["validation_state"] = "blocked_lock_held"
            report["next_required_action"] = "release_or_recover_lock"
        elif "parent_spec_hash_mismatch" in codes:
            report["validation_state"] = "blocked_drift_detected"
            report["next_required_action"] = "regenerate_task_rules_from_parent_spec"
        else:
            report["validation_state"] = "blocked_state_mismatch"
            report["next_required_action"] = "reconcile_state"
    elif warnings:
        report["validation_state"] = "warning"
        report["next_required_action"] = "none"
    else:
        report["validation_state"] = "valid"
        report["next_required_action"] = "none"

    return report


# --- start_here renderer -----------------------------------------------------

def render_start_here(
    spec: dict,
    ctx: dict,
    task_state: dict,
    validation_report: dict[str, Any] | None = None,
    lock_active: bool = False,
) -> str:
    body = spec["schemas"]["start_here_schema"]["skeleton"]["body"]
    counts = task_state.get("counts", {})
    counts_str = " / ".join(str(counts.get(k, 0)) for k in ("raw", "accepted", "pending", "rejected", "diagnostic"))
    validation_state = "blocked_missing_artifact (initial)"
    if validation_report:
        validation_state = validation_report.get("validation_state", validation_state)
    extra = {
        "VALIDATION_STATE": validation_state,
        "LOCK_ACTIVE": str(lock_active).lower(),
        "COUNTS": counts_str,
        "RECENT_FAILURES_OR_NONE": "none",
        "REPO_POINTERS_LIST_OR_NONE": "none",
    }
    merged = {**ctx, **extra}
    return substitute(body, merged)


# --- JSON Schema export (minimal) -------------------------------------------

def export_json_schemas(spec: dict, schemas_dir: Path, expected_schema_files: dict[str, str] | None = None) -> None:
    """Generate one JSON Schema file per schema_ref in json_schema_exports.
    Minimal: stamps $schema, $id, and the source schema dict's required_fields
    plus any enums. Apps that need fuller validation should regenerate later."""
    dialect = spec["json_schema_exports"]["dialect"]
    base = spec["json_schema_exports"]["schema_id_base"]
    written: set[str] = set()

    def write_schema(filename: str, ref: str) -> None:
        src = spec["schemas"].get(ref, {})
        out = {
            "$schema": dialect,
            "$id": base + filename,
            "title": ref,
            "type": "object",
            "required": src.get("required_fields", []),
            "properties": {f: {} for f in src.get("required_fields", [])},
        }
        if "enums" in src:
            out["x-enums"] = src["enums"]
        write_json_atomic(schemas_dir / filename, out)
        written.add(filename)

    for entry in spec["json_schema_exports"]["generated_files"]:
        filename = Path(entry["path"]).name
        ref = entry["schema_ref"]
        write_schema(filename, ref)

    if expected_schema_files:
        for schema_name, rel in expected_schema_files.items():
            filename = Path(rel).name
            if filename in written:
                continue
            ref = f"{schema_name}_schema"
            if ref not in spec["schemas"]:
                continue
            write_schema(filename, ref)


# --- Main --------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--spec", required=True, type=Path, help="Path to the JSON init spec.")
    p.add_argument("--operator-workspace-root", required=True, type=Path,
                   help="Path to the outer nickname folder. The inner task_root will be created here.")
    p.add_argument("--request", type=Path,
                   help="Optional JSON request with task-specific criteria. Defaults to task_request.json next to the spec; if missing, that template is written and init exits.")
    p.add_argument("--task-id", help="Optional explicit task_id. Must match task_{project_code}_{ordinal4}_{ULID26}.")
    p.add_argument("--project-code", default=None)
    p.add_argument("--task-ordinal", type=int, default=None)
    p.add_argument("--dataset-ordinal", type=int, default=None)
    p.add_argument("--batch-ordinal", type=int, default=None)
    p.add_argument("--subject", default=None)
    p.add_argument("--group", default=None)
    p.add_argument("--subject-slug", default=None)
    p.add_argument("--accepted-count-target", type=int, default=None)
    p.add_argument("--skip-neutrality-check", action="store_true",
                   help="Bypass spec neutrality preflight. Intended only for migration/debugging.")
    p.add_argument("--dry-run", action="store_true", help="Print what would be done; create no files.")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    # Resolve every path to absolute. This is the portability guarantee:
    # callers can pass any relative or absolute path on any drive; we
    # canonicalize once and use absolute paths throughout.
    spec_path = resolve_spec_path(args.spec)
    workspace_root = args.operator_workspace_root.resolve()

    if not spec_path.is_file():
        print(f"FATAL: spec not found: {spec_path}", file=sys.stderr)
        return 2

    with spec_path.open("r", encoding="utf-8") as f:
        spec = json.load(f)

    if not args.skip_neutrality_check:
        neutrality_errors = check_spec_neutrality(spec, spec_path, workspace_root)
        if neutrality_errors:
            print("FATAL: spec neutrality preflight failed:", file=sys.stderr)
            for err in neutrality_errors:
                print(f"  - {err}", file=sys.stderr)
            return 2

    request_path = resolve_request_path(args.request, spec_path)
    request_is_default = args.request is None
    if not request_path.exists():
        if args.dry_run:
            print("DRY RUN - would write request template.")
            print(f"SELECTED SPEC: {spec_path}")
            print(f"TARGET FILE TO EDIT: {request_path}")
            print("After filling that JSON file, rerun the same init_task.py command.")
            return 0
        write_request_template(request_path, spec)
        print("Task init request template created.")
        print(f"SELECTED SPEC: {spec_path}")
        print(f"TARGET FILE TO EDIT: {request_path}")
        print("Portable rule: this target file is resolved next to the --spec file unless --request is supplied.")
        print("Fill project_code, task_id, accepted_count_target, subject/identity, subject_slug, and criteria in that JSON file.")
        print("Then rerun the same init_task.py command. The second run will mechanically create the task root and artifacts.")
        print("Do not edit the neutral init spec for task-specific values.")
        return 0

    try:
        request = load_request(request_path)
        validate_request_ready(request, request_path, require_concrete_task_id=request_is_default)
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        print(f"TARGET FILE TO EDIT: {request_path}", file=sys.stderr)
        return 2

    # Compute parent spec hash
    parent_sha256 = hashlib.sha256(spec_path.read_bytes()).hexdigest()

    # Resolve fixed naming-convention inputs. The spec owns the pattern; the
    # request/CLI may provide values only if they match it.
    try:
        canonical_default_project = get_request_value(spec, "canonical_ids.default_project_code", "cwb_isrc")
        project_code = str(coalesce(args.project_code, request.get("project_code"), default=canonical_default_project))
        if not PROJECT_CODE_RE.fullmatch(project_code):
            raise ValueError("project_code must match ^[a-z0-9_]{3,24}$")

        task_id_arg = coalesce(args.task_id, request.get("task_id"))
        if task_id_arg in ("", "auto", "optional_or_auto"):
            task_id_arg = None

        requested_task_ordinal = coalesce(args.task_ordinal, request.get("task_ordinal"), default=1)
        task_ordinal_i = validate_ordinal("task_ordinal", requested_task_ordinal)
        task_ulid = make_ulid()

        if task_id_arg:
            parsed_project_code, parsed_task_ordinal, parsed_task_ulid = parse_task_id(str(task_id_arg))
            if args.project_code and args.project_code != parsed_project_code:
                raise ValueError("--project-code conflicts with --task-id")
            if request.get("project_code") and request.get("project_code") != parsed_project_code:
                raise ValueError("request.project_code conflicts with task_id")
            if args.task_ordinal is not None and f"{args.task_ordinal:04d}" != parsed_task_ordinal:
                raise ValueError("--task-ordinal conflicts with --task-id")
            if request.get("task_ordinal") is not None and f"{int(request['task_ordinal']):04d}" != parsed_task_ordinal:
                raise ValueError("request.task_ordinal conflicts with task_id")
            project_code = parsed_project_code
            task_ordinal = parsed_task_ordinal
            task_ulid = parsed_task_ulid
            task_id = str(task_id_arg)
        else:
            task_ordinal = f"{task_ordinal_i:04d}"
            task_id = f"task_{project_code}_{task_ordinal}_{task_ulid}"

        dataset_ordinal_i = validate_ordinal("dataset_ordinal", coalesce(args.dataset_ordinal, request.get("dataset_ordinal"), default=1))
        batch_ordinal_i = validate_ordinal("batch_ordinal", coalesce(args.batch_ordinal, request.get("batch_ordinal"), default=1))
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 2

    dataset_ordinal = f"{dataset_ordinal_i:04d}"
    batch_ordinal = f"{batch_ordinal_i:04d}"
    dataset_ulid = make_ulid()
    batch_ulid = make_ulid()
    dataset_id = f"dataset_{project_code}_{dataset_ordinal}_{dataset_ulid}"
    batch_id = f"batch_{project_code}_{task_ordinal}_{batch_ordinal}_{batch_ulid}"
    run_id = make_uuidv7()

    task_root = workspace_root / task_id
    subject = str(first_meaningful(
        args.subject,
        get_request_value(request, "identity.target_subject"),
        request.get("subject"),
        default="UNSET",
    ))
    group = coalesce(args.group, request.get("group"), get_request_value(request, "identity.group"))
    subject_slug = str(coalesce(args.subject_slug, request.get("subject_slug"), default="subject"))
    if args.accepted_count_target is not None:
        request["accepted_count_target"] = args.accepted_count_target

    print(f"spec:               {spec_path}")
    print(f"workspace_root:     {workspace_root}")
    print(f"request:            {request_path}")
    print(f"project_code:       {project_code}")
    print(f"task_id:            {task_id}")
    print(f"dataset_id:         {dataset_id}")
    print(f"batch_id:           {batch_id}")
    print(f"task_root:          {task_root}")

    # Preflight checks
    if not workspace_root.is_dir():
        print(f"FATAL: workspace root does not exist or not a directory: {workspace_root}", file=sys.stderr)
        return 2
    if (workspace_root / "task_state.yaml").exists() or (workspace_root / "task_state.json").exists():
        print(f"FATAL: workspace root is itself a task root (has task_state). Refusing.", file=sys.stderr)
        return 2
    if task_root.exists():
        print(f"FATAL: task_root already exists: {task_root}. Refusing.", file=sys.stderr)
        return 2

    if args.dry_run:
        print("\nDRY RUN - no files written.")
        return 0

    # ----- live init -----
    rolled_back = False
    try:
        # Step 4: create task_root
        task_root.mkdir(parents=True, exist_ok=False)

        # Step 5: acquire lock at hard-coded relative path BEFORE topology written.
        # This bootstrap path matches what task_topology.skeleton declares for the lock.
        lock_path = task_root / "state" / f"{task_id}.run_state_lock.json"
        acquire_lock(lock_path, run_id, command=f"python init_task.py --task-id {task_id}")

        # Substitution context (operator_input + computed)
        ctx = {
            "PROJECT_CODE": project_code,
            "DATASET_ORDINAL_4": dataset_ordinal,
            "TASK_ORDINAL_4": task_ordinal,
            "BATCH_ORDINAL_4": batch_ordinal,
            "ULID": task_ulid,
            "DATASET_ID": dataset_id,
            "TASK_ID": task_id,
            "BATCH_ID": batch_id,
            "PARENT_INIT_SPEC_SHA256": parent_sha256,
            "SUBJECT": subject,
            "GROUP": str(group) if group else "null",
            "GROUP_OR_NULL": str(group) if group else "null",
            "SUBJECT_SLUG": subject_slug,
            "TASK_ROOT": str(task_root),
            "TASK_FOLDER": str(task_root),
            "OPERATOR_WORKSPACE_ROOT": str(workspace_root),
            "RUN_ID": run_id,
            "RUN_ID_OR_NULL": run_id,
            "MODEL_OR_OPERATOR_IDENTIFIER": "operator",
        }

        # Step 6: create folders from task_topology skeleton
        topo_skel = spec["schemas"]["task_topology_schema"]["skeleton"]
        topo = normalize_topology(substitute(topo_skel, ctx))
        for folder_name, rel_path in topo["folders"].items():
            (task_root / rel_path).mkdir(parents=True, exist_ok=True)

        # Also create handoffs folder explicitly (declared in task_topology v00.18+)
        # already covered above if listed; handle handoffs key
        if "handoffs" in topo["folders"]:
            (task_root / topo["folders"]["handoffs"]).mkdir(parents=True, exist_ok=True)

        # --- Write all required artifacts. The path for each is taken from
        #     topo['files'][logical_name]; the format from the schema. ---

        files_map = topo["files"]

        def write_logical(
            logical_name: str,
            schema_name: str,
            source_skel_key: str = "skeleton",
            rendered: dict[str, Any] | None = None,
        ) -> dict:
            sch = spec["schemas"][schema_name]
            skel = rendered if rendered is not None else substitute(sch[source_skel_key], ctx)
            # Patch parent_init_spec_sha256 if applicable
            if "parent_init_spec" in skel and isinstance(skel["parent_init_spec"], dict):
                skel["parent_init_spec"]["sha256"] = parent_sha256
                skel["parent_init_spec"]["captured_at"] = now_utc_iso()
            rel = files_map[logical_name]
            path = task_root / rel
            fmt = sch["format"]
            # Honor the file extension declared in topology
            write_artifact(path, fmt if fmt != "yaml" else "yaml", skel)
            return skel

        # Step 7-12: structured artifacts
        topo_written = write_logical("task_topology", "task_topology_schema", rendered=topo)
        task_state = write_logical("task_state", "task_state_schema")
        task_rules = write_logical("task_rules", "task_rules_schema")
        task_requirements_rendered = apply_requirement_request(
            substitute(spec["schemas"]["task_requirements_schema"]["skeleton"], ctx),
            request,
        )
        task_requirements = write_logical(
            "task_requirements",
            "task_requirements_schema",
            rendered=task_requirements_rendered,
        )
        artifact_manifest = write_logical("artifact_manifest", "artifact_manifest_schema")
        app_adapter = write_logical("app_adapter", "app_adapter_schema")

        # Step 13: empty JSONL logs
        for logical_name in ("media_items", "media_events", "app_sync_events",
                             "source_expansion_matrix", "workflow_failure_log",
                             "insights_log", "rule_change_events", "operator_approvals"):
            rel = files_map[logical_name]
            (task_root / rel).parent.mkdir(parents=True, exist_ok=True)
            write_atomic(task_root / rel, "")

        # Step 14: JSON Schema exports
        expected_schema_files = files_map.get("schemas") if isinstance(files_map.get("schemas"), dict) else None
        export_json_schemas(spec, task_root / topo["folders"]["schemas"], expected_schema_files)

        # Step 15: start_here.md (preliminary; refreshed after validation)
        start_here_text = render_start_here(spec, ctx, task_state, lock_active=True)
        rel = files_map["start_here"]
        write_atomic(task_root / rel, start_here_text)

        # Step 16: validation_report
        validation_report = substitute(spec["schemas"]["validation_report_schema"]["skeleton"], ctx)
        rel = files_map["validation_report"]
        write_json_atomic(task_root / rel, validation_report)
        # Finalize the bootstrap lock before producing the import-gating report.
        release_lock(lock_path, dataset_id, task_id, exit_code=0)

        validation_report = build_validation_report(
            spec=spec,
            ctx=ctx,
            task_root=task_root,
            topo=topo_written,
            artifact_manifest=artifact_manifest,
            parent_sha256=parent_sha256,
            init_run_id=run_id,
        )
        write_json_atomic(task_root / rel, validation_report)
        start_here_text = render_start_here(spec, ctx, task_state, validation_report, lock_active=False)
        write_atomic(task_root / files_map["start_here"], start_here_text)

    except Exception as e:
        print(f"\nFATAL during init: {e!r}", file=sys.stderr)
        # Rollback: delete task_root if we created it
        if task_root.exists():
            try:
                shutil.rmtree(task_root)
                print(f"rolled back: deleted {task_root}", file=sys.stderr)
                rolled_back = True
            except Exception as cleanup_err:
                print(f"WARNING: rollback failed: {cleanup_err!r}", file=sys.stderr)
        return 3

    print(f"\nOK. Task initialized at: {task_root}")
    print(f"Read first: {task_root / files_map['start_here']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
