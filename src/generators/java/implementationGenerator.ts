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
    packageName: string,
    getters: PropertyGetter[],
    baseClass?: string
): string {
    const propertyNames = new Set(getters.map(g => g.propertyName));

    // Collect imports from getters
    const imports = collectImports(getters, packageName);
    const importBlock = imports.size > 0 
           ? Array.from(imports).sort().map(imp => 'import ' + imp).join('\n') + '\n' : '';

    return dedent`
    
         /**
          * Default implementation of ${schemaName} backed by JsonNode.
           * Thread-safe and immutable after construction.
           */
        package ${packageName};

        ${importBlock}public class ${schemaName}Impl${baseClass ? ` extends ${baseClass}` : ''} implements ${schemaName} {

             ${Array.from(propertyNames).sort().map(name => `private static final String PROP_${toConstant(name)} = "${name}";`).join('\n             ')}

            private final com.fasterxml.jackson.databind.JsonNode jsonNode;

             ${schemaName}Impl(com.fasterxml.jackson.databind.JsonNode jsonNode) {
                ${baseClass ? 'super(jsonNode);' : ''}
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
                com.fasterxml.jackson.databind.JsonNode node = jsonNode.get(propertyName);
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
    packageName: string,
    getters: PropertyGetter[]
): string {
    const imports = collectImports(getters, packageName);
    const importBlock = imports.size > 0 
           ? Array.from(imports).sort().map(imp => 'import ' + imp).join('\n') + '\n' : '';

    return dedent`
    
          /**
           * Implementation of ${optionName} backed by JsonNode.
            * Implements both ${baseInterface} and ${optionName}.
            */
          package ${packageName};

          ${importBlock}public final class ${optionName}Impl implements ${optionName}, ${baseInterface} {

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
    packageName: string,
    optionInterfaces: string[],
    gettersByOption: Map<string, PropertyGetter[]>,
    baseClass?: string
): string {
    const implementsList = [schemaName, ...optionInterfaces].join(', ');

    const gettersByName = new Map<string, PropertyGetter>();
    gettersByOption.forEach(getters => {
        getters.forEach(getter => {
            if (!gettersByName.has(getter.javaName)) {
                gettersByName.set(getter.javaName, getter);
            }
        });
    });
    const getters = Array.from(gettersByName.values());
    const imports = collectImports(getters, packageName);
    const importBlock = imports.size > 0 
           ? Array.from(imports).sort().map(imp => 'import ' + imp).join('\n') + '\n' : '';

    return dedent`
          package ${packageName};

          ${importBlock}public final class ${schemaName}Impl${baseClass ? ` extends ${baseClass}` : ''} implements ${implementsList} {

              private final com.fasterxml.jackson.databind.JsonNode jsonNode;
              private final java.util.Set<String> satisfiedSchemas;

               ${schemaName}Impl(com.fasterxml.jackson.databind.JsonNode jsonNode, java.util.List<String> matchedIndices) {
                  ${baseClass ? 'super(jsonNode);' : ''}
                  this.jsonNode = java.util.Objects.requireNonNull(jsonNode, "jsonNode must not be null");
                  this.satisfiedSchemas = new java.util.HashSet<>(matchedIndices);
                 }

               ${getters.map(getter => dedent`
                   @Override
                  public ${getter.typeMapping.javaType} get${capitalize(getter.javaName)}() {
                      ${generateGetterBody(getter)}
                    }
               `).join('\n\n               ')}

               ${optionInterfaces.map(optionName => dedent`
                   @Override
                  public java.util.Optional<${optionName}> as${capitalize(optionName)}() {
                      return satisfiedSchemas.contains("${optionName}") ? java.util.Optional.of((${optionName}) this) : java.util.Optional.empty();
                     }

                   @Override
                  public boolean is${capitalize(optionName)}() {
                      return satisfiedSchemas.contains("${optionName}");
                     }
               `).join('\n\n               ')}

               public java.util.List<String> getSatisfiedSchemas() {
                  return java.util.List.copyOf(satisfiedSchemas);
                 }

               @Override
              public com.fasterxml.jackson.databind.JsonNode getRawNode() {
                  return jsonNode;
                 }

               @Override
              public boolean hasProperty(String propertyName) {
                  com.fasterxml.jackson.databind.JsonNode node = jsonNode.get(propertyName);
                  return node != null && !node.isNull();
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

function collectImports(getters: PropertyGetter[], packageName: string): Set<string> {
    const imports = new Set<string>();
    for (const getter of getters) {
        for (const imp of getter.typeMapping.imports) {
            if (imp) {
                imports.add(imp + ';');
            }
        }
    }
    // Always add JsonNode import for implementation classes
    imports.add('com.fasterxml.jackson.databind.JsonNode;');
    // Add JsonNodeConverters import (assumed to be in the same package)
    imports.add(`${packageName}.JsonNodeConverters;`);
    return imports;
}
