#!/bin/bash
# Download Java dependencies for integration tests
# Target: Amazon Corretto JDK 21+

set -e

LIBS_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$LIBS_DIR"

echo "Downloading Java dependencies to $LIBS_DIR..."

# Jackson Databind (latest stable)
JACKSON_VERSION="2.18.0"
curl -fSL "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/$JACKSON_VERSION/jackson-databind-$JACKSON_VERSION.jar" \
  -o "$LIBS_DIR/jackson-databind-$JACKSON_VERSION.jar"

# Jackson Core
curl -fSL "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-core/$JACKSON_VERSION/jackson-core-$JACKSON_VERSION.jar" \
  -o "$LIBS_DIR/jackson-core-$JACKSON_VERSION.jar"

# Jackson Annotations  
curl -fSL "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-annotations/$JACKSON_VERSION/jackson-annotations-$JACKSON_VERSION.jar" \
  -o "$LIBS_DIR/jackson-annotations-$JACKSON_VERSION.jar"

# Networknt JSON Schema Validator (latest stable)
NETWORKNT_VERSION="1.0.87"
curl -fSL "https://repo1.maven.org/maven2/com/networknt/json-schema-validator/$NETWORKNT_VERSION/json-schema-validator-$NETWORKNT_VERSION.jar" \
  -o "$LIBS_DIR/json-schema-validator-$NETWORKNT_VERSION.jar"

# Slf4j API (required by networknt)
SLF4J_VERSION="2.0.16"
curl -fSL "https://repo1.maven.org/maven2/org/slf4j/slf4j-api/$SLF4J_VERSION/slf4j-api-$SLF4J_VERSION.jar" \
  -o "$LIBS_DIR/slf4j-api-$SLF4J_VERSION.jar"

# Slf4j Simple Implementation (for logging during validation)
curl -fSL "https://repo1.maven.org/maven2/org/slf4j/slf4j-simple/$SLF4J_VERSION/slf4j-simple-$SLF4J_VERSION.jar" \
  -o "$LIBS_DIR/slf4j-simple-$SLF4J_VERSION.jar"

echo "✓ Dependencies downloaded successfully"
ls -lh "$LIBS_DIR"/*.jar
