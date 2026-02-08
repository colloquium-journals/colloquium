/**
 * JATS XML Generation Types
 * For PMC (PubMed Central) compliance
 */
export interface JatsGenerationResult {
    success: boolean;
    xml?: string;
    error?: string;
}
export interface ParsedReference {
    id: string;
    type: string;
    title?: string;
    authors?: {
        given: string;
        family: string;
    }[];
    year?: number;
    doi?: string;
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    publisher?: string;
    url?: string;
}
export interface JatsValidationError {
    code: string;
    message: string;
    element?: string;
}
export interface JatsValidationResult {
    valid: boolean;
    errors: JatsValidationError[];
    warnings: JatsValidationError[];
}
export interface JatsAuthorMetadata {
    givenNames: string;
    surname: string;
    email?: string;
    orcid?: string;
    isCorresponding?: boolean;
    affiliations?: JatsAffiliation[];
    creditRoles?: string[];
}
export interface JatsAffiliation {
    id: string;
    institution: string;
    department?: string;
    city?: string;
    state?: string;
    country?: string;
    ror?: string;
}
export interface JatsFunding {
    funderName: string;
    funderDoi?: string;
    awardId?: string;
}
export interface JatsJournalMetadata {
    title: string;
    abbrevTitle?: string;
    pissn?: string;
    eissn?: string;
    publisherName?: string;
}
export interface JatsArticleMetadata {
    title: string;
    subtitle?: string;
    articleType?: string;
    doi?: string;
    volume?: string;
    issue?: string;
    elocationId?: string;
    abstract?: string;
    keywords?: string[];
    subjects?: string[];
    receivedDate?: Date;
    acceptedDate?: Date;
    publishedDate?: Date;
    copyrightHolder?: string;
    copyrightYear?: number;
    licenseType?: string;
    licenseUrl?: string;
}
export interface JatsMetadata {
    journal: JatsJournalMetadata;
    article: JatsArticleMetadata;
    authors: JatsAuthorMetadata[];
    funding?: JatsFunding[];
}
//# sourceMappingURL=jatsTypes.d.ts.map