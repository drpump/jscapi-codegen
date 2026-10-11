package com.example.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public class UserEventsTestDriver {
    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode validJson = mapper.readTree(Path.of("json-data", "valid-user-events.json").toFile());

        UserEvents event = UserEventsFactory.fromJsonNode(validJson);
        check(event.isUserCreatedEvent(), "USER_CREATED variant is selected");
        check(!event.isUserUpdatedEvent(), "USER_UPDATED variant is not selected");
        UserCreatedEvent createdEvent = event.asUserCreatedEvent().orElseThrow(
            () -> new AssertionError("Expected a UserCreatedEvent view")
        );
        check("USER_CREATED".equals(createdEvent.getEventType()), "eventType getter");
        check("8e03978e-40d5-43e8-bc93-6894a57f9324".equals(createdEvent.getEventId().toString()), "eventId getter");
        check("ddeb27fb-d9a0-4624-be4d-4615062daed4".equals(createdEvent.getUserId().toString()), "userId getter");
        check("jane.doe@example.com".equals(createdEvent.getProfile().getEmail()), "profile email getter");
        System.out.println("Test 1 PASSED: Valid user event creates the expected variant and exposes getters");

        UserEvents streamedEvent = UserEventsFactory.fromJson(new ByteArrayInputStream(
            validJson.toString().getBytes(StandardCharsets.UTF_8)
        ));
        check(streamedEvent.isUserCreatedEvent(), "InputStream factory overload selects the user-created variant");
        System.out.println("Test 1b PASSED: UserEvents factory parses and validates JSON from an InputStream");

        JsonNode invalidJson = mapper.readTree(Path.of("json-data", "invalid-user-events.json").toFile());
        boolean validationFailed = false;
        try {
            UserEventsFactory.fromJsonNode(invalidJson);
        } catch (ValidationException expected) {
            validationFailed = true;
        }
        check(validationFailed, "event missing a required inherited field is rejected");
        System.out.println("Test 2 PASSED: UserEvents factory rejects invalid JSON");
        System.out.println("=== All User Events Tests Passed ===");
    }

    private static void check(boolean condition, String description) {
        if (!condition) {
            throw new AssertionError("Check failed: " + description);
        }
    }
}
