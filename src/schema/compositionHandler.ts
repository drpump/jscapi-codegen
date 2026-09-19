import { JsonSchema2020 } from './jsonSchemaTypes';
import { DiscriminatorStrategy, detectDiscriminatorStrategy } from './discriminatorStrategy';

/**
 * Represents a composition schema (allOf, oneOf, anyOf).
 */
export interface CompositionInfo {
      type: 'allOf' | 'oneOf' | 'anyOf';
    options: Array<{
         index: number;
        name: string;
        schema: JsonSchema2020;
         discriminatorValue?: string | number;
       }>;
     discriminatorStrategy: DiscriminatorStrategy;
}

/**
 * Analyze a schema for composition keywords.
 */
export function analyzeComposition(
    schema: JsonSchema2020,
    parentName: string
): CompositionInfo | null {
       
      if ('oneOf' in schema && (schema as any).oneOf) {
        const options = buildOptions((schema as any).oneOf, parentName);
        return {
            type: 'oneOf',
            options,
            discriminatorStrategy: detectDiscriminatorStrategy(schema, options)
          };
      }
      
      if ('anyOf' in schema && (schema as any).anyOf) {
        const options = buildOptions((schema as any).anyOf, parentName);
        return {
            type: 'anyOf',
            options,
            discriminatorStrategy: detectDiscriminatorStrategy(schema, options)
          };
      }
      
      if ('allOf' in schema && (schema as any).allOf) {
        const options = buildOptions((schema as any).allOf, parentName);
        return {
            type: 'allOf',
            options,
            discriminatorStrategy: { type: 'structural-match' }
          };
      }
      
    return null;
}

function buildOptions(
    schemas: JsonSchema2020[],
    parentName: string
): CompositionInfo['options'] {
      
    return schemas.map((schema, index) => ({
        index,
        name: generateOptionName(schema, parentName, index),
        schema
      }));
}

export function generateOptionName(
    schema: JsonSchema2020,
    parentName: string,
    index: number
): string {
      
      // Use title if present
    if (schema.title) {
        return capitalize(schema.title);
      }
      
      // Use $id if present
    if (schema.$id) {
        const basename = schema.$id.split('/').pop();
        if (basename) {
            const nameWithoutExt = basename.replace(/\.[^.]+$/, '');
            // Convert hyphenated names to CamelCase (e.g., "user-profile" → "UserProfile")
            return nameWithoutExt
                .split(/[-_]/)
                .map(segment => capitalize(segment))
                .join('');
        }
        return `${parentName}Option${index}`;
        }
        
        // Fallback to index-based name
    return `${capitalize(parentName)}Option${index}`;
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
