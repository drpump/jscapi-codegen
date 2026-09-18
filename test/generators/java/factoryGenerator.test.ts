import { generateFactoryClass } from '../../src/generators/java/factoryGenerator';
import { CompositionInfo } from '../../src/schema/compositionHandler';

describe('factoryGenerator', () => {
    describe('generateFactoryClass (simple)', () => {
        it('should generate simple factory without composition', () => {
            const code = generateFactoryClass('Person');

            expect(code).toContain('public class PersonFactory');
            expect(code).toContain('SchemaRegistry.get("Person")');
           });

        it('should include fromJsonNode method', () => {
            const code = generateFactoryClass('Person');
            expect(code).toContain('fromJsonNode(JsonNode jsonNode)');
           });

        it('should include fromJson method', () => {
            const code = generateFactoryClass('Person');
            expect(code).toContain('fromJson(String jsonString)');
           });

        it('should include package placeholder', () => {
            const code = generateFactoryClass('Test');
            expect(code).toContain('package PACKAGE_PLACEHOLDER;');
           });

        it('should use JsonSchema validation', () => {
            const code = generateFactoryClass('Person');
            expect(code).toContain('com.networknt.schema.JsonSchema');
            expect(code).toContain('SCHEMA.validate(jsonNode, com.networknt.schema.InputFormat.JSON)');
           });

        it('should throw ValidationException on invalid JSON', () => {
            const code = generateFactoryClass('Person');
            expect(code).toContain('ValidationException');
           });
       });

    describe('generateFactoryClass (composition)', () => {
        const sampleOneOfComposition: CompositionInfo = {
            type: 'oneOf',
            options: [
                { index: 0, name: 'OptionA', schema: { type: 'object' } },
                { index: 1, name: 'OptionB', schema: { type: 'object' } }
              ],
            discriminatorStrategy: { type: 'structural-match' }
         };

        const sampleAnyOfComposition: CompositionInfo = {
            type: 'anyOf',
            options: [
                { index: 0, name: 'VariantA', schema: { type: 'object' } },
                { index: 1, name: 'VariantB', schema: { type: 'object' } }
              ],
            discriminatorStrategy: { type: 'structural-match' }
         };

        const sampleAllOfComposition: CompositionInfo = {
            type: 'allOf',
            options: [
                { index: 0, name: 'Base', schema: { type: 'object' } },
                { index: 1, name: 'Extension', schema: { type: 'object' } }
              ],
            discriminatorStrategy: { type: 'structural-match' }
         };

        it('should delegate to oneOf factory when composition type is oneOf', () => {
            const code = generateFactoryClass('Union', true, sampleOneOfComposition);

            expect(code).toContain('oneOf');
            expect(code).toContain('CompositionValidator');
            expect(code).toContain('validateOneOf');
           });

        it('should include lenient factory for oneOf compositions', () => {
            const code = generateFactoryClass('Union', true, sampleOneOfComposition);
            
            expect(code).toContain('fromJsonNodeLenient');
            expect(code).toContain('WARNING: JSON does not match any oneOf schema');
           });

        it('should delegate to anyOf factory when composition type is anyOf', () => {
            const code = generateFactoryClass('Multi', true, sampleAnyOfComposition);

            expect(code).toContain('anyOf');
            expect(code).toContain('validateAnyOf');
           });

        it('should include matchedOptionIndices for anyOf', () => {
            const code = generateFactoryClass('Multi', true, sampleAnyOfComposition);
            
            expect(code).toContain('matchedOptionIndices');
           });

        it('should delegate to allOf factory when composition type is allOf', () => {
            const code = generateFactoryClass('Combined', true, sampleAllOfComposition);

            expect(code).toContain('allOf');
           });

        it('should include option schemas for oneOf', () => {
            const code = generateFactoryClass('Union', true, sampleOneOfComposition);
            
            expect(code).toContain('OPTION_0_SCHEMA');
            expect(code).toContain('OPTION_1_SCHEMA');
           });

        it('should include switch cases for oneOf options', () => {
            const code = generateFactoryClass('Union', true, sampleOneOfComposition);
            
            expect(code).toContain('case 0');
            expect(code).toContain('case 1');
           });

        it('should handle empty options array', () => {
            const emptyComposition: CompositionInfo = {
                type: 'oneOf',
                options: [],
                discriminatorStrategy: { type: 'structural-match' }
              };

            const code = generateFactoryClass('Empty', true, emptyComposition);
            expect(code).not.toBeNull();
           });
       });

    describe('template structure', () => {
        it('should include generated header comment', () => {
            const code = generateFactoryClass('Test');
            expect(code).toContain('Generated by schema-driven-generator');
           });

        it('should include all necessary imports', () => {
            const code = generateFactoryClass('Person');
            
            expect(code).toContain('import com.fasterxml.jackson.databind.JsonNode;');
            expect(code).toContain('import com.networknt.schema.JsonSchema;');
            expect(code).toContain('import com.networknt.schema.ValidationMessage;');
           });

        it('should be valid Java class structure', () => {
            const code = generateFactoryClass('Person');
            
            expect(code).toContain('public class PersonFactory {');
            expect(code).toContain('}'); // closing brace
           });
       });
});
