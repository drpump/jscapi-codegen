import { 
    JsonSchema2020, 
    detectDialect, 
    OPENAPI_31_DIALECT, 
    JSON_SCHEMA_2020_DIALECT,
    SchemaDialect
} from '../../src/schema/jsonSchemaTypes';

describe('jsonSchemaTypes', () => {
    describe('detectDialect', () => {
        it('should detect OpenAPI 3.1 dialect', () => {
            const schema: any = {
                $schema: 'https://spec.openapis.org/draft/2020-12/schema'
            };

            const result = detectDialect(schema);
            expect(result).toBe(OPENAPI_31_DIALECT);
        });

        it('should detect JSON Schema 2020-12 dialect', () => {
            const schema: any = {
                $schema: 'https://json-schema.org/draft/2020-12/schema'
            };

            const result = detectDialect(schema);
            expect(result).toBe(JSON_SCHEMA_2020_DIALECT);
        });

        it('should return null for unrecognized dialect', () => {
            const schema: any = {
                $schema: 'https://json-schema.org/draft/2019-09/schema'
            };

            const result = detectDialect(schema);
            expect(result).toBeNull();
        });

        it('should return null for schema without $schema', () => {
            const schema: any = {
                type: 'object'
            };

            const result = detectDialect(schema);
            expect(result).toBeNull();
        });
    });

    describe('JsonSchema2020 interface', () => {
        it('should support $id property', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                $id: 'https://example.com/schema'
            };

            expect(schema.$id).toBe('https://example.com/schema');
        });

        it('should support $ref property', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                $ref: '#/definitions/Child'
            };

            expect(schema.$ref).toBe('#/definitions/Child');
        });

        it('should support properties object', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                }
            };

            expect(schema.properties).toBeDefined();
            expect(schema.properties?.name).toBeDefined();
        });

        it('should support allOf/oneOf/anyOf', () => {
            const schema: JsonSchema2020 = {
                oneOf: [
                    { type: 'string' },
                    { type: 'integer' }
                ],
                anyOf: [
                    { type: 'object' }
                ],
                allOf: [
                    { type: 'null' }
                ]
            };

            expect(schema.oneOf).toHaveLength(2);
            expect(schema.anyOf).toHaveLength(1);
            expect(schema.allOf).toHaveLength(1);
        });


        it('should support additionalProperties as object schema', () => {
            const schema: JsonSchema2020 = {
                type: 'object',
                additionalProperties: { type: 'string' }
             };

            expect(schema.additionalProperties).toBeDefined();
         });
      });
   });
