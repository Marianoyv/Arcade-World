# Arcade World

Arcade World is a browser game room with gaming news, retro guides, and an optional desktop launcher.

Automated work starts with [AGENTS.md](AGENTS.md) and the short [operating routes](OPERATIONS.md). Editorial decisions follow [EDITORIAL_PLAYBOOK.md](EDITORIAL_PLAYBOOK.md); measurement follows [ANALYTICS.md](ANALYTICS.md).

## Local development

Serve the project directory with `npm run serve`, then open `http://localhost:8000/`. The news portal is at `/blog.html`.

## Checks and deployment

Run `npm run content:check`, `npm run test:analytics`, and `npm run build:web` before a release. The static build is written to `site-dist/`.

Firebase Hosting serves `site-dist/` from the `arcade-world` project. Deploy with `firebase deploy --only hosting --project arcade-world` from an authenticated environment. The repository is maintained at [Marianoyv/Arcade-World](https://github.com/Marianoyv/Arcade-World).
