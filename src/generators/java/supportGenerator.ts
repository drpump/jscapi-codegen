import dedent from 'dedent';

export function generateJavaSupportFiles(packageName: string): Map<string, string> {
  return new Map([
    ['SchemaRegistry', generateSchemaRegistry(packageName)],
    ['CompositionValidator', generateCompositionValidator(packageName)],
    ['AnyOfMatchResult', generateAnyOfMatchResult(packageName)],
    ['ValidationException', generateValidationException(packageName)],
    ['JacksonMapper', generateJacksonMapper(packageName)],
  ]);
}

function generateSchemaRegistry(packageName: string): string {
  const resourcePath = packageName.replace(/\./g, '/');
  return dedent`
    package ${packageName};

    import com.fasterxml.jackson.databind.JsonNode;
    import com.fasterxml.jackson.databind.ObjectMapper;
    import com.fasterxml.jackson.databind.node.ArrayNode;
    import com.fasterxml.jackson.databind.node.ObjectNode;
    import com.networknt.schema.JsonSchema;
    import com.networknt.schema.JsonSchemaFactory;
    import com.networknt.schema.SpecVersion;
    import java.io.IOException;
    import java.io.InputStream;
    import java.util.IdentityHashMap;
    import java.util.Map;
    import java.util.concurrent.ConcurrentHashMap;

    public final class SchemaRegistry {
        private static final ObjectMapper MAPPER = new ObjectMapper();
        private static final JsonSchemaFactory FACTORY =
            JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        private static final Map<String, JsonNode> ROOTS = new ConcurrentHashMap<>();
        private static final Map<String, JsonSchema> SCHEMAS = new ConcurrentHashMap<>();
        private static final Map<JsonSchema, String> NAMES = new IdentityHashMap<>();

        private SchemaRegistry() {}

        public static JsonSchema get(String schemaName) {
            return get(schemaName, schemaName);
        }

        public static JsonSchema get(String rootName, String schemaName) {
            String cacheKey = rootName + ":" + schemaName;
            return SCHEMAS.computeIfAbsent(cacheKey, ignored -> load(rootName, schemaName));
        }

        static String nameOf(JsonSchema schema) {
            String name = NAMES.get(schema);
            if (name == null) {
                throw new IllegalArgumentException("Schema was not loaded by SchemaRegistry");
            }
            return name;
        }

        private static JsonSchema load(String rootName, String schemaName) {
            JsonNode root = ROOTS.computeIfAbsent(rootName, SchemaRegistry::readRoot);
            JsonSchema schema;
            if (rootName.equals(schemaName)) {
                schema = FACTORY.getSchema(root);
            } else {
                JsonNode definitions = root.path("$defs");
                if (!definitions.has(schemaName)) {
                    throw new IllegalArgumentException(
                        "Schema '" + schemaName + "' is not defined in '" + rootName + "'"
                    );
                }
                ObjectNode scopedRoot = root.deepCopy();
                ArrayNode options = MAPPER.createArrayNode();
                options.add(MAPPER.createObjectNode().put("$ref", "#/$defs/" + schemaName));
                scopedRoot.set("anyOf", options);
                schema = FACTORY.getSchema(scopedRoot);
            }
            synchronized (NAMES) {
                NAMES.put(schema, schemaName);
            }
            return schema;
        }

        private static JsonNode readRoot(String schemaName) {
            String resource = "/${resourcePath}/" + schemaName + ".schema.json";
            try (InputStream input = SchemaRegistry.class.getResourceAsStream(resource)) {
                if (input == null) {
                    throw new IllegalArgumentException("Schema resource not found: " + resource);
                }
                return MAPPER.readTree(input);
            } catch (IOException e) {
                throw new IllegalStateException("Unable to read schema resource: " + resource, e);
            }
        }
    }
  `;
}

function generateCompositionValidator(packageName: string): string {
  return dedent`
    package ${packageName};

    import com.fasterxml.jackson.databind.JsonNode;
    import com.networknt.schema.JsonSchema;
    import com.networknt.schema.ValidationMessage;
    import java.util.ArrayList;
    import java.util.List;
    import java.util.Set;

    final class CompositionValidator {
        AnyOfMatchResult validateAnyOf(JsonNode node, List<JsonSchema> schemas) {
            List<String> matches = new ArrayList<>();
            for (JsonSchema schema : schemas) {
                Set<ValidationMessage> errors = schema.validate(node);
                if (errors.isEmpty()) {
                    matches.add(SchemaRegistry.nameOf(schema));
                }
            }
            if (matches.isEmpty()) {
                throw new ValidationException("JSON does not match any anyOf schema");
            }
            return new AnyOfMatchResult(matches);
        }
    }
  `;
}

function generateAnyOfMatchResult(packageName: string): string {
  return dedent`
    package ${packageName};

    import java.util.List;

    final class AnyOfMatchResult {
        private final List<String> matchedOptionIndices;

        AnyOfMatchResult(List<String> matchedOptionIndices) {
            this.matchedOptionIndices = List.copyOf(matchedOptionIndices);
        }

        List<String> matchedOptionIndices() {
            return matchedOptionIndices;
        }
    }
  `;
}

function generateValidationException(packageName: string): string {
  return dedent`
    package ${packageName};

    public class ValidationException extends RuntimeException {
        public ValidationException(String message) {
            super(message);
        }
    }
  `;
}

function generateJacksonMapper(packageName: string): string {
  return dedent`
    package ${packageName};

    import com.fasterxml.jackson.databind.ObjectMapper;

    final class JacksonMapper {
        private static final ObjectMapper MAPPER = new ObjectMapper();

        private JacksonMapper() {}

        static ObjectMapper getSharedInstance() {
            return MAPPER;
        }
    }
  `;
}
