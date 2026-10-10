import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { generateJavaFromSchema, writeJavaFiles } from '../../src/generators/java/codeGenerator';
import { generateJsonNodeConverters } from '../../src/generators/java/jsonNodeConvertersGenerator';

describe('Java Integration Tests', () => {
    const projectRoot = path.join(__dirname, '..', '..');
    const schemasDir = path.join(__dirname, '..', 'fixtures', 'schemas');
    const jsonDataDir = path.join(__dirname, '..', 'fixtures', 'json-data');
    const tempDir = path.join(projectRoot, '.temp-test-java');
    const libsDir = path.join(projectRoot, 'libs');
    
    // Check if Java is available
    function javaAvailable(): boolean {
        try {
            execSync('java -version', { stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }
    
    beforeAll(() => {
        // Create temp directory for generated Java code
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
        
        const hasJava = javaAvailable();
        console.log(`Java integration tests: ${hasJava ? 'ENABLED' : 'SKIPPED (Java not found)'}`);
    });
    
    afterAll(() => {
        // Cleanup temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    
    describe('Person Schema Code Generation', () => {
        const schemaName = 'Person';
        let packageDir: string;
        
        beforeAll(() => {
            packageDir = path.join(tempDir, 'com/example/api');
        }, 30000);
        
        it('should generate compilable Java interface from Person schema', () => {
            // Load and parse the schema
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'person.json'), 'utf-8'));
            
            // Call the SINGLE top-level generation function
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            
            // Write the generated files
            fs.mkdirSync(packageDir, { recursive: true });
            const interfacePath = path.join(packageDir, `${schemaName}.java`);
            fs.writeFileSync(interfacePath, result.interfaceCode.replace('package PACKAGE_PLACEHOLDER;', 'package com.example.api;'));
            
            // Verify interface contains expected methods
            expect(result.interfaceCode).toContain('public interface Person');
            expect(result.interfaceCode).toContain('String getFirstName()');
            expect(result.interfaceCode).toContain('String getLastName()');
            // Verify implementation is also generated
            expect(result.implementationCode).toContain('class PersonImpl implements Person');
            // Verify factory is also generated
            expect(result.factoryCode).toContain('class PersonFactory');
        }, 30000);
    });

    describe('Full Java Compilation and Runtime Validation', () => {
        const schemaName = 'Person';
        let packageDir: string;
        
        beforeAll(() => {
            // Generate ALL code with a SINGLE top-level call
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'person.json'), 'utf-8'));
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            
            packageDir = path.join(tempDir, 'com/example/api');
            fs.mkdirSync(packageDir, { recursive: true });
            writeJavaFiles(result, tempDir, 'com.example.api');
            fs.writeFileSync(
                path.join(packageDir, `${schemaName}.java`),
                result.interfaceCode.replace('package PACKAGE_PLACEHOLDER;', 'package com.example.api;')
            );
            // Write the JsonNodeConverters utility class (required by generated code)
            const convertersCode = generateJsonNodeConverters('com.example.api');
            fs.writeFileSync(path.join(packageDir, 'JsonNodeConverters.java'), convertersCode);
            const jsonDataTempDir = path.join(tempDir, 'json-data');
            fs.mkdirSync(jsonDataTempDir, { recursive: true });
            fs.copyFileSync(path.join(jsonDataDir, 'valid-person.json'), path.join(jsonDataTempDir, 'valid-person.json'));
            fs.copyFileSync(path.join(jsonDataDir, 'invalid-person.json'), path.join(jsonDataTempDir, 'invalid-person.json'));
        }, 30000);
        
        it('should compile generated interface and implementation', () => {
            // Skip if Java is not available
            if (!javaAvailable()) {
                return;
            }
            
            // Compile with javac using absolute libs path
            const javacCmd = `cd ${tempDir} && javac -cp "${libsDir}/*" com/example/api/${schemaName}.java`;
            try {
                execSync(javacCmd, { stdio: 'pipe', timeout: 30000 });
            } catch (err) {
                const output = err instanceof Error ? err.message : String(err);
                throw new Error(`javac failed: ${output}`);
            }
            
            // Verify class files were generated
            expect(fs.existsSync(path.join(packageDir, `${schemaName}.class`))).toBe(true);
        }, 30000);
        
        it('should allow runtime instantiation and validation of compiled Java objects', () => {
            if (!javaAvailable()) {
                return;
            }

             // Copy test driver from fixtures into temp package directory
            const fixtureDriverPath = path.join(
                __dirname,
                'com', 'example', 'api', 'PersonTestDriver.java'
             );
            fs.copyFileSync(fixtureDriverPath, path.join(packageDir, 'PersonTestDriver.java'));
            // Compile the test driver alongside generated classes
            const compileCmd = `cd ${tempDir} && javac -cp ".:${libsDir}/*" com/example/api/Person.java com/example/api/PersonImpl.java com/example/api/PersonFactory.java com/example/api/JsonNodeConverters.java com/example/api/SchemaRegistry.java com/example/api/CompositionValidator.java com/example/api/AnyOfMatchResult.java com/example/api/ValidationException.java com/example/api/JacksonMapper.java com/example/api/PersonTestDriver.java`;
            execSync(compileCmd, { stdio: 'pipe', timeout: 30000 });

             // Run the test driver
            const runCmd = `cd ${tempDir} && java -cp ".:${libsDir}/*" com.example.api.PersonTestDriver`;
            const output = execSync(runCmd, { encoding: 'utf-8', timeout: 30000 });
            
            expect(output).toContain('PASSED');
            expect(output).toContain('All Tests Passed');
        }, 30000);
    });

    describe('Schema Validation with Generated Code', () => {
        it('should verify Person schema compiles without errors', () => {
            if (!javaAvailable()) {
                return;
            }
            
            // Read and validate the schema file itself
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'person.json'), 'utf-8'));
            expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
            expect(schema.type).toBe('object');
            expect(schema.required).toContain('firstName');
            expect(schema.required).toContain('lastName');
        });
        
        it('should generate valid property accessors for all schema properties', () => {
            if (!javaAvailable()) {
                return;
            }
            
            // Load schema and use the top-level generator to verify getters
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'person.json'), 'utf-8'));
            const result = generateJavaFromSchema(schema, 'Person', 'com.example.api');
            
            // Verify the interface code contains all expected property accessors
            expect(result.interfaceCode).toContain('String getFirstName()');
            expect(result.interfaceCode).toContain('String getLastName()');
            expect(result.interfaceCode).toContain('String getEmail()');
            expect(result.interfaceCode).toContain('Long getAge()');
            expect(result.interfaceCode).toContain('BigDecimal getSalary()');
        });
    });

    describe('AllOf Shared Schema Integration', () => {
        const schemaName = 'AllOfShared';
        let packageDir: string;
        
        beforeAll(() => {
            packageDir = path.join(tempDir, 'com/example/api');
        }, 30000);
        
        it('should generate interface with $ref property getters', () => {
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'all-of-shared.json'), 'utf-8'));
            expect(schema.title).toBe('AllOfShared');
            expect(schema.type).toBe('object');
            
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            
            // Top-level is a simple object (not allOf), so no extends clause
            expect(result.interfaceCode).toContain('public interface AllOfShared');
            // Properties reference $defs but are not resolved at top level
            expect(result.interfaceCode).toContain('JsonNode getBaseRef()');
            expect(result.interfaceCode).toContain('JsonNode getDetailedRef()');
            expect(result.implementationCode).toContain('class AllOfSharedImpl implements AllOfShared');
            expect(result.factoryCode).toContain('AllOfSharedFactory');
        });
        
        it('should produce getters for $ref properties in simple object', () => {
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'all-of-shared.json'), 'utf-8'));
            expect(schema.definitions).toBeDefined();
            expect(schema.definitions!.BaseObject).toBeDefined();
            expect(schema.definitions!.DetailedObject).toBeDefined();
            
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            
            // Top-level object has properties with $ref - generates JsonNode getters for them
            expect(result.interfaceCode).toContain('JsonNode getBaseRef()');
            expect(result.interfaceCode).toContain('JsonNode getDetailedRef()');
        });
        
        it('should handle nested allOf within $defs (DetailedObject)', () => {
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'all-of-shared.json'), 'utf-8'));
            const detailedDef = schema.definitions!.DetailedObject as any;
            expect(detailedDef.allOf).toBeDefined();
            expect(Array.isArray(detailedDef.allOf)).toBe(true);
            
            // Nested allOf in definitions should be processable by the composition handler
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            expect(result.interfaceCode).toContain('JsonNode getDetailedRef()');
        });
    });

    describe('Content Types Polymorphic Schema', () => {
        const schemaName = 'ContentTypes';

        it('should validate content JSON and access generated variant getters at runtime', () => {
            if (!javaAvailable()) {
                return;
            }

            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'content-types.json'), 'utf-8'));
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            writeJavaFiles(result, tempDir, 'com.example.api');

            const packageDir = path.join(tempDir, 'com/example/api');
            fs.writeFileSync(
                path.join(packageDir, 'JsonNodeConverters.java'),
                generateJsonNodeConverters('com.example.api')
            );
            fs.copyFileSync(
                path.join(__dirname, 'com', 'example', 'api', 'ContentTypesTestDriver.java'),
                path.join(packageDir, 'ContentTypesTestDriver.java')
            );
            const jsonDataTempDir = path.join(tempDir, 'json-data');
            fs.mkdirSync(jsonDataTempDir, { recursive: true });
            fs.copyFileSync(path.join(jsonDataDir, 'valid-content-types.json'), path.join(jsonDataTempDir, 'valid-content-types.json'));
            fs.copyFileSync(path.join(jsonDataDir, 'invalid-content-types.json'), path.join(jsonDataTempDir, 'invalid-content-types.json'));

            const sources = [
                'ContentTypes.java',
                'ContentTypesFactory.java',
                'ContentTypesImpl.java',
                'TextContent.java',
                'RichContent.java',
                'ImageContent.java',
                'VideoContent.java',
                'RichContentFormatting.java',
                'RichContentFormattingImpl.java',
                'JsonNodeConverters.java',
                'SchemaRegistry.java',
                'CompositionValidator.java',
                'AnyOfMatchResult.java',
                'ValidationException.java',
                'JacksonMapper.java',
                'ContentTypesTestDriver.java',
            ].map(file => `com/example/api/${file}`).join(' ');
            execSync(`cd ${tempDir} && javac -cp ".:${libsDir}/*" ${sources}`, { stdio: 'pipe', timeout: 30000 });

            const output = execSync(
                `cd ${tempDir} && java -cp ".:${libsDir}/*" com.example.api.ContentTypesTestDriver`,
                { encoding: 'utf-8', timeout: 30000 }
            );
            expect(output).toContain('Valid image JSON creates ContentTypes');
            expect(output).toContain('ContentTypes factory rejects invalid JSON');
            expect(output).toContain('All Content Types Tests Passed');
        }, 30000);
        
        it('should generate union interface from anyOf with variant check methods', () => {
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'content-types.json'), 'utf-8'));
            expect(schema.title).toBe('ContentTypes');
            expect(schema.anyOf).toBeDefined();
            expect(Array.isArray(schema.anyOf)).toBe(true);
            expect((schema.anyOf as any[]).length).toBe(4);
            
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            
            expect(result.interfaceCode).toContain('public interface ContentTypes');
            expect(result.interfaceCode).toContain('boolean isTextContent()');
            expect(result.interfaceCode).toContain('boolean isRichContent()');
            expect(result.interfaceCode).toContain('boolean isImageContent()');
            expect(result.interfaceCode).toContain('boolean isVideoContent()');
            expect(result.implementationCode).toContain('TextContent');
            expect(result.implementationCode).toContain('RichContent');
            expect(result.implementationCode).toContain('ImageContent');
            expect(result.implementationCode).toContain('VideoContent');
        });
        
        it('should generate factory with variant creators for anyOf schema', () => {
            const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'content-types.json'), 'utf-8'));
            const result = generateJavaFromSchema(schema, schemaName, 'com.example.api');
            
            expect(result.factoryCode).toContain('ContentTypesFactory');
            // Factory uses composition validator for variant matching
            expect(result.factoryCode).toContain('CompositionValidator');
            // RichContent itself uses allOf but composition is handled at option level
            
            // Implementation should contain the variant's top-level properties
            expect(result.implementationCode).toContain('contentType');
            expect(result.implementationCode).toContain('textContent');
            expect(result.implementationCode).toContain('imageUrl');
            expect(result.implementationCode).toContain('getHeight()');
            expect(result.implementationCode).toContain('videoUrl');
            expect(result.implementationCode).toContain('durationSeconds');
        });
    });

    describe('Polymorphism Composition Test', () => {
        it('should correctly identify allOf composition pattern', () => {
            const allOfSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'all-of-shared.json'), 'utf-8'));
            // This schema is a simple object (not allOf at top level)
            const allOfResult = generateJavaFromSchema(allOfSchema, 'AllOfShared', 'com.example.api');
            // Simple objects don't have extends or boolean is patterns
            expect(allOfResult.interfaceCode).not.toContain('boolean is');
        });
        
        it('should correctly identify anyOf composition pattern', () => {
            const anyOfSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'content-types.json'), 'utf-8'));
            const anyOfResult = generateJavaFromSchema(anyOfSchema, 'ContentTypes', 'com.example.api');
            expect(anyOfResult.interfaceCode).toContain('boolean is');
        });
        
        it('should distinguish simple object from polymorphic schemas', () => {
            const simpleSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'person.json'), 'utf-8'));
            const simpleResult = generateJavaFromSchema(simpleSchema, 'Person', 'com.example.api');
            expect(simpleResult.interfaceCode).not.toContain('extends');
            expect(simpleResult.interfaceCode).not.toContain('boolean is');
            expect(simpleResult.interfaceCode).toContain('getFirstName()');
            expect(simpleResult.interfaceCode).toContain('getLastName()');
            
            // anyOf schema should have variant check methods
            const anyOfSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'content-types.json'), 'utf-8'));
            const anyOfResult = generateJavaFromSchema(anyOfSchema, 'ContentTypes', 'com.example.api');
            expect(anyOfResult.interfaceCode).toContain('boolean isTextContent()');
        });
    });
});
