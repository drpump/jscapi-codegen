import * as fs from 'fs';
import { JsonSchema2020 } from '../../schema/jsonSchemaTypes';
import { mapJsonSchemaToJavaType, TypeMappingContext } from './typeMapper';
import { generatePropertyGetters, PropertyGetter, generateInterfaceJava } from './interfaceGenerator';
import { generateImplementationClass } from './implementationGenerator';
import { generateFactoryClass } from './factoryGenerator';

/**
 * Result of generating Java code for a schema.
 */
export interface CodeGenerationResult {
  schemaName: string;
  interfaceCode: string;
  implementationCode: string;
  factoryCode: string;
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
 * Generate all Java code (interface, implementation, factory) from a JSON Schema.
 * Uses the full type-mapping pipeline with proper Java types and JsonNode-backed getters.
 * 
 * This is the single entry point for code generation — whether from the CLI,
 * tests, or programmatic API callers.
 */
export function generateJavaFromSchema(
  schema: JsonSchema2020,
  schemaName: string,
  packageName = 'com.example.api'
): CodeGenerationResult {
  // Use the full type mapper (NOT hardcoded stub)
  const propertyGetters: PropertyGetter[] = [];
  const requiredSet = new Set(schema.required || []);

  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const jsPropSchema = propSchema as JsonSchema2020;
      const javaName = toCamelCase(propName);
      const isRequired = requiredSet.has(propName);

      // Properly map using the JSON Schema type info — this fixes both bugs:
      // 1. Uses actual Java types (BigDecimal, String, etc.) instead of generic Object
      // 2. Generates real JsonNode-backed getters instead of returning null
      const typeMapping = mapJsonSchemaToJavaType(jsPropSchema, {
        propertyName: propName,
        schemaName: `${schemaName}${capitalize(javaName)}`,
        isRequired,
      });

      propertyGetters.push({
        propertyName: propName,
        javaName: javaName,
        typeMapping: typeMapping,
        isRequired: isRequired,
        description: jsPropSchema.description,
      });
    }
  }

  const interfaceCode = generateInterfaceJava(
    schemaName,
    propertyGetters,
    undefined, // extendsInterface
    false,     // isSealed
    undefined  // permittedSubtypes
  );

  const implementationCode = generateImplementationClass(schemaName, propertyGetters);

  const factoryCode = generateFactoryClass(schemaName, false, undefined);

  return {
    schemaName,
    interfaceCode,
    implementationCode,
    factoryCode,
  };
}

/**
 * Write generated Java files to disk for a given schema.
 */
export function writeJavaFiles(
  result: CodeGenerationResult,
  outputDir: string,
  packageName: string = 'com.example.api'
): void {
  const javaPackageDir = outputDir + '/' + packageName.replace(/\./g, '/');
  fs.mkdirSync(javaPackageDir, { recursive: true });

  const interfacePath = javaPackageDir + '/' + result.schemaName + '.java';
  fs.writeFileSync(interfacePath, result.interfaceCode);

  const implPath = javaPackageDir + '/' + result.schemaName + 'Impl.java';
  fs.writeFileSync(implPath, result.implementationCode);

  const factoryPath = javaPackageDir + '/' + result.schemaName + 'Factory.java';
  fs.writeFileSync(factoryPath, result.factoryCode);
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
