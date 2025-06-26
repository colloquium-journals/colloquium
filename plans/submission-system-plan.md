# Submission System Implementation Plan

## Overview

This document outlines the implementation plan for the Colloquium submission system based on the requirements defined in `submission-ideas.md`. The system will support flexible, multi-format manuscript submission with bot-assisted rendering into journal templates.

## Core Requirements Analysis

From `submission-ideas.md`, the key requirements are:

1. **Multi-format Support**: Primary focus on Markdown, with extensibility for LaTeX, Quarto, and other formats
2. **Asset Management**: Support for figures and other linked assets
3. **Bot-driven Rendering**: Bots handle format conversion to journal templates
4. **API-driven Workflow**: REST API for document and asset submission
5. **Revision Support**: Ability to submit revised versions throughout the process
6. **Frontend Integration**: Dedicated submission component linked to editorial conversations
7. **Change Tracking**: Editorial bot notifications for document changes

## Technical Architecture

### Database Schema Extensions

Add to existing Prisma schema (`packages/database/prisma/schema.prisma`):

```prisma
model Submission {
  id          String   @id @default(cuid())
  title       String
  abstract    String?
  keywords    String[]
  
  // Source document file reference
  sourceFile  SubmissionFile @relation("SourceFile")
  sourceFileId String        @unique
  
  // Format detection (flexible string)
  detectedFormat String?     // e.g., "markdown", "latex", "quarto", etc.
  fileExtension  String      // Original file extension for format hints
  
  // Asset management
  assets      SubmissionAsset[]
  
  // Rendered outputs
  renderedFiles SubmissionFile[] @relation("RenderedFiles")
  
  // Metadata
  authorId    String
  author      User     @relation(fields: [authorId], references: [id])
  manuscriptId String?
  manuscript  Manuscript? @relation(fields: [manuscriptId], references: [id])
  
  // Versioning
  version     Int      @default(1)
  parentId    String?
  parent      Submission? @relation("SubmissionVersions", fields: [parentId], references: [id])
  revisions   Submission[] @relation("SubmissionVersions")
  
  // Status tracking
  status      SubmissionStatus @default(DRAFT)
  submittedAt DateTime?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("submissions")
}

model SubmissionFile {
  id           String     @id @default(cuid())
  filename     String
  originalName String
  mimeType     String
  fileSize     Int
  storagePath  String     // Path in file storage system
  storageType  StorageType @default(LOCAL)
  
  // File metadata
  checksum     String?    // For integrity verification
  encoding     String?    // Text encoding if applicable
  
  // Relationships
  sourceSubmissionId String? @unique
  sourceSubmission   Submission? @relation("SourceFile", fields: [sourceSubmissionId], references: [id])
  
  renderedSubmissionId String?
  renderedSubmission   Submission? @relation("RenderedFiles", fields: [renderedSubmissionId], references: [id])
  
  createdAt    DateTime   @default(now())
  
  @@map("submission_files")
}

model SubmissionAsset {
  id           String     @id @default(cuid())
  filename     String
  originalName String
  mimeType     String
  fileSize     Int
  storagePath  String     // Path in file storage system
  storageType  StorageType @default(LOCAL)
  
  // Asset metadata
  altText      String?    // For accessibility
  caption      String?    // Figure caption
  checksum     String?    // For integrity verification
  
  submissionId String
  submission   Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  createdAt    DateTime   @default(now())
  
  @@map("submission_assets")
}

// Flexible format registry for supported formats
model SupportedFormat {
  id           String   @id @default(cuid())
  name         String   @unique // e.g., "markdown", "latex", "quarto"
  displayName  String   // e.g., "Markdown", "LaTeX", "Quarto"
  fileExtensions String[] // e.g., [".md", ".markdown"]
  mimeTypes    String[] // e.g., ["text/markdown"]
  
  // Bot configuration
  rendererBotId String?
  validatorBotId String?
  
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  
  @@map("supported_formats")
}

enum StorageType {
  LOCAL
  S3
  GCS
  AZURE
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  REVISION_REQUESTED
  ACCEPTED
  REJECTED
}
```

### API Integration Strategy

**Extend existing `/api/manuscripts` endpoint** rather than creating separate submissions endpoints:

