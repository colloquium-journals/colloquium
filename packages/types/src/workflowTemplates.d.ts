import { WorkflowConfig } from './index';
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    config: WorkflowConfig;
}
export declare const workflowTemplates: WorkflowTemplate[];
export declare function getWorkflowTemplate(templateId: string): WorkflowTemplate | undefined;
export declare function getWorkflowTemplateConfig(templateId: string): WorkflowConfig | undefined;
//# sourceMappingURL=workflowTemplates.d.ts.map