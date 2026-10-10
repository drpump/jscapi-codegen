import * as fs from 'fs';
import dedent from 'dedent';
import { JsonSchema2020 } from '../../schema/jsonSchemaTypes';
import { mapJsonSchemaToJavaType, TypeMappingContext } from './typeMapper';
import { generatePropertyGetters, PropertyGetter, generateInterfaceJava } from './interfaceGenerator';
import { generateImplementationClass, generateOneOfImplementationClass, generateAnyOfImplementationClass } from './implementationGenerator';
import { generateFactoryClass } from './factoryGenerator';
import { generateJsonNodeConverters } from './jsonNodeConvertersGenerator';
import { analyzeComposition, CompositionInfo } from '../../schema/compositionHandler';
import { generateJavaSupportFiles } from './supportGenerator';

/**
 * Result of generating Java code for a schema.
 */
export interface CodeGenerationResult {
  schemaName: string;
  interfaceCode: string;
  implementationCode: string;
  factoryCode: string;
  schemaJson?: string;
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
function flattenAllOfProperties(
  schema: JsonSchema2020,
  rootSchema: JsonSchema2020 = schema,
  resolvedRefs: Set<string> = new Set()
): JsonSchema2020 {
  if (!schema.allOf || schema.allOf.length === 0) return schema;

  const mergedProperties: Record<string, any> = {};
  const mergedRequired: string[] = [];

  for (const option of schema.allOf) {
    if (typeof option === 'object' && option !== null) {
      // Resolve $ref references before extracting properties
      let objSchema = option as JsonSchema2020;
      if (objSchema.$ref) {
        if (resolvedRefs.has(objSchema.$ref)) continue;
        resolvedRefs.add(objSchema.$ref);
        objSchema = resolveRef(rootSchema, objSchema.$ref);
      }
      objSchema = flattenAllOfProperties(objSchema, rootSchema, new Set(resolvedRefs));
      if (objSchema.properties) {
        for (const [key, value] of Object.entries(objSchema.properties)) {
          // Only replace existing if it has no type declaration - prefer typed over non-typed
          const existing = mergedProperties[key];
          if (!(existing && (existing as { type?: string }).type)) {
            mergedProperties[key] = value;
          }
        }
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
    required: Array.from(new Set([...(schema.required || []), ...mergedRequired])),
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
function buildPropertyGetters(
  schema: JsonSchema2020,
  schemaName: string,
  rootSchema: JsonSchema2020 = schema
): PropertyGetter[] {
  const flattened = flattenAllOfProperties(schema, rootSchema);
  return generatePropertyGetters(flattened, schemaName);
}

/**
 * Generate code for a simple object schema (no composition keywords).
 */
function generateObjectCode(
  schema: JsonSchema2020,
  schemaName: string,
  packageName: string
): CodeGenerationResult {
  const propertyGetters = buildPropertyGetters(schema, schemaName);

  return {
    schemaName,
    interfaceCode: generateInterfaceJava(schemaName, propertyGetters, undefined,
 false, undefined),
    implementationCode: generateImplementationClass(schemaName, packageName, propertyGetters)
,
    factoryCode: generateFactoryClass(schemaName, false, packageName),
  };
}

/**
 * Generate code for an allOf composition.
 * Finds the first $ref as an extends interface and merges properties from all options.
 */
function generateAllOfCode(
  schema: JsonSchema2020,
  schemaName: string,
  composition: CompositionInfo,
  packageName: string
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
    implementationCode: generateImplementationClass(schemaName, packageName, propertyGetters)
,
    factoryCode: generateFactoryClass(schemaName, true, packageName, composition),
  };
}

/**
 * Generate a union interface for a composition type.
 */
function generateUnionInterface(
  schemaName: string,
  optionNames: string[],
  packageName: string
): string {
  return dedent`
    package ${packageName};

    /**
     * Union interface for ${schemaName} variants.
     */
    public interface ${schemaName} {
      ${optionNames.map(name => `public java.util.Optional<${name}> as${name}();`).join('\n      ')}
      ${optionNames.map(name => `public boolean is${capitalize(name)}();`).join('\n      ')}
    }
  `;
}

/**
 * Generate code for a oneOf/anyOf union type.
 * Creates a union interface with variant check methods and generates separate variant interfaces.
 */
function generateUnionCode(
  schema: JsonSchema2020,
  schemaName: string,
  composition: CompositionInfo,
  packageName: string
): CodeGenerationResult {
  // Generate variant interfaces for each option
  const variantInterfaces = new Map<string, string>();
  const optionNames: string[] = [];
  const gettersByOption = new Map<string, PropertyGetter[]>();
  const flattenedOptions = new Map<string, JsonSchema2020>();

  for (const option of composition.options) {
    const optionName = option.name;
    optionNames.push(optionName);
    // Resolve $ref against root schema $defs before flattening
    const resolvedSchema = option.schema.$ref ? resolveRef(schema, option.schema.$ref) : option.schema;
    const flattenedOption = flattenAllOfProperties(resolvedSchema, schema);
    const optionGetters = buildPropertyGetters(flattenedOption, optionName, schema);
    flattenedOptions.set(optionName, flattenedOption);
    gettersByOption.set(optionName, optionGetters);

    variantInterfaces.set(
      optionName,
      generateInterfaceJava(optionName, optionGetters).replace(
        'package PACKAGE_PLACEHOLDER;',
        `package ${packageName};`
      )
    );
  }

  for (const [optionName, optionSchema] of flattenedOptions) {
    for (const [nestedName, nestedCode] of generateNestedObjectFiles(optionSchema, optionName, packageName)) {
      variantInterfaces.set(nestedName, nestedCode);
    }
  }

  return {
    schemaName,
    interfaceCode: generateUnionInterface(schemaName, optionNames, packageName),
    implementationCode: generateAnyOfImplementationClass(
      schemaName,
      packageName,
      optionNames,
      gettersByOption
    ),
    variantInterfaces,
    factoryCode: generateFactoryClass(schemaName, true, packageName, composition),
  };
}

function generateNestedObjectFiles(
  schema: JsonSchema2020,
  parentName: string,
  packageName: string
): Map<string, string> {
  const files = new Map<string, string>();
  if (!schema.properties) return files;

  for (const [propertyName, propertySchemaValue] of Object.entries(schema.properties)) {
    const propertySchema = propertySchemaValue as JsonSchema2020;
    if (propertySchema.type !== 'object' || !propertySchema.properties) continue;

    const nestedName = propertySchema.title || `${parentName}${capitalize(propertyName)}`;
    const nestedGetters = buildPropertyGetters(propertySchema, nestedName);
    files.set(
      nestedName,
      generateInterfaceJava(nestedName, nestedGetters).replace(
        'package PACKAGE_PLACEHOLDER;',
        `package ${packageName};`
      )
    );
    files.set(
      `${nestedName}Impl`,
      generateImplementationClass(nestedName, packageName, nestedGetters)
    );

    for (const [childName, childCode] of generateNestedObjectFiles(propertySchema, nestedName, packageName)) {
      files.set(childName, childCode);
    }
  }
  return files;
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

  let result: CodeGenerationResult;
  if (composition) {
    switch (composition.type) {
      case 'allOf':
        result = generateAllOfCode(schema, schemaName, composition, packageName);
        break;
      case 'oneOf':
      case 'anyOf':
        result = generateUnionCode(schema, schemaName, composition, packageName);
        break;
      default:
        result = generateObjectCode(schema, schemaName, packageName);
        break;
    }
  } else {
    result = generateObjectCode(schema, schemaName, packageName);
  }
  result.schemaJson = JSON.stringify(schema, null, 2);
  return result;
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

  if (result.schemaJson) {
    fs.writeFileSync(javaPackageDir + '/' + result.schemaName + '.schema.json', result.schemaJson);
  }

  for (const [supportName, supportCode] of generateJavaSupportFiles(packageName)) {
    fs.writeFileSync(javaPackageDir + '/' + supportName + '.java', supportCode);
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
