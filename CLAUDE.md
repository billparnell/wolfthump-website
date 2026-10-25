# Wolfthump website

Static one-pager on **GitHub Pages** (`wolfthump_index.html`, `css/default.css`),
DNS at **NameSilo**. The booking form's backend is a Cloudflare Worker in `worker/`.

- Docs: `PRODUCT_BRIEF.md` (decisions), `TECH_DESIGN.md` (how the form works),
  `BACKLOG.md` (next phase, at the top).
- Tests: `node --test worker/contact.test.mjs`. No npm install, no venv.
  There's no Python here.
- Deploy Worker: `npx wrangler deploy -c worker/wrangler.jsonc` (by hand).
- **GitHub Pages publishes everything in this repo. Never commit a secret.**
