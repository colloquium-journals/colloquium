# Colloquium Press Website Plan (colloquium-press.org)

## Purpose

The colloquium-press.org website serves as the public-facing marketing site, documentation hub, and community portal for the Colloquium platform. It is separate from the journal application itself — this site explains what Colloquium is, why it exists, and how to use it.

## Site Architecture

```
colloquium-press.org/
├── /                           # Landing page
├── /features                   # Feature overview
├── /features/conversations     # Conversational review deep dive
├── /features/bots              # Bot ecosystem deep dive
├── /features/publishing        # Publishing pipeline deep dive
├── /features/deployment        # Self-hosting and deployment
├── /pricing                    # Free/hosted/enterprise options
├── /docs                       # Documentation hub
│   ├── /docs/getting-started   # Quick start guides
│   ├── /docs/guides            # How-to guides
│   ├── /docs/reference         # API and configuration reference
│   ├── /docs/bots              # Bot development docs
│   └── /docs/deployment        # Deployment guides
├── /blog                       # News, updates, case studies
├── /community                  # Community resources
├── /about                      # About the project
└── /demo                       # Live demo or sandbox
```

---

## Content Plan

### 1. Landing Page (/)

**Goal**: Immediately communicate the value proposition and differentiate from traditional publishing.

**Sections**:

1. **Hero**
   - Headline: "Your journal. Your rules. Your community."
   - Subheadline: "Open-source publishing infrastructure that puts academics in control. Conversational peer review, automated workflows, and complete data sovereignty."
   - Primary CTA: "Get Started" → /docs/getting-started
   - Secondary CTA: "See It In Action" → /demo

2. **Problem Statement**
   - Traditional publishers control the infrastructure, the data, and the process
   - Academics do the work (writing, reviewing, editing) but don't own the platform
   - Journal creation requires either expensive vendor contracts or significant technical expertise
   - Peer review is opaque, slow, and stuck in email

3. **Solution Overview** (3-4 cards)
   - **Conversational Review**: Replace email chains with structured conversations. Granular privacy controls let you run open, semi-open, or traditional blind review — or invent your own model.
   - **Bot Automation**: Automate formatting, reference checking, plagiarism detection, and editorial workflows. Install community bots or build your own.
   - **Self-Sovereign**: Deploy on your own infrastructure. Your data never touches our servers unless you choose managed hosting.
   - **Open Source**: MIT licensed. Fork it, extend it, contribute back. No vendor lock-in, ever.

4. **How It Works** (visual workflow)
   - Author submits → Editor assigns reviewers → Conversational review → Decision → Automated publishing
   - Emphasize that each step happens in a conversation thread with bot assistance

5. **For Different Audiences** (tabbed or accordion)
   - **For Editors**: "Run your journal with modern tools. Assign reviewers, track deadlines, and make decisions — all in one place."
   - **For Reviewers**: "No more email attachments. Review in context, discuss with editors, submit structured assessments."
   - **For Authors**: "Submit once, track your manuscript's progress, respond to reviews directly."
   - **For Institutions**: "Give your researchers publishing independence. Deploy Colloquium behind your firewall with full SSO integration."
   - **For Developers**: "Build bots that automate scholarly workflows. TypeScript SDK, clear APIs, and a growing marketplace."

6. **Social Proof / Credibility**
   - Open source stats (GitHub stars, contributors)
   - "Built by academics, for academics"
   - Technology stack credibility (TypeScript, PostgreSQL, Next.js)

7. **Footer CTA**
   - "Ready to start your journal?" → /docs/getting-started
   - "Read the documentation" → /docs
   - GitHub link, community link

---

### 2. Features (/features)

**Overview page** with cards linking to deep-dive pages:

#### 2a. Conversational Review (/features/conversations)

- **The Problem**: Email-based review is fragmented, loses context, and forces editors to manually relay information between parties
- **The Solution**: Structured conversation threads with privacy levels
- **Privacy Models**:
  - Editorial (editors only)
  - Review (editors + reviewers)
  - Semi-public (editors + reviewers + authors)
  - Public (open community participation)
  - Author-only (authors discussing among themselves)
