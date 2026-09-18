import { JsonSchema2020 } from './jsonSchemaTypes';

/**
 * Strategy for determining which option in a oneOf/anyOf matches.
 * The validator determines the match - we just expose the result.
 */
export type DiscriminatorStrategy = 
      | ExplicitDiscriminator          // From OpenAPI discriminator or $dynamicRef
      | ImplicitStructuralMatch;       // Validator determines via schema matching

/**
 * Explicit discriminator from OpenAPI-style discriminator object
 * or JSON Schema $dynamicRef / $dynamicAnchor.
 */
export interface ExplicitDiscriminator {
    type: 'explicit';
    propertyName: string;
    mapping?: Map<string, string>;      // discriminatorValue -> schema name/ref
    source: 'openapi-discriminator' | 'dynamic-anchor';
}

/**
 * Implicit structural match - validator determines which option(s) match.
 */
export interface ImplicitStructuralMatch {
    type: 'structural-match';
}

/**
 * Detect the best discriminator strategy for a oneOf/anyOf composition.
 * Prefer explicit discriminators, fall back to structural validation.
 */
export function detectDiscriminatorStrategy(
      schema: JsonSchema2020,
    options: Array<{ name: string; schema: JsonSchema2020 }>
): DiscriminatorStrategy {
      
      // 1. Check for OpenAPI-style discriminator (only in OpenAPI 3.0/3.1)
    if ('discriminator' in schema) {
        const disc = (schema as any).discriminator as {
              propertyName: string;
             mapping?: Record<string, string>;
           };
          
        const mapping = disc.mapping
               ? new Map(Object.entries(disc.mapping))
               : undefined;
            
        return {
            type: 'explicit',
            propertyName: disc.propertyName,
            mapping,
            source: 'openapi-discriminator'
          };
      }
      
      // 2. Check for $dynamicAnchor (JSON Schema 2020-12) - requires companion $dynamicRef
    if ('$dynamicAnchor' in schema) {
        return {
            type: 'explicit',
            propertyName: (schema as any).discriminator?.propertyName || 'type',
            source: 'dynamic-anchor'
          };
      }
      
      // 3. Fallback: structural validation at runtime
      // The validator will determine which option(s) match during construction
    return { type: 'structural-match' };
}

/**
 * For explicit discriminators, resolve the discriminator value for a given option.
 */
export function resolveDiscriminatorValue(
    strategy: DiscriminatorStrategy,
    optionSchema: JsonSchema2020,
    optionName: string
): string | number | null {
      
    if (strategy.type !== 'explicit') {
        return null;
      }
      
      // Check if the discriminator property has a const/enum in this option
    const discProperty = optionSchema.properties?.[strategy.propertyName] as JsonSchema2020;
    if (!discProperty) {
        return null;
      }
      
      // Check for const value
    if ('const' in discProperty) {
        return (discProperty as any).const;
      }
      
      // Check for single-value enum
    if ('enum' in discProperty && (discProperty as any).enum.length === 1) {
        return (discProperty as any).enum[0];
      }
      
      // Check mapping from discriminator
    if (strategy.mapping) {
        for (const [value, ref] of strategy.mapping.entries()) {
            if (ref.includes(optionName)) {
                return value;
              }
          }
      }
      
    return null;
}
