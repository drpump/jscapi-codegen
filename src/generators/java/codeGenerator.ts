import * as fs from 'fs';
import { JsonSchema2020 } from '../../schema/jsonSchemaTypes';
import { mapJsonSchemaToJavaType, TypeMappingContext } from './typeMapper';
import { generatePropertyGetters, PropertyGetter, generateInterfaceJava } from './interfaceGenerator';
import { generateImplementationClass, generateOneOfImplementationClass, generateAnyOfImplementationClass } from './implementationGenerator';
import { generateFactoryClass } from './factoryGenerator';
import { analyzeComposition, CompositionInfo } from '../../schema/compositionHandler';

/**
 * Result of generating Java code for a schema.
 */
export interface CodeGenerationResult {
  schemaName: string;
  interfaceCode: string;
  implementationCode: string;
  factoryCode: string;
  /** Variant interfaces for composition types (allOf, oneOf, anyOf). */
  variantInterfaces?: Map<string, string>;
}

/**
 * Options for code generation.
 */
export interface CodeGenerationOptions {
  packageName?: string;
  writeFiles?: boolean;
  outputDir?: string;
}

/**
 * Flatten properties from embedded allOf options into a single merged schema.
 * This fixes the case where variant interfaces (e.g., RichContent) have
 * their properties defined within an allOf structure rather than at the top level.
 */
function flattenAllOfProperties(schema: JsonSchema2020): JsonSchema2020 {
  if (!schema.allOf || schema.allOf.length === 0) return schema;

  const mergedProperties: Record<string, any> = {};
  const mergedRequired: string[] = [];

  for (const option of schema.allOf) {
    if (typeof option === 'object' && option !== null) {
      const objSchema = option as JsonSchema2020;
      if (objSchema.properties) {
        Object.assign(mergedProperties, objSchema.properties);
      }
      if (Array.isArray(objSchema.required)) {
        mergedRequired.push(...objSchema.required);
      }
    }
  }

  return {
    ...schema,
    properties: { 
      ...mergedProperties, 
      ...(schema.properties || {}) 
    },
   };
}

/**
 * Resolve a $ref reference against the root schema's $defs.
 */
function resolveRef(schema: JsonSchema2020, ref: string): JsonSchema2020 {
  const defName = ref.split('/').pop()!;
  return ((schema as any).$defs?.[defName]) ?? schema;
}

/**
 * Build property getters for a schema, flattening embedded allOf if needed.
 */
function buildPropertyGetters(schema: JsonSchema2020, schemaName: string): PropertyGetter[] {
  const flattened = flattenAllOfProperties(schema);
  return generatePropertyGetters(flattened, schemaName);
}

/**
 * Generate code for a simple object schema (no composition keywords).
 */
function generateObjectCode(
  schema: JsonSchema2020,
  schemaName: string
): CodeGenerationResult {
  const propertyGetters = buildPropertyGetters(schema, schemaName);

  return {
    schemaName,
    interfaceCode: generateInterfaceJava(schemaName, propertyGetters, undefined, false, undefined),
    implementationCode: generateImplementationClass(schemaName, propertyGetters),
    factoryCode: generateFactoryClass(schemaName, false, undefined),
  };
}

/**
 * Generate code for an allOf composition.
 * Finds the first $ref as an extends interface and merges properties from all options.
 */
function generateAllOfCode(
  schema: JsonSchema2020,
  schemaName: string,
  composition: CompositionInfo
): CodeGenerationResult {
  // Find the first $ref option to use as extends interface
  let extendsInterface: string | undefined;
  for (const option of composition.options) {
    if (option.schema.$ref) {
      const refParts = option.schema.$ref.split('/');
      extendsInterface = refParts[refParts.length - 1];
      break;
    }
  }

  // Merge all properties from all options
  const flattened = flattenAllOfProperties(schema);
  const propertyGetters = buildPropertyGetters(flattened, schemaName);

  return {
    schemaName,
    interfaceCode: generateInterfaceJava(schemaName, propertyGetters, extendsInterface, false, undefined),
    implementationCode: generateImplementationClass(schemaName, propertyGetters),
    factoryCode: generateFactoryClass(schemaName, true, composition),
  };
}

/**
 * Generate code for a oneOf/anyOf union type.
 * Creates a union interface with variant check methods and generates separate variant interfaces.
 */
