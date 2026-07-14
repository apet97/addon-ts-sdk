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

function executableReferenceKind(node, aliases) {
  if (!isNode(node)) return undefined;
  if (node.type === "ChainExpression") {
    return executableReferenceKind(node.expression, aliases);
  }
  if (node.type === "SequenceExpression") {
    return executableReferenceKind(node.expressions.at(-1), aliases);
  }
  if (node.type === "Identifier") {
    if (node.name === "eval") return "eval-call";
    if (node.name === "Function") return "function-constructor";
    return aliases.get(node.name);
  }
  if (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "globalThis"
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
  const executableAliases = new Map();

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

    if (node.type === "VariableDeclaration" && node.kind === "const") {
      for (const declaration of node.declarations) {
        if (declaration.id.type !== "Identifier") continue;
        const kind = executableReferenceKind(
          declaration.init,
          executableAliases,
        );
        if (kind !== undefined)
          executableAliases.set(declaration.id.name, kind);
      }
    }

    if (node.type === "ImportDeclaration") {
      inspectImport(node, "static-import");
    } else if (node.type === "ImportExpression") {
      inspectImport(node, "dynamic-import");
    } else if (
      node.type === "CallExpression" &&
      executableReferenceKind(node.callee, executableAliases) === "eval-call"
    ) {
      report(node, "eval-call", "calls eval");
    } else if (
      (node.type === "CallExpression" || node.type === "NewExpression") &&
      executableReferenceKind(node.callee, executableAliases) ===
        "function-constructor"
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

    for (const [key, value] of Object.entries(node)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
      } else {
        visit(value);
      }
    }
  };

  visit(root);
  return findings;
}
