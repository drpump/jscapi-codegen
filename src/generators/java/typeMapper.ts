import { JsonSchema2020 } from '../../schema/jsonSchemaTypes';
import { resolveFormatConverter, FormatConverter } from '../../schema/formatConverter';

/**
 * Context for type mapping decisions.
 */
export interface TypeMappingContext {
    propertyName?: string;
    schemaName?: string;
    isRequired?: boolean;
}

/**
 * Result of mapping a JSON Schema type to Java.
 */
export interface TypeMapping {
    /** The Java type name (e.g., "BigDecimal", "List<String>") */
    javaType: string;

    /** Required imports for this type */
    imports: string[];

    /** How to convert from JsonNode in the getter implementation */
    getterExpression: (propertyName: string) => string;

    /** Whether this type needs null handling in getters */
    nullable: boolean;
}

/**
 * Map a JSON Schema type to a Java type.
 * Numbers map to BigDecimal to preserve precision.
 */
export function mapJsonSchemaToJavaType(
    schema: JsonSchema2020,
    context: TypeMappingContext = {}
): TypeMapping {

    // Handle enum as Java enum
    if (schema.enum) {
        return mapEnumType(schema, context);
     }

    switch (schema.type) {
        case 'integer':
            return {
                javaType: 'Long',
                imports: [],
                getterExpression: (prop) => generateGetterForPrimitive(prop, 'asLong'),
                nullable: !context.isRequired
             };

        case 'number':
            // Use BigDecimal to preserve precision (important for financial data, etc.)
            return {
                javaType: 'BigDecimal',
                imports: ['java.math.BigDecimal'],
                getterExpression: (prop) => `
                    JsonNode node = jsonNode.get("${prop}");
                    if (node == null || node.isNull()) return ${!context.isRequired ? 'null' : 'BigDecimal.ZERO'};
                    return new BigDecimal(node.decimalValue());
                `.trim(),
                nullable: !context.isRequired
             };

        case 'string':
            return mapStringType(schema, context);

        case 'boolean':
            return {
                javaType: 'Boolean',
                imports: [],
                getterExpression: (prop) => generateGetterForPrimitive(prop, 'asBoolean'),
                nullable: !context.isRequired
             };

        case 'array':
            return mapArrayType(schema, context);

        case 'object':
            return mapObjectType(schema, context);

        default:
            // Unknown or null type - return as raw JsonNode
            return {
                javaType: 'JsonNode',
                imports: ['com.fasterxml.jackson.databind.JsonNode'],
                getterExpression: (prop) => `return jsonNode.get("${prop}");`,
                nullable: true
             };
    }
}

function mapStringType(schema: JsonSchema2020, context: TypeMappingContext): TypeMapping {
    // Check for format converters
    const formatConverter = resolveFormatConverter(schema);

    if (formatConverter) {
        return {
            javaType: formatConverter.javaType,
            imports: formatConverter.imports,
            getterExpression: (prop) => `return JsonNodeConverters.${formatConverter.converterMethod}(jsonNode.get("${prop}"));`,
            nullable: !context.isRequired
         };
     }

    // Plain string
    return {
        javaType: 'String',
        imports: [],
        getterExpression: (prop) => generateGetterForPrimitive(prop, 'asText'),
        nullable: !context.isRequired
     };
}

function mapArrayType(schema: JsonSchema2020, context: TypeMappingContext): TypeMapping {
    const items = schema.items as JsonSchema2020 || {};
    const itemType = mapJsonSchemaToJavaType(items, { ...context, isRequired: true });

    return {
        javaType: `List<${itemType.javaType}>`,
        imports: ['java.util.List', 'java.util.ArrayList', ...itemType.imports],
        getterExpression: (prop) => generateArrayGetter(prop, itemType),
        nullable: !context.isRequired
     };
}