function generateUnionCode(
  schema: JsonSchema2020,
  schemaName: string,
  composition: CompositionInfo
): CodeGenerationResult {
  // Generate variant interfaces for each option
  const variantInterfaces = new Map<string, string>();

  for (const option of composition.options) {
    const optionName = option.name;
      // Resolve $ref against root schema $defs before flattening
    const resolvedSchema = option.schema.$ref ? resolveRef(schema, option.schema.$ref) : option.schema;
    const flattenedOption = flattenAllOfProperties(resolvedSchema);
    const optionGetters = buildPropertyGetters(flattenedOption, optionName);

    variantInterfaces.set(
      optionName,
      generateInterfaceJava(optionName, optionGetters, undefined, false, undefined)
       );
     }

    // Generate variant check methods for the union interface
    const variantCheckMethods = composition.options
        .map(opt => `  boolean is${opt.name}();`)
        .join('\n');

    const interfaceCode = generateInterfaceJava(schemaName, [], undefined, false, undefined)
       .replace(
         'boolean hasProperty(String propertyName);',
        variantCheckMethods + '\n  boolean hasProperty(String propertyName);'
       );
  let implementationCode: string;
  if (composition.type === 'anyOf') {
    const optionInterfaces = composition.options.map(opt => opt.name);
    const gettersByOption = new Map<string, PropertyGetter[]>();
    for (const opt of composition.options) {
      // Resolve $ref against root schema $defs before flattening
      const resolvedOpt = opt.schema.$ref ? resolveRef(schema, opt.schema.$ref) : opt.schema;
      const flattenedOpt = flattenAllOfProperties(resolvedOpt);
      gettersByOption.set(opt.name, buildPropertyGetters(flattenedOpt, opt.name));
      }
    implementationCode = generateAnyOfImplementationClass(
      schemaName,
      optionInterfaces,
      gettersByOption
      );
     } else {
       // oneOf
      implementationCode = generateOneOfImplementationClass(
        schemaName,
        schemaName,
        []
       );
     }

      return {
        schemaName,
        interfaceCode,
        implementationCode,
        factoryCode: generateFactoryClass(schemaName, true, composition),
        variantInterfaces,
      };
    }

    /**
     * Generate all Java code (interface, implementation, factory) from a JSON Schema.
 * Uses the full type-mapping pipeline with proper Java types and JsonNode-backed getters.
 * 
 * This is the single entry point for code generation — whether from the CLI,
 * tests, or programmatic API callers.
 * 
 * Now includes composition dispatch: detects oneOf/anyOf/allOf and generates
 * appropriate union interfaces and variant implementations.
 */
export function generateJavaFromSchema(
  schema: JsonSchema2020,
  schemaName: string,
  packageName = 'com.example.api'
): CodeGenerationResult {
  // Detect composition keywords and dispatch to the appropriate generator
  const composition = analyzeComposition(schema, schemaName);

  if (composition) {
    switch (composition.type) {
      case 'allOf':
        return generateAllOfCode(schema, schemaName, composition);
      case 'oneOf':
      case 'anyOf':
        return generateUnionCode(schema, schemaName, composition);
      default:
        break;
    }
  }

  // Simple object — no composition keywords
  return generateObjectCode(schema, schemaName);
}

/**
 * Write generated Java files to disk for a given schema.
 * Includes variant interfaces for composition types as separate .java files.
 */
export function writeJavaFiles(
  result: CodeGenerationResult,
  outputDir: string,
  packageName: string = 'com.example.api'
): void {
  const javaPackageDir = outputDir + '/' + packageName.replace(/\./g, '/');
  fs.mkdirSync(javaPackageDir, { recursive: true });

  // Write main interface
  const interfacePath = javaPackageDir + '/' + result.schemaName + '.java';
  fs.writeFileSync(interfacePath, result.interfaceCode);

  // Write implementation
  const implPath = javaPackageDir + '/' + result.schemaName + 'Impl.java';
  fs.writeFileSync(implPath, result.implementationCode);

  // Write factory
  const factoryPath = javaPackageDir + '/' + result.schemaName + 'Factory.java';
  fs.writeFileSync(factoryPath, result.factoryCode);

  // Write variant interfaces as separate .java files (if any)
  if (result.variantInterfaces) {
    for (const [variantName, variantCode] of result.variantInterfaces.entries()) {
      const variantPath = javaPackageDir + '/' + variantName + '.java';
      fs.writeFileSync(variantPath, variantCode);
    }
  }
}

/**
 * Generate and write all Java code from a schema file path.
 * This is the top-level CLI entry point.
 */
export async function generateJavaFromSchemaFile(
  schemaPath: string,
  outputDir: string,
  packageName: string = 'com.example.api'
): Promise<void> {
  const fsMod = await import('fs');
  const pathMod = await import('path');

  if (!fsMod.existsSync(schemaPath)) {
    throw new Error(`Schema path does not exist: ${schemaPath}`);
  }

  const schema: JsonSchema2020 = JSON.parse(fsMod.readFileSync(schemaPath, 'utf-8'));
  const schemaName = schema.title || pathMod.basename(schemaPath, '.json');

  // Determine if this is part of a multi-schema generation
  const isDir = fsMod.statSync(schemaPath).isDirectory();

  if (isDir) {
    // Directory: process all JSON files
    const files = fsMod.readdirSync(schemaPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = pathMod.join(schemaPath, file);
      const result = generateJavaFromSchema(
        JSON.parse(fsMod.readFileSync(filePath, 'utf-8')) as JsonSchema2020,
        file.replace('.json', ''),
        packageName
      );
      writeJavaFiles(result, outputDir, packageName);
    }
  } else {
    const result = generateJavaFromSchema(schema, schemaName, packageName);
    writeJavaFiles(result, outputDir, packageName);
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}
