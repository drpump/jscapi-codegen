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
import { generateJavaFromSchema, writeJavaFiles } from './generators/java/codeGenerator';
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
        console.log(`   - ${ps.name}: ${(ps.schema as any).title || '(no title)'}`);
       }

       // Create output directory if it doesn't exist
      fs.mkdirSync(absOutputDir, { recursive: true });

       // Generate code for each schema using the shared pipeline
      for (const parsedSchema of parsedSchemas) {
        const schema = parsedSchema.schema as JsonSchema2020;
        const javaPackageName = (packageName || 'com.example.api').replace(/\./g, '/');
        const outputPackageDir = path.join(absOutputDir, javaPackageName);

         // Create package directory structure
        fs.mkdirSync(outputPackageDir, { recursive: true });

        console.log(`\nGenerating code for: ${parsedSchema.name}`);

         // Use the single top-level generation function — wraps the full pipeline
        const result = generateJavaFromSchema(schema, parsedSchema.name, packageName || 'com.example.api');
        writeJavaFiles(result, outputDir, packageName || 'com.example.api');

        console.log(`   ✓ Interface: ${outputPackageDir}/${parsedSchema.name}.java`);
        console.log(`   ✓ Implementation: ${outputPackageDir}/${parsedSchema.name}Impl.java`);
        console.log(`   ✓ Factory: ${outputPackageDir}/${parsedSchema.name}Factory.java`);
       }

      console.log(`\n✅ Generation complete. Output written to: ${absOutputDir}`);
     } catch (error) {
      console.error('Error generating code:', error);
      process.exit(1);
     }
   });

program.parse();
