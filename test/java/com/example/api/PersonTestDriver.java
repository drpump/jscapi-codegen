package com.example.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

/**
 * Driver that verifies generated Java classes can validate and read JSON data.
 */
public class PersonTestDriver {
    public static void main(String[] args) throws Exception {
        System.out.println("=== Person Java Integration Test ===");

        ObjectMapper mapper = new ObjectMapper();
        JsonNode validJson = mapper.readTree(Path.of("json-data", "valid-person.json").toFile());
        Person person = PersonFactory.fromJsonNode(validJson);
        check("John".equals(person.getFirstName()), "firstName getter");
        check("Doe".equals(person.getLastName()), "lastName getter");
        check(person.getAge() == 30L, "age getter");
        check(person.getSalary().compareTo(new BigDecimal("75000.50")) == 0, "salary getter");
        check(Boolean.TRUE.equals(person.getIsActive()), "isActive getter");
        System.out.println("Test 1 PASSED: Valid JSON creates a Person and getters return parsed attributes");

        Person streamedPerson = PersonFactory.fromJson(new ByteArrayInputStream(
            validJson.toString().getBytes(StandardCharsets.UTF_8)
        ));
        check("John".equals(streamedPerson.getFirstName()), "InputStream factory overload");
        System.out.println("Test 1b PASSED: Person factory parses and validates JSON from an InputStream");

        JsonNode invalidJson = mapper.readTree(Path.of("json-data", "invalid-person.json").toFile());
        boolean validationFailed = false;
        try {
            PersonFactory.fromJsonNode(invalidJson);
        } catch (ValidationException expected) {
            validationFailed = true;
        }
        check(validationFailed, "invalid JSON is rejected by the Person factory");
        System.out.println("Test 2 PASSED: Person factory rejects invalid JSON");

        System.out.println("=== All Tests Passed ===");
    }

    private static void check(boolean condition, String description) {
        if (!condition) {
            throw new AssertionError("Check failed: " + description);
        }
    }
}
