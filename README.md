# Typing Rogue

Typing Rogue is a static tactical typing practice game built with Vite, React, and TypeScript.

The game does not call a server, database, or LLM. The AI is a game concept: typing feeds XP and task progress into the AI companion, while opponents add time pressure and focus loss.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

## GitHub Pages

The app uses `base: './'` in `vite.config.ts`, so the built files work under a GitHub Pages project path.

This repo includes `.github/workflows/deploy.yml`. Enable GitHub Pages in the repository settings and set the source to GitHub Actions.
