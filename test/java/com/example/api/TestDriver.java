package com.example.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

/**
 * Driver that verifies generated Java classes can validate and read JSON data.
 */
public class TestDriver {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Person Java Integration Test ===");

        ObjectMapper mapper = new ObjectMapper();
        JsonNode schemaNode = mapper.readTree(Files.readString(Path.of("person.schema.json")));
        JsonSchema schema = JsonSchemaFactory
            .getInstance(SpecVersion.VersionFlag.V202012)
            .getSchema(schemaNode);

        JsonNode validJson = mapper.readTree(Files.readString(Path.of("valid-person.json")));
        Set<ValidationMessage> validErrors = schema.validate(validJson);
        if (!validErrors.isEmpty()) {
            throw new AssertionError("Expected valid person JSON, but validation failed: " + validErrors);
        }
        Person person = new PersonImpl(validJson);
        check("John".equals(person.getFirstName()), "firstName getter");
        check("Doe".equals(person.getLastName()), "lastName getter");
        check(person.getAge() == 30L, "age getter");
        check(person.getSalary().compareTo(new BigDecimal("75000.50")) == 0, "salary getter");
        check(Boolean.TRUE.equals(person.getIsActive()), "isActive getter");
        System.out.println("Test 1 PASSED: Valid JSON creates a Person and getters return parsed attributes");

        JsonNode invalidJson = mapper.readTree(Files.readString(Path.of("invalid-person.json")));
        Set<ValidationMessage> invalidErrors = schema.validate(invalidJson);
        check(!invalidErrors.isEmpty(), "invalid JSON is rejected by schema validation");
        System.out.println("Test 2 PASSED: Invalid JSON fails schema validation");

        System.out.println("=== All Tests Passed ===");
    }

    private static void check(boolean condition, String description) {
        if (!condition) {
            throw new AssertionError("Check failed: " + description);
        }
    }
}
