import { parse } from "acorn";

function isNode(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.type === "string"
  );
}

function importedModule(node) {
  return typeof node.source?.value === "string" ? node.source.value : undefined;
}

function isAjvModule(moduleName) {
  return (
    moduleName === "ajv" ||
    moduleName.startsWith("ajv/") ||
    moduleName === "ajv-draft-04" ||
    moduleName.startsWith("ajv-draft-04/")
  );
}

function locationOf(node) {
  return {
    line: node.loc?.start.line ?? 1,
    column: node.loc?.start.column ?? 0,
  };
}

function staticMemberName(node) {
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  if (node.computed && node.property.type === "Literal") {
    return typeof node.property.value === "string"
      ? node.property.value
      : undefined;
  }
  return undefined;
}

function forEachChild(node, callback) {
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    if (Array.isArray(value)) {
      for (const child of value) callback(child);
    } else {
      callback(value);
    }
  }
}

function createScope(parent, kind) {
  return { parent, kind, bindings: new Map() };
}

function defineBinding(scope, name, binding = {}) {
  scope.bindings.set(name, binding);
}

function definePatternBindings(scope, pattern, binding = {}) {
  if (!isNode(pattern)) return;
  if (pattern.type === "Identifier") {
    defineBinding(scope, pattern.name, binding);
  } else if (pattern.type === "RestElement") {
    definePatternBindings(scope, pattern.argument, binding);
  } else if (pattern.type === "AssignmentPattern") {
    definePatternBindings(scope, pattern.left, binding);
  } else if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) {
      definePatternBindings(scope, element, binding);
    }
  } else if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      definePatternBindings(
        scope,
        property.type === "RestElement" ? property.argument : property.value,
        binding,
      );
    }
  }
}

function nearestVariableScope(scope) {
  let current = scope;
  while (current.kind !== "function" && current.kind !== "program") {
    current = current.parent;
  }
  return current;
}

function findBinding(scope, name) {
  let current = scope;
  while (current !== null) {
    const binding = current.bindings.get(name);
    if (binding !== undefined) return binding;
    current = current.parent;
  }
  return undefined;
}

function executableReferenceKind(node, scope, resolvingBindings = new Set()) {
  if (!isNode(node)) return undefined;
  if (node.type === "ChainExpression") {
    return executableReferenceKind(node.expression, scope, resolvingBindings);
  }
  if (node.type === "SequenceExpression") {
    return executableReferenceKind(
      node.expressions.at(-1),
      scope,
      resolvingBindings,
    );
  }
  if (node.type === "Identifier") {
    const binding = findBinding(scope, node.name);
    if (binding !== undefined) {
      if (binding.aliasExpression === undefined) return undefined;
      if (resolvingBindings.has(binding)) return undefined;
      resolvingBindings.add(binding);
      const kind = executableReferenceKind(
        binding.aliasExpression,
        binding.referenceScope,
        resolvingBindings,
      );
      resolvingBindings.delete(binding);
      return kind;
    }
    if (node.name === "eval") return "eval-call";
    if (node.name === "Function") return "function-constructor";
    return undefined;
  }
  if (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "globalThis" &&
    findBinding(scope, "globalThis") === undefined
  ) {
    const memberName = staticMemberName(node);
    if (memberName === "eval") return "eval-call";
    if (memberName === "Function") return "function-constructor";
  }
  return undefined;
}

/**
 * Parse JavaScript and report executable constructs that must not appear in
 * generated validators or Worker bundles. Text inside comments and literals is
 * intentionally ignored because Acorn never exposes it as executable syntax.
 *
 * @param {string} source JavaScript module source.
 * @param {{ readonly forbidImports?: boolean }} [options] Inspection policy.
 * @returns {Array<{ readonly kind: string, readonly message: string, readonly line: number, readonly column: number }>}
 */
