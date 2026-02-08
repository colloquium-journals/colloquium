"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREDIT_ROLES = void 0;
exports.getCreditRoleLabel = getCreditRoleLabel;
exports.isValidCreditRole = isValidCreditRole;
exports.CREDIT_ROLES = [
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
];
function getCreditRoleLabel(code) {
    const role = exports.CREDIT_ROLES.find((r) => r.code === code);
    return role?.label ?? code;
}
function isValidCreditRole(code) {
    return exports.CREDIT_ROLES.some((r) => r.code === code);
}
//# sourceMappingURL=creditRoles.js.map