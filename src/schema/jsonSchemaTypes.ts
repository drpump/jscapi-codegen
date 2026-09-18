/**
    JSON Schema 2020-12 type definitions with dialect support.

    OpenAPI 3.1 is a defined dialect of JSON Schema 2020-12 that adds
    API-specific keywords including:
    - discriminator: for polymorphic type resolution in oneOf/anyOf
    - examples (dictionary): named example structures (vs JSON Schema's array)
    - xml, externalDocs, and other OpenAPI 3.0 legacy keywords
    """

    ============================================================================
    Base JSON Schema 2020-12 Keywords (RFC 9206/9207)
    ============================================================================
*/
export type JsonSchema2020Type = 
    | 'array'
    | 'boolean'
    | 'integer'
    | 'null'
    | 'number'
    | 'object'
    | 'string';

/**
 * Pure JSON Schema 2020-12 (RFC 9206/9207).
 * No dialect extensions.
 */
export interface JsonSchema2020 {
    // Meta-schema & references
    $schema?: string;
    $id?: string;
    $ref?: string;
    $dynamicRef?: string;          // 2020-12: runtime polymorphic references
    $dynamicAnchor?: string;       // 2020-12: anchor for dynamic refs
    $vocabulary?: Record<string, boolean>;
    
    // Metadata
    title?: string;
    description?: string;
    default?: any;
    deprecated?: boolean;
    examples?: any[];              // Array of example values (JSON Schema standard)
    
    // Type & structure
    type?: JsonSchema2020Type | JsonSchema2020Type[];
    enum?: any[];
    const?: any;
    
    // Number validation
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;
    
    // String validation
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    format?: string;
    formatAnnotation?: boolean;     // 2020-12: format as annotation vs assertion
    
    // Array validation (2020-12 restructured)
    prefixItems?: JsonSchema2020[];          // Tuple typing (replaces positional items[])
    items?: JsonSchema2020;                  // Schema for additional array items beyond prefixItems
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    contains?: JsonSchema2020;               // At least one item must match
    minContains?: number;
    maxContains?: number;
    
    // Object validation
    properties?: Record<string, JsonSchema2020>;
    patternProperties?: Record<string, JsonSchema2020>;
    additionalProperties?: JsonSchema2020 | boolean;
    propertyNames?: JsonSchema2020;
    minProperties?: number;
    maxProperties?: number;
    required?: string[];
    dependentRequired?: Record<string, string[]>;     // 2020-12
    
    // Composition & conditionals
    allOf?: JsonSchema2020[];
    anyOf?: JsonSchema2020[];
    oneOf?: JsonSchema2020[];
    not?: JsonSchema2020;
    if?: JsonSchema2020;                    // Conditional validation (2019-09+)
    then?: JsonSchema2020;
    else?: JsonSchema2020;
    dependentSchemas?: Record<string, JsonSchema2020>;     // 2020-12
    
    // Unevaluated (composition safety)
    unevaluatedItems?: JsonSchema2020;
    unevaluatedProperties?: JsonSchema2020;
    
    // Content validation
    contentMediaType?: string;
    contentEncoding?: string;
    contentSchema?: JsonSchema2020;         // 2020-12: schema for decoded content
}

// ============================================================================
// Dialect System - Extensible for Future Dialects
// ============================================================================

/**
 * A JSON Schema dialect identifier.
 * Dialects extend base JSON Schema with additional keywords and behaviors.
 */
export interface SchemaDialect {
    /** The $schema URI that identifies this dialect */
    readonly uri: string;
    
    /** Human-readable name */
    readonly name: string;
    
    /** Version of the base spec (e.g., "2020-12") */
    readonly baseVersion: string;
    
    // Keywords added by this dialect beyond base 2020-12
    additionalKeywords?: Record<string, DialectKeyword>;
}

/**
 * Describes a dialect-specific keyword and its impact on code generation.
 */
export interface DialectKeyword {
    /** The keyword name as it appears in schemas */
    readonly keyword: string;
    
    /** Description of what this keyword does */
    readonly description: string;
    
    // Whether this keyword affects type/interface generation
    affectsTypeGeneration: boolean;
    
    // Whether this keyword is used only for validation (not type generation)
    validationOnly?: boolean;
}

/**
 * OpenAPI 3.1 dialect definition.
 * Extends JSON Schema 2020-12 with API-specific keywords.
 */