- **Message-Level Privacy**: Individual messages can have different visibility than the conversation default
- **Real-Time**: Server-Sent Events for live updates — no page refreshing
- **Markdown Support**: Rich formatting for technical and scientific discussion
- **Threaded Replies**: Keep complex discussions organized
- **Bot Integration**: @mention bots directly in conversations to trigger automated actions

#### 2b. Bot Ecosystem (/features/bots)

- **What Bots Do**: Automate repetitive editorial tasks, enforce quality standards, generate formatted outputs
- **Built-In Bots**:
  - **Editorial Bot**: Manage reviewer assignments, track deadlines, automate status transitions
  - **Markdown Renderer**: Convert manuscripts to publication-ready HTML/PDF with customizable templates
  - **Reference Bot**: Validate DOIs, check citations against CrossRef, identify missing references
  - **Reviewer Checklist Bot**: Generate structured evaluation forms for systematic review
- **Bot Framework**: Build custom bots in TypeScript with the Colloquium SDK
  - Standard API interface
  - Declarative permission system
  - Async job queue execution (non-blocking)
  - Rich execution context (manuscript, conversation, user info)
  - YAML-based configuration
- **Bot Marketplace** (coming): Discover, rate, and install community-built bots
- **Security**: Bots authenticate with scoped tokens, can only access what they're permitted

#### 2c. Publishing Pipeline (/features/publishing)

- **Multi-Format Input**: Accept PDF, LaTeX, Word, and Markdown submissions
- **Automated Formatting**: Bot-driven conversion to publication formats
- **Template System**: Journal-specific templates for consistent branding
  - HTML, LaTeX, and Typst engine support
  - Handlebars-based template customization
  - Built-in academic templates
- **File Management**: Organized per-manuscript storage with version tracking
- **Dual-Tier Hosting**: Authenticated access during review, static CDN-ready hosting after publication
- **DOI Integration** (planned): CrossRef registration and metadata submission
- **Indexing** (planned): Automatic submission to PubMed, Google Scholar, and other services

#### 2d. Deployment & Self-Hosting (/features/deployment)

- **One Command Setup**: `npx create-colloquium-journal` generates a complete, deployable instance
- **Deployment Options**:
  - Docker Compose (simplest)
  - Railway, Fly.io, Render (zero-config cloud)
  - AWS, GCP, Azure (enterprise cloud)
  - Kubernetes (large-scale)
  - Pulumi (infrastructure-as-code)
- **Complete Isolation**: Each journal gets its own database, file storage, and application containers
- **Self-Managed Updates**: Scripted upgrade path with zero-downtime migration
- **Backup & Recovery**: Automated backup scripts included

---

### 3. Pricing (/pricing)

**Model**: Open core with optional managed services.

| | Self-Hosted (Free) | Managed Hosting | Enterprise |
|---|---|---|---|
| Full platform | Yes | Yes | Yes |
| All bots | Yes | Yes | Yes |
| Custom domain | Yes | Yes | Yes |
| Data ownership | You own it | You own it | You own it |
| Infrastructure | You manage | We manage | We manage |
| SSL/Security | You manage | Included | Included |
| Backups | You manage | Included | Included + SLA |
| Support | Community | Email | Dedicated |
| SSO/SAML | DIY | Add-on | Included |
| SLA | - | 99.5% | 99.9% |

**Messaging**: "The complete platform is free and open source. Managed hosting is for teams that want convenience without sacrificing control."

---

### 4. Documentation (/docs)

#### 4a. Getting Started (/docs/getting-started)

1. **Quick Start (5 min)**: Deploy locally with Docker Compose for evaluation
2. **Create Your Journal**: Use the CLI to generate a production instance
3. **First Submission**: Walk through submitting and reviewing a test manuscript
4. **Install Bots**: Add editorial automation to your workflow
5. **Invite Your Team**: Set up editor and reviewer accounts

