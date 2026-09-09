# PermitCoach content admin

The web panel for authoring, comparing and releasing course content. It is a
Vite SPA that lives in the app repository — not because it ships with the app,
but because it renders lessons with the app's own components, so an editor
previews the product rather than a drawing of it.

```
npm run admin          # dev server on :5273, proxying /v1 to the content server
npm run admin:build    # builds into server/admin-ui, served at /admin
```

The content server must be running (`cd server && npm run dev`).

## What it does

- **Versions and drafts** — released versions are immutable; duplicating one
  produces an editable draft. Drafts live in `server/content-admin/`, physically
  outside the directory the client API reads, so unreleased work cannot leak.
- **Comparison** — any two versions side by side, with a word-level diff. A
  redrawn illustration is reported separately: an illustration-only release
  changes the lesson without changing a word.
- **Phone simulator** — the lesson under `LessonCardBody`, the same component
  the device renders, under the app's own theme and fonts. Competitor courses
  are drawn in their own idiom instead.
- **Prompt builder** — right-click a selection to collect it; each excerpt keeps
  its version and lesson, and the panel copies the lot as one markdown request.
- **Find similar** — word overlap shortlists candidates in the reference course,
  then the configured model ranks them. Without an API key it degrades to the
  local ranking and says so.
- **Release and publish** — the panel works out what changed and which bump that
  needs, the operator names the version and sets each instruction's severity,
  and publishing commits and pushes the released tree.

## Layout

```
src/api/        typed client for /v1/admin
src/store/      zustand slices: workspace, selection, docs, edit, ui, prompt, similar
src/model/      RenderCard, the word diff, compare pairing, prompt text
src/features/   one folder per area of the screen
src/shims/      web stand-ins for react-native-svg and safe-area insets
```

`vite.config.ts` aliases `react-native` to `react-native-web` and pins React so
the shared app components resolve to one copy.

## Checks

```
npm run typecheck   # includes the shared app modules it imports
npm test            # the diff and compare pairing
npm run smoke       # renders the app's card renderer in a DOM
npm run ui-check    # drives the whole panel against a throwaway content server
```

`ui-check` is the phase gate: it loads the workspace, walks the sidebars, edits a
draft, releases it and asserts `/v1/bootstrap` offers the result. It copies the
content tree first, so it never touches real course data.
