package com.example.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for Person interface and implementation.
 * Exercises constructor with JsonNode, getter methods, hasProperty(), and getRawNode().
 */
class PersonTest {

    private final ObjectMapper mapper = new ObjectMapper();

      // ── Constructing Persons from JsonNode ────────────────────────

      @Test
      @DisplayName("should construct Person with all fields from valid JSON")
     void shouldConstructPersonWithAllFields() {
         String json = "{\n" +
                   "\"firstName\": \"John\",\n" +
                   "\"lastName\": \"Doe\",\n" +
                   "\"email\": \"john.doe@example.com\",\n" +
                   "\"age\": 30,\n" +
                   "\"salary\": 75000.50,\n" +
                   "\"isActive\": true\n" +
                   "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals("John", person.getFirstName());
          assertEquals("Doe", person.getLastName());
          assertEquals("john.doe@example.com", person.getEmail());
          assertEquals(Long.valueOf(30L), person.getAge());
          assertNotNull(person.getSalary());
         assertEquals(new BigDecimal("75000.50"), person.getSalary());
         assertTrue(person.getIsActive());
      }

      @Test
      @DisplayName("should construct Person with only required fields")
     void shouldConstructPersonWithOnlyRequiredFields() {
         String json = "{\n" +
                   "\"firstName\": \"Jane\",\n" +
                   "\"lastName\": \"Smith\"\n" +
                   "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals("Jane", person.getFirstName());
          assertEquals("Smith", person.getLastName());
      }

      @Test
      @DisplayName("should return true when isActive is explicitly true")
     void shouldHandleTrueIsActive() {
         String json = "{\n" +
                   "\"firstName\": \"Bob\",\n" +
                   "\"lastName\": \"Jones\",\n" +
                   "\"isActive\": true\n" +
                   "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);
          assertTrue(person.getIsActive());
      }

      @Test
      @DisplayName("should return false when isActive is explicitly false")
     void shouldHandleFalseIsActive() {
         String json = "{\n" +
                   "\"firstName\": \"Charlie\",\n" +
                   "\"lastName\": \"Brown\",\n" +
                   "\"isActive\": false\n" +
                   "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);
          assertFalse(person.getIsActive());
      }

      // ── Required Field Handling ───────────────────────────────────

      @Test
      @DisplayName("should throw NullPointerException when jsonNode is null in constructor")
     void shouldThrowOnNullJsonNode() {
         assertThrows(NullPointerException.class, () -> {
              new PersonImpl(null);
          });
      }

      @Test
      @DisplayName("missing required field returns null from getter")
     void missingRequiredFieldReturnsNull() {
          String json = "{\n" +
                    "\"lastName\": \"Valid\"\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertNull(person.getFirstName());    // missing required field returns null
          assertEquals("Valid", person.getLastName());
      }

      @Test
      @DisplayName("required fields with null JSON values return null from getters")
     void requiredFieldsWithNullValuesReturnNull() {
         String json = "{\n" +
                    "\"firstName\": null,\n" +
                    "\"lastName\": null\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertNull(person.getFirstName());
          assertNull(person.getLastName());
      }

      // ── Optional Field Behavior ───────────────────────────────────

      @Test
      @DisplayName("should return null for optional fields not present in JSON")
     void shouldReturnNullForMissingOptionalFields() {
         String json = "{\n" +
                    "\"firstName\": \"Alice\",\n" +
                    "\"lastName\": \"Wonder\"\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertNull(person.getEmail());
          assertNull(person.getAge());
          assertNull(person.getSalary());
      }

      @Test
      @DisplayName("should return null for optional fields with null values")
     void shouldReturnNullForOptionalFieldsWithNullValues() {
         String json = "{\n" +
                    "\"firstName\": \"Alice\",\n" +
                    "\"lastName\": \"Wonder\",\n" +
                    "\"email\": null,\n" +
                    "\"age\": null\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertNull(person.getEmail());
          assertNull(person.getAge());
      }

      // ── Type Handling and Coercion ────────────────────────────────

