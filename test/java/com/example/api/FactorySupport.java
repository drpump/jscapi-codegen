package com.example.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class SchemaRegistry {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final JsonSchemaFactory FACTORY =
        JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
    private static final Map<String, JsonNode> ROOTS = new java.util.HashMap<>();
    private static final Map<String, JsonSchema> SCHEMAS = new java.util.HashMap<>();
    private static final Map<JsonSchema, String> SCHEMA_NAMES = new IdentityHashMap<>();

    private SchemaRegistry() {}

    static void load(String name, Path schemaPath) throws IOException {
        JsonNode root = MAPPER.readTree(schemaPath.toFile());
        ROOTS.put(name, root);
        register(name, FACTORY.getSchema(root));
    }

    static JsonSchema get(String name) {
        JsonSchema cached = SCHEMAS.get(name);
        if (cached != null) return cached;

        for (JsonNode root : ROOTS.values()) {
            JsonNode definitions = root.path("$defs");
            if (!definitions.has(name) || !root.has("anyOf")) continue;

            ObjectNode scopedRoot = root.deepCopy();
            ArrayNode selectedOption = MAPPER.createArrayNode();
            selectedOption.add(MAPPER.createObjectNode().put("$ref", "#/$defs/" + name));
            scopedRoot.set("anyOf", selectedOption);
            JsonSchema schema = FACTORY.getSchema(scopedRoot);
            register(name, schema);
            return schema;
        }

        throw new IllegalArgumentException("No schema registered for " + name);
    }

    static String nameOf(JsonSchema schema) {
        String name = SCHEMA_NAMES.get(schema);
        if (name == null) {
            throw new IllegalArgumentException("Schema was not obtained from this registry");
        }
        return name;
    }

    private static void register(String name, JsonSchema schema) {
        SCHEMAS.put(name, schema);
        SCHEMA_NAMES.put(schema, name);
    }
}

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

final class AnyOfMatchResult {
    private final List<String> matchedOptionIndices;

    AnyOfMatchResult(List<String> matchedOptionIndices) {
        this.matchedOptionIndices = List.copyOf(matchedOptionIndices);
    }

    List<String> matchedOptionIndices() {
        return matchedOptionIndices;
    }
}

final class ValidationException extends RuntimeException {
    ValidationException(String message) {
        super(message);
    }
}

final class JacksonMapper {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JacksonMapper() {}

    static ObjectMapper getSharedInstance() {
        return MAPPER;
    }
}
