@echo off
setlocal

set "CKC_ROOT=%~dp0"
set "AGENTS=%CKC_ROOT%AGENTS.md"
set "PROJECT_CODEX=%CKC_ROOT%CKC_GOV\PROJECT_CODEX.md"
set "TASK_BOARD=%CKC_ROOT%CKC_GOV\taskboard\TASK_BOARD.md"
set "README=%CKC_ROOT%README.md"

echo LLM/agent bootstrap instructions
echo.
echo BINDING CONTRACT: the following four files form the binding contract for
echo any human or LLM/agent doing work in this repository. All four MUST be
echo read and acknowledged BEFORE any code, governance, spec, task, build, or
echo backup action is taken. Working in this repo without reading them is a
echo process violation.
echo.
echo Read these files in this order:
echo 1. "%AGENTS%"
echo 2. "%PROJECT_CODEX%"
echo 3. "%TASK_BOARD%"
echo 4. "%README%"
echo.
echo Conflict resolution (highest authority first):
echo   1. CKC_GOV\PROJECT_CODEX.md  (canonical operating guide)
echo   2. CKC_GOV\taskboard\TASK_BOARD.md  (status of work, current focus)
echo   3. AGENTS.md
echo   4. README.md
echo.
echo Treat CKC_GOV\PROJECT_CODEX.md as the canonical authority and governing
echo operating guide. If any instructions conflict, follow PROJECT_CODEX.md.
echo Follow all repository instructions, workflow rules, naming rules, and
echo scope rules from those files.
echo Stay LLM-provider agnostic. Do not assume any specific model, company,
echo API, or local runtime unless the task explicitly requires it.
echo.
echo If you need shell commands to read the files on Windows, use:
echo powershell -NoProfile -Command "Get-Content -Encoding utf8 -LiteralPath '%AGENTS%'"
echo powershell -NoProfile -Command "Get-Content -Encoding utf8 -LiteralPath '%PROJECT_CODEX%'"
echo powershell -NoProfile -Command "Get-Content -Encoding utf8 -LiteralPath '%TASK_BOARD%'"
echo powershell -NoProfile -Command "Get-Content -Encoding utf8 -LiteralPath '%README%'"

endlocal