      @Test
      @DisplayName("should handle large integer for age field")
     void shouldHandleLargeAge() {
         String json = "{\n" +
                    "\"firstName\": \"Eve\",\n" +
                    "\"lastName\": \"Smith\",\n" +
                    "\"age\": 2147483647\n" +   // Integer.MAX_VALUE
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals(Long.valueOf(2147483647L), person.getAge());
      }

      @Test
      @DisplayName("should handle zero for numeric fields")
     void shouldHandleZeroForNumericFields() {
         String json = "{\n" +
                    "\"firstName\": \"Zero\",\n" +
                    "\"lastName\": \"Hero\",\n" +
                    "\"age\": 0,\n" +
                    "\"salary\": 0.00\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals(Long.valueOf(0L), person.getAge());
          assertNotNull(person.getSalary());
          assertEquals(BigDecimal.ZERO, person.getSalary());
      }

      @Test
      @DisplayName("should handle negative age (schema would reject but JsonNode allows)")
     void shouldHandleNegativeAge() {
         String json = "{\n" +
                    "\"firstName\": \"Test\",\n" +
                    "\"lastName\": \"Person\",\n" +
                    "\"age\": -1\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals(Long.valueOf(-1L), person.getAge());
      }

      @Test
      @DisplayName("should handle negative salary")
     void shouldHandleNegativeSalary() {
         String json = "{\n" +
                    "\"firstName\": \"Test\",\n" +
                    "\"lastName\": \"Person\",\n" +
                    "\"salary\": -5000.25\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals(new BigDecimal("-5000.25"), person.getSalary());
      }

      // ── Raw Node and hasProperty ──────────────────────────────────

      @Test
      @DisplayName("should return underlying JsonNode via getRawNode")
     void shouldReturnRawNode() {
         String json = "{\n" +
                    "\"firstName\": \"Test\",\n" +
                    "\"lastName\": \"User\"\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          JsonNode rawNode = person.getRawNode();
          assertNotNull(rawNode);
          assertEquals("Test", rawNode.get("firstName").asText());
          assertEquals("User", rawNode.get("lastName").asText());
      }

      @Test
      @DisplayName("getRawNode returns the same node passed to constructor")
     void shouldReturnSameNode() {
         String json = "{ \"firstName\": \"X\", \"lastName\": \"Y\" }";
          JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

         assertSame(node, person.getRawNode());
      }

      @Test
      @DisplayName("should return true for hasProperty when field exists")
     void shouldReturnTrueForExistingProperty() {
          String json = "{\n" +
                    "\"firstName\": \"Test\",\n" +
                    "\"lastName\": \"User\"\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertTrue(person.hasProperty("firstName"));
          assertTrue(person.hasProperty("lastName"));
      }

      @Test
      @DisplayName("should return false for hasProperty when field does not exist")
     void shouldReturnFalseForMissingProperty() {
          String json = "{\n" +
                    "\"firstName\": \"Test\",\n" +
                    "\"lastName\": \"User\"\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertFalse(person.hasProperty("email"));
          assertFalse(person.hasProperty("nonexistent"));
      }

      @Test
      @DisplayName("should return false for hasProperty when field value is null")
     void shouldReturnFalseForNullProperty() {
          String json = "{\n" +
                    "\"firstName\": \"Test\",\n" +
                    "\"lastName\": null\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertTrue(person.hasProperty("firstName"));
         assertFalse(person.hasProperty("lastName"));   // null values excluded by hasProperty
      }

      // ── Edge Cases ────────────────────────────────────────────────

      @ParameterizedTest(name = "should handle whitespace-only string: \"{0}\"")
      @ValueSource(strings = { " ", "    ", "\t" })
     void shouldHandleWhitespaceInFirstName(String input) {
          String json;
          if ("\t".equals(input)) {
              json = "{ \"firstName\": \"\\t\", \"lastName\": \"Valid\" }";
          } else {
              json = "{ \"firstName\": \"" + input + "\", \"lastName\": \"Valid\" }";
          }

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals(input, person.getFirstName());
      }

