export declare const CREDIT_ROLES: readonly [{
    readonly code: "conceptualization";
    readonly label: "Conceptualization";
}, {
    readonly code: "data-curation";
    readonly label: "Data curation";
}, {
    readonly code: "formal-analysis";
    readonly label: "Formal analysis";
}, {
    readonly code: "funding-acquisition";
    readonly label: "Funding acquisition";
}, {
    readonly code: "investigation";
    readonly label: "Investigation";
}, {
    readonly code: "methodology";
    readonly label: "Methodology";
}, {
    readonly code: "project-administration";
    readonly label: "Project administration";
}, {
    readonly code: "resources";
    readonly label: "Resources";
}, {
    readonly code: "software";
    readonly label: "Software";
}, {
    readonly code: "supervision";
    readonly label: "Supervision";
}, {
    readonly code: "validation";
    readonly label: "Validation";
}, {
    readonly code: "visualization";
    readonly label: "Visualization";
}, {
    readonly code: "writing-original-draft";
    readonly label: "Writing – original draft";
}, {
    readonly code: "writing-review-editing";
    readonly label: "Writing – review & editing";
}];
export type CreditRoleCode = (typeof CREDIT_ROLES)[number]['code'];
export declare function getCreditRoleLabel(code: CreditRoleCode): string;
export declare function isValidCreditRole(code: string): code is CreditRoleCode;
//# sourceMappingURL=creditRoles.d.ts.map