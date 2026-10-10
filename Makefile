# Makefile for Java integration test scaffolding
# Manages dependency download, compilation, and cleanup
# Usage: make deps | make test-java | make test-junit | make clean

LIBS_DIR       := libs
TEMP_DIR       := .temp-test-java
JACKSON_VER    := 2.18.0
SNAKEYAML_VER  := 2.2
SCHEMA_VER     := 1.0.87
JUNIT_VER       := 5.11.3
JUNIT_PLATFORM_VER := 1.11.3
MAVEN_CENTRAL   := https://repo.maven.apache.org/maven2

# All JAR dependencies (runtime + test)
DEPS = $(LIBS_DIR)/jackson-annotations-$(JACKSON_VER).jar \
          $(LIBS_DIR)/jackson-core-$(JACKSON_VER).jar \
          $(LIBS_DIR)/jackson-databind-$(JACKSON_VER).jar \
          $(LIBS_DIR)/jackson-dataformat-yaml-$(JACKSON_VER).jar \
          $(LIBS_DIR)/snakeyaml-$(SNAKEYAML_VER).jar \
          $(LIBS_DIR)/slf4j-api-2.0.16.jar \
          $(LIBS_DIR)/slf4j-simple-2.0.16.jar \
          $(LIBS_DIR)/json-schema-validator-$(SCHEMA_VER).jar \
          $(LIBS_DIR)/junit-jupiter-api-$(JUNIT_VER).jar \
          $(LIBS_DIR)/junit-jupiter-engine-$(JUNIT_VER).jar \
           $(LIBS_DIR)/junit-platform-commons-$(JUNIT_PLATFORM_VER).jar \
           $(LIBS_DIR)/junit-platform-engine-$(JUNIT_PLATFORM_VER).jar \
