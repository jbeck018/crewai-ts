/**
 * Type declarations for js-yaml module.
 * This declaration file provides type safety for the js-yaml module used in CrewBase.
 */

declare module 'js-yaml' {
  /**
   * Parses YAML string and returns JavaScript object.
   * @param str - String to parse.
   * @param options - Optional parsing options.
   * @returns Parsed object.
   */
  export function load(str: string, options?: any): any;

  /**
   * Serializes a JavaScript object to a YAML string.
   * @param obj - Object to serialize.
   * @param options - Optional serialization options.
   * @returns Serialized YAML string.
   */
  export function dump(obj: any, options?: any): string;
}