#### 4b. Guides (/docs/guides)

- **Journal Administration**
  - Configuring journal settings and branding
  - Managing user roles and permissions
  - Setting up submission guidelines
  - Configuring review workflows
  - Managing about pages and content

- **Editorial Workflow**
  - Processing new submissions
  - Assigning action editors
  - Inviting and managing reviewers
  - Making editorial decisions
  - Managing revisions and re-review

- **Conversations**
  - Understanding privacy levels
  - Using bot mentions effectively
  - Managing conversation participants
  - Message formatting with Markdown

- **Publishing**
  - Configuring templates
  - Generating formatted outputs
  - Managing published assets
  - Setting up DOI registration

- **Authentication**
  - Magic link authentication
  - ORCID integration
  - User profile management

#### 4c. API Reference (/docs/reference)

- **REST API**: Full endpoint documentation with request/response examples
  - Authentication endpoints
  - Manuscript endpoints
  - Conversation endpoints
  - User endpoints
  - Reviewer endpoints
  - Bot management endpoints
  - Settings endpoints
- **Bot API**: Interface specification for bot development
- **Configuration Reference**: All environment variables and config file options
- **Database Schema**: Entity relationship documentation

#### 4d. Bot Development (/docs/bots)

- **Introduction**: What bots are, how they work, when to build one
- **Getting Started**: `npx create-colloquium-bot` scaffolding
- **Bot Architecture**: Event model, job queue, execution context
- **API Access**: Using service tokens for authenticated API calls
- **Permissions**: Declaring and requesting bot permissions
- **Configuration**: YAML-based bot configuration system
- **Testing**: Testing bots locally and in development
- **Publishing**: Distributing bots to the community
- **Examples**: Annotated source of built-in bots

#### 4e. Deployment Guides (/docs/deployment)

- **Docker Compose** (recommended for small journals)
- **Railway / Fly.io / Render** (recommended for hands-off hosting)
- **AWS** (ECS + RDS + ElastiCache)
- **GCP** (Cloud Run + Cloud SQL + Memorystore)
- **Azure** (Container Instances + PostgreSQL + Redis)
- **Kubernetes** (Helm charts for large-scale)
- **Upgrading**: Version migration guides
- **Backup & Recovery**: Disaster recovery procedures
- **Monitoring**: Setting up health checks and alerting
- **Security**: SSL, firewall, and access control hardening

---

### 5. Blog (/blog)

**Content types**:

- **Release Notes**: New features, bug fixes, upgrade instructions
- **Case Studies**: Journals using Colloquium, their experience and workflow
- **Technical Deep Dives**: Architecture decisions, bot development tutorials
- **Community Spotlights**: Notable community bots, contributions
- **Opinion/Vision**: Essays on open access, academic publishing reform, the future of peer review

**Initial posts** to write for launch:

1. "Why We Built Colloquium" — founding motivation, problems with traditional publishing
2. "Conversational Review: A New Model for Peer Review" — the philosophy and mechanics
3. "Building Your First Bot" — tutorial-style introduction to the bot framework
4. "From Submission to Publication: A Complete Walkthrough" — end-to-end demo
5. "Self-Hosting Your Journal in 15 Minutes" — practical deployment guide

---

### 6. Community (/community)

- **GitHub**: Link to repository, contribution guidelines, issue tracker
- **Discussions**: GitHub Discussions for Q&A and feature requests
- **Bot Directory**: Catalog of available community bots (pre-marketplace)
- **Contributing**: How to contribute code, documentation, bots, or translations
- **Code of Conduct**: Community standards
- **Roadmap**: Public roadmap with voting/input (link to plans/TODO.md or a public board)

---

### 7. About (/about)

- **Mission**: Democratize academic publishing through open-source infrastructure
- **Philosophy**: Self-sovereign journals, conversational review, community-driven automation
- **Team/Contributors**: Key contributors and their roles
- **License**: MIT — what this means practically
- **Contact**: How to reach the team