export const OPENAPI_31_DIALECT: SchemaDialect = {
    uri: 'https://spec.openapis.org/oas/3.1/dialect/base',
    name: 'OpenAPI 3.1',
    baseVersion: '2020-12',
    additionalKeywords: {
        discriminator: {
            keyword: 'discriminator',
            description: 'Specifies a property whose value determines which schema applies in oneOf/anyOf.',
            affectsTypeGeneration: true
        },
        xml: {
            keyword: 'xml',
            description: 'Describes XML representation of schemas (legacy from OpenAPI 3.0).',
            affectsTypeGeneration: false,
            validationOnly: false
        },
        externalDocs: {
            keyword: 'externalDocs',
            description: 'Links to external documentation for this schema.',
            affectsTypeGeneration: false,
            validationOnly: false
        },
        example: {
            keyword: 'example',
            description: 'Single example value (singular, vs examples array).',
            affectsTypeGeneration: false,
            validationOnly: false
        }
    }
};

/** Base JSON Schema 2020-12 has no additional keywords */
export const JSON_SCHEMA_2020_DIALECT: SchemaDialect = {
    uri: 'https://json-schema.org/draft/2020-12/schema',
    name: 'JSON Schema 2020-12',
    baseVersion: '2020-12'
};

/** Registry of known dialects */
export const KNOWN_DIALECTS: SchemaDialect[] = [
    JSON_SCHEMA_2020_DIALECT,
    OPENAPI_31_DIALECT
];

/**
 * Detect which dialect a schema belongs to based on $schema URI or metadata.
 */
export function detectDialect(schema: JsonSchema2020): SchemaDialect {
    if (!schema.$schema) {
        return JSON_SCHEMA_2020_DIALECT;     // Default to pure JSON Schema
    }
    
    const uri = schema.$schema.toLowerCase();
    
    if (uri.includes('openapis.org') || uri.includes('openapi')) {
        return OPENAPI_31_DIALECT;
    }
    
    // Check for JSON Schema 2020-12
    if (uri.includes('draft/2020-12') || 
        uri.includes('json-schema.org/draft/2020')) {
        return JSON_SCHEMA_2020_DIALECT;
    }
    
    // Unknown dialect - treat as base 2020-12 with potential extensions
    return JSON_SCHEMA_2020_DIALECT;
}

// ============================================================================
// Dialect-Aware Schema Types
// ============================================================================

/**
 * OpenAPI 3.1 specific extension properties.
 * These extend the base JSON Schema 2020-12 with API-specific features.
 */
export interface OpenApi31Extensions {
    /** 
     * Discriminator for polymorphic type resolution.
     * Used to determine which schema applies in oneOf/anyOf compositions.
     */
    discriminator?: {
        propertyName: string;
        mapping?: Record<string, string>;     // value -> schema $ref
    };
    
    /** XML representation metadata (legacy from OpenAPI 3.0) */
    xml?: {
        name?: string;
        namespace?: string;
        prefix?: string;
        attribute?: boolean;
        wrapped?: boolean;
    };
    
    /** External documentation links */
    externalDocs?: {
        description?: string;
        url: string;
    };
    
    /** 
     * Single example value (singular form).
     * OpenAPI allows both 'example' (singular) and 'examples' (array/dict).
     */
    example?: any;
    
    /** 
     * Named examples dictionary - significant enhancement over JSON Schema.
     * Maps example names to structured example objects with optional summaries.
     */
    examples?: Record<string, OpenApiExample>;
}

/**
 * OpenAPI named example structure.
 */
export interface OpenApiExample {
    name?: string;
    summary?: string;
    value?: any;
    externalValue?: string;     // URL to external example
}

/**
 * A JSON Schema that includes OpenAPI 3.1 extensions.
 */
export type OpenApiSchema = JsonSchema2020 & Partial<OpenApi31Extensions>;

/**
 * Generic schema type accepting any dialect extensions.
 * Use this when working with schemas of unknown dialect.
 */
export type JsonSchema = JsonSchema2020 & Record<string, unknown>;

/**
 * Type guard for JSON Schema objects.
 */
export function isJsonSchema(value: unknown): value is JsonSchema {
    if (value === null || typeof value !== 'object') return false;
    return true;     // Any non-null object is potentially a schema
}
