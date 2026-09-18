import { JsonSchema2020 } from './jsonSchemaTypes';

/**
 * Defines a format converter for string/number properties.
 * Extensible via configuration or custom converters.
 */
export interface FormatConverter {
      /** The JSON Schema format value (e.g., "date-time", "uuid") */
    readonly format: string;
     
      /** The Java type to use */
    readonly javaType: string;
     
      /** Required imports for the Java type */
    readonly imports: string[];
     
      /** Conversion method name from JsonNodeConverters utility */
    readonly converterMethod: string;
}

/**
 * Built-in format converters.
 * Extensible - add custom converters via generator options.
 */
export const DEFAULT_FORMAT_CONVERTERS: FormatConverter[] = [
    {
        format: 'date-time',
        javaType: 'OffsetDateTime',
        imports: ['java.time.OffsetDateTime'],
        converterMethod: 'toOffsetDateTime'
     },
    {
        format: 'date',
        javaType: 'LocalDate',
        imports: ['java.time.LocalDate'],
        converterMethod: 'toLocalDate'
     },
    {
        format: 'time',
        javaType: 'LocalTime',
        imports: ['java.time.LocalTime'],
        converterMethod: 'toLocalTime'
     },
    {
        format: 'duration',
        javaType: 'Duration',
        imports: ['java.time.Duration'],
        converterMethod: 'toDuration'
     },
    {
        format: 'email',
        javaType: 'String',
        imports: [],
        converterMethod: 'asString'
     },
    {
        format: 'hostname',
        javaType: 'String',
        imports: [],
        converterMethod: 'asString'
     },
    {
        format: 'uri',
        javaType: 'URI',
        imports: ['java.net.URI'],
        converterMethod: 'toUri'
     },
    {
        format: 'uuid',
        javaType: 'UUID',
        imports: ['java.util.UUID'],
        converterMethod: 'toUuid'
     },
    {
        format: 'int32',
        javaType: 'Integer',
        imports: [],
        converterMethod: 'toInt'
     },
    {
        format: 'int64',
        javaType: 'Long',
        imports: [],
        converterMethod: 'toLong'
     },
    {
        format: 'float',
        javaType: 'Float',
        imports: [],
        converterMethod: 'toFloat'
     },
    {
        format: 'double',
        javaType: 'Double',
        imports: [],
        converterMethod: 'toDouble'
     },
    {
        format: 'byte',      // base64 encoded data
        javaType: 'byte[]',
        imports: ['java.util.Base64'],
        converterMethod: 'toBase64Bytes'
     },
    {
        format: 'binary',
        javaType: 'byte[]',
        imports: [],
        converterMethod: 'toBinaryBytes'
     }
];

/**
 * Resolve a format converter for a given schema.
 */
export function resolveFormatConverter(
    schema: JsonSchema2020,
    customConverters?: FormatConverter[]
): FormatConverter | null {
      
    if (schema.type !== 'string' && schema.type !== 'integer' && schema.type !== 'number') {
        return null;
      }
    if (!schema.format) return null;
     
      // Check custom converters first
    if (customConverters) {
        const custom = customConverters.find(c => c.format === schema.format);
        if (custom) return custom;
       }
      
      // Fall back to built-in converters
    return DEFAULT_FORMAT_CONVERTERS.find(c => c.format === schema.format) || null;
}
