/**
 * Unified schema parsing and resolution module.
 * Orchestrates $RefParser + reference counting for all generators.
 */

import * as fs from 'fs';
import * as path from 'path';
import { $RefParser } from '@apidevtools/json-schema-ref-parser';
import { JsonSchema2020, detectDialect } from './jsonSchemaTypes';
import { SchemaRegistry, ResolvedSchema } from './refCollector';

export interface ParsedSchema {
  /** Name derived from title, $id, or filename */
  name: string;
  /** The resolved JSON Schema */
  schema: JsonSchema2020 | any;
  /** Whether this is a top-level schema (not nested) */
  isTopLevel: boolean;
  /** Reference count across all schemas (1 = inline, >1 = shared) */
  refCount?: number;
  /** Source file path if external */
  sourceFile?: string;
  /** Self-contained schema JSON for generated runtime validation. */
  runtimeSchemaJson?: string;
}

export interface SchemaParseResult {
  /** All parsed top-level schemas */
  schemas: ParsedSchema[];
  /** Full registry of all resolved schemas */
  registry: SchemaRegistry;
  /** Metadata about the parse operation */
  metadata: {
    totalSchemas: number;
    topLevelSchemas: number;
    externalRefs: number;
  };
}

/**
 * Parse and resolve a JSON Schema file or directory.
 * Resolves external schemas while retaining their original references for generation.
 */
export async function parseAndResolve(
  entryPath: string,
): Promise<ParsedSchema[]> {
  const stat = fs.statSync(entryPath);

  let schemas: ParsedSchema[];

  if (stat.isDirectory()) {
    // Directory mode: collect all JSON/YAML files recursively
    const files = findSchemaFiles(entryPath);
    console.log(`Found ${files.length} schema files in directory: ${entryPath}`);
    
    // Parse each file and aggregate
    const combined: ParsedSchema[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      let schema: any;
      
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        schema = require('js-yaml').load(content);
      } else {
        schema = JSON.parse(content);
      }
      
      // Derive name from filename
      const rawName = path.basename(file).replace(/.(json|yaml|yml)$/, '');
      const name = rawName.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase());
      combined.push({
        name,
        schema,
        isTopLevel: true,
        sourceFile: file,
        runtimeSchemaJson: JSON.stringify(await $RefParser.bundle(file), null, 2),
      });
    }
    
    schemas = combined;
  } else {
    const absoluteEntryPath = path.resolve(entryPath);
    const refs = await $RefParser.resolve(absoluteEntryPath);
    schemas = refs.paths().map(sourceFile => {
      const schema = refs.get(sourceFile) as JsonSchema2020;
      const name = schema.title || path.basename(sourceFile).replace(/\.(json|yaml|yml)$/, '')
        .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        .replace(/^./, c => c.toUpperCase());
      return {
        name,
        schema,
        isTopLevel: sourceFile === absoluteEntryPath,
        sourceFile,
        runtimeSchemaJson: JSON.stringify(
          sourceFile === absoluteEntryPath ? undefined : schema,
          null,
          2
        ),
      };
    });
    const rootSchema = schemas.find(schema => schema.sourceFile === absoluteEntryPath);
    if (rootSchema) {
      rootSchema.runtimeSchemaJson = JSON.stringify(
        await $RefParser.bundle(absoluteEntryPath),
        null,
        2
      );
    }
  }

  // Collect full registry for reference counting
  const registry = await collectRegistry(schemas);
  
  // Perform reference counting pass
  const countedSchemas = performReferenceCounting(schemas, registry);
  
  return countedSchemas;
}

/**
 * Find all JSON/YAML schema files in a directory recursively.
 */
function findSchemaFiles(dir: string): string[] {
  const files: string[] = [];
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      // Skip hidden directories and node_modules
      if (!item.name.startsWith('.') && item.name !== 'node_modules') {
        files.push(...findSchemaFiles(fullPath));
      }
    } else if (
      item.isFile() &&
      (item.name.endsWith('.json') ||
        item.name.endsWith('.yaml') ||
        item.name.endsWith('.yml'))
    ) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Build a full schema registry from all top-level schemas.
 * Uses $RefParser to resolve all $refs without modifying schemas.
 */
