# TaskFlow

A local-first personal task manager built with semantic HTML, modern CSS, and vanilla JavaScript. TaskFlow keeps the interface calm and focused: add a task, give it a priority and an optional due date, then work through it one step at a time.

No frameworks, build step, CDN, external fonts, or accounts. Everything runs in the browser and task data is stored in `localStorage`.

## Features

- **Task dashboard** — live counts for all tasks, active tasks, completed tasks, and high-priority tasks.
- **Create tasks** — a required title, optional description, priority (low, medium, high), and optional due date.
- **Edit and delete** — update any task, or delete it through a confirmation dialog.
- **Complete and reopen** — check a task off, or move it back to active.
- **Filters** — view all tasks, active tasks, completed tasks, or high-priority tasks from the sidebar (or the compact mobile navigation).
- **Title search** — filter the current view by task title, with a clear-search action and a dedicated no-results state.
- **Local persistence** — tasks are saved to `localStorage` after every change and restored on the next visit.
- **Thoughtful empty states** — different guidance for an empty list, an empty filter, and a search with no matches.
- **Input feedback** — inline title validation and short toast messages for add, edit, complete, and delete actions.
- **Sample tasks** — four examples are seeded only when no saved task data exists. A visible banner removes them in one confirmed step.
- **Storage failure handling** — read and write errors are caught, the app remains usable in memory, and an explanatory banner appears.
- **Responsive and accessible** — keyboard-friendly controls, semantic landmarks, visible focus states, a skip link, native dialogs, safe DOM rendering, and `prefers-reduced-motion` support.

## Tech stack

- HTML5
- CSS3 (custom properties, grid, flexbox, media queries, reduced-motion support)
- Vanilla JavaScript (ES2020+, no dependencies)
- Browser `localStorage`

## Run locally

TaskFlow is a static site, so there is no installation or build step.

1. Open `proyek-02-taskflow/index.html` directly in a modern browser, **or**
2. From the repository root, serve the folder with any static server and open it in the browser. For example:

   ```bash
   npx serve .
   ```

   Then visit `http://localhost:3000/proyek-02-taskflow/`.

All application logic lives in `script.js`, so the page must be allowed to run JavaScript. The app does not require a network connection once the files are available locally.

## Data and localStorage

- Task data is stored under the key **`taskflow.tasks.v1`**.
- Sample tasks are created only when that key does not exist. If you remove every task, the empty list is preserved — samples are not re-seeded.
- The **Remove samples** banner action deletes only the seeded examples; your own tasks stay.
- Data belongs to the current browser and profile. It is not synced across browsers, devices, or private/incognito sessions.
- Clearing site data for the page, using a different profile, or blocking storage removes access to saved tasks.
- If `localStorage` is unavailable or full, TaskFlow shows a warning and keeps working for the current tab, but changes may be lost on reload.

## Project structure

```text
proyek-02-taskflow/
├── index.html   # Semantic page structure and dialogs
├── style.css    # Layout, theme, responsive states, reduced motion
├── script.js    # Task state, rendering, filtering, storage
└── README.md
```

## Notes

- User-provided text is rendered with `textContent` and DOM APIs, never injected as HTML.
- The interface uses native `<dialog>` elements for focus management and Escape-to-close behavior.
- The layout is designed to avoid horizontal page overflow from small phones up to wide desktop screens.
- This is a single-user, offline-first project. It intentionally has no backend, sync, notifications, or multi-device support.
