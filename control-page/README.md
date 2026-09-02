# agentbench control page

Fixed navigation target for the benchmark. Deployed to Vercel so every
provider navigates the same bytes on the same origin — this is what
isolates provider overhead from third-party CDN noise.

## Deploy

```bash
cd control-page
npx vercel deploy --prod
```

Then set the resulting URL in `.env`:

```
CONTROL_PAGE_URL=https://<your-app>.vercel.app
```

## Rules

- Content is deterministic (seeded generator, 80 KiB). Changing the payload
  requires bumping the version in `index.html` and in `METHODOLOGY.md`, and
  invalidating historical comparisons.
- Never navigate providers to example.com or any third-party site for
  published numbers.
