export const CREDIT_ROLES = [
  { code: 'conceptualization', label: 'Conceptualization' },
  { code: 'data-curation', label: 'Data curation' },
  { code: 'formal-analysis', label: 'Formal analysis' },
  { code: 'funding-acquisition', label: 'Funding acquisition' },
  { code: 'investigation', label: 'Investigation' },
  { code: 'methodology', label: 'Methodology' },
  { code: 'project-administration', label: 'Project administration' },
  { code: 'resources', label: 'Resources' },
  { code: 'software', label: 'Software' },
  { code: 'supervision', label: 'Supervision' },
  { code: 'validation', label: 'Validation' },
  { code: 'visualization', label: 'Visualization' },
  { code: 'writing-original-draft', label: 'Writing – original draft' },
  { code: 'writing-review-editing', label: 'Writing – review & editing' },
] as const;

export type CreditRoleCode = (typeof CREDIT_ROLES)[number]['code'];

export function getCreditRoleLabel(code: CreditRoleCode): string {
  const role = CREDIT_ROLES.find((r) => r.code === code);
  return role?.label ?? code;
}

export function isValidCreditRole(code: string): code is CreditRoleCode {
  return CREDIT_ROLES.some((r) => r.code === code);
}