```typescript
// Extend existing manuscripts.ts endpoints:

// Enhanced file upload (already exists, extend for additional assets)
POST   /api/manuscripts                   // Create manuscript with multi-file support
PUT    /api/manuscripts/:id              // Update manuscript metadata
GET    /api/manuscripts/:id/files        // List all files (source + assets + rendered)
POST   /api/manuscripts/:id/files       // Add additional files/assets
DELETE /api/manuscripts/:id/files/:fileId // Remove specific file

// Format management (new endpoints)
GET    /api/formats                      // List supported formats
POST   /api/formats                      // Register new format (admin only)
PUT    /api/formats/:id                  // Update format configuration
DELETE /api/formats/:id                  // Deactivate format

// Bot integration uses existing bot execution system:
// - Rendering bots are installed via /api/bots/:id/install
// - Bots are triggered via mentions in conversations
// - Bots access manuscript files and submit rendered outputs
// - No direct rendering endpoints needed
```

**Bot Integration Workflow:**
1. User uploads manuscript with assets via existing manuscripts endpoint
2. System detects format and suggests appropriate rendering bots
3. Editorial bot mentions renderer: `@markdown-renderer process manuscript`
4. Renderer bot accesses files, processes them, uploads rendered output
5. Bot posts completion message to conversation thread

### Frontend Components

Create in `apps/web/src/components/submissions/`:

1. **SubmissionEditor.tsx** - Main editing interface
2. **AssetUploader.tsx** - File upload component
3. **FormatSelector.tsx** - Document format selection
4. **VersionHistory.tsx** - Version tracking display
5. **RenderingStatus.tsx** - Bot rendering progress

### Bot Framework Integration

Extend existing bot system to support format-agnostic rendering:

1. **Format Detection Service** - Automatically identifies document formats
2. **Generic Renderer Interface** - Extensible bot framework for any format
3. **Asset Processor Bot** - Handles file linking and validation
4. **Format Registry** - Dynamic registration of new format support

## Current Status Summary

### ✅ **Completed Features (Phase 1 & 2)**

**Robust Submission Form:**
- Email-based author management with automatic user lookup and creation
- Single corresponding author enforcement with intuitive UI
- Visual file tree structure supporting folder uploads and organization
- Real-time format detection and validation
- Clean, simplified visual design without cluttered shadows

**Advanced File Management:**
- Drag-and-drop upload for both individual files and entire folder structures
- Visual file tree with collapsible folders and appropriate file type icons
- Support for complex asset hierarchies (figures/, data/, supplementary/ folders)
- File removal and management with visual feedback
- Format-aware file validation and suggestions

**Backend Infrastructure:**
- Flexible format registry system supporting dynamic format addition
- Enhanced manuscript API with multi-file support and author processing
- User lookup API for author email validation
- File storage abstraction supporting multiple backends
- Format detection service for automatic file type identification

### 🎯 **Ready for Next Phase: Bot Framework Integration**

The submission system now has a solid foundation with excellent UX for manuscript and asset management. The next logical step is to implement the bot framework that will process these uploaded files and provide automated assistance to the editorial workflow.

## Next Implementation Priority: Phase 3 Bot Framework

### **Immediate Next Steps (Priority Order):**

1. **Create Basic Markdown Renderer Bot (Week 5)**
   - Implement a simple bot that can process uploaded Markdown files
   - Convert Markdown to HTML with academic styling
   - Handle basic asset linking (images, figures)
   - Upload rendered files back to the manuscript
   - Integration with conversation system for status updates

2. **Bot File Access System (Week 5-6)**
   - Secure API for bots to access manuscript files
   - File download and upload capabilities for bots
   - Proper authentication and authorization for bot operations
   - File versioning and conflict resolution

3. **Automatic Bot Triggers (Week 6)**
   - Automatic bot suggestions based on uploaded file formats
   - Integration with conversation system for bot mentions
   - Bot discovery and recommendation system
   - Editorial workflow automation

### **Success Criteria for Phase 3:**
- Bots can securely access and process manuscript files
- At least one working renderer (Markdown → HTML)
- Automatic bot suggestions appear in conversations after submission
- Rendered files are properly versioned and accessible
- Editorial team can easily trigger and monitor bot operations

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2) ✅ COMPLETED

**Backend:**
- [x] Extend database schema with new submission models
- [x] Add format registry system (`SupportedFormat` model)  
- [x] Enhance existing manuscripts endpoint for additional file types
- [x] Implement flexible file storage abstraction
- [x] Create `/api/formats` endpoints for format management

**Frontend:**
- [x] Enhance existing manuscript submission page
- [x] Add multi-file upload support (source + assets)
- [x] Create format detection/selection interface  
- [x] Update file listing to show source vs assets vs rendered files

