# DDM console: JavaScript SDKs

The admin console for the JavaScript SDK, built from the design canvas **"Data Masking Redesign"** (the 8 "SDK" screens).
Phase 1: the screens work exactly as in the design, on the design's sample data. Nothing is saved to the backend yet.

Run: `npm run dev`, then open http://localhost:5181.

## Screens

| Route | Canvas screen |
|---|---|
| `#/sdks` | SDK 1 · All SDKs |
| `#/sdks/new` | SDK 2 · Create SDK |
| `#/sdks/dam-portal/rules` | SDK 3 · Rules |
| `#/sdks/dam-portal/rules/add` | SDK 3a · Add rule |
| `#/sdks/dam-portal/pages` | SDK 3b · Page map |
| `#/sdks/dam-portal/review` | SDK 4 · Review (reviewer) |
| `#/sdks/dam-portal/build` | SDK 5 · Build |
| `#/sdks/dam-portal/ready` | SDK 6 · Download and README |

The canvas has 8 screens but only 3 pages: each page is shown in several states. So `src/pages/` holds 3 components, and
each route gives its page a starting state (`initial`).

## How the pages are made

`src/pages/*.jsx` are **generated** from the design sources in `design/` by `tools/dc2jsx.py`:

- the markup is copied as-is (inline styles, classes, icons, texts);
- the design's logic class becomes a React class component;
- links between screens become the hash routes above (`src/lib/dc.js`);
- the shared stylesheet is `src/styles.css`.

To take a new version of the design: save the canvas's `SDKList.dc.html`, `DDMRules.dc.html` and `SDKReview.dc.html` into `design/`,
then run:

```
python tools/dc2jsx.py design/SDKList.dc.html   src/pages/SdkListPage.jsx SdkListPage
python tools/dc2jsx.py design/DDMRules.dc.html  src/pages/RulesPage.jsx   RulesPage
python tools/dc2jsx.py design/SDKReview.dc.html src/pages/ReviewPage.jsx  ReviewPage
```

Once phase 2 starts (backend connection), the pages will be edited by hand, and regenerating them will stop.

## Checks

From `../e2e`:

- `node sdk-console-shots.mjs`: one screenshot per screen in `e2e/out/sdk-console/`, plus any runtime errors or React warnings;
- `node sdk-console-flow.mjs`: clicks through list → create → rules → add rule → page map → review → approve → build → download.

The previous console (fields, pages, approval) is backed up in `../_backup/admin-ui-before-redesign-2026-11-19/`.
