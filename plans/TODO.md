# Colloquium TODO

High-level roadmap of unimplemented features and planned work.

## Publishing Pipeline

- [x] PDF generation via Pandoc (see [markdown-renderer-pandoc-implementation-plan.md](markdown-renderer-pandoc-implementation-plan.md))
- [x] Multi-engine template system: HTML, LaTeX, Typst (see [document-rendering-templating-plan.md](document-rendering-templating-plan.md))
- [x] Journal-configurable typesetting engine selection (see [robust-typesetting-publishing-plan.md](robust-typesetting-publishing-plan.md))
- [x] DOI assignment and indexing services (see [doi-crossref-indexing-plan.md](doi-crossref-indexing-plan.md))
  - [x] Phase 1: Core Crossref integration (journal settings, DOI minting, XML deposit)
  - [x] Phase 2: Enhanced metadata (structured affiliations, CRediT roles, funding)
  - [x] Phase 3: Full JATS compliance (JATS XML export, PMC compatibility)
  - [x] Google Scholar meta tag generation
  - [x] DOAJ integration
- [ ] Publication preview system for authors/editors

## Bot Ecosystem

- [ ] Bot developer experience overhaul (see [bot-developer-experience.md](bot-developer-experience.md))
  - [ ] Phase 1: Bot SDK, enriched context, docs restructure, template update
  - [ ] Phase 2: Event/hook system, bot-scoped persistent storage
  - [ ] Phase 3: Expanded API surface, bot composition/pipelines
  - [ ] Phase 4: Dev tooling (watch mode, playground UI), structured return types
- [ ] Containerized service-enhanced bots (see [bot-architecture-flexible-services.md](bot-architecture-flexible-services.md))
- [ ] Bot marketplace: discovery, ratings, community contributions
- [ ] Bot sandboxing / isolated execution
- [ ] Statcheck bot (statistical analysis validation)
- [ ] Link check bot (URL and OSF link verification)
- [ ] Plagiarism detection bot (actual algorithms, not placeholder)

## Editorial Workflow

- [x] Configurable review workflow system (see [configurable-review-workflow-plan.md](configurable-review-workflow-plan.md))
  - [x] Template-based workflow configuration (blind, open, progressive disclosure, etc.)
  - [x] Phase-aware visibility and participation enforcement
  - [x] Editorial release controls and round tracking
  - [x] Admin UI for workflow configuration (WorkflowConfigPanel)
  - [x] Frontend conversation UI adaptations (AuthorLockedState, EditorPhaseControls, RoundDivider, masked identities)
- [x] Deadline management with automated reminders (see [deadline-reminders-plan.md](deadline-reminders-plan.md))
- [ ] Revision diff visualization
- [ ] Appeal handling process

## Authentication & Identity

- [x] ORCID OAuth verification (see [orcid-oauth-plan.md](orcid-oauth-plan.md))
- [ ] Passkey authentication for frequent users (see [passkey-authentication-plan.md](passkey-authentication-plan.md))
- [ ] Institutional SSO support
- [ ] Expertise tags for reviewer matching

## Deployment & Operations

- [x] Instance creation CLI tool (see [instance-creation-deployment-plan.md](instance-creation-deployment-plan.md))
  - [x] `create-colloquium-journal` CLI with Docker, AWS, and GCP support
  - [x] AWS Terraform templates (ECS Fargate, RDS, S3, ALB)
  - [x] GCP Terraform templates (Cloud Run, Cloud SQL, Cloud Storage)
  - [x] Deployment documentation (`docs/deployment/aws.md`, `gcp.md`, `troubleshooting.md`)
- [x] PostgreSQL-based job queue (graphile-worker)
  - [x] Replaced Bull/Redis with graphile-worker for async bot processing
  - [x] Uses PostgreSQL LISTEN/NOTIFY (no polling, no Redis needed)
  - [x] Removed Memorystore (GCP) and ElastiCache (AWS) - saves ~$35-40/month
- [x] Production Docker configurations
- [x] Cloud storage integration (S3/GCS)
  - [x] S3 storage implementation with `@aws-sdk/client-s3`
  - [x] GCS storage implementation with `@google-cloud/storage`
  - [x] Storage configuration factory (`apps/api/src/config/storage.ts`)
- [x] CI/CD pipeline for Terraform validation (`.github/workflows/terraform-validate.yml`)
- [ ] Backup and disaster recovery automation
- [ ] Performance monitoring and logging

## Infrastructure

- [ ] Redis caching layer (optional - for high-traffic caching only, not needed for job queue)
- [ ] WebSocket scaling (replace/augment SSE)
- [ ] Database connection pooling and query optimization
- [ ] CDN for published static assets

## Community & Distribution

- [ ] RSS feeds for new publications
- [ ] Email subscriber notifications
- [ ] Repository integration (institutional uploads)
- [ ] Bot developer documentation and SDK (see [bot-developer-experience.md](bot-developer-experience.md))
- [ ] Self-hosting documentation and guides
