# RayShield AI

> An agentic security remediation workflow for developers.

**Detect -> Understand -> Fix -> Test -> Verify**

RayShield is a hackathon MVP that analyzes a controlled demo project, explains real security findings, proposes an approved remediation, and verifies the result with tests and a re-scan.

## Repository layout

```text
RayShield/
├── frontend/                 # React/Vite interface for the demo
├── backend/                  # Node.js API and workflow coordinator
├── scanner/                  # Security detection adapters and rules
├── agents/
│   └── remediation/          # Bob-powered remediation boundary
├── validator/                # Tests, re-scan and verification decision
├── demo-app/                 # Small controlled app scanned by RayShield
├── tests/                    # Cross-component fixtures and integration tests
├── docs/                     # Architecture and demo decisions
└── README.md
```

## MVP workflow

1. Select the controlled `demo-app` project.
2. The scanner returns structured findings.
3. The backend coordinates analysis and requests a remediation proposal.
4. A human approves the proposed code diff.
5. The validator runs tests and a security re-scan.
6. RayShield displays `FIX VERIFIED` only when every required check passes.

## Getting started

This is an npm workspace. Install dependencies once Node.js 20+ is available:

```bash
npm install
```

Then run the two services in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

The API health check is available at `GET /health` on port `3001` by default.

## Team ownership

| Area | Suggested owner | Responsibility |
| --- | --- | --- |
| `frontend/` | Frontend / UX | Dashboard, findings, agent activity, diff and verification screens |
| `backend/` | Backend / integration | API, workflow state and service integration |
| `scanner/`, `demo-app/`, `tests/` | Security / QA | Real controlled findings, scanner rules and verification tests |
| `agents/`, `validator/` | AI / integration | Remediation proposal, test/re-scan orchestration and final status |

## Security

This repository includes pre-configured security files to help prevent accidental credential commits and potential account suspension during the hackathon.

Read [SECURITY.MD](SECURITY.MD) before committing. Never commit `.env` files or credentials, and never place credentials in AI prompts. Copy `.env.example` to `.env` locally and add real values only on your machine.

## Near-term milestones

1. Implement one controlled SQL-injection finding end-to-end.
2. Show an approval gate and before/after diff.
3. Run a test plus re-scan and emit `FIX VERIFIED` or `NOT VERIFIED`.
4. Add XSS and hardcoded-secret scenarios only after the first loop is reliable.
