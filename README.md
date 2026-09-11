# pairoo.xyz

Static marketing site for Pairoobot. No build step.

- `index.html` — landing page; coin and pair lists are fetched from `pairoo/api/*.json`
- `pairoo/api/` — generated feeds (`coins.json`, `pairs.json`, `stats.json`)
- `pairoo/{privacy,terms,data-deletion}/` — legal pages
- `assets/` — brand assets

The feeds are generated from the bot's own data by `scripts/build_site_api.py`
in the Pairoobot repository. A coin is only listed once it has a mint address
and a confirmed signature on chain; fields without a live source stay `null`
and render as `—` rather than a made-up number.

## Status

The legal pages are **drafts**, in English like every public text. The
administrator is identified only as "Pairoo Dev"; no natural person is
named and the legal identification of the operator is still pending.
Contact: legal@pairoo.xyz (privacy and deletion: privacy@pairoo.xyz).
Those mailboxes still have to be created — the domain has no MX record
yet. Retention periods are not approved or implemented — do not present
them as active policy.

## Deploy

Vercel project `pairoo-site`, connected to this repository. Pushing to `main`
deploys production (`pairoo.xyz`). Framework preset "Other", no build command,
output directory `.`. CLI deploys to this project return BLOCKED — use git.
