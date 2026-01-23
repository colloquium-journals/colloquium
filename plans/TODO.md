# Colloquium TODO

High-level roadmap of unimplemented features and planned work.

## Publishing Pipeline

- [ ] PDF generation via Pandoc (see [markdown-renderer-pandoc-implementation-plan.md](markdown-renderer-pandoc-implementation-plan.md))
- [ ] Multi-engine template system: HTML, LaTeX, Typst (see [document-rendering-templating-plan.md](document-rendering-templating-plan.md))
- [ ] Journal-configurable typesetting engine selection (see [robust-typesetting-publishing-plan.md](robust-typesetting-publishing-plan.md))
- [ ] DOI assignment / CrossRef integration
- [ ] Metadata submission to indexing services (PubMed, etc.)
- [ ] Publication preview system for authors/editors

## Bot Ecosystem

- [ ] Containerized service-enhanced bots (see [bot-architecture-flexible-services.md](bot-architecture-flexible-services.md))
- [ ] Bot marketplace: discovery, ratings, community contributions
- [ ] Bot sandboxing / isolated execution
- [ ] Statcheck bot (statistical analysis validation)
- [ ] Link check bot (URL and OSF link verification)
- [ ] Plagiarism detection bot (actual algorithms, not placeholder)

## Editorial Workflow

- [ ] Editorial decision interface (accept/reject/revise with structured criteria)
- [ ] Manuscript status transition automation
- [ ] Deadline management with automated reminders
- [ ] Revision diff visualization
- [ ] Re-review coordination for additional rounds
- [ ] Appeal handling process

## Authentication & Identity

- [ ] ORCID OAuth verification (see [orcid-oauth-plan.md](orcid-oauth-plan.md))
- [ ] Institutional SSO support
- [ ] Expertise tags for reviewer matching

## Deployment & Operations

- [ ] Instance creation CLI tool (see [instance-creation-deployment-plan.md](instance-creation-deployment-plan.md))
- [ ] Production Docker configurations
- [ ] Cloud storage integration (S3/GCS/Azure)
- [ ] CI/CD pipeline
- [ ] Backup and disaster recovery automation
- [ ] Performance monitoring and logging

## Infrastructure

- [ ] Redis caching layer
- [ ] WebSocket scaling (replace/augment SSE)
- [ ] Database connection pooling and query optimization
- [ ] CDN for published static assets

## Community & Distribution

- [ ] RSS feeds for new publications
- [ ] Email subscriber notifications
- [ ] Repository integration (institutional uploads)
- [ ] Bot developer documentation and SDK
- [ ] Self-hosting documentation and guides