      @Test
      @DisplayName("should handle empty string for firstName")
     void shouldHandleEmptyString() {
          String json = "{ \"firstName\": \"\", \"lastName\": \"Valid\" }";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals("", person.getFirstName());
      }

      @Test
      @DisplayName("should handle special characters in name fields")
     void shouldHandleSpecialCharacters() {
          String json = "{\n" +
                    "\"firstName\": \"Jos\\u00e9 Mar\\u00eda\",\n" +
                    "\"lastName\": \"O'Brien-Smith\",\n" +
                    "\"email\": \"jose+tag@example.co.uk\"\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals("José María", person.getFirstName());
          assertEquals("O'Brien-Smith", person.getLastName());
          assertEquals("jose+tag@example.co.uk", person.getEmail());
      }

      @Test
      @DisplayName("should handle very long strings")
     void shouldHandleLongStrings() {
         String longName = "A".repeat(10000);
         String json = "{ \"firstName\": \"" + longName + "\", \"lastName\": \"Valid\" }";

          JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals(longName, person.getFirstName());
      }

      @Test
      @DisplayName("should handle null for all properties")
     void shouldHandleAllNulls() {
          String json = "{\n" +
                    "\"firstName\": null,\n" +
                    "\"lastName\": null,\n" +
                    "\"email\": null,\n" +
                    "\"age\": null,\n" +
                    "\"salary\": null\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertNull(person.getFirstName());
          assertNull(person.getLastName());
          assertNull(person.getEmail());
          assertNull(person.getAge());
          assertNull(person.getSalary());
      }

      @Test
      @DisplayName("should handle additional unexpected properties in JSON")
     void shouldHandleAdditionalProperties() {
         String json = "{\n" +
                    "\"firstName\": \"Test\",\n" +
                    "\"lastName\": \"User\",\n" +
                    "\"unexpectedField\": 123,\n" +
                    "\"another\": true\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals("Test", person.getFirstName());
          assertEquals("User", person.getLastName());
      }

      @Test
      @DisplayName("should return empty JsonNode for non-existent properties via getRawNode")
     void shouldReturnEmptyForNonExistentPropertiesViaRawNode() {
         String json = "{ \"firstName\": \"Test\", \"lastName\": \"User\" }";

         JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          JsonNode raw = person.getRawNode();
          assertNull(raw.get("nonexistent"));
      }

      @Test
      @DisplayName("should allow re-using the same JsonNode for multiple operations")
     void shouldAllowReuseOfJsonNode() {
         String json = "{\n" +
                    "\"firstName\": \"Reuse\",\n" +
                    "\"lastName\": \"Me\",\n" +
                    "\"age\": 25\n" +
                    "}";

         JsonNode node = mapper.readTree(json);
         Person person1 = new PersonImpl(node);
          Person person2 = new PersonImpl(node);

          assertEquals(person1.getFirstName(), person2.getFirstName());
          assertNotSame(person1, person2);   // different instances, same backing node
      }

      @Test
      @DisplayName("should work with all getters together on valid data")
     void shouldWorkWithAllGettersTogether() {
         String json = "{\n" +
                    "\"firstName\": \"All\",\n" +
                    "\"lastName\": \"Getters\",\n" +
                    "\"email\": \"all@test.com\",\n" +
                    "\"age\": 42,\n" +
                    "\"salary\": 100000.00,\n" +
                    "\"isActive\": true\n" +
                    "}";

          JsonNode node = mapper.readTree(json);
         Person person = new PersonImpl(node);

          assertEquals("All", person.getFirstName());
          assertEquals("Getters", person.getLastName());
          assertEquals("all@test.com", person.getEmail());
          assertEquals(Long.valueOf(42L), person.getAge());
          assertEquals(new BigDecimal("100000.00"), person.getSalary());
          assertTrue(person.getIsActive());
          assertEquals("All", person.getRawNode().get("firstName").asText());
         assertTrue(person.hasProperty("firstName"));
      }
}
