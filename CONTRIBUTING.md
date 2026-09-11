# Contributing

## Development

Use Node.js 24+ and npm. Install dependencies with:

```powershell
npm install
npm --prefix apps/api install
npm --prefix apps/web install
```

Start the local environment with:

```powershell
npm run dev
```

## Validation

Before pushing changes, run:

```powershell
npm run build
```

Keep `main` buildable. Use focused feature branches for larger changes.

## Code changes

- Keep core logic under `core/` independent from the web UI.
- Keep HTTP concerns under `apps/api/`.
- Keep presentation concerns under `apps/web/`.
- Do not commit `.env` files, API keys, generated build output, or dependency directories.
- Preserve workspace path-safety checks when adding file operations.
- Do not introduce unbounded autonomous execution.
