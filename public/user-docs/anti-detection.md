# Anti-Detection Engine

Social networks deploy advanced heuristics to detect botting. Our execution worker provides built-in spoofing.

### 1. Timing Signatures
Human users don't interact at 1ms intervals. The execution worker enforces a randomized cooldown between actions to mimic reading speed and cognitive processing time.

### 2. Touch Coordinate Variance
A script clicking exactly at `(350, 420)` 50 times in a row will immediately flag an account. When **Tap Jitter** is enabled, the worker randomizes the final tap coordinate within a designated pixel radius.

### 3. Account Warm-up States
Brand new accounts are subjected to intense scrutiny by social platforms. See the **Warm-up Schedules** guide to learn how the platform limits automated action velocity based on the account's age and health.