export function inspectRuntimeJavaScript(source, options = {}) {
  const root = parse(source, {
    allowHashBang: true,
    ecmaVersion: "latest",
    locations: true,
    sourceType: "module",
  });
  const findings = [];
  const scopeByNode = new WeakMap();
  const programScope = createScope(null, "program");

  const collectFunctionScope = (node, parentScope) => {
    const functionScope = createScope(parentScope, "function");
    scopeByNode.set(node, functionScope);
    if (node.type === "FunctionExpression" && node.id?.type === "Identifier") {
      defineBinding(functionScope, node.id.name);
    }
    for (const parameter of node.params) {
      definePatternBindings(functionScope, parameter);
    }
    for (const parameter of node.params)
      collectScopes(parameter, functionScope);
    collectScopes(node.body, functionScope);
  };

  // Collect every lexical binding before calls are classified, so aliases are
  // independent of declaration traversal order and cannot leak across scopes.
  const collectScopes = (node, scope) => {
    if (!isNode(node)) return;
    scopeByNode.set(node, scope);

    if (node.type === "Program") {
      for (const statement of node.body) collectScopes(statement, scope);
      return;
    }
    if (node.type === "BlockStatement") {
      const blockScope = createScope(scope, "block");
      scopeByNode.set(node, blockScope);
      for (const statement of node.body) collectScopes(statement, blockScope);
      return;
    }
    if (node.type === "FunctionDeclaration") {
      if (node.id?.type === "Identifier") defineBinding(scope, node.id.name);
      collectFunctionScope(node, scope);
      return;
    }
    if (
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      collectFunctionScope(node, scope);
      return;
    }
    if (node.type === "CatchClause") {
      const catchScope = createScope(scope, "block");
      scopeByNode.set(node, catchScope);
      definePatternBindings(catchScope, node.param);
      collectScopes(node.param, catchScope);
      collectScopes(node.body, catchScope);
      return;
    }
    if (node.type === "VariableDeclaration") {
      const bindingScope =
        node.kind === "var" ? nearestVariableScope(scope) : scope;
      for (const declaration of node.declarations) {
        if (node.kind === "const" && declaration.id.type === "Identifier") {
          defineBinding(bindingScope, declaration.id.name, {
            aliasExpression: declaration.init ?? undefined,
            referenceScope: scope,
          });
        } else {
          definePatternBindings(bindingScope, declaration.id);
        }
        collectScopes(declaration.id, scope);
        collectScopes(declaration.init, scope);
      }
      return;
    }
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) {
        defineBinding(scope, specifier.local.name);
      }
      return;
    }
    if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      if (node.type === "ClassDeclaration" && node.id?.type === "Identifier") {
        defineBinding(scope, node.id.name);
      }
      const classScope = createScope(scope, "block");
      if (node.id?.type === "Identifier") {
        defineBinding(classScope, node.id.name);
      }
      collectScopes(node.superClass, scope);
      collectScopes(node.body, classScope);
      return;
    }

    forEachChild(node, (child) => collectScopes(child, scope));
  };

  collectScopes(root, programScope);

  const report = (node, kind, message) => {
    findings.push({ kind, message, ...locationOf(node) });
  };

  const inspectImport = (node, kind) => {
    const moduleName = importedModule(node);
    if (moduleName !== undefined && isAjvModule(moduleName)) {
      report(
        node,
        "ajv-import",
        `imports AJV compiler module ${JSON.stringify(moduleName)}`,
      );
    } else if (options.forbidImports) {
      report(node, kind, "imports runtime code from another module");
    }
  };

  const visit = (node) => {
    if (!isNode(node)) return;
    const scope = scopeByNode.get(node) ?? programScope;

    if (node.type === "ImportDeclaration") {
      inspectImport(node, "static-import");
    } else if (node.type === "ImportExpression") {
      inspectImport(node, "dynamic-import");
    } else if (
      node.type === "CallExpression" &&
      executableReferenceKind(node.callee, scope) === "eval-call"
    ) {
      report(node, "eval-call", "calls eval");
    } else if (
      (node.type === "CallExpression" || node.type === "NewExpression") &&
      executableReferenceKind(node.callee, scope) === "function-constructor"
    ) {
      report(
        node,
        "function-constructor",
        "constructs a function from a string",
      );
    } else if (
      node.type === "CallExpression" &&
      node.callee.type === "Identifier" &&
      node.callee.name === "require"
    ) {
      report(node, "require-call", "calls CommonJS require");
    }

    if (
      node.type === "ClassDeclaration" &&
      node.id?.type === "Identifier" &&
      node.id.name === "CodeGen"
    ) {
      report(node, "ajv-compiler", "declares AJV CodeGen compiler machinery");
    } else if (
      node.type === "FunctionDeclaration" &&
      node.id?.type === "Identifier" &&
      (node.id.name === "CodeGen" || node.id.name === "compileSchema")
    ) {
      report(
        node,
        "ajv-compiler",
        `declares AJV compiler marker ${node.id.name}`,
      );
    } else if (
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      (node.id.name === "CodeGen" || node.id.name === "compileSchema")
    ) {
      report(
        node,
        "ajv-compiler",
        `declares AJV compiler marker ${node.id.name}`,
      );
    } else if (
      node.type === "MemberExpression" &&
      !node.computed &&
      node.property.type === "Identifier" &&
      (node.property.name === "CodeGen" ||
        node.property.name === "compileSchema")
    ) {
      report(
        node,
        "ajv-compiler",
        `accesses AJV compiler marker ${node.property.name}`,
      );
    }

    forEachChild(node, visit);
  };

  visit(root);
  return findings;
}
