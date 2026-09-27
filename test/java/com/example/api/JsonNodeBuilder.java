package com.example.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Builder for constructing JsonNode fixtures used to instantiate Person objects.
 * Provides a fluent API over ObjectMapper for test readability.
 */
public final class JsonNodeBuilder {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ObjectNode root = mapper.createObjectNode();

     /** Create a new builder with no properties set. */
    private JsonNodeBuilder() {}

     /** Return a fresh empty builder. */
    public static JsonNodeBuilder create() {
        return new JsonNodeBuilder();
    }

       /** Add a string property, or null to represent a missing/null value. */
    public JsonNodeBuilder withString(String key, String value) {
          if (value == null) {
              root.putNull(key);
           } else {
              root.put(key, value);
           }
        return this;
       }

       /** Add an integer property, or null to represent a missing/null value. */
    public JsonNodeBuilder withInt(String key, Integer value) {
         if (value == null) {
             root.putNull(key);
          } else {
              root.put(key, value);
           }
        return this;
      }

       /** Add a long property, or null to represent a missing/null value. */
    public JsonNodeBuilder withLong(String key, Long value) {
         if (value == null) {
             root.putNull(key);
          } else {
              root.put(key, value);
           }
        return this;
      }

       /** Add a double property, or null to represent a missing/null value. */
    public JsonNodeBuilder withDouble(String key, Double value) {
         if (value == null) {
             root.putNull(key);
          } else {
              root.put(key, value);
           }
        return this;
      }

       /** Add a boolean property, or null to represent a missing/null value. */
    public JsonNodeBuilder withBoolean(String key, Boolean value) {
         if (value == null) {
             root.putNull(key);
          } else {
              root.put(key, value);
           }
        return this;
      }

       /** Add an arbitrary key-value pair from a raw JsonNode. */
    public JsonNodeBuilder withNode(String key, JsonNode value) {
         if (value == null) {
             root.putNull(key);
          } else {
              root.set(key, value);
           }
        return this;
      }

       /** Remove a property from the builder. */
    public JsonNodeBuilder without(String key) {
          root.remove(key);
        return this;
      }

       /** Build and return an immutable JsonNode. */
    public JsonNode build() {
         return mapper.createObjectNode().setAll(root);
     }
}
