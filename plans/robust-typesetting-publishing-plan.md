# Robust Typesetting and Publishing System Plan

**Status: ✅ Implemented**

The `markdown-renderer-bot` with Pandoc microservice provides journal-configurable engine selection (HTML/LaTeX/Typst), template management, bibliography support, and dual HTML/PDF output.

## Overview

This plan outlines a robust, flexible typesetting and publishing system for Colloquium that enables journal administrators to choose from various bot-based rendering engines while maintaining consistent manuscript processing workflows and reliable output generation.

## Core Philosophy

- **Administrative Choice**: Journal admins select rendering engines based on their needs
- **Third-Party Extensibility**: Support for third-party bot development with clear interfaces
- **Dual Output Support**: Bots can support HTML, PDF, or both formats based on their capabilities
- **Consistent Interface**: Manuscript upload and processing interface remains uniform regardless of chosen bots
- **Transparent Processing**: Clear reporting of compilation/typesetting errors and warnings without automatic rejection
- **Flexible Standards**: Optional support for academic publishing standards (CSL, scholarly metadata, etc.)

## Architecture Overview

### 1. Typesetting Engine Selection System

```
Journal Admin Configuration
├── Default Rendering Engine (journal-wide)
├── Output Format Requirements
│   ├── HTML Required: true/false
│   ├── PDF Required: true/false
│   └── Both Required: true/false
└── Reference Processing Settings
    ├── CSL Processing: optional/required
    ├── Accepted Reference Formats: [.bib, .ris, .json]
    └── Default Citation Style: APA/MLA/Chicago/etc.
```


## System Components

### 1. Manuscript Upload and Processing

Command to bot in conversation triggers rendering. If render fails, the bot posts a message with error details.

### 2. Rendering Bot Architecture

Same as other bots. API endpoints for accessing manuscript data, processing files, and returning outputs.

### 3. Reference Processing System

Bots should support flexible reference processing:
- **Separate Bibliography Files**: Support for .bib, .ris, .json reference files when provided
- **Inline Citations**: Process manuscripts with pre-formatted references sections when separate files are not provided
- **Journal Configuration**: Allow admins to configure CSL style and reference file requirements per bot

### 4. Output Format Handling

**Template Management**: Bots use file-based template systems managed through the standard bot configuration UI in admin settings. Each bot defines its own template format and structure.

**Format Support**: Bots declare their output format capabilities (HTML, PDF, or both) and journals configure their requirements accordingly.




## Design Decisions Based on Feedback

**Reference Processing**: CSL reference processing is optional at the journal level, but individual bots may require separate reference files to function properly. The upload interface supports optional reference files, and bots declare their reference requirements.

**Bot Selection Strategy**: No automatic fallback system. Journal administrators establish their preferred bot configuration, and the system provides clear error reporting to help editors and authors resolve issues.

**Output Format Priority**: Journal administrators configure output format requirements (HTML required/optional/disabled, PDF required/optional/disabled). This is a per-journal decision rather than a system-wide default.

**Quality Standards**: The system reports compilation/typesetting errors transparently to editors and authors, but does not automatically reject outputs. Warning systems are optional and bot-specific. Publication readiness decisions remain with editors and authors.

**Third-Party Bot Development**: The system prioritizes clear interfaces and documentation for third-party bot developers, allowing them to make their own performance and quality trade-offs within the standardized framework.

This plan provides a comprehensive framework for building a flexible typesetting and publishing system that gives journal administrators full control over their rendering pipeline while supporting third-party bot development and maintaining consistent user experiences.