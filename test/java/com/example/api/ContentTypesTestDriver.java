package com.example.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.file.Path;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public class ContentTypesTestDriver {
    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode validJson = mapper.readTree(Path.of("json-data", "valid-content-types.json").toFile());

        ContentTypes content = ContentTypesFactory.fromJsonNode(validJson);
        check(content.isImageContent(), "image variant is selected");
        check(!content.isTextContent(), "text variant is not selected");
        ImageContent image = content.asImageContent().orElseThrow(
            () -> new AssertionError("Expected an ImageContent view")
        );
        check("IMAGE".equals(image.getContentType()), "contentType getter");
        check(URI.create("https://example.com/image.png").equals(image.getImageUrl()), "imageUrl getter");
        check(image.getWidth() == 640L, "width getter");
        check(image.getHeight() == 480L, "height getter");
        System.out.println("Test 1 PASSED: Valid image JSON creates ContentTypes and exposes image getters");

        ContentTypes streamedContent = ContentTypesFactory.fromJson(new ByteArrayInputStream(
            validJson.toString().getBytes(StandardCharsets.UTF_8)
        ));
        check(streamedContent.isImageContent(), "InputStream factory overload selects the image variant");
        System.out.println("Test 1b PASSED: ContentTypes factory parses and validates JSON from an InputStream");

        JsonNode invalidJson = mapper.readTree(Path.of("json-data", "invalid-content-types.json").toFile());
        boolean validationFailed = false;
        try {
            ContentTypesFactory.fromJsonNode(invalidJson);
        } catch (ValidationException expected) {
            validationFailed = true;
        }
        check(validationFailed, "invalid content JSON is rejected by the ContentTypes factory");
        System.out.println("Test 2 PASSED: ContentTypes factory rejects invalid JSON");
        System.out.println("=== All Content Types Tests Passed ===");
    }

    private static void check(boolean condition, String description) {
        if (!condition) {
            throw new AssertionError("Check failed: " + description);
        }
    }
}
