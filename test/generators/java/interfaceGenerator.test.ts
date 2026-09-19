import { generatePropertyGetters, generateInterfaceJava, PropertyGetter } from '../../../src/generators/java/interfaceGenerator';
import { JsonSchema2020 } from '../../../src/schema/jsonSchemaTypes';

describe('interfaceGenerator', () => {
    describe('generatePropertyGetters', () => {
        it('should generate getters for simple object properties', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer' }
                }
            };

            const getters = generatePropertyGetters(schema, 'Person');

            expect(getters).toHaveLength(2);
            expect(getters[0].propertyName).toBe('name');
            expect(getters[0].javaName).toBe('name');
            expect(getters[1].propertyName).toBe('age');
         });

        it('should mark required properties', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer' }
                },
                required: ['name']
            };

            const getters = generatePropertyGetters(schema, 'Person');
            const nameGetter = getters.find(g => g.propertyName === 'name');
            const ageGetter = getters.find(g => g.propertyName === 'age');

            expect(nameGetter?.isRequired).toBe(true);
            expect(ageGetter?.isRequired).toBe(false);
         });

        it('should include descriptions', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    name: { 
                        type: 'string',
                        description: 'The person name'
                    }
                }
            };

            const getters = generatePropertyGetters(schema, 'Person');
            expect(getters[0].description).toBe('The person name');
         });

        it('should return empty array for schemas without properties', () => {
            const schema: JsonSchema2020 = { type: 'object' };
            const getters = generatePropertyGetters(schema, 'Empty');
            expect(getters).toHaveLength(0);
         });

        it('should convert property names to camelCase', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    first_name: { type: 'string' }
                }
            };

            const getters = generatePropertyGetters(schema, 'Person');
            expect(getters[0].javaName).toBe('first_name');
         });
     });

    describe('generateInterfaceJava', () => {
        it('should generate basic interface with no properties', () => {
            const javaCode = generateInterfaceJava('Empty', []);

            expect(javaCode).toContain('public interface Empty');
            expect(javaCode).toContain('getRawNode()');
            expect(javaCode).toContain('hasProperty(String propertyName)');
            expect(javaCode).not.toContain('extends');
            expect(javaCode).not.toContain('permits');
         });

        it('should generate interface with extends clause', () => {
            const javaCode = generateInterfaceJava('Child', [], 'Parent');

            expect(javaCode).toContain('extends Parent');
            expect(javaCode).not.toContain('permits');
         });

        it('should generate sealed interface with permits', () => {
            const javaCode = generateInterfaceJava(
                'Sealed', 
                [],
                undefined,
                true,
                ['SubType1', 'SubType2']
            );

            expect(javaCode).toContain('permits SubType1, SubType2');
         });

        it('should include package placeholder', () => {
            const javaCode = generateInterfaceJava('Test', []);
            expect(javaCode).toContain('package PACKAGE_PLACEHOLDER;');
         });

        it('should include generated imports for non-java.lang types', () => {
            const getters: PropertyGetter[] = [
                {
                    propertyName: 'data',
                    javaName: 'data',
                    typeMapping: {
                        javaType: 'List<String>',
                        imports: ['java.util.List'],
                        getterExpression: () => 'jsonNode.get("data")',
                        nullable: false
                    },
                    isRequired: true
                }
            ];

            const javaCode = generateInterfaceJava('Test', getters);
            expect(javaCode).toContain('import java.util.List');
         });

        it('should include Javadoc for properties with descriptions', () => {
            const getters: PropertyGetter[] = [
                {
                    propertyName: 'name',
                    javaName: 'name',
                    typeMapping: {
                        javaType: 'String',
                        imports: [],
                        getterExpression: () => 'jsonNode.get("name")',
                        nullable: false
                    },
                    isRequired: true,
                    description: 'The name field'
                }
            ];

            const javaCode = generateInterfaceJava('Person', getters);
            expect(javaCode).toContain('/**');
            expect(javaCode).toContain('Gets the');
         });

        it('should include getRawNode method', () => {
            const javaCode = generateInterfaceJava('Test', []);
            expect(javaCode).toContain('JsonNode getRawNode()');
         });

        it('should include hasProperty method', () => {
            const javaCode = generateInterfaceJava('Test', []);
            expect(javaCode).toContain('boolean hasProperty(String propertyName)');
         });

        it('should not include extends or permits when not provided', () => {
            const javaCode = generateInterfaceJava('Simple', []);
            
            expect(javaCode).not.toContain('extends');
            expect(javaCode).not.toContain('permits');
         });

        it('should handle empty import block correctly', () => {
            const getters: PropertyGetter[] = [
                {
                    propertyName: 'flag',
                    javaName: 'flag',
                    typeMapping: {
                        javaType: 'Boolean',
                        imports: [],
                        getterExpression: () => 'jsonNode.get("flag")',
                        nullable: false
                    },
                    isRequired: false
                }
            ];

            const javaCode = generateInterfaceJava('Simple', getters);
            expect(javaCode).toContain('package PACKAGE_PLACEHOLDER;');
         });
     });
});
