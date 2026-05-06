# Bug Fix Rules

Apply before fixing any bug, test failure, runtime failure, CI failure, or unexpected behavior.

## Mandatory Pre-Check

- Before fixing any bug, always check `docs/common-issues.md` first to see whether the symptom, root cause, or known workaround is already documented.
- If an existing entry matches, follow the documented solution or explain why it does not apply before changing code.
- If no entry matches, state the new symptom and suspected area before editing.

## Fix Discipline

- Root cause first; do not patch symptoms blindly.
- For code bugs, make the reproducer or characterization test/blocking check the first implementation step, then make it pass.
- Keep fixes surgical: every changed line must trace to the bug, its test, or cleanup caused by the fix.
- Do not refactor adjacent code unless the fix requires it.
- If you notice unrelated dead code or tech debt, mention it; do not delete it.

## Post-Fix Documentation

After each bug fix, add or update an entry in `docs/common-issues.md` using this exact structure:

```md
## <Short Issue Name>

Symptoms:
- <What the user/dev sees>

Root Cause:
- <Why it happens>

Common Triggers:
- <Inputs/env/state that reproduce it>

Solutions:
- <Minimal proven fix or workaround>

Verification:
- <Command or manual check that proves fixed>
```

## Verification

- Run the narrowest command that proves the original symptom is fixed.
- Run the relevant project verification from `AGENTS.md` for the touched area.
- Do not claim fixed until the verification output has been read.