function generateArrayGetter(propertyName: string, itemType: TypeMapping): string {
    return `
        JsonNode node = jsonNode.get("${propertyName}");
        if (node == null || !node.isArray()) {
            return ${!itemType.nullable ? 'List.of()' : 'null'};
         }
        List<${itemType.javaType}> result = new ArrayList<>();
        for (JsonNode item : node) {
            result.add(${generateItemConversion(itemType)});
         }
        return result;
    `.trim();
}

function generateItemConversion(itemType: TypeMapping): string {
    if (itemType.javaType === 'String' || itemType.javaType === 'Boolean') {
        return `item.isValueNode() ? ${getConversionCall(itemType)} : null`;
     }

    // For nested objects, create wrapper
    if (itemType.imports.some(i => !i.startsWith('java.'))) {
        return `new ${extractClassName(itemType.javaType)}Impl(item)`;
     }

    return getConversionCall(itemType);
}

function getConversionCall(itemType: TypeMapping): string {
    if (itemType.javaType === 'BigDecimal') {
        return 'new BigDecimal(item.decimalValue())';
     }

    // Check for format converter
    const formatConverter = resolveFormatConverter({
        type: itemType.javaType === 'String' ? 'string' : undefined
    } as JsonSchema2020);

    if (formatConverter) {
        return `JsonNodeConverters.${formatConverter.converterMethod}(item)`;
     }

    return `item.isValueNode() ? ${primitiveConversion(itemType.javaType)} : null`;
}

function primitiveConversion(javaType: string): string {
    switch (javaType) {
        case 'Integer': return 'item.asInt()';
        case 'Long': return 'item.asLong()';
        case 'Double': return 'item.asDouble()';
        case 'Float': return 'item.floatValue()';
        case 'String': return 'item.asText()';
        case 'Boolean': return 'item.asBoolean()';
        default: return 'item';
    }
}

function mapObjectType(schema: JsonSchema2020, context: TypeMappingContext): TypeMapping {
    // Use schema name or property name as the type name
    const typeName = schema.title || context.schemaName || context.propertyName || 'JsonObject';
    const capitalized = capitalize(typeName);

    return {
        javaType: capitalized,
        imports: [`${PACKAGE_NAME}.${capitalized}`],
        getterExpression: (prop) => `
            JsonNode node = jsonNode.get("${prop}");
            if (node == null || node.isNull()) return ${context.isRequired ? `throw new IllegalStateException("Required property '${prop}' is missing")` : 'null'};
            return new ${capitalized}Impl(node);
        `.trim(),
        nullable: !context.isRequired
     };
}

function mapEnumType(schema: JsonSchema2020, context: TypeMappingContext): TypeMapping {
    const enumName = `${capitalize(context.schemaName || context.propertyName || 'Enum')}Enum`;
    const values = schema.enum as (string | number)[];

    // Return mapping that references the generated enum
    return {
        javaType: enumName,
        imports: [`${PACKAGE_NAME}.${enumName}`],
        getterExpression: (prop) => `
            JsonNode node = jsonNode.get("${prop}");
            if (node == null || node.isNull()) return ${context.isRequired ? `throw new IllegalStateException("Required property '${prop}' is missing")` : 'null'};
            try {
                return ${enumName}.fromValue(${schema.type === 'string' ? 'node.asText()' : 'node.asDouble()'});
             } catch (IllegalArgumentException e) {
                throw new ValidationException("Invalid enum value: " + node, e);
             }
        `.trim(),
        nullable: !context.isRequired
     };
}

// Placeholder - will be set by the generator
let PACKAGE_NAME = 'com.example.api';
export function setPackageName(name: string): void {
    PACKAGE_NAME = name;
}

function capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractClassName(typeName: string): string {
    // Extract simple class name from generic type
    const match = typeName.match(/^\w+/);
    return match ? match[0] : 'Object';
}

function generateGetterForPrimitive(propertyName: string, conversionMethod: string): string {
    return `
        JsonNode node = jsonNode.get("${propertyName}");
        if (node == null || node.isNull()) return null;
        return node.${conversionMethod}();
    `.trim();
}
