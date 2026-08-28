# MVP architecture

```text
Frontend
  -> Backend API / workflow coordinator
       -> Scanner: structured, evidence-backed findings
       -> Remediation agent: proposal + code diff
       -> Human approval gate
       -> Validator: unit tests + security test + re-scan + regression check
  <- Findings and verification evidence
```

## API contract to implement next

| Endpoint | Purpose |
| --- | --- |
| `POST /api/reviews` | Start a security review for the controlled demo app |
| `GET /api/reviews/:reviewId` | Return status, agent activity and findings |
| `POST /api/findings/:findingId/remediation` | Generate a remediation proposal and diff |
| `POST /api/findings/:findingId/approve` | Explicitly approve a proposed change |
| `POST /api/findings/:findingId/validate` | Run tests, re-scan and return verification evidence |

The final state is `FIX VERIFIED` only if all required checks pass. Otherwise it is `NOT VERIFIED`.
