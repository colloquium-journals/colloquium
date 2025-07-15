/**
 * Utility functions for handling JSON with comments
 */

/**
 * Strips line comments (// comment) from JSON string
 * Preserves comments inside string values
 */
export function stripJsonComments(jsonString: string): string {
  const lines = jsonString.split('\n');
  const cleanLines = lines.map(line => {
    // Check if we're inside a string value
    let inString = false;
    let escaped = false;
    let result = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (escaped) {
        escaped = false;
        result += char;
        continue;
      }
      
      if (char === '\\' && inString) {
        escaped = true;
        result += char;
        continue;
      }
      
      if (char === '"' && !escaped) {
        inString = !inString;
        result += char;
        continue;
      }
      
      // If we find // and we're not in a string, strip from here
      if (char === '/' && nextChar === '/' && !inString) {
        break;
      }
      
      result += char;
    }
    
    return result.trimEnd();
  });
  
  return cleanLines.join('\n');
}

/**
 * Parses JSON with comments, stripping comments first
 */
export function parseJsonWithComments(jsonString: string): any {
  const cleanJson = stripJsonComments(jsonString);
  return JSON.parse(cleanJson);
}

/**
 * Validates JSON with comments without parsing
 */
export function validateJsonWithComments(jsonString: string): { valid: boolean; error?: string } {
  try {
    parseJsonWithComments(jsonString);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid JSON' 
    };
  }
}