# pairoo.xyz

Static marketing site for Pairoobot.

- `index.html` — landing page
- `assets/` — brand assets (bird, mark, banner, icons)
- `pairoo/{privacy,terms,data-deletion}/` — legal pages

## Status

The legal pages are **drafts**. Controller: Christian Santana (individual).
Contact: christian@holzbach.co. Retention periods are not approved or
implemented — do not present them as active policy.

## Deploy

Static, no build step. Vercel: import this repo, framework preset "Other",
no build command, output directory `.`.

Domain `pairoo.xyz` currently resolves to Hostinger parking (`2.57.91.91`).
Point it at Vercel before using these URLs anywhere public.
