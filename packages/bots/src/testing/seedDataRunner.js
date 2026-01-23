"use strict";
/**
 * Seed Data Test Runner
 *
 * Enables testing bots against real seed data files without running the API server
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedDataTestRunner = void 0;
exports.createSeedDataRunner = createSeedDataRunner;
exports.describeSeedDataTests = describeSeedDataTests;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mockApiServer_1 = require("./mockApiServer");
const mockFiles_1 = require("./mockFiles");
const testHarness_1 = require("./testHarness");
/**
 * Test runner that uses real seed data files
 */
class SeedDataTestRunner {
    constructor(options = {}) {
        this.papers = null;
        // Default to the standard uploads directory
        // Try multiple possible paths based on where the code might be running from
        if (options.uploadsDir) {
            this.uploadsDir = options.uploadsDir;
        }
        else {
            // Try to find the uploads directory relative to common locations
            const possiblePaths = [
                // From bots package source
                path.resolve(__dirname, '../../../../../../apps/api/uploads/manuscripts'),
                // From bots package dist
                path.resolve(__dirname, '../../../../../../../apps/api/uploads/manuscripts'),
                // From other packages in the monorepo
                path.resolve(process.cwd(), '../../apps/api/uploads/manuscripts'),
                path.resolve(process.cwd(), '../apps/api/uploads/manuscripts'),
                path.resolve(process.cwd(), 'apps/api/uploads/manuscripts'),
            ];
            // Find the first path that exists
            let foundPath;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    foundPath = p;
                    break;
                }
            }
            // Use found path or fallback to the first option
            this.uploadsDir = foundPath ?? possiblePaths[0];
        }
        if (options.papers) {
            this.papers = options.papers;
        }
    }
    /**
     * Gets available seed papers and their files
     */
    getAvailablePapers() {
        const papers = [];
        // Known paper keys from seed-content
        const knownPapers = ['mlPeerReview', 'colloquiumPlatform', 'climateModeling'];
        for (const key of knownPapers) {
            const mdPath = path.join(this.uploadsDir, `${key}.md`);
            const bibPath = path.join(this.uploadsDir, `${key}-references.bib`);
            if (fs.existsSync(mdPath)) {
                const imageFiles = [];
                const imagePaths = [];
                // Find associated images based on paper key
                const imagePatterns = {
                    'mlPeerReview': ['performance-results.png'],
                    'colloquiumPlatform': ['system-architecture.png'],
                    'climateModeling': ['coupling-diagram.png', 'heat-feedback.png']
                };
                for (const imgFile of imagePatterns[key] ?? []) {
                    const imgPath = path.join(this.uploadsDir, imgFile);
                    if (fs.existsSync(imgPath)) {
                        imageFiles.push(imgFile);
                        imagePaths.push(imgPath);
                    }
                }
                papers.push({
                    key,
                    title: this.getPaperTitle(key),
                    markdownFile: `${key}.md`,
                    markdownPath: mdPath,
                    bibliographyFile: fs.existsSync(bibPath) ? `${key}-references.bib` : undefined,
                    bibliographyPath: fs.existsSync(bibPath) ? bibPath : undefined,
                    imageFiles,
                    imagePaths
                });
            }
        }
        return papers;
    }
    /**
     * Gets the title for a known paper
     */
    getPaperTitle(key) {
        const titles = {
            'mlPeerReview': 'Machine Learning Applications in Automated Peer Review Systems',
            'colloquiumPlatform': 'A Novel Approach to Academic Publishing: The Colloquium Platform',
            'climateModeling': 'Interdisciplinary Approaches to Climate Change Modeling: Integrating Physical and Social Systems'
        };
        return titles[key] ?? key;
    }
    /**
     * Reads a file from the uploads directory
     */
    readFile(filename) {
        const filePath = path.join(this.uploadsDir, filename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        // Determine if binary or text based on extension
        const ext = path.extname(filename).toLowerCase();
        const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.bib'];
        if (binaryExtensions.includes(ext)) {
            return fs.readFileSync(filePath);
        }
        return fs.readFileSync(filePath, 'utf-8');
    }
    /**
     * Loads files for a specific paper as MockFiles
     */
    loadPaperFiles(paperKey) {
        const paperInfo = this.getAvailablePapers().find(p => p.key === paperKey);
        if (!paperInfo) {
            throw new Error(`Paper "${paperKey}" not found. Available papers: ${this.getAvailablePapers().map(p => p.key).join(', ')}`);
        }
        const files = [];
        // Load markdown file
        const mdContent = this.readFile(paperInfo.markdownFile);
        files.push((0, mockFiles_1.createMockFile)({
            id: `${paperKey}-md`,
            filename: paperInfo.markdownFile,
            originalName: paperInfo.markdownFile,
            fileType: 'SOURCE',
            mimetype: 'text/markdown',
            content: mdContent
        }));
        // Load bibliography file if present
        if (paperInfo.bibliographyFile && paperInfo.bibliographyPath) {
            const bibContent = this.readFile(paperInfo.bibliographyFile);
            files.push((0, mockFiles_1.createMockFile)({
                id: `${paperKey}-bib`,
                filename: paperInfo.bibliographyFile,
                originalName: paperInfo.bibliographyFile,
                fileType: 'BIBLIOGRAPHY',
                mimetype: 'application/x-bibtex',
                content: bibContent
            }));
        }
        // Load image files
        for (let i = 0; i < paperInfo.imageFiles.length; i++) {
            const imgFilename = paperInfo.imageFiles[i];
            const imgContent = this.readFile(imgFilename);
            files.push((0, mockFiles_1.createMockFile)({
                id: `${paperKey}-img-${i}`,
                filename: imgFilename,
                originalName: imgFilename,
                fileType: 'ASSET',
                mimetype: 'image/png',
                content: imgContent
            }));
        }
        return files;
    }
    /**
     * Creates a test harness pre-configured with seed data for a specific paper
     */
    createHarnessForPaper(bot, paperKey) {
        const paperInfo = this.getAvailablePapers().find(p => p.key === paperKey);
        if (!paperInfo) {
            throw new Error(`Paper "${paperKey}" not found`);
        }
        const files = this.loadPaperFiles(paperKey);
        return (0, testHarness_1.createTestHarness)(bot, {
            files,
            manuscriptData: {
                id: `seed-${paperKey}`,
                title: paperInfo.title,
                authors: ['Seed Data Author'],
                status: 'SUBMITTED'
            },
            context: {
                manuscriptId: `seed-${paperKey}`
            }
        });
    }
    /**
     * Sets up a mock API server that serves real seed files for a paper
     */
    setupMockApiWithSeedData(paperKey) {
        const files = this.loadPaperFiles(paperKey);
        const paperInfo = this.getAvailablePapers().find(p => p.key === paperKey);
        return mockApiServer_1.MockApiServer.withManuscriptAndFiles({
            id: `seed-${paperKey}`,
            title: paperInfo?.title ?? paperKey,
            authors: ['Seed Data Author'],
            status: 'SUBMITTED'
        }, files);
    }
    /**
     * Checks if seed data files are available
     */
    hasSeedData() {
        return this.getAvailablePapers().length > 0;
    }
    /**
     * Gets the uploads directory path
     */
    getUploadsDir() {
        return this.uploadsDir;
    }
}
exports.SeedDataTestRunner = SeedDataTestRunner;
/**
 * Creates a seed data test runner
 */
function createSeedDataRunner(options = {}) {
    return new SeedDataTestRunner(options);
}
/**
 * Helper to skip tests if seed data is not available
 */
function describeSeedDataTests(name, fn) {
    const runner = new SeedDataTestRunner();
    if (runner.hasSeedData()) {
        describe(name, () => fn(runner));
    }
    else {
        describe.skip(`${name} (seed data not available)`, () => {
            it('skipped - seed data not found', () => { });
        });
    }
}
