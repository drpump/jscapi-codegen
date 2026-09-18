import * as fs from "fs";
import * as path from "path";
import { JsonSchema, JsonSchema2020, detectDialect } from "./jsonSchemaTypes";

/**
 * Represents a resolved schema reference without modifying the original schema.
 */
export interface ResolvedSchema {
     /** The original $ref path (e.g., "#/definitions/User") */
    refPath: string;
     
     /** The resolved schema object (read-only, not modified) */
    schema: JsonSchema2020;
     
     /** Whether this schema was loaded from an external file */
    isExternal: boolean;
     
     /** Source file path for external refs */
    sourceFile?: string;
}

/**
 * Schema registry mapping names to their original schemas.
 * Preserves schema structure intact for NetworkNT validation.
 */
export interface SchemaRegistry {
     [name: string]: ResolvedSchema;
}

/**
 * Collects all $ref targets from a schema WITHOUT inlining or bundling.
 * Uses parse() only to discover references, then manually loads original schemas.
 * 
 * This ensures that:
 * 1. The original schema structure is preserved for validation
 * 2. $refs remain resolvable by other tools (NetworkNT)
 * 3. No artificial $ref targets are generated
 */
export async function collectAllSchemas(
    rootSchema: JsonSchema,
    rootPath?: string
): Promise<SchemaRegistry> {
    const registry: SchemaRegistry = {};
    const visited = new Set<string>();
     
     // First, register the root schema itself
    registerSchema(registry, "Root", rootSchema);
     
     // Collect all schemas from definitions/components
    await collectSchemasRecursively(rootSchema, registry, visited, rootPath);
     
    return registry;
}

/**
 * Recursively collect all schema definitions without modifying them.
 */
async function collectSchemasRecursively(
    schema: JsonSchema,
    registry: SchemaRegistry,
    visited: Set<string>,
    rootPath?: string
): Promise<void> {
     
     // Avoid infinite recursion
    const schemaKey = getSchemaKey(schema);
    if (visited.has(schemaKey)) return;
    visited.add(schemaKey);
     
     // Handle definitions (draft-07 and earlier)
    if ("definitions" in schema && schema.definitions) {
        for (const [name, defSchema] of Object.entries(schema.definitions as Record<string, JsonSchema>)) {
            const key = `definitions/${name}`;
            if (!registry[key]) {
                registerSchema(registry, name, defSchema);
                await collectSchemasRecursively(defSchema, registry, visited, rootPath);
             }
         }
     }
     
     // Handle components/schemas (OpenAPI 3.0/3.1)
    if ("components" in schema && (schema as any).components?.schemas) {
        for (const [name, defSchema] of Object.entries((schema as any).components.schemas)) {
            const key = `schemas/${name}`;
            if (!registry[key]) {
                registerSchema(registry, name, defSchema as JsonSchema);
                await collectSchemasRecursively(defSchema as JsonSchema, registry, visited, rootPath);
             }
         }
     }
     
     // Recurse into properties
    if (schema.properties) {
        for (const propSchema of Object.values(schema.properties)) {
            if (isSchemaObject(propSchema)) {
                await collectSchemasRecursively(propSchema, registry, visited, rootPath);
             }
         }
     }
     
     // Recurse into items (single schema or tuple)
    if (schema.items) {
        if (Array.isArray(schema.items)) {
            for (const item of schema.items) {
                if (isSchemaObject(item)) {
                    await collectSchemasRecursively(item, registry, visited, rootPath);
                 }
             }
         } else if (isSchemaObject(schema.items)) {
            await collectSchemasRecursively(schema.items, registry, visited, rootPath);
         }
     }
     
     // Recurse into prefixItems (JSON Schema 2020-12 tuples)
    if ("prefixItems" in schema && (schema as any).prefixItems) {
        for (const item of (schema as any).prefixItems) {
            if (isSchemaObject(item)) {
                await collectSchemasRecursively(item, registry, visited, rootPath);
             }
         }
     }
     
     // Recurse into allOf, oneOf, anyOf
    for (const keyword of ["allOf", "oneOf", "anyOf"] as const) {
        if (keyword in schema && (schema as any)[keyword]) {
            for (const subSchema of (schema as any)[keyword]) {
                if (isSchemaObject(subSchema)) {
                    await collectSchemasRecursively(subSchema, registry, visited, rootPath);
                 }
             }
         }
     }
     
     // Recurse into dependentSchemas (JSON Schema 2020-12)
    if ("dependentSchemas" in schema && (schema as any).dependentSchemas) {
        for (const depSchema of Object.values((schema as any).dependentSchemas)) {
            if (isSchemaObject(depSchema)) {
                await collectSchemasRecursively(depSchema, registry, visited, rootPath);
             }
         }
     }
}

function registerSchema(registry: SchemaRegistry, name: string, schema: JsonSchema): void {
     // Use $id if present for naming
    const key = schema.$id || name;
    registry[key] = {
        refPath: schema.$id ? `#/$id/${schema.$id}` : `#${name}`,
        schema,
        isExternal: false
     };
}

function getSchemaKey(schema: JsonSchema): string {
    if (schema.$id) return schema.$id;
    if (schema.title) return `title:${schema.title}`;
    return JSON.stringify(schema);
}

function isSchemaObject(value: unknown): value is JsonSchema {
     if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
     // Check if it looks like a schema (has schema keywords)
    return (
         "$ref" in obj ||
         "type" in obj ||
         "properties" in obj ||
         "allOf" in obj ||
         "oneOf" in obj ||
         "anyOf" in obj
      );
}

/**
 * Load a JSON Schema from a file path.
 */
export async function loadSchemaFromFile(filePath: string): Promise<JsonSchema> {
    const absolutePath = path.resolve(filePath);
    const content = await fs.promises.readFile(absolutePath, "utf-8");
     
     // Support both JSON and YAML
    if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
        const yaml = await import("js-yaml");
        return yaml.load(content) as JsonSchema;
     }
     
    return JSON.parse(content) as JsonSchema;
}
