/**
 * Utility functions for handling YAML bot configurations
 */
import yaml from 'js-yaml';

/**
 * Parses YAML configuration string into an object
 */
export function parseYamlConfig(yamlString: string): any {
  try {
    return yaml.load(yamlString);
  } catch (error) {
    throw new Error(`Invalid YAML configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts an object to YAML string
 */
export function stringifyYamlConfig(obj: any): string {
  try {
    return yaml.dump(obj, {
      indent: 2,
      lineWidth: 80,
      quotingType: '"',
      forceQuotes: false
    });
  } catch (error) {
    throw new Error(`Failed to convert to YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates YAML configuration without parsing
 */
export function validateYamlConfig(yamlString: string): { valid: boolean; error?: string } {
  try {
    yaml.load(yamlString);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid YAML' 
    };
  }
}

/**
 * Converts JSON to YAML (for migration purposes)
 */
export function jsonToYaml(jsonString: string): string {
  try {
    const obj = JSON.parse(jsonString);
    return stringifyYamlConfig(obj);
  } catch (error) {
    throw new Error(`Failed to convert JSON to YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts YAML to JSON (for backward compatibility)
 */
export function yamlToJson(yamlString: string): string {
  try {
    const obj = parseYamlConfig(yamlString);
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    throw new Error(`Failed to convert YAML to JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}