---

### 8. Demo (/demo)

**Options** (choose one or combine):

- **Live Sandbox**: A running Colloquium instance with sample data where visitors can explore the UI without signing up. Read-only or with guest accounts that reset periodically.
- **Guided Tour**: Interactive walkthrough (screenshots/video + annotations) showing the key workflows
- **Video Demo**: 3-5 minute narrated screencast of the full submission-to-publication flow

---

## Technical Implementation

### Framework Choice: Astro + Starlight

**Rationale**:
- **Astro**: Fast static site generator with excellent content-focused features, partial hydration for interactive components
- **Starlight**: Astro's official documentation theme — provides sidebar navigation, search, versioning, and i18n out of the box
- **MDX**: Write content in Markdown with embedded React/Astro components for interactive examples
- **Performance**: Static output with zero JavaScript by default, selective hydration where needed
- Starlight handles the /docs section natively; marketing pages use custom Astro layouts

### Alternative: Next.js (same stack as the product)

If consistency with the main product stack is preferred:
- Next.js 14 with App Router
- Static export for marketing pages
- MDX for documentation content
- Fumadocs or Nextra for documentation structure
- Mantine UI for component consistency

### Directory Structure

```
apps/website/
├── src/
│   ├── content/
│   │   ├── docs/               # Starlight documentation (MDX)
│   │   │   ├── getting-started/
│   │   │   ├── guides/
│   │   │   ├── reference/
│   │   │   ├── bots/
│   │   │   └── deployment/
│   │   └── blog/               # Blog posts (MDX)
│   ├── pages/
│   │   ├── index.astro         # Landing page
│   │   ├── features/
│   │   ├── pricing.astro
│   │   ├── community.astro
│   │   ├── about.astro
│   │   └── demo.astro
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── FeatureCard.astro
│   │   ├── PricingTable.astro
│   │   ├── WorkflowDiagram.astro
│   │   ├── CodeExample.astro
│   │   └── AudienceTabs.astro
│   ├── layouts/
│   │   ├── Marketing.astro     # Layout for marketing pages
│   │   └── Blog.astro          # Layout for blog posts
│   └── styles/
│       └── global.css
├── public/
│   ├── images/
│   │   ├── screenshots/        # Product screenshots
│   │   ├── diagrams/           # Architecture diagrams
│   │   └── icons/              # Feature icons
│   └── fonts/
├── astro.config.mjs
├── package.json
└── tailwind.config.mjs         # Tailwind for marketing pages
```

### Hosting

- **Cloudflare Pages** or **Vercel**: Free tier handles static sites well, global CDN, automatic deployments from GitHub
- Custom domain: colloquium-press.org
- Preview deployments for PRs

### Search

- Starlight includes built-in search (Pagefind) for documentation
- Consider Algolia DocSearch for enhanced search if traffic warrants it

### Analytics

- Privacy-respecting analytics: Plausible or Umami (self-hosted)
- No Google Analytics — consistent with privacy-first philosophy

---

## Design Direction

### Visual Identity

- **Clean and academic**: Professional without being corporate
- **High contrast**: Accessibility-first, WCAG AA minimum
- **Minimal decoration**: Let content and structure communicate, not ornament
- **Code-friendly**: Syntax-highlighted code blocks are first-class content
- **Diagrams**: Mermaid or custom SVG for architecture and workflow visualization

### Color Palette

- Primary: A muted blue or teal (trustworthy, academic)
- Accent: A warmer tone for CTAs and highlights
- Neutral: Near-black text on near-white backgrounds
- Code: Dark theme for code blocks (consistent with developer expectations)

### Typography

- **Headings**: A clean sans-serif (Inter, Source Sans, or similar)
- **Body**: Readable at long-form lengths (16px+ base, 1.6+ line height)
- **Code**: JetBrains Mono or Fira Code

---

## Content Principles

