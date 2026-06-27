# Phase 10: User Documentation System

## Context
With the shift from a generic device orchestration tool to a "Social Media Automation Platform", users need to understand how to connect their devices, set up proxy/network bypasses, write or configure macros, and interpret the analytics dashboard. The platform needs an integrated, user-facing documentation portal.

## Goals
1. Add a documentation UI accessible directly from the dashboard sidebar (`/docs`).
2. Author Markdown-based guides for:
   - **Getting Started**: Connecting an Android/iOS device via ADB/Portal.
   - **Account Setup**: Importing accounts, setting up warm-up schedules.
   - **Macro Creation**: How to use the Visual Builder and the anti-detection configurations.
3. Provide an interactive markdown viewer inside the app to render these files gracefully.

## Files to Create / Modify
| File | Action |
|------|--------|
| `src/pages/DocsPage.tsx` | Create the new documentation viewer page |
| `src/components/docs/*` | Create markdown rendering components (e.g. `react-markdown`) |
| `src/App.tsx` | Add `/docs` route |
| `src/components/layout/Sidebar.tsx` | Add Docs link to the navigation |
| `public/docs/*` | Author the markdown content files |
| `docs/project-roadmap.md` | Update roadmap to include Phase 10 |

## Approach
- Add `react-markdown` (and plugins like `remark-gfm` if needed) to the frontend dependencies.
- Create a `public/docs/manifest.json` to define the table of contents.
- `DocsPage.tsx` will fetch the markdown files from the `public/docs` directory at runtime and render them, providing a seamless SPA experience without needing a separate documentation host (like GitBook or MkDocs).

## Verification
- Run `npm run dev`.
- Click the "Documentation" link in the sidebar.
- Verify the "Getting Started" guide renders correctly with markdown formatting (headers, lists, code blocks).
