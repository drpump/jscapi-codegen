import dedent from 'dedent';
import { JsonSchema2020 } from '../../schema/jsonSchemaTypes';
import { mapJsonSchemaToJavaType, TypeMapping } from './typeMapper';
import { PropertyGetter } from './interfaceGenerator';

/**
 * Generate the implementation class for a schema interface.
 * The implementation is a nested static class in the same file as the interface.
 */
export function generateImplementationClass(
    schemaName: string,
    getters: PropertyGetter[]
): string {
    const propertyNames = new Set(getters.map(g => g.propertyName));

    return dedent`
    
         /**
          * Default implementation of ${schemaName} backed by JsonNode.
           * Thread-safe and immutable after construction.
           */
        static class ${schemaName}Impl implements ${schemaName} {

             ${Array.from(propertyNames).sort().map(name => `private static final String PROP_${toConstant(name)} = "${name}";`).join('\n             ')}

            private final com.fasterxml.jackson.databind.JsonNode jsonNode;

             ${schemaName}Impl(com.fasterxml.jackson.databind.JsonNode jsonNode) {
                this.jsonNode = java.util.Objects.requireNonNull(jsonNode, "jsonNode must not be null");
               }

             ${getters.map(getter => dedent`
                   @Override
                  public ${getter.typeMapping.javaType} get${capitalize(getter.javaName)}() {
                      ${generateGetterBody(getter)}
                    }
               `).join('\n\n                 ')}

             @Override
            public com.fasterxml.jackson.databind.JsonNode getRawNode() {
                return jsonNode;
               }

             @Override
            public boolean hasProperty(String propertyName) {
                JsonNode node = jsonNode.get(propertyName);
                return node != null && !node.isNull();
               }
           }
       `;
}

function generateGetterBody(getter: PropertyGetter): string {
    // Use the pre-generated expression from typeMapper
    return getter.typeMapping.getterExpression(getter.propertyName);
}

/**
 * Generate an implementation class for a oneOf option.
 * This class implements both the sealed base interface and its marker interface.
 */
export function generateOneOfImplementationClass(
    optionName: string,
    baseInterface: string,
    getters: PropertyGetter[]
): string {
    return dedent`
        
          /**
           * Implementation of ${optionName} backed by JsonNode.
            * Implements both ${baseInterface} and ${optionName}.
            */
          public final class ${optionName}Impl implements ${optionName}, ${baseInterface} {

              private final com.fasterxml.jackson.databind.JsonNode jsonNode;

               ${optionName}Impl(com.fasterxml.jackson.databind.JsonNode jsonNode) {
                  this.jsonNode = java.util.Objects.requireNonNull(jsonNode, "jsonNode must not be null");
                 }

               ${getters.map(getter => dedent`
                     @Override
                    public ${getter.typeMapping.javaType} get${capitalize(getter.javaName)}() {
                        ${generateGetterBody(getter)}
                      }
                 `).join('\n\n                 ')}

               @Override
              public com.fasterxml.jackson.databind.JsonNode getRawNode() {
                  return jsonNode;
                 }

           }
       `;
}

/**
 * Generate an implementation class for an anyOf composition.
 * Single class implements all option interfaces.
 */
export function generateAnyOfImplementationClass(
    schemaName: string,
    optionInterfaces: string[],
    gettersByOption: Map<string, PropertyGetter[]>
): string {
    const implementsList = [schemaName, ...optionInterfaces].join(', ');

    return dedent`
        
          public final class ${schemaName}Impl implements ${implementsList} {

              private final com.fasterxml.jackson.databind.JsonNode jsonNode;
              private final java.util.Set<String> satisfiedSchemas;

               ${schemaName}Impl(com.fasterxml.jackson.databind.JsonNode jsonNode, java.util.List<String> matchedIndices) {
                  this.jsonNode = java.util.Objects.requireNonNull(jsonNode, "jsonNode must not be null");
                  this.satisfiedSchemas = new java.util.HashSet<>(schemaNamesFromIndices(matchedIndices));
                 }

               ${Array.from(gettersByOption.entries()).map(([optionName, getters]) => {
                   if (getters.length === 0) return '';
                   return dedent`
                     
                     // ${optionName} getters
                      ${getters.map(getter => dedent`
                             @Override
                            public ${getter.typeMapping.javaType} get${capitalize(getter.javaName)}() {
                                ${generateGetterBody(getter)}
                              }
                        `).join('\n\n                          ')}
                   `;
                 }).join('\n\n               ')}

               @Override
              public java.util.List<String> getSatisfiedSchemas() {
                  return java.util.List.copyOf(satisfiedSchemas);
                 }

               ${optionInterfaces.map(optionName => dedent`
                   @Override
                  public java.util.Optional<${optionName}> as${capitalize(optionName)}() {
                      return satisfiedSchemas.contains("${optionName}") ? java.util.Optional.<${optionName}>this((${optionName}) this) : java.util.Optional.empty();
                     }
               `).join('\n\n               ')}

               @Override
              public com.fasterxml.jackson.databind.JsonNode getRawNode() {
                  return jsonNode;
                 }

           }
       `;
}

function toConstant(name: string): string {
    return name.replace(/([A-Z])/g, '_$1').toUpperCase();
}

function capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function schemaNamesFromIndices(indices: string[]): string[] {
    // Placeholder - will be replaced with actual logic
    return [];
}
