# Macro Builder

Macros define the exact sequence of actions your devices perform. 

## Supported Step Types

- `launch_app`: Opens the target application package (e.g. `com.instagram.android`).
- `tap`: Clicks a coordinate (represented as a percentage of screen width/height, e.g. `0.5` = middle).
- `swipe`: Swipes from coordinate A to coordinate B.
- `wait`: Pauses execution for a specified duration in milliseconds.
- `input_text`: Types text into the currently focused field.
- `loop`: Unrolls nested steps X times.

## Anti-Detection 

When authoring a macro, configure the **Anti-Detection** block to prevent your accounts from being flagged:

- **Random Delay**: Inserts random wait times (e.g., 3000ms - 8000ms) between steps.
- **Scroll Variance**: Interjects micro-scrolls before tapping elements.
- **Tap Jitter**: Adds a pixel variance radius to click targets to simulate human imprecision.
