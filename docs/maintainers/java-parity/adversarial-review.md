# Adversarial Review: Design Choices and Deviations

This maintainer record captures deliberate TypeScript design choices made while porting the Java
SDK. Revisit it when a parity change could blur an intentional runtime or language adaptation.

## 1. Monorepo vs Standalone Workspace

**Decision**: Initialized a monorepo structure in the active workspace. This provides root-level validation scripts and governance targets, while keeping the primary code inside the `addon-sdk` package.

## 2. Type-State Pattern vs Method Chaining

**Decision**: In TypeScript, the step builder pattern is represented via type-state interfaces. At compile time, the user is forced to chain required setters in order. At runtime, the builder validates missing inputs on `.build()`.

## 3. JWT Signature Parsing Library

**Decision**: We use `jose` for signature parsing. It is lightweight, native to Node.js/Web environments, and does not require complex cryptographic configurations. It verifies RS256 tokens in complete alignment with Java's JJWT configuration.

## 4. Exact Routing: 404 vs 405

**Decision**: An unknown path returns 404 Not Found. When the exact path exists for another method,
the router returns 405 Method Not Allowed with an `Allow` header. This records the maintained
routing contract without treating unknown paths and wrong methods as equivalent.

## 5. Manifest Serialization

**Decision**: TypeScript plain objects are directly serializable using `JSON.stringify()`. We avoid class private properties for serialized states since `JSON.stringify()` would omit them.