async function collectRegistry(schemas: ParsedSchema[]): Promise<SchemaRegistry> {
  // Combine all schemas into a virtual root for resolution
  const combinedSchema: any = {
    definitions: {},
    components: {
      schemas: {},
    },
  };
  
  for (const parsed of schemas) {
    if (parsed.schema.definitions) {
      Object.assign(combinedSchema.definitions, parsed.schema.definitions);
    }
    if (parsed.schema.components?.schemas) {
      Object.assign(combinedSchema.components.schemas, parsed.schema.components.schemas);
    }
  }
  
  // Use $RefParser to resolve all references
  const parser = new $RefParser();
  await parser.parse(combinedSchema as any);
  
  // Build registry from resolved schemas
  const registry: SchemaRegistry = {};
  
  for (const parsed of schemas) {
    registerSchemaIntoRegistry(registry, parsed.name, parsed.schema);
    
    // Register all nested definitions
    if ((parsed.schema as any).definitions) {
      for (const [name, defSchema] of Object.entries((parsed.schema as any).definitions)) {
        registerSchemaIntoRegistry(registry, `${parsed.name}/${name}`, defSchema as JsonSchema2020);
      }
    }
    
    if ((parsed.schema as any).components?.schemas) {
      for (const [name, defSchema] of Object.entries((parsed.schema as any).components.schemas)) {
        registerSchemaIntoRegistry(registry, `${parsed.name}/${name}`, defSchema as JsonSchema2020);
      }
    }
  }
  
  return registry;
}

/**
 * Register a single schema into the registry.
 */
function registerSchemaIntoRegistry(
  registry: SchemaRegistry,
  name: string,
  schema: JsonSchema2020,
): void {
  const key = schema.$id || name;
  registry[key] = {
    refPath: schema.$id ? `#/$id/${schema.$id}` : `#${name}`,
    schema,
    isExternal: false,
  };
}

/**
 * Perform reference counting across all schemas.
 * Count==1 → inline/flatten (local). Count>1 → shared interface with extends.
 */
function performReferenceCounting(
  schemas: ParsedSchema[],
  registry: SchemaRegistry,
): ParsedSchema[] {
  const schemasByPath = new Map(
    schemas
      .filter(parsed => parsed.sourceFile)
      .map(parsed => [path.resolve(parsed.sourceFile!), parsed])
  );
  const schemasById = new Map(
    schemas
      .filter(parsed => parsed.schema.$id)
      .map(parsed => [parsed.schema.$id as string, parsed])
  );
  const refOwners = new Map<string, Set<string>>();
  
  for (const parsed of schemas) {
    const owner = parsed.sourceFile ? path.resolve(parsed.sourceFile) : parsed.name;
    countReferencesInSchema(parsed.schema as any, parsed.sourceFile, owner, schemasByPath, schemasById, refOwners);
  }
  
  // Update each schema with its reference count
  const result: ParsedSchema[] = [];
  for (const parsed of schemas) {
    const count = refOwners.get(parsed.name)?.size || 1;
    
    result.push({
      ...parsed,
      refCount: count > 1 ? count : 1,
    });
  }
  
  return result;
}

/**
 * Count how many times a schema is referenced in another schema.
 */
function countReferencesInSchema(
  schema: any,
  sourceFile: string | undefined,
  owner: string,
  schemasByPath: Map<string, ParsedSchema>,
  schemasById: Map<string, ParsedSchema>,
  refOwners: Map<string, Set<string>>,
): void {
  if (!schema || typeof schema !== 'object') return;
  
  // Handle $ref targets
  if (schema.$ref) {
    const ref = schema.$ref as string;
    const targetPath = sourceFile && !ref.startsWith('#') && !/^[a-z]+:/i.test(ref)
      ? path.resolve(path.dirname(sourceFile), ref.split('#')[0])
      : undefined;
    const target = (targetPath && schemasByPath.get(targetPath))
      || schemasById.get(ref.split('#')[0]);
    if (target) {
      const owners = refOwners.get(target.name) || new Set<string>();
      owners.add(owner);
      refOwners.set(target.name, owners);
    }
    return;
  }
  
  // Recurse into compositions
  for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(schema[keyword])) {
      for (const subSchema of schema[keyword]) {
        countReferencesInSchema(subSchema, sourceFile, owner, schemasByPath, schemasById, refOwners);
      }
    }
  }
  
  // Recurse into properties
  if (schema.properties) {
    for (const propSchema of Object.values(schema.properties)) {
      countReferencesInSchema(propSchema as any, sourceFile, owner, schemasByPath, schemasById, refOwners);
    }
  }
  
  // Recurse into items
  if (schema.items) {
    countReferencesInSchema(schema.items as any, sourceFile, owner, schemasByPath, schemasById, refOwners);
  }
  
  // Recurse into definitions
  if (schema.definitions) {
    for (const defSchema of Object.values(schema.definitions)) {
      countReferencesInSchema(defSchema as any, sourceFile, owner, schemasByPath, schemasById, refOwners);
    }
  }
}

/**
 * Detect if a schema should be inlined (count==1) or shared (count>1).
 */
export function shouldBeShared(parsedSchema: ParsedSchema): boolean {
  return (parsedSchema.refCount || 1) > 1;
}