### Phase 2: Complete Submission Form & Asset Management (Week 3-4) ✅ COMPLETED

**Frontend Completion:**
- [x] Complete manuscript submission form updates
- [x] Implement separate source file and asset file upload areas
- [x] Add file type indicators and format detection display
- [x] Create asset management interface (add/remove/organize)
- [x] Add real-time format validation and suggestions
- [x] Implement email-based author management with user lookup
- [x] Add automatic account creation for non-existing authors
- [x] Create visual file tree structure with folder support
- [x] Implement drag-and-drop file upload with folder capabilities
- [ ] Implement file preview capabilities where possible

**Enhanced File Management:**
- [x] Update manuscript detail pages to show file categorization
- [x] Create file listing component with source/asset/rendered separation
- [x] Add file download and management capabilities
- [x] Visual file tree display with hierarchical folder structure
- [x] Appropriate file type icons and organization
- [ ] Implement file replacement functionality

**User Experience Improvements:**
- [x] Email-based author input with real-time user lookup
- [x] Single corresponding author enforcement
- [x] Automatic user account creation for new authors
- [x] Drag-and-drop file upload with visual feedback
- [x] Folder upload support for complex asset structures
- [x] Simplified visual design (removed heavy shadows)
- [ ] Upload progress indicators
- [x] Create file format help and guidelines
- [x] Add submission validation and error handling

### Phase 3: Document Processing & Bot Framework (Week 5-6) 🔄 NEXT PHASE

**Bot Framework Development:**
- [ ] Create generic rendering bot interface (`RenderingBot`)
- [ ] Implement format registry and bot discovery system
- [ ] Build example markdown renderer bot
- [ ] Add bot file access capabilities for manuscript files
- [ ] Create bot action for uploading rendered files back to manuscripts
- [ ] Implement bot security and sandboxing

**Editorial Workflow Integration:**
- [ ] Bot suggestion system in conversations based on file formats
- [ ] Automatic bot mentions when manuscripts are submitted
- [ ] Rendered file management and versioning
- [ ] Bot progress tracking and status updates
- [ ] Error handling and retry mechanisms for bot failures

**File Processing Pipeline:**
- [ ] Asynchronous file processing queue
- [ ] Progress indicators for long-running operations
- [ ] File validation and preprocessing
- [ ] Automatic format detection and validation
- [ ] Asset linking validation and preprocessing

### Phase 4: Advanced Features & Additional Formats (Week 7-8)

**Extended Format Support:**
- [ ] LaTeX renderer bot using existing bot framework
- [ ] Quarto renderer bot implementation
- [ ] PDF processing and text extraction bot
- [ ] R Markdown renderer integration
- [ ] Jupyter notebook processing capabilities

**Advanced Features:**
- [ ] Journal template customization system
- [ ] Bot marketplace for community-contributed renderers
- [ ] Advanced file preview capabilities (PDF, images, code)
- [ ] Version control and diff visualization
- [ ] Collaborative editing features
- [ ] Real-time collaboration on manuscripts

**Production Readiness:**
- [ ] Performance optimization and caching
- [ ] Security audit and hardening
- [ ] Comprehensive testing suite
- [ ] Documentation and user guides
- [ ] Deployment automation and monitoring

## Detailed Implementation Specifications

### File Storage Strategy

```typescript
// Flexible storage configuration
interface StorageConfig {
  type: 'local' | 's3' | 'gcs' | 'azure';
  basePath: string;
  maxFileSize: number;
  
  // Storage-specific configuration
  local?: {
    uploadsDir: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  // ... other storage types
}

const STORAGE_CONFIG: StorageConfig = {
  type: process.env.STORAGE_TYPE || 'local',
  basePath: process.env.STORAGE_BASE_PATH || 'uploads/',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default
  local: {
    uploadsDir: 'uploads/',
  }
};

// Dynamic file type validation based on registered formats
class FileValidator {
  static async validateFile(file: Express.Multer.File): Promise<ValidationResult> {
    const supportedFormats = await getSupportedFormats();
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    // Check against dynamically registered formats
    const matchingFormat = supportedFormats.find(format => 
      format.fileExtensions.includes(fileExtension) ||
      format.mimeTypes.includes(file.mimetype)
    );
    
    return {
      isValid: !!matchingFormat,
      detectedFormat: matchingFormat?.name,
      errors: matchingFormat ? [] : [`Unsupported file type: ${fileExtension}`]
    };
  }
}
```

### Rendering Bot Interface

