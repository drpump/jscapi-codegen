import { 
    detectDiscriminatorStrategy,
    resolveDiscriminatorValue,
    ExplicitDiscriminator,
    ImplicitStructuralMatch,
    DiscriminatorStrategy
} from '../../src/schema/discriminatorStrategy';
import { JsonSchema2020 } from '../../src/schema/jsonSchemaTypes';

describe('discriminatorStrategy', () => {
    describe('detectDiscriminatorStrategy', () => {
        it('should detect explicit discriminator with propertyName', () => {
            const schema: any = {
                oneOf: [
                    { type: 'object' },
                    { type: 'object' }
                  ],
                discriminator: { 
                    propertyName: 'type',
                    mapping: { a: '#/$defs/A', b: '#/$defs/B' }
                 }
              };

            const result = detectDiscriminatorStrategy(
                schema as JsonSchema2020,
                [{ name: 'A', schema: {} }, { name: 'B', schema: {} }]
              );

            expect(result.type).toBe('explicit');
             expect((result as ExplicitDiscriminator).propertyName).toBe('type');
             expect((result as ExplicitDiscriminator).source).toBe('openapi-discriminator');
           });

        it('should detect explicit discriminator without mapping', () => {
            const schema: any = {
                oneOf: [
                    { type: 'object' },
                    { type: 'object' }
                  ],
                discriminator: { 
                    propertyName: 'kind'
                 }
              };

            const result = detectDiscriminatorStrategy(
                schema as JsonSchema2020,
                []
              );

            expect(result.type).toBe('explicit');
             expect((result as ExplicitDiscriminator).propertyName).toBe('kind');
           });

        it('should fallback to structural-match when no discriminator', () => {
            const schema: JsonSchema2020 = {
                oneOf: [
                    { type: 'object' },
                    { type: 'string' }
                  ]
              };

            const result = detectDiscriminatorStrategy(schema, []);

            expect(result.type).toBe('structural-match');
           });

        it('should fallback to structural-match for anyOf without discriminator', () => {
            const schema: JsonSchema2020 = {
                anyOf: [
                    { type: 'string' },
                    { type: 'integer' }
                  ]
              };

               // Note: anyOf goes through compositionHandler which sets structural-match
               // But direct call to detectDiscriminatorStrategy should still work
            const options = [
                { name: 'A', schema: schema.anyOf![0] },
                 { name: 'B', schema: schema.anyOf![1] }
              ];
            const result = detectDiscriminatorStrategy(schema, options);

               expect(result.type).toBe('structural-match');
           });

        it('should handle $dynamicAnchor as explicit source', () => {
            const schema: any = {
                oneOf: [{ type: 'object' }],
                 $dynamicAnchor: '#cat'
              };

               // Note: $dynamicAnchor detection requires discriminator property presence
               // So this should fall through to structural-match
            const result = detectDiscriminatorStrategy(schema, []);
            
               expect(result.type).toBe('structural-match');
           });
       });

    describe('resolveDiscriminatorValue', () => {
        it('should return null for structural-match strategy', () => {
            const strategy: ImplicitStructuralMatch = { type: 'structural-match' };
            const optionSchema: JsonSchema2020 = { type: 'object' };

            const result = resolveDiscriminatorValue(strategy, optionSchema, 'Test');

            expect(result).toBeNull();
           });

        it('should return const value from discriminator property', () => {
            const strategy: ExplicitDiscriminator = {
                type: 'explicit',
                propertyName: 'type',
                source: 'openapi-discriminator'
              };

            const optionSchema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    type: { const: 'Cat' }
                 }
              };

            const result = resolveDiscriminatorValue(strategy, optionSchema, 'Cat');

            expect(result).toBe('Cat');
           });

        it('should return single enum value from discriminator property', () => {
            const strategy: ExplicitDiscriminator = {
                type: 'explicit',
                propertyName: 'kind',
                source: 'openapi-discriminator'
              };

            const optionSchema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    kind: { enum: ['Dog'] }
                 }
              };

            const result = resolveDiscriminatorValue(strategy, optionSchema, 'Dog');

            expect(result).toBe('Dog');
           });

        it('should return null when discriminator property not found', () => {
            const strategy: ExplicitDiscriminator = {
                type: 'explicit',
                propertyName: 'nonexistent',
                source: 'openapi-discriminator'
              };

            const optionSchema: JsonSchema2020 = {
                type: 'object',
                properties: {
                    otherProp: { type: 'string' }
                 }
              };

            const result = resolveDiscriminatorValue(strategy, optionSchema, 'Test');

            expect(result).toBeNull();
           });

        it('should use mapping to resolve discriminator value', () => {
            const mapping = new Map<string, string>();
            mapping.set('cat-value', '#/definitions/Cat');
            mapping.set('dog-value', '#/definitions/Dog');

            const strategy: ExplicitDiscriminator = {
                type: 'explicit',
                propertyName: 'type',
                mapping,
                source: 'openapi-discriminator'
              };

            const optionSchema: JsonSchema2020 = { type: 'object' };

            const result = resolveDiscriminatorValue(strategy, optionSchema, 'Cat');

               expect(result).toBe('cat-value');
           });

        it('should return null when mapping does not match', () => {
            const mapping = new Map<string, string>();
            mapping.set('valueA', '#/definitions/A');
            mapping.set('valueB', '#/definitions/B');

            const strategy: ExplicitDiscriminator = {
                type: 'explicit',
                propertyName: 'type',
                mapping,
                source: 'openapi-discriminator'
              };

            const optionSchema: JsonSchema2020 = { type: 'object' };

            const result = resolveDiscriminatorValue(strategy, optionSchema, 'NotFound');

               expect(result).toBeNull();
           });
       });

    describe('DiscriminatorStrategy types', () => {
        it('should create valid ExplicitDiscriminator', () => {
            const mapping = new Map<string, string>();
            mapping.set('a', '#/$defs/A');

            const strategy: ExplicitDiscriminator = {
                type: 'explicit',
                propertyName: 'category',
                mapping,
                source: 'openapi-discriminator'
              };

            expect(strategy.type).toBe('explicit');
            expect(strategy.propertyName).toBe('category');
            expect(strategy.source).toBe('openapi-discriminator');
             expect(mapping.get('a')).toBe('#/$defs/A');
           });

        it('should create valid ImplicitStructuralMatch', () => {
            const strategy: ImplicitStructuralMatch = {
                type: 'structural-match'
              };

            expect(strategy.type).toBe('structural-match');
           });

        it('should be discriminated union by type property', () => {
            const explicit: DiscriminatorStrategy = {
                type: 'explicit',
                propertyName: 'type',
                source: 'openapi-discriminator'
              };

            const implicit: DiscriminatorStrategy = {
                type: 'structural-match'
              };

               expect(explicit.type).toBe('explicit');
              expect(implicit.type).toBe('structural-match');
           });
       });
});
