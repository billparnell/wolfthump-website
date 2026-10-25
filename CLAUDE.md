# Wolfthump website

Static one-pager on **GitHub Pages** (`index.html`, `css/default.css`),
DNS at **NameSilo**. The booking form's backend is a Cloudflare Worker in `worker/`.

- Docs: `PRODUCT_BRIEF.md` (decisions), `TECH_DESIGN.md` (how the form works),
  `BACKLOG.md` (next phase, at the top).
- Tests: `node --test worker/contact.test.mjs`. No npm install, no venv.
  There's no Python here.
- Deploy Worker: `npx wrangler deploy -c worker/wrangler.jsonc` (by hand).
- **GitHub Pages publishes the repo, minus what `_config.yml` excludes.** Add any new
  non-site file (doc, tool) to its `exclude:` list. The repo is public, so never commit a secret.
- **Bump `?v=` on the stylesheet link in `index.html` whenever `default.css` changes**
  (GitHub Pages caches CSS for 10 minutes).
- `wolfthump_index.html` is only a redirect to `./` for old links. Don't edit the site there.