```typescript
// Generic, extensible bot interface
interface RenderingBot {
  id: string;
  name: string;
  version: string;
  supportedFormats: string[]; // Dynamic format names, not enum
  
  // Core methods
  canHandle(formatName: string, fileExtension: string): boolean;
  render(sourceFile: FileReference, options: RenderOptions): Promise<RenderResult>;
  validate(sourceFile: FileReference): Promise<ValidationResult>;
  extractMetadata(sourceFile: FileReference): Promise<SubmissionMetadata>;
}

interface FileReference {
  id: string;
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum?: string;
}

interface RenderOptions {
  templateId?: string;
  outputFormat?: string; // 'html', 'pdf', 'docx', etc.
  includeBibliography?: boolean;
  customCss?: string;
  journalSettings?: Record<string, any>;
}

interface RenderResult {
  success: boolean;
  outputFiles: FileReference[]; // Can generate multiple files
  errors: RenderError[];
  warnings: RenderWarning[];
  metadata: Record<string, any>;
  processingTime: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestedFormat?: string;
  confidence: number; // 0-1 for format detection confidence
}

// Format registration system
class FormatRegistry {
  static async registerFormat(format: FormatDefinition): Promise<void> {
    // Register a new format with its associated bot
  }
  
  static async getAvailableFormats(): Promise<FormatDefinition[]> {
    // Get all currently supported formats
  }
  
  static async findBotForFormat(formatName: string): Promise<RenderingBot | null> {
    // Find appropriate bot for a given format
  }
}

interface FormatDefinition {
  name: string;
  displayName: string;
  fileExtensions: string[];
  mimeTypes: string[];
  description: string;
  rendererBotId?: string;
  validatorBotId?: string;
  isActive: boolean;
}
```

### Frontend State Management

Use React Query for submission data management:

```typescript
// Custom hooks
export const useSubmission = (id: string) => {
  return useQuery(['submission', id], () => fetchSubmission(id));
};

export const useSubmissionMutation = () => {
  return useMutation(updateSubmission, {
    onSuccess: () => {
      queryClient.invalidateQueries(['submissions']);
    }
  });
};
```

## Testing Strategy

### Backend Tests
- Unit tests for submission CRUD operations
- Integration tests for file upload handling
- Bot rendering pipeline tests
- API endpoint validation tests

### Frontend Tests
- Component rendering tests
- File upload functionality tests
- Editor state management tests
- Integration tests with backend API

### End-to-End Tests
- Complete submission workflow
- Multi-format rendering validation
- Asset linking verification
- Version control functionality

## Security Considerations

1. **File Upload Security**
   - File type validation
   - Size limits enforcement
   - Virus scanning integration
   - Secure file naming

2. **Content Validation**
   - XSS prevention in markdown rendering
   - LaTeX command filtering for security
   - Asset reference validation

3. **Access Control**
   - Author-only editing permissions
   - Reviewer read-only access
   - Editorial override capabilities

## Performance Optimization

1. **Lazy Loading**
   - Asset loading on demand
   - Paginated version history
   - Streaming large file uploads

2. **Caching Strategy**
   - Rendered output caching
   - Asset CDN integration
   - API response caching

3. **Background Processing**
   - Async rendering jobs
   - Queue-based asset processing
   - Progress tracking for long operations

## Migration and Deployment

### Data Migration
- Convert existing manuscripts to new submission format
- Migrate existing assets to new storage structure
- Update conversation references

### Deployment Checklist
- [ ] Database migration scripts
- [ ] Environment variable configuration
- [ ] File storage setup (local/cloud)
- [ ] Bot registration and configuration
- [ ] Frontend build and deployment

## Success Metrics

1. **Functional Metrics**
   - Successful submission rate
   - Rendering success rate across formats
   - Asset upload reliability
   - Version tracking accuracy

2. **Performance Metrics**
   - Upload speed for various file sizes
   - Rendering time by format type
   - API response times
   - Frontend loading performance

3. **User Experience Metrics**
   - Time to complete submission
   - Error rate in submission process
   - User feedback on editor interface
   - Adoption rate of different formats

## Future Enhancements

1. **Advanced Editing**
   - Collaborative editing capabilities
   - Real-time preview for LaTeX
   - Integrated reference management

2. **Format Extensions**
   - Jupyter notebook support
   - R Markdown integration
   - Word document import/export

3. **Workflow Integration**
   - Automated quality checks
   - Plagiarism detection integration
   - Citation validation bots

4. **Analytics and Reporting**
   - Submission analytics dashboard
   - Format usage statistics
   - Performance monitoring