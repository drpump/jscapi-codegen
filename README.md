# JSON schema and OpenAPI code generator

This repository implements a code generator for JSON schema and OpenAPI. It differs quite fundamentally from the [standard OpenAPI generator](https://openapi-generator.tech) in a few key ways:

1. Deserialization targets a simple JSON Node structure, using mainstream or built-in JSON libraries for each target language.
2. Schemas are treated as interfaces or views over the JSON Node structure, properly reflecting the constraint-based nature of JSON schema. 
3. Validation uses off-the-shelf JSON schema validation libraries, noting here that OpenAPI 3.1 is now a formal JSON schema dialect. 
4. It does not generate language-native DTOs. Concrete wrapper classes provide language-native getters and setters, with validation-on-create and explicit validation functions.

How is this better? 
* JSON schema composition (`oneOf`, `allOf`, `anyOf`, `not`) is a nightmare for strongly-typed languages. There just isn't a natural way to represent these in language constructs for most languages. `jscapi-gen` doesn't try. The notable exception is TypeScript, with it's native JSON object representation and interfaces.
* Conversion to/from language-specific types is lazy, leading to efficiency and performance improvements, particularly for large data structures with properties that are seldom referenced.
* Persistence in document-based databases (e.g. Mongo) is more efficient. For RESTful CRUD APIs, this is a significant advantage. 
* The use of interfaces provides type safety for strongly-typed languages without giving up the JSON-native representation.
* The mapping of schemas to interfaces provides a natural way to apply schema-as-constraint, allowing you to separate the static, structural aspects of your schemas from more dynamic aspects like codes and reference values. 

## Quick start

TBD. 

## Design

* The generator is a TypeScript CLI. TypeScript is used due to the native JSON object representation and support for JSON schema tooling.
* A separate code generator per-target is defined, with the initial target being Java (21 or higher). 
* The Java target uses Jackson for serialization/deserialization and the networknt package for validation against schemas

