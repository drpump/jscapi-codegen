import { 
    analyzeComposition, 
    CompositionInfo,
    generateOptionName
} from '../../src/schema/compositionHandler';
import { JsonSchema2020 } from '../../src/schema/jsonSchemaTypes';
import { DiscriminatorStrategy, detectDiscriminatorStrategy } from '../../src/schema/discriminatorStrategy';

describe('compositionHandler', () => {
    describe('analyzeComposition', () => {
        it('should return null for non-composition schemas', () => {
            const schema: JsonSchema2020 = { type: 'object' };
            const result = analyzeComposition(schema, 'Test');
            
            expect(result).toBeNull();
          });

        it('should detect oneOf composition', () => {
            const schema: JsonSchema2020 = {
                oneOf: [
                    { type: 'object', properties: { name: { type: 'string' } } },
                    { type: 'object', properties: { age: { type: 'integer' } } }
                   ]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.type).toBe('oneOf');
            expect(result?.options).toHaveLength(2);
          });

        it('should detect anyOf composition', () => {
            const schema: JsonSchema2020 = {
                anyOf: [
                    { type: 'string' },
                    { type: 'integer' }
                   ]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.type).toBe('anyOf');
            expect(result?.options).toHaveLength(2);
          });

        it('should detect allOf composition', () => {
            const schema: JsonSchema2020 = {
                allOf: [
                    { type: 'object', properties: { id: { type: 'string' } } },
                    { type: 'object', properties: { name: { type: 'string' } } }
                   ]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.type).toBe('allOf');
            expect(result?.options).toHaveLength(2);
          });

        it('should prioritize oneOf over anyOf and allOf', () => {
            const schema: JsonSchema2020 = {
                oneOf: [{ type: 'object' }],
                anyOf: [{ type: 'string' }],
                allOf: [{ type: 'integer' }]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.type).toBe('oneOf');
          });

        it('should set structural-match for allOf', () => {
            const schema: JsonSchema2020 = {
                allOf: [{ type: 'object' }]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.discriminatorStrategy.type).toBe('structural-match');
          });
        });

    describe('option name generation', () => {
        it('should use title if present', () => {
            const schema: JsonSchema2020 = { 
                title: 'UserProfile',
                type: 'object' 
                 };
            
            const name = generateOptionName(schema, 'Parent', 0);
            expect(name).toBe('UserProfile');
          });

        it('should use $id basename if no title', () => {
            const schema: JsonSchema2020 = { 
                $id: 'https://example.com/schemas/user-profile.json',
                type: 'object' 
                 };
            
            const name = generateOptionName(schema, 'Parent', 0);
            expect(name).toBe('UserProfile');
          });

        it('should use fallback index-based naming', () => {
            const schema: JsonSchema2020 = { type: 'object' };
            
            const name = generateOptionName(schema, 'Base', 1);
            expect(name).toBe('BaseOption1');
          });
        });

    describe('DiscriminatorStrategy detection', () => {
        it('should detect explicit discriminator strategy', () => {
            const schema: any = {
                oneOf: [
                    { type: 'object', properties: { type: { const: 'A' } } },
                    { type: 'object', properties: { type: { const: 'B' } } }
                   ],
                discriminator: { propertyName: 'type' }
                 };

            const options = [
                { index: 0, name: 'OptionA', schema: schema.oneOf[0] },
                { index: 1, name: 'OptionB', schema: schema.oneOf[1] }
               ];

            const result = detectDiscriminatorStrategy(schema, options);
            
            expect(result.type).toBe('explicit');
          });

        it('should fallback to structural-match when no discriminator', () => {
            const schema: JsonSchema2020 = {
                oneOf: [
                    { type: 'object' },
                    { type: 'object' }
                   ]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.discriminatorStrategy.type).toBe('structural-match');
          });
        });

    describe('options array building', () => {
        it('should include correct index for each option', () => {
            const schema: JsonSchema2020 = {
                oneOf: [
                    { type: 'object' },
                    { type: 'string' },
                    { type: 'integer' }
                   ]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.options[0].index).toBe(0);
            expect(result?.options[1].index).toBe(1);
            expect(result?.options[2].index).toBe(2);
          });

        it('should preserve schema reference in each option', () => {
            const expectedSchema: JsonSchema2020 = { 
                type: 'object', 
                properties: { name: { type: 'string' } } 
               };
            const schema: JsonSchema2020 = {
                oneOf: [expectedSchema]
                 };

            const result = analyzeComposition(schema, 'Test');
            
            expect(result?.options[0].schema).toBe(expectedSchema);
          });
        });
    });

describe('discriminatorStrategy', () => {
    it('should detect OpenAPI 3.1 discriminator with propertyName', () => {
        const schema: any = {
            oneOf: [
                 { type: 'object', title: 'TypeA' },
                 { type: 'object', title: 'TypeB' }
               ],
            discriminator: { 
                propertyName: 'category',
                mapping: { a: '#/definitions/TypeA' }
               }
             };

        const result = detectDiscriminatorStrategy(schema, []);
        expect(result.type).toBe('explicit');
        if (result.type === 'explicit') {
            expect(result.propertyName).toBe('category');
        }
    });

    it('should detect structural match with const values', () => {
        const schema: JsonSchema2020 = {
            oneOf: [
                 { type: 'object', properties: { kind: { const: 'A' } } },
                 { type: 'object', properties: { kind: { const: 'B' } } }
               ]
             };

        const result = detectDiscriminatorStrategy(schema, []);
         expect(result.type).toBe('structural-match');
    });

    it('should fallback to index-based when no discriminator found', () => {
        const schema: JsonSchema2020 = {
            oneOf: [
                 { type: 'object' },
                 { type: 'string' }
               ]
             };

         const result = detectDiscriminatorStrategy(schema, []);
          expect(result.type).toBe('structural-match');
    });
});
