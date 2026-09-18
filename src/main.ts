#!/usr/bin/env node
/**
 * CLI entry point for schema-gen.
 * Generates Java interfaces, implementations, and factories from JSON Schema 2020-12.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { parseAndResolve, ParsedSchema } from './schema/schemaParser';
import { collectAllSchemas, SchemaRegistry } from './schema/refCollector';
import { generateInterfaceJava, PropertyGetter } from './generators/java/interfaceGenerator';
import { generateImplementationClass } from './generators/java/implementationGenerator';
import { generateFactoryClass } from './generators/java/factoryGenerator';
import { JsonSchema2020 } from './schema/jsonSchemaTypes';

const program = new Command();

interface GenerateOptions {
  schema: string;
  output: string;
  package?: string;
}

program
  .name('schema-gen')
  .description('JSON Schema 2020-12 driven Java code generator')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate Java code from JSON Schema')
  .requiredOption('--schema <path>', 'Path to JSON Schema file or directory')
  .requiredOption('--output <dir>', 'Output directory for generated code')
  .option('--package <name>', 'Java package name (e.g., com.example.api)', 'com.example.api')
  .action(async (options: GenerateOptions) => {
    const { schema: schemaPath, output: outputDir, package: packageName } = options;

    console.log(`Schema path: ${schemaPath}`);
    console.log(`Output directory: ${outputDir}`);
    console.log(`Package name: ${packageName}`);

    // Resolve absolute paths
    const absSchemaPath = path.resolve(schemaPath);
    const absOutputDir = path.resolve(outputDir);

    // Validate schema path exists
    if (!fs.existsSync(absSchemaPath)) {
      console.error(`Error: Schema path does not exist: ${absSchemaPath}`);
      process.exit(1);
    }

    try {
      // Phase 0 & 1: Parse and resolve schemas using the unified parser
      const parsedSchemas = await parseAndResolve(absSchemaPath);

      console.log(`\nParsed ${parsedSchemas.length} top-level schemas:`);
      for (const ps of parsedSchemas) {
        console.log(`  - ${ps.name}: ${(ps.schema as any).title || '(no title)'}`);
      }

      // Create output directory if it doesn't exist
      fs.mkdirSync(absOutputDir, { recursive: true });

      // Generate code for each schema
      for (const parsedSchema of parsedSchemas) {
        const schema = parsedSchema.schema as JsonSchema2020;
        const javaPackageName = (packageName || 'com.example.api').replace(/\./g, '/');
        const outputPackageDir = path.join(absOutputDir, javaPackageName);

        // Create package directory structure
        fs.mkdirSync(outputPackageDir, { recursive: true });

        console.log(`\nGenerating code for: ${parsedSchema.name}`);

        // Generate interface
        const propertyGetters: PropertyGetter[] = [];
        if (schema.properties) {
          const requiredSet = new Set(schema.required || []);
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const jsPropSchema = propSchema as JsonSchema2020;
            propertyGetters.push({
              propertyName: propName,
              javaName: toCamelCase(propName),
              typeMapping: {
                javaType: 'Object', // TODO: proper type mapping
                imports: [],
                getterExpression: (p: string) => `return null;`,
                nullable: !requiredSet.has(propName),
              },
              isRequired: requiredSet.has(propName),
              description: jsPropSchema.description,
            });
          }
        }

        const interfaceCode = generateInterfaceJava(
          parsedSchema.name,
          propertyGetters,
          undefined, // extendsInterface
          false, // isSealed
          undefined // permittedSubtypes
        );

        const interfaceFilePath = path.join(outputPackageDir, `${parsedSchema.name}.java`);
        fs.writeFileSync(interfaceFilePath, interfaceCode);
        console.log(`  ✓ Interface: ${interfaceFilePath}`);

        // Generate implementation
        const implCode = generateImplementationClass(parsedSchema.name, propertyGetters);
        const implFilePath = path.join(outputPackageDir, `${parsedSchema.name}Impl.java`);
        fs.writeFileSync(implFilePath, implCode);
        console.log(`  ✓ Implementation: ${implFilePath}`);

        // Generate factory
        const factoryCode = generateFactoryClass(parsedSchema.name, false, undefined);
        const factoryFilePath = path.join(outputPackageDir, `${parsedSchema.name}Factory.java`);
        fs.writeFileSync(factoryFilePath, factoryCode);
        console.log(`  ✓ Factory: ${factoryFilePath}`);
      }

      console.log(`\n✅ Generation complete. Output written to: ${absOutputDir}`);
    } catch (error) {
      console.error('Error generating code:', error);
      process.exit(1);
    }
  });

program.parse();

// Helper function to convert property names to camelCase
function toCamelCase(str: string): string {
  return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

export {};
