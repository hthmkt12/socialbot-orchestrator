# Karpathy Coding Principles

Four guardrails against common LLM coding failures. Apply to all planning, implementation, refactoring, and bug fixes.

## 1. Think Before Coding

- State assumptions explicitly before writing code.
- When multiple interpretations exist, present them; never pick silently.
- Push back if a simpler approach exists.
- If something is unclear, stop and ask before proceeding.

## 2. Simplicity First

- No features beyond what was explicitly asked.
- No abstractions for single-use code.
- No flexibility or configurability not requested.
- No error handling for impossible scenarios.
- Self-test: would a senior engineer say this is overcomplicated? If yes, rewrite.
- If 200 lines could be 50, rewrite it.

## 3. Surgical Changes

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style even if you would do it differently.
- If you notice unrelated dead code, mention it; do not delete it.
- When your changes create orphans such as unused imports, variables, or functions, clean those up.
- Litmus test: every changed line must trace directly to the user's request.

## 4. Goal-Driven Execution

- Transform tasks into verifiable goals with success criteria.
- `Add validation` means write tests for invalid inputs, then make them pass.
- `Fix the bug` means write a test that reproduces it, then make it pass.
- `Refactor X` means ensure tests pass before and after.
- Multi-step plans must have explicit verify conditions per step.
