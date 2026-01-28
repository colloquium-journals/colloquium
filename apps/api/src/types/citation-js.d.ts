// Type declarations for citation-js packages

declare module '@citation-js/core' {
  export class Cite {
    constructor(data: string | object | Array<any>);
    data: any[];
    static async(data: string | object | Array<any>): Promise<Cite>;
    format(format: string, options?: object): string;
  }
}

declare module '@citation-js/plugin-bibtex' {
  // Plugin self-registers with @citation-js/core
}
