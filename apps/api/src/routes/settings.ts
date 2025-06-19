import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Validation schema for journal settings
const JournalSettingsSchema = z.object({
  // Basic Information
  name: z.string().min(1, 'Journal name is required'),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  
  // Contact Information
  contactEmail: z.string().email().optional(),
  editorEmail: z.string().email().optional(),
  publisherName: z.string().optional(),
  publisherLocation: z.string().optional(),
  
  // Appearance
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  customCss: z.string().optional(),
  
  // Submission Settings
  submissionsOpen: z.boolean().default(true),
  maxFileSize: z.number().min(1).max(500).default(50),
  allowedFileTypes: z.array(z.string()).default(['pdf', 'docx', 'tex', 'zip']),
  requireOrcid: z.boolean().default(false),
  
  // Review Settings
  defaultReviewPeriod: z.number().min(7).max(365).default(30),
  allowPublicReviews: z.boolean().default(true),
  requireReviewerRegistration: z.boolean().default(true),
  
  // Publication Settings
  issn: z.string().optional(),
  doi: z.string().optional(),
  licenseType: z.string().default('CC BY 4.0'),
  copyrightHolder: z.string().optional(),
  
  // Email Settings
  enableEmailNotifications: z.boolean().default(true),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  
  // Advanced Settings
  enableAnalytics: z.boolean().default(false),
  analyticsId: z.string().optional(),
  customFooter: z.string().optional(),
  maintenanceMode: z.boolean().default(false)
});

// In-memory settings store (replace with database in production)
let journalSettings = {
  name: 'Colloquium Journal',
  description: 'An academic journal powered by Colloquium',
  logoUrl: undefined as string | undefined,
  faviconUrl: undefined as string | undefined,
  contactEmail: 'contact@colloquium.example',
  editorEmail: 'editor@colloquium.example',
  publisherName: 'Colloquium Press',
  publisherLocation: 'Digital',
  primaryColor: '#1976d2',
  secondaryColor: '#424242',
  customCss: undefined as string | undefined,
  submissionsOpen: true,
  maxFileSize: 50,
  allowedFileTypes: ['pdf', 'docx', 'tex', 'zip'],
  requireOrcid: false,
  defaultReviewPeriod: 30,
  allowPublicReviews: true,
  requireReviewerRegistration: true,
  issn: undefined as string | undefined,
  doi: undefined as string | undefined,
  licenseType: 'CC BY 4.0',
  copyrightHolder: 'Colloquium Journal',
  enableEmailNotifications: true,
  smtpHost: undefined as string | undefined,
  smtpPort: undefined as number | undefined,
  smtpUsername: undefined as string | undefined,
  smtpPassword: undefined as string | undefined,
  enableAnalytics: false,
  analyticsId: undefined as string | undefined,
  customFooter: undefined as string | undefined,
  maintenanceMode: false
};

// Middleware to check admin access
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      error: { 
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED' 
      } 
    });
  }
  next();
};

// GET /api/settings - Get journal settings
router.get('/', async (req, res, next) => {
  try {
    // Return public settings (non-sensitive information)
    const publicSettings = {
      name: journalSettings.name,
      description: journalSettings.description,
      logoUrl: journalSettings.logoUrl,
      faviconUrl: journalSettings.faviconUrl,
      primaryColor: journalSettings.primaryColor,
      secondaryColor: journalSettings.secondaryColor,
      submissionsOpen: journalSettings.submissionsOpen,
      maxFileSize: journalSettings.maxFileSize,
      allowedFileTypes: journalSettings.allowedFileTypes,
      requireOrcid: journalSettings.requireOrcid,
      allowPublicReviews: journalSettings.allowPublicReviews,
      requireReviewerRegistration: journalSettings.requireReviewerRegistration,
      licenseType: journalSettings.licenseType,
      copyrightHolder: journalSettings.copyrightHolder,
      customFooter: journalSettings.customFooter,
      maintenanceMode: journalSettings.maintenanceMode
    };

    res.json(publicSettings);
  } catch (error) {
    next(error);
  }
});

// GET /api/settings/admin - Get all settings (admin only)
router.get('/admin', authenticate, requireAdmin, async (req, res, next) => {
  try {
    // Return all settings excluding sensitive fields like passwords
    const adminSettings = { ...journalSettings };
    if (adminSettings.smtpPassword) {
      adminSettings.smtpPassword = '***hidden***';
    }
    
    res.json(adminSettings);
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings - Update journal settings (admin only)
router.put('/', 
  authenticate, 
  requireAdmin, 
  validateRequest({ body: JournalSettingsSchema }),
  async (req, res, next) => {
    try {
      // Update settings (in production, this would update the database)
      journalSettings = { ...journalSettings, ...req.body };
      
      // Log the settings update
      console.log(`Settings updated by admin: ${req.user?.email || 'unknown'}`);
      
      res.json({ 
        message: 'Settings updated successfully',
        settings: journalSettings
      });
    } catch (error) {
      next(error);
    }
  });

// GET /api/settings/maintenance - Check maintenance mode
router.get('/maintenance', async (req, res, next) => {
  try {
    res.json({ 
      maintenanceMode: journalSettings.maintenanceMode,
      message: journalSettings.maintenanceMode ? 'The journal is currently under maintenance' : null
    });
  } catch (error) {
    next(error);
  }
});

export default router;