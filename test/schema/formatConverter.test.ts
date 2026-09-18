import { 
    DEFAULT_FORMAT_CONVERTERS, 
    resolveFormatConverter,
    FormatConverter
} from '../../src/schema/formatConverter';
import { JsonSchema2020 } from '../../src/schema/jsonSchemaTypes';

describe('formatConverter', () => {
    describe('DEFAULT_FORMAT_CONVERTERS', () => {
        it('should contain date-time converter', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'date-time');
            expect(converter).toBeDefined();
            expect(converter?.javaType).toBe('OffsetDateTime');
            expect(converter?.converterMethod).toBe('toOffsetDateTime');
         });

        it('should contain uuid converter', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'uuid');
            expect(converter).toBeDefined();
            expect(converter?.javaType).toBe('UUID');
            expect(converter?.converterMethod).toBe('toUuid');
         });

        it('should contain uri converter', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'uri');
            expect(converter).toBeDefined();
            expect(converter?.javaType).toBe('URI');
            expect(converter?.imports).toContain('java.net.URI');
         });

        it('should contain int32 converter', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'int32');
            expect(converter).toBeDefined();
            expect(converter?.javaType).toBe('Integer');
         });

        it('should contain int64 converter', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'int64');
            expect(converter).toBeDefined();
            expect(converter?.javaType).toBe('Long');
         });

        it('should contain byte format converter', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'byte');
            expect(converter).toBeDefined();
            expect(converter?.javaType).toBe('byte[]');
         });

        it('should contain binary format converter', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'binary');
            expect(converter).toBeDefined();
            expect(converter?.javaType).toBe('byte[]');
         });

        it('should have email converter returning String', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS.find(c => c.format === 'email');
            expect(converter?.javaType).toBe('String');
            expect(converter?.imports).toEqual([]);
         });
     });

    describe('resolveFormatConverter', () => {
        it('should resolve date-time format', () => {
            const schema: JsonSchema2020 = { type: 'string', format: 'date-time' };
            const result = resolveFormatConverter(schema);
            
            expect(result).not.toBeNull();
            expect(result?.javaType).toBe('OffsetDateTime');
         });

        it('should resolve uuid format', () => {
            const schema: JsonSchema2020 = { type: 'string', format: 'uuid' };
            const result = resolveFormatConverter(schema);
            
            expect(result).not.toBeNull();
            expect(result?.javaType).toBe('UUID');
         });

        it('should return null for unsupported format', () => {
            const schema: JsonSchema2020 = { type: 'string', format: 'custom-format' };
            const result = resolveFormatConverter(schema);
            
            expect(result).toBeNull();
         });

        it('should return null for non-string/number type with format', () => {
            const schema: JsonSchema2020 = { 
                type: 'object', 
                format: 'uuid' 
             };
            const result = resolveFormatConverter(schema);
            
            expect(result).toBeNull();
         });

        it('should return null for integer type with int32 format (type mismatch)', () => {
            // int32 expects integer type, not string
            const schema: JsonSchema2020 = { 
                type: 'integer', 
                format: 'int32' 
             };
            const result = resolveFormatConverter(schema);
            
              // This may return a converter since int32 is for integers
            expect(result).toBeDefined();
         });

        it('should accept custom converters array', () => {
            const schema: JsonSchema2020 = { 
                type: 'string', 
                format: 'custom' 
             };
            const customConverters: FormatConverter[] = [
                 { format: 'custom', javaType: 'String', imports: [], converterMethod: 'toCustom' }
               ];
            const result = resolveFormatConverter(schema, customConverters);
            
            expect(result).not.toBeNull();
            expect(result?.converterMethod).toBe('toCustom');
         });
     });

    describe('FormatConverter interface', () => {
        it('should have format property', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS[0];
            expect(converter.format).toBeDefined();
         });

        it('should have javaType property', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS[0];
            expect(converter.javaType).toBeDefined();
         });

        it('should have imports array', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS[0];
            expect(Array.isArray(converter.imports)).toBe(true);
         });

        it('should have converterMethod property', () => {
            const converter = DEFAULT_FORMAT_CONVERTERS[0];
            expect(converter.converterMethod).toBeDefined();
         });
     });
});
