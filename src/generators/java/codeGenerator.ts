import * as fs from 'fs';
import * as path from 'path';
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

export interface CodeGenerationContext {
  sharedReferences?: Set<string>;
  referenceSchemas?: Map<string, JsonSchema2020>;
}

/**
 * Flatten properties from embedded allOf options into a single merged schema.
 * This fixes the case where variant interfaces (e.g., RichContent) have
 * their properties defined within an allOf structure rather than at the top level.
 */
function flattenAllOfProperties(
  schema: JsonSchema2020,
  rootSchema: JsonSchema2020 = schema,
  resolvedRefs: Set<string> = new Set(),
  context: CodeGenerationContext = {}
): JsonSchema2020 {
  if (!schema.allOf || schema.allOf.length === 0) return schema;

  const mergedProperties: Record<string, any> = {};
  const mergedRequired: string[] = [];

  for (const option of schema.allOf) {
    if (typeof option === 'object' && option !== null) {
      // Resolve $ref references before extracting properties
      let objSchema = option as JsonSchema2020;
      if (objSchema.$ref) {
        const refName = referenceName(objSchema.$ref);
        if (context.sharedReferences?.has(refName)) continue;
        if (resolvedRefs.has(objSchema.$ref)) continue;
        resolvedRefs.add(objSchema.$ref);
        objSchema = resolveRef(rootSchema, objSchema.$ref, context.referenceSchemas);
      }
      objSchema = flattenAllOfProperties(objSchema, rootSchema, new Set(resolvedRefs), context);
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
function resolveRef(
  schema: JsonSchema2020,
  ref: string,
  referenceSchemas?: Map<string, JsonSchema2020>
): JsonSchema2020 {
  const defName = ref.split('/').pop()!;
  const local = (schema as any).$defs?.[defName];
  if (local) return local;
  const targetName = referenceName(ref);
  return referenceSchemas?.get(targetName)
    ?? referenceSchemas?.get(defName)
    ?? schema;
}

/**
 * Build property getters for a schema, flattening embedded allOf if needed.
 */
function buildPropertyGetters(
  schema: JsonSchema2020,
  schemaName: string,
  rootSchema: JsonSchema2020 = schema,
  context: CodeGenerationContext = {}
): PropertyGetter[] {
  const flattened = flattenAllOfProperties(schema, rootSchema, new Set(), context);
  return generatePropertyGetters(flattened, schemaName);
}

/**
 * Generate code for a simple object schema (no composition keywords).
 */
function generateObjectCode(
  schema: JsonSchema2020,
  schemaName: string,
  packageName: string,
  context: CodeGenerationContext
): CodeGenerationResult {
  const propertyGetters = buildPropertyGetters(schema, schemaName, schema, context);

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
 * Generate code for an allOf composition, using an interface hierarchy for shared references.
 */
function generateAllOfCode(
  schema: JsonSchema2020,
  schemaName: string,
  composition: CompositionInfo,
  packageName: string,
  context: CodeGenerationContext
): CodeGenerationResult {
  // Find the first $ref option to use as extends interface
  let extendsInterface: string | undefined;
  for (const option of composition.options) {
    if (option.schema.$ref) {
      const refName = referenceName(option.schema.$ref);
      if (context.sharedReferences?.has(refName)) {
        extendsInterface = refName;
      }
      break;
    }
  }

  // Merge all properties from all options
  const flattened = flattenAllOfProperties(schema, schema, new Set(), context);
  const propertyGetters = buildPropertyGetters(flattened, schemaName, schema, context);

  return {
    schemaName,
    interfaceCode: generateInterfaceJava(schemaName, propertyGetters, extendsInterface, false, undefined),
    implementationCode: generateImplementationClass(
      schemaName,
      packageName,
      propertyGetters,
      extendsInterface ? `${extendsInterface}Impl` : undefined
    )
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
  packageName: string,
  extendsInterfaces: string[] = []
): string {
  return dedent`
    package ${packageName};

    /**
     * Union interface for ${schemaName} variants.
     */
    public interface ${schemaName}${extendsInterfaces.length ? ` extends ${extendsInterfaces.join(', ')}` : ''} {
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
  packageName: string,
  context: CodeGenerationContext
): CodeGenerationResult {
  // Generate variant interfaces for each option
  const variantInterfaces = new Map<string, string>();
  const optionNames: string[] = [];
  const gettersByOption = new Map<string, PropertyGetter[]>();
  const flattenedOptions = new Map<string, JsonSchema2020>();
  const sharedParentInterfaces = (schema.allOf || [])
    .filter(option => !!option.$ref)
    .map(option => referenceName(option.$ref!))
    .filter(name => context.sharedReferences?.has(name));

  for (const option of composition.options) {
    const optionName = option.name;
    optionNames.push(optionName);
    // Resolve $ref against root schema $defs before flattening
    const resolvedSchema = option.schema.$ref
      ? resolveRef(schema, option.schema.$ref, context.referenceSchemas)
      : option.schema;
    const schemaToFlatten = composition.type === 'oneOf'
      ? {
          ...schema,
          ...resolvedSchema,
          allOf: schema.allOf,
          properties: resolvedSchema.properties,
          required: resolvedSchema.required,
        } as JsonSchema2020
      : resolvedSchema;
    const flattenedOption = flattenAllOfProperties(schemaToFlatten, schema, new Set(), context);
    const optionGetters = buildPropertyGetters(flattenedOption, optionName, schema, context);
    flattenedOptions.set(optionName, flattenedOption);
    gettersByOption.set(optionName, optionGetters);

    variantInterfaces.set(
      optionName,
      generateInterfaceJava(optionName, optionGetters, sharedParentInterfaces).replace(
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
    interfaceCode: generateUnionInterface(schemaName, optionNames, packageName, sharedParentInterfaces),
    implementationCode: generateAnyOfImplementationClass(
      schemaName,
      packageName,
      optionNames,
      gettersByOption,
      sharedParentInterfaces[0] ? `${sharedParentInterfaces[0]}Impl` : undefined
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
  packageName = 'com.example.api',
  context: CodeGenerationContext = {}
): CodeGenerationResult {
  // Detect composition keywords and dispatch to the appropriate generator
  const composition = analyzeComposition(schema, schemaName);

  let result: CodeGenerationResult;
  if (composition) {
    switch (composition.type) {
      case 'allOf':
        result = generateAllOfCode(schema, schemaName, composition, packageName, context);
        break;
      case 'oneOf':
      case 'anyOf':
        result = generateUnionCode(schema, schemaName, composition, packageName, context);
        break;
      default:
        result = generateObjectCode(schema, schemaName, packageName, context);
        break;
    }
  } else {
    result = generateObjectCode(schema, schemaName, packageName, context);
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
  fs.writeFileSync(
    interfacePath,
    result.interfaceCode.replace('package PACKAGE_PLACEHOLDER;', `package ${packageName};`)
  );

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
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema path does not exist: ${schemaPath}`);
  }
  const { parseAndResolve } = await import('../../schema/schemaParser');
  const parsedSchemas = await parseAndResolve(schemaPath);
  const referenceSchemas = new Map<string, JsonSchema2020>();
  for (const parsedSchema of parsedSchemas) {
    referenceSchemas.set(parsedSchema.name, parsedSchema.schema as JsonSchema2020);
    referenceSchemas.set(
      path.basename(parsedSchema.sourceFile || parsedSchema.name).replace(/\.(json|yaml|yml)$/, ''),
      parsedSchema.schema as JsonSchema2020
    );
  }
  const context: CodeGenerationContext = {
    referenceSchemas,
    sharedReferences: new Set(
      parsedSchemas.filter(parsedSchema => (parsedSchema.refCount || 1) > 1).map(parsedSchema => parsedSchema.name)
    ),
  };

  for (const parsedSchema of parsedSchemas) {
    const result = generateJavaFromSchema(
      parsedSchema.schema as JsonSchema2020,
      parsedSchema.name,
      packageName,
      context
    );
    result.schemaJson = parsedSchema.runtimeSchemaJson || JSON.stringify(parsedSchema.schema, null, 2);
    writeJavaFiles(result, outputDir, packageName);
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function referenceName(ref: string): string {
  const target = ref.split(/[\/#]/).pop() || ref;
  const withoutExtension = target.replace(/\.(json|yaml|yml)$/i, '');
  return withoutExtension
    .replace(/-([a-z])/g, (_, character: string) => character.toUpperCase())
    .replace(/^./, character => character.toUpperCase());
}

function toCamelCase(str: string): string {
  return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}
