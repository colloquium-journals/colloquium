import { z } from 'zod';

export const templateFileSchema = z.object({
  fileId: z.string().describe('ID of the uploaded file'),
  filename: z.string().describe('Original filename for reference'),
  engine: z.enum(['html', 'latex', 'typst']).describe('Rendering engine this file is for'),
  metadata: z.record(z.any()).optional().describe('Additional metadata about this file')
});

export const citationHoverConfigSchema = z.object({
  enabled: z.boolean(),
  links: z.array(z.string()).optional(),
  customLinks: z.record(z.object({
    label: z.string(),
    urlPattern: z.string()
  })).optional()
});

export const templateDefinitionSchema = z.object({
  name: z.string().describe('Template identifier'),
  title: z.string().describe('Display name for the template'),
  description: z.string().describe('Template description'),
  defaultEngine: z.enum(['html', 'latex', 'typst']).describe('Default rendering engine'),
  files: z.array(templateFileSchema).describe('Files that make up this template'),
  metadata: z.object({
    type: z.string().optional(),
    responsive: z.boolean().optional(),
    printOptimized: z.boolean().optional(),
    features: z.record(z.union([z.boolean(), citationHoverConfigSchema])).optional()
  }).optional().describe('Template metadata and features')
});

export const botConfigSchema = z.object({
  templateName: z.string().default('academic-standard').describe('Default template to use'),
  outputFormats: z.array(z.string()).default(['pdf']).describe('Default output formats'),
  requireSeparateBibliography: z.boolean().default(false).describe('Whether bibliography must be separate file'),
  templates: z.record(templateDefinitionSchema).describe('Available templates mapped by name'),
  customTemplates: z.record(z.any()).optional().describe('Legacy custom template definitions')
});
