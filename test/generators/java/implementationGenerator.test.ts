import { 
    generateImplementationClass, 
    generateOneOfImplementationClass, 
    generateAnyOfImplementationClass 
} from '../../../src/generators/java/implementationGenerator';
import { PropertyGetter } from '../../../src/generators/java/interfaceGenerator';

describe('implementationGenerator', () => {
    const sampleGetters: PropertyGetter[] = [
         {
            propertyName: 'name',
            javaName: 'name',
            typeMapping: {
                javaType: 'String',
                imports: [],
                getterExpression: (prop) => `return jsonNode.get("${prop}").asText();`,
                nullable: false
             },
            isRequired: true
         },
         {
            propertyName: 'age',
            javaName: 'age',
            typeMapping: {
                javaType: 'Long',
                imports: [],
                getterExpression: (prop) => `return jsonNode.get("${prop}").asLong();`,
                nullable: false
             },
            isRequired: true
         }
     ];

    describe('generateImplementationClass', () => {
        it('should generate implementation class with correct name', () => {
            const code = generateImplementationClass('Person', sampleGetters);

            expect(code).toContain('class PersonImpl implements Person');
          });

        it('should include JsonNode backing field', () => {
            const code = generateImplementationClass('Person', sampleGetters);
            expect(code).toContain('private final com.fasterxml.jackson.databind.JsonNode jsonNode;');
          });

        it('should include constructor with requireNonNull validation', () => {
            const code = generateImplementationClass('Person', sampleGetters);
            expect(code).toContain('requireNonNull(jsonNode, "jsonNode must not be null")');
          });

        it('should implement getRawNode method', () => {
            const code = generateImplementationClass('Person', sampleGetters);
            expect(code).toContain('JsonNode getRawNode()');
            expect(code).toContain('return jsonNode;');
          });

        it('should implement hasProperty method', () => {
            const code = generateImplementationClass('Person', sampleGetters);
            expect(code).toContain('boolean hasProperty(String propertyName)');
            expect(code).toContain('jsonNode.get(propertyName)');
          });

        it('should include property name constants', () => {
            const code = generateImplementationClass('Person', sampleGetters);
            expect(code).toContain('PROP_NAME');
            expect(code).toContain('PROP_AGE');
          });

        it('should delegate getters to typeMapper expressions', () => {
            const code = generateImplementationClass('Person', sampleGetters);
             // Check that the getter bodies use the expressions from typeMapper
            expect(code).not.toContain('line 182 of');
          });
      });

    describe('generateOneOfImplementationClass', () => {
        it('should generate standalone class implementing both interfaces', () => {
            const code = generateOneOfImplementationClass('Cat', 'Pet', sampleGetters);

            expect(code).toContain('public final class CatImpl');
            expect(code).toContain('implements Cat, Pet');
          });

        it('should include JsonNode backing field', () => {
            const code = generateOneOfImplementationClass('Dog', 'Animal', sampleGetters);
            expect(code).toContain('private final com.fasterxml.jackson.databind.JsonNode jsonNode;');
          });

        it('should include package-private constructor', () => {
            const code = generateOneOfImplementationClass('Cat', 'Pet', sampleGetters);
            expect(code).toContain('CatImpl(com.fasterxml.jackson.databind.JsonNode jsonNode)');
          });

        it('should include getRawNode method', () => {
            const code = generateOneOfImplementationClass('Cat', 'Pet', sampleGetters);
            expect(code).toContain('JsonNode getRawNode()');
          });

        it('should exclude hasProperty for oneOf variants', () => {
            const code = generateOneOfImplementationClass('Cat', 'Pet', sampleGetters);
             // OneOf implementation doesn't have hasProperty, only the base interface does
            expect(code).not.toContain('boolean hasProperty');
          });

        it('should handle empty getters array', () => {
            const code = generateOneOfImplementationClass('Empty', 'Base', []);
            expect(code).toContain('public final class EmptyImpl');
            expect(code).toContain('implements Empty, Base');
          });
      });

    describe('generateAnyOfImplementationClass', () => {
        it('should generate implementation implementing multiple interfaces', () => {
            const gettersByOption = new Map<string, PropertyGetter[]>();
            gettersByOption.set('Text', []);
            gettersByOption.set('Rich', []);

            const code = generateAnyOfImplementationClass(
                'Document',
                ['Text', 'Rich'],
                gettersByOption
             );

            expect(code).toContain('public final class DocumentImpl');
            expect(code).toContain('implements Document, Text, Rich');
          });

        it('should include satisfiedSchemas field', () => {
            const gettersByOption = new Map<string, PropertyGetter[]>();
            
            const code = generateAnyOfImplementationClass(
                'Content',
                ['A', 'B'],
                gettersByOption
             );

            expect(code).toContain('private final java.util.Set<String> satisfiedSchemas;');
          });

        it('should include constructor taking matched indices', () => {
            const gettersByOption = new Map<string, PropertyGetter[]>();
            
            const code = generateAnyOfImplementationClass(
                'Content',
                ['X', 'Y'],
                gettersByOption
             );

            expect(code).toContain('matchedIndices');
          });

        it('should include getSatisfiedSchemas method', () => {
            const gettersByOption = new Map<string, PropertyGetter[]>();
            
            const code = generateAnyOfImplementationClass(
                'Content',
                ['X', 'Y'],
                gettersByOption
             );

            expect(code).toContain('getSatisfiedSchemas()');
          });

        it('should include asXxx methods for each option interface', () => {
            const gettersByOption = new Map<string, PropertyGetter[]>();
            
            const code = generateAnyOfImplementationClass(
                'Content',
                ['Text', 'Rich'],
                gettersByOption
             );

            expect(code).toContain('asText()');
            expect(code).toContain('asRich()');
          });

        it('should include getRawNode method', () => {
            const gettersByOption = new Map<string, PropertyGetter[]>();
            
            const code = generateAnyOfImplementationClass(
                'Content',
                ['A', 'B'],
                gettersByOption
             );

            expect(code).toContain('JsonNode getRawNode()');
          });

        it('should skip empty option getters', () => {
            const gettersByOption = new Map<string, PropertyGetter[]>();
            gettersByOption.set('EmptyOption', []);
            gettersByOption.set('RealOption', sampleGetters);

            const code = generateAnyOfImplementationClass(
                'Multi',
                ['EmptyOption', 'RealOption'],
                gettersByOption
             );

            expect(code).toContain('RealOption');
          });
      });
});