# JAR classpath using wildcard, evaluated after dependencies are downloaded
JARS = $(shell echo $(wildcard libs/*.jar) | tr ' ' ':')
deps: $(DEPS)
	@echo "✓ All dependencies downloaded"

$(LIBS_DIR):
	mkdir -p $(LIBS_DIR)

$(LIBS_DIR)/jackson-annotations-$(JACKSON_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/com/fasterxml/jackson/core/jackson-annotations/$(JACKSON_VER)/jackson-annotations-$(JACKSON_VER).jar" -o $@

$(LIBS_DIR)/jackson-core-$(JACKSON_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/com/fasterxml/jackson/core/jackson-core/$(JACKSON_VER)/jackson-core-$(JACKSON_VER).jar" -o $@

$(LIBS_DIR)/jackson-databind-$(JACKSON_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/com/fasterxml/jackson/core/jackson-databind/$(JACKSON_VER)/jackson-databind-$(JACKSON_VER).jar" -o $@

$(LIBS_DIR)/jackson-dataformat-yaml-$(JACKSON_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/com/fasterxml/jackson/dataformat/jackson-dataformat-yaml/$(JACKSON_VER)/jackson-dataformat-yaml-$(JACKSON_VER).jar" -o $@

$(LIBS_DIR)/snakeyaml-$(SNAKEYAML_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/yaml/snakeyaml/$(SNAKEYAML_VER)/snakeyaml-$(SNAKEYAML_VER).jar" -o $@

$(LIBS_DIR)/slf4j-api-2.0.16.jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/slf4j/slf4j-api/2.0.16/slf4j-api-2.0.16.jar" -o $@

$(LIBS_DIR)/slf4j-simple-2.0.16.jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/slf4j/slf4j-simple/2.0.16/slf4j-simple-2.0.16.jar" -o $@

$(LIBS_DIR)/json-schema-validator-$(SCHEMA_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/com/networknt/json-schema/$(SCHEMA_VER)/json-schema-$(SCHEMA_VER).jar" -o $@

$(LIBS_DIR)/junit-jupiter-api-$(JUNIT_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/junit/jupiter/junit-jupiter-api/$(JUNIT_VER)/junit-jupiter-api-$(JUNIT_VER).jar" -o $@

$(LIBS_DIR)/junit-jupiter-engine-$(JUNIT_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/junit/jupiter/junit-jupiter-engine/$(JUNIT_VER)/junit-jupiter-engine-$(JUNIT_VER).jar" -o $@

$(LIBS_DIR)/junit-platform-commons-$(JUNIT_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/junit/platform/junit-platform-commons/$(JUNIT_VER)/junit-platform-commons-$(JUNIT_VER).jar" -o $@

$(LIBS_DIR)/junit-platform-engine-$(JUNIT_VER).jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/junit/platform/junit-platform-engine/$(JUNIT_VER)/junit-platform-engine-$(JUNIT_VER).jar" -o $@

$(LIBS_DIR)/opentest4j-1.3.0.jar: | $(LIBS_DIR)
	curl -f -L "$(MAVEN_CENTRAL)/org/opentest4j/opentest4j/1.3.0/opentest4j-1.3.0.jar" -o $@

# Main test target
test-java: setup test-person test-driver test-content-types

test-person: deps
	@echo "=== Testing Person Schema Compilation ===" && \
	mkdir -p $(TEMP_DIR)/com/example/api && \
	npx ts-node src/main.ts generate --schema test/fixtures/person.json --output $(TEMP_DIR) && \
	sed 's/package PACKAGE_PLACEHOLDER;/package com.example.api;/' $(TEMP_DIR)/com/example/api/Person.java > $(TEMP_DIR)/com/example/api/Person.java.tmp && \
	mv $(TEMP_DIR)/com/example/api/Person.java.tmp $(TEMP_DIR)/com/example/api/Person.java && \
	node --require ts-node/register -e 'const fs = require("fs"); const { generateJsonNodeConverters } = require("./src/generators/java/jsonNodeConvertersGenerator"); fs.writeFileSync("$(TEMP_DIR)/com/example/api/JsonNodeConverters.java", generateJsonNodeConverters("com.example.api"));' && \
	javac -cp "$(JARS):$(TEMP_DIR)" $(TEMP_DIR)/com/example/api/Person.java $(TEMP_DIR)/com/example/api/PersonImpl.java $(TEMP_DIR)/com/example/api/PersonFactory.java $(TEMP_DIR)/com/example/api/JsonNodeConverters.java $(TEMP_DIR)/com/example/api/SchemaRegistry.java $(TEMP_DIR)/com/example/api/CompositionValidator.java $(TEMP_DIR)/com/example/api/AnyOfMatchResult.java $(TEMP_DIR)/com/example/api/ValidationException.java $(TEMP_DIR)/com/example/api/JacksonMapper.java && \
	echo "✓ Person schema compiled successfully"

test-driver: test-person
	@echo "=== Testing Driver Compilation ===" && \
	mkdir -p $(TEMP_DIR)/com/example/api && \
	cp test/java/com/example/api/PersonTestDriver.java $(TEMP_DIR)/com/example/api/ && \
	cp test/fixtures/valid-person.json $(TEMP_DIR)/valid-person.json && \
	cp test/fixtures/invalid-person.json $(TEMP_DIR)/invalid-person.json && \
	javac -cp "$(JARS):$(TEMP_DIR)" $(TEMP_DIR)/com/example/api/PersonTestDriver.java && \
	cd $(TEMP_DIR) && java -cp ".:$(abspath $(LIBS_DIR))/*" com.example.api.PersonTestDriver

test-content-types: deps
	@echo "=== Testing Content Types Schema Compilation and Runtime ===" && \
	mkdir -p $(TEMP_DIR)/com/example/api && \
	npx ts-node src/main.ts generate --schema test/fixtures/content-types.json --output $(TEMP_DIR) && \
	node --require ts-node/register -e 'const fs = require("fs"); const { generateJsonNodeConverters } = require("./src/generators/java/jsonNodeConvertersGenerator"); fs.writeFileSync("$(TEMP_DIR)/com/example/api/JsonNodeConverters.java", generateJsonNodeConverters("com.example.api"));' && \
	cp test/java/com/example/api/ContentTypesTestDriver.java $(TEMP_DIR)/com/example/api/ && \
	cp test/fixtures/valid-content-types.json $(TEMP_DIR)/valid-content-types.json && \
	cp test/fixtures/invalid-content-types.json $(TEMP_DIR)/invalid-content-types.json && \
	javac -cp "$(JARS):$(TEMP_DIR)" \
		$(TEMP_DIR)/com/example/api/ContentTypes.java \
		$(TEMP_DIR)/com/example/api/ContentTypesFactory.java \
		$(TEMP_DIR)/com/example/api/ContentTypesImpl.java \
		$(TEMP_DIR)/com/example/api/TextContent.java \
		$(TEMP_DIR)/com/example/api/RichContent.java \
		$(TEMP_DIR)/com/example/api/ImageContent.java \
		$(TEMP_DIR)/com/example/api/VideoContent.java \
		$(TEMP_DIR)/com/example/api/RichContentFormatting.java \
		$(TEMP_DIR)/com/example/api/RichContentFormattingImpl.java \
		$(TEMP_DIR)/com/example/api/JsonNodeConverters.java \
		$(TEMP_DIR)/com/example/api/SchemaRegistry.java \
		$(TEMP_DIR)/com/example/api/CompositionValidator.java \
		$(TEMP_DIR)/com/example/api/AnyOfMatchResult.java \
		$(TEMP_DIR)/com/example/api/ValidationException.java \
		$(TEMP_DIR)/com/example/api/JacksonMapper.java \
		$(TEMP_DIR)/com/example/api/ContentTypesTestDriver.java && \
	cd $(TEMP_DIR) && java -cp ".:$(abspath $(LIBS_DIR))/*" com.example.api.ContentTypesTestDriver

test-junit: test-person
	@echo "=== Compiling JUnit Tests ===" && \
	mkdir -p $(TEMP_DIR)/test-classes && \
	javac --source 11 --target 11 --release 11 \
		-cp "$(JARS):$(TEMP_DIR)" \
		-p $(TEMP_DIR) \
		-d $(TEMP_DIR)/test-classes \
		test/java/com/example/api/JsonNodeBuilder.java \
		test/java/com/example/api/PersonTest.java && \
	echo "✓ Tests compiled successfully" && \
	echo "=== Running JUnit 5 Tests ===" && \
	java --enable-preview --release 11 \
		-cp "$(JARS):$(TEMP_DIR):$(TEMP_DIR)/test-classes" \
		org.junit.platform.console.ConsoleLauncher \
		--select-class com.example.api.PersonTest \
		--disable-all-discoverers

setup: deps
	@echo "✓ Setup complete"

clean:
	rm -rf $(TEMP_DIR)
	@echo "✓ Cleaned temp directory"

distclean: clean
	rm -f $(LIBS_DIR)/*.jar
	@echo "✓ Cleaned all generated and dependency files"
