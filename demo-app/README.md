# Controlled demo application

This directory will contain the small application that RayShield scans during the demo.

The security/QA owner should add intentional, isolated vulnerabilities here along with reproducible tests. Do not use RayShield's own source as the vulnerable target, and do not put real secrets or production data in this directory.

Start with one SQL-injection scenario. Add XSS and hardcoded-secret scenarios only after the first detection-to-verification loop works.
