# g24-cordlife-grc-prototype

IS4234 Group 24: deviation escalation and compliance monitoring prototype for the Cordlife case.

The prototype removes single-person discretion from the deviation lifecycle: storage-tank breaches raise deviations automatically, overdue deviations escalate on a timer, and closures need independent approval. Operators, Clinical Governance, the Board and MOH each get their own view. There is no login; use the role switcher in the header.

## Running locally

```bash
npm install
npm run dev
```

## Deployment

Pushing to `main` builds the site and deploys it to GitHub Pages through `.github/workflows/deploy.yml`. In the repo settings, set **Pages → Source** to **GitHub Actions**. The repo must be public unless the organisation is on a paid plan.

## Stack

Vite, React and TypeScript. All data is simulated and stored in the browser; there is no backend.
