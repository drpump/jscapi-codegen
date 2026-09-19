import { mapJsonSchemaToJavaType, setPackageName } from '../../../src/generators/java/typeMapper';
import { JsonSchema2020 } from '../../../src/schema/jsonSchemaTypes';

describe('typeMapper', () => {
    beforeEach(() => {
        setPackageName('com.example.api');
    });

    describe('mapJsonSchemaToJavaType', () => {
        describe('string types', () => {
            it('should map plain string to String', () => {
                const schema: JsonSchema2020 = { type: 'string' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'name' });

                expect(result.javaType).toBe('String');
                expect(result.imports).toEqual([]);
                expect(result.getterExpression('name')).toContain('asText');
            });

            it('should map date-time to OffsetDateTime', () => {
                const schema: JsonSchema2020 = { type: 'string', format: 'date-time' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'createdAt' });

                expect(result.javaType).toBe('OffsetDateTime');
                expect(result.imports).toContain('java.time.OffsetDateTime');
                expect(result.getterExpression('createdAt')).toContain('toOffsetDateTime');
            });

            it('should map uuid to UUID', () => {
                const schema: JsonSchema2020 = { type: 'string', format: 'uuid' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'id' });

                expect(result.javaType).toBe('UUID');
                expect(result.imports).toContain('java.util.UUID');
            });

            it('should map uri to URI', () => {
                const schema: JsonSchema2020 = { type: 'string', format: 'uri' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'link' });

                expect(result.javaType).toBe('URI');
                expect(result.imports).toContain('java.net.URI');
            });
        });

        describe('integer types', () => {
            it('should map plain integer to Long', () => {
                const schema: JsonSchema2020 = { type: 'integer' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'age' });

                expect(result.javaType).toBe('Long');
                expect(result.imports).toEqual([]);
            });

            it('should map int32 to Integer', () => {
                const schema: JsonSchema2020 = { type: 'integer', format: 'int32' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'size' });

                expect(result.javaType).toBe('Integer');
            });

            it('should map int64 to Long', () => {
                const schema: JsonSchema2020 = { type: 'integer', format: 'int64' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'count' });

                expect(result.javaType).toBe('Long');
            });
        });

        describe('number types', () => {
            it('should map plain number to BigDecimal', () => {
                const schema: JsonSchema2020 = { type: 'number' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'price' });

                expect(result.javaType).toBe('BigDecimal');
                expect(result.imports).toContain('java.math.BigDecimal');
            });

            it('should map float to Float', () => {
                const schema: JsonSchema2020 = { type: 'number', format: 'float' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'temperature' });

                expect(result.javaType).toBe('Float');
            });

            it('should map double to Double', () => {
                const schema: JsonSchema2020 = { type: 'number', format: 'double' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'weight' });

                expect(result.javaType).toBe('Double');
            });
        });

        describe('boolean types', () => {
            it('should map boolean to Boolean', () => {
                const schema: JsonSchema2020 = { type: 'boolean' };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'active' });

                expect(result.javaType).toBe('Boolean');
                expect(result.imports).toEqual([]);
            });
        });

        describe('array types', () => {
            it('should map array of strings to List<String>', () => {
                const schema: JsonSchema2020 = { 
                    type: 'array', 
                    items: { type: 'string' } 
                };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'tags' });

                expect(result.javaType).toBe('List<String>');
                expect(result.imports).toContain('java.util.List');
                expect(result.imports).toContain('java.util.ArrayList');
            });

            it('should map array of integers to List<Long>', () => {
                const schema: JsonSchema2020 = { 
                    type: 'array', 
                    items: { type: 'integer' } 
                };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'ids' });

                expect(result.javaType).toBe('List<Long>');
            });
        });

        describe('object types', () => {
            it('should map object to className based on title', () => {
                const schema: JsonSchema2020 = { 
                    type: 'object',
                    title: 'UserProfile'
                };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'profile' });

                expect(result.javaType).toBe('UserProfile');
                expect(result.imports).toContain('com.example.api.UserProfile');
            });
        });

        describe('enum types', () => {
            it('should map string enums to generated enum type', () => {
                const schema: JsonSchema2020 = { 
                    type: 'string',
                    enum: ['ACTIVE', 'INACTIVE', 'PENDING']
                };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'status' });

                expect(result.javaType).toBe('StatusEnum');
                expect(result.imports).toContain('com.example.api.StatusEnum');
            });

            it('should mark required properties as non-nullable', () => {
                const schema: JsonSchema2020 = { type: 'string' };
                const result = mapJsonSchemaToJavaType(schema, { 
                    propertyName: 'name',
                    isRequired: true 
                 });
            });

            it('should mark optional properties as nullable', () => {
                const schema: JsonSchema2020 = { type: 'string' };
                const result = mapJsonSchemaToJavaType(schema, { 
                    propertyName: 'name',
                    isRequired: false 
                });

                expect(result.nullable).toBe(true);
            });
        });

        describe('packageName setting', () => {
            it('should update package name for type mappings', () => {
                setPackageName('org.custom.api');
                
                const schema: JsonSchema2020 = { 
                    type: 'object',
                    title: 'TestModel'
                };
                const result = mapJsonSchemaToJavaType(schema, { propertyName: 'model' });

                expect(result.imports).toContain('org.custom.api.TestModel');
            });
        });
    });
});