1. **Show, don't tell**: Use screenshots, code examples, and diagrams over marketing copy
2. **Honest about status**: Clearly label features as implemented, in progress, or planned
3. **Technical accuracy**: The audience is academics and developers — don't oversimplify
4. **Opinionated but respectful**: We believe in open access and conversational review, but don't disparage alternatives
5. **Practical focus**: Every page should help someone do something or decide something
6. **No fluff**: No stock photos, no meaningless testimonials, no buzzword soup

---

## SEO and Discovery Strategy

### Target Keywords

- "open source journal platform"
- "self-hosted academic publishing"
- "peer review software open source"
- "create scientific journal"
- "conversational peer review"
- "academic journal management system"
- "open access journal software"
- "journal publishing platform self-hosted"

### Content Strategy for SEO

- Blog posts targeting long-tail keywords ("how to start an academic journal", "alternatives to [commercial platform]", "open peer review tools")
- Documentation pages naturally rank for technical queries
- Feature pages target comparison queries

### Technical SEO

- Static HTML output (excellent crawlability)
- Proper semantic markup (headings, nav, main, article)
- Open Graph and Twitter Card meta tags
- Structured data (SoftwareApplication schema)
- Sitemap.xml and robots.txt
- Fast load times (static site, minimal JS)

---

## Launch Plan

### Phase 1: Minimal Viable Site

- Landing page with clear value proposition
- Getting started documentation (Docker quick start)
- Feature overview pages
- About page
- GitHub link and community pointers

### Phase 2: Complete Documentation

- Full API reference
- All deployment guides
- Bot development documentation
- Editorial workflow guides

### Phase 3: Community and Content

- Blog with launch posts
- Community page with contribution guidelines
- Demo instance or guided tour
- Bot directory

### Phase 4: Growth

- Case studies from early adopters
- Comparison pages (vs. OJS, vs. Scholastica, etc.)
- Pricing page (when managed hosting launches)
- Newsletter signup
- Conference/event presence

---

## Repository Structure

The website lives in the main Colloquium monorepo at `apps/website/`. This follows the existing pattern of `apps/web` and `apps/api`, and leverages the Turborepo build system already in place.

### Why Same Repo

- **Docs track the code**: API documentation updates happen in the same commit as API changes. No cross-repo drift.
- **Shared types**: The website can import from `packages/types` for accurate schema docs, or reference the Prisma schema directly.
- **Single contributor experience**: A PR that adds a bot framework feature can include the bot development docs update.
- **Existing tooling**: TypeScript, linting, and build orchestration already handle multiple apps.
- **Natural fit**: The monorepo already has 15+ packages. One more app doesn't change the character.

### Monorepo Integration

```
apps/
├── web/                    # Next.js frontend (the journal product)
├── api/                    # Express.js backend
├── website/                # Astro + Starlight (colloquium-press.org)
│   ├── src/
│   │   ├── content/docs/   # Documentation (MDX)
│   │   ├── content/blog/   # Blog posts (MDX)
│   │   ├── pages/          # Marketing pages (Astro)
│   │   ├── components/     # Site components
│   │   └── styles/
│   ├── public/
│   ├── astro.config.mjs
│   └── package.json
```

### Turborepo Configuration

Add to root `turbo.json`:
```json
{
  "pipeline": {
    "website#build": {
      "outputs": ["dist/**"]
    },
    "website#dev": {
      "persistent": true
    }
  }
}
```

### Deployment

- Deploy from `apps/website/` subdirectory via Cloudflare Pages or Vercel (both support monorepo root directory configuration)
- Deploys on every push to main — static site builds are fast and cheap
- Preview deployments for PRs that touch `apps/website/`

---

## Metrics and Success Criteria

- **Visitor → GitHub**: Percentage of visitors who click through to the repository
- **Visitor → Docs**: Percentage who enter the documentation
- **Docs → Getting Started completion**: How many start the quick start guide
- **Instance creation**: Tracked via opt-in telemetry in the CLI tool
- **Search ranking**: Position for target keywords
- **Community growth**: GitHub stars, forks, contributors, discussions activity
