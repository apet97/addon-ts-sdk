# Adversarial Review: Design Choices and Deviations

## 1. Monorepo vs Standalone Workspace
**Decision**: Initialized a monorepo structure in the active workspace. This provides root-level validation scripts and governance targets, while keeping the primary code inside the `addon-sdk` package.

## 2. Type-State Pattern vs Method Chaining
**Decision**: In TypeScript, the step builder pattern is represented via type-state interfaces. At compile time, the user is forced to chain required setters in order. At runtime, the builder validates missing inputs on `.build()`.

## 3. JWT Signature Parsing Library
**Decision**: We use `jose` for signature parsing. It is lightweight, native to Node.js/Web environments, and does not require complex cryptographic configurations. It verified RSA256 tokens in complete alignment with Java's JJWT configuration.

## 4. Default Routing 405 vs 404
**Decision**: We return 405 Method Not Allowed for unmatched paths or methods. This strictly preserves the Java Addon router behavior.

## 5. Manifest Serialization
**Decision**: TypeScript plain objects are directly serializable using `JSON.stringify()`. We avoid class private properties for serialized states since `JSON.stringify()` would omit them.
