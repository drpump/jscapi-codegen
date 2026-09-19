_**[Work in progress, not ready for use yet]**_

# JSON schema and OpenAPI code generator

This repository implements a code generator for JSON schema and OpenAPI. It differs quite fundamentally from the [standard OpenAPI generator](https://openapi-generator.tech) in a few key ways:

1. Deserialization targets a simple JSON Node structure, using mainstream or built-in JSON libraries for each target language.
2. Schemas are treated as interfaces or views over the JSON Node structure, properly reflecting the constraint-based nature of JSON schema. 
3. Validation uses off-the-shelf JSON schema validation libraries, noting here that OpenAPI 3.1 is now a formal JSON schema dialect. 
4. It does not generate language-native DTOs. Concrete wrapper classes provide language-native getters and setters, with validation-on-create and explicit validation functions.


## Quick start

TBD. 

## How is this better? 
* JSON schema composition (`oneOf`, `allOf`, `anyOf`, `not`) is a nightmare for strongly-typed languages. There just isn't a natural way to represent these in language constructs for most languages. `jscapi-gen` doesn't try. The notable exception is TypeScript, with it's native JSON object representation and interfaces.
* The standard OpenAPI generator struggles with JSON schema composition, often generating invalid or unusable code when JSON schema structures imply multiple-inheritance and polymorphism. 
* Conversion to/from language-specific types is lazy, so can realize efficiency and performance improvements for large data structures with properties that are seldom referenced. For structures that are accessed frequently the two-stage processing (JSON parse, then language-specific convert) might be less efficient. 
* Persistence in document-based databases (e.g. Mongo) can be more efficient. For RESTful CRUD APIs where your code is mostly a pass-through with validation, this is a potentially significant advantage. 
* The use of interfaces provides type safety for strongly-typed languages without giving up the JSON-native representation.
* The mapping of schemas to interfaces provides a natural way to apply schema-as-constraint, allowing you to separate the static, structural aspects of your schemas from more dynamic aspects like codes and reference values. 

## What do we give up?
* The code generator is for JSON payloads only. We could perhaps do the same for other wire formats (e.g. XML might be a good candidate), but that's not currently being considered.
* OpenAPI prior to v3.1 wasn't a dialect of JSON schema, so there are potential semantic issues if you use earlier versions of OpenAPI. 
* It's early days. There will be bugs, missing features and target languages will be limited. The existing OpenAPI tooling is a lot more mature and broad-based. 

## Design

* The generator is a TypeScript CLI. TypeScript is used due to the native JSON object representation and support for JSON schema tooling.
* A separate code generator per-target is defined, with the initial target being Java (21 or higher). 
* The Java target uses Jackson for serialization/deserialization and the networknt package for validation against schemas

