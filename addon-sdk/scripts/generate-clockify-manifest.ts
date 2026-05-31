import * as fs from "fs";
import * as path from "path";

const DEFINITIONS_MAP: Record<string, string> = {
  lifecycle: "lifecycleEvent",
};

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toMethodName(value: string): string {
  if (value === value.toUpperCase() && !/[.\-_]/.test(value)) {
    return value.toLowerCase();
  }
  const parts = value.split(/[.\-_]/);
  const words: string[] = [];
  for (let part of parts) {
    if (part === part.toUpperCase()) {
      part = part.toLowerCase();
    }
    const subparts = part.split(/(?=[A-Z])/);
    for (const sp of subparts) {
      if (sp) words.push(sp.toLowerCase());
    }
  }
  if (words.length === 0) return "";
  let res = words[0];
  for (let i = 1; i < words.length; i++) {
    res += capitalize(words[i]);
  }
  return res;
}

function toClassName(value: string): string {
  const methodName = toMethodName(value);
  return capitalize(methodName);
}

function getDefinitionSimpleClassName(defName: string): string {
  const suffix = DEFINITIONS_MAP[defName] || defName;
  return toClassName("Clockify_" + suffix);
}

function getEnumSetterMethodName(definition: string | null, property: string, value: string): string {
  let val = value;
  if (definition === "component") {
    if (property === "accessLevel") {
      val = "allow_" + val;
    }
  } else if (definition === "lifecycle") {
    if (property === "type") {
      val = "on_" + val;
    }
  } else if (definition === "webhook") {
    if (property === "event") {
      val = "on_" + val;
    }
  } else if (definition === "setting") {
    if (property === "type") {
      val = "as_" + val;
    } else if (property === "accessLevel") {
      val = "allow_" + val;
    }
  } else if (definition === null) {
    if (property === "minimalSubscriptionPlan") {
      val = "require_" + val + "_plan";
    }
  }
  return toMethodName(val);
}

function resolveRef(ref: string): string {
  return ref.substring(ref.lastIndexOf("/") + 1);
}

function getTSType(node: any, definitions: any): string {
  if (node.anyOf) {
    return node.anyOf.map((n: any) => getTSType(n, definitions)).join(" | ");
  }
  if (node.$ref) {
    const ref = resolveRef(node.$ref);
    if (ref === "url" || ref === "selfHostedSettings") {
      return "string";
    }
    return getDefinitionSimpleClassName(ref);
  }
  const type = node.type;
  if (Array.isArray(type)) {
    return type.map((t: string) => {
      if (t === "integer") return "number";
      if (t === "array") return "any[]";
      if (t === "object") return "Record<string, any>";
      return t;
    }).join(" | ");
  }
  if (type === "integer") {
    return "number";
  }
  if (type === "boolean") {
    return "boolean";
  }
  if (type === "string") {
    if (node.enum) {
      return node.enum.map((e: string) => JSON.stringify(e)).join(" | ");
    }
    return "string";
  }
  if (type === "array") {
    if (node.items) {
      return `${getTSType(node.items, definitions)}[]`;
    }
    return "any[]";
  }
  if (type === "object") {
    return "Record<string, any>";
  }
  return "any";
}

function generateVersion(schemaPath: string, outDir: string) {
  const schemaRaw = fs.readFileSync(schemaPath, "utf-8");
  const schema = JSON.parse(schemaRaw);
  const version = schema.version;
  const versionSuffix = version.replace(".", "_");
  const definitions = schema.definitions;

  const imports = `import { ClockifyResource } from "../clockify-resource";\n\n`;
  let content = imports;

  // Generate top-level enums (scope, minimalSubscriptionPlan)
  for (const [defName, defNode] of Object.entries(definitions) as [string, any][]) {
    if (defNode.type === "string" && defNode.enum) {
      const className = getDefinitionSimpleClassName(defName);
      content += `export const ${className} = {\n`;
      for (const val of defNode.enum) {
        content += `  ${val}: "${val}",\n`;
      }
      content += `} as const;\n\n`;
      content += `export type ${className} = typeof ${className}[keyof typeof ${className}];\n\n`;
    }
  }

  // Helper to gather properties of an object
  function getPropertiesInfo(propertiesNode: any, requiredList: string[]) {
    const props: any[] = [];
    const required = new Set(requiredList);
    for (const [propName, propNode] of Object.entries(propertiesNode) as [string, any][]) {
      if (propName === "schemaVersion") continue;
      const isReq = required.has(propName);
      const tsType = getTSType(propNode, definitions);
      const desc = propNode.description || "";
      props.push({
        name: propName,
        isReq,
        tsType,
        desc,
        node: propNode,
      });
    }
    return props;
  }

  // Pre-process definitions to generate interfaces first
  const objectDefs: { defName: string | null; className: string; properties: any[]; requiredList: string[] }[] = [];
  for (const [defName, defNode] of Object.entries(definitions) as [string, any][]) {
    if (defNode.type === "object") {
      const className = getDefinitionSimpleClassName(defName);
      const requiredList = defNode.required || [];
      const properties = getPropertiesInfo(defNode.properties, requiredList);
      objectDefs.push({ defName, className, properties, requiredList });
    }
  }

  // Add the Manifest itself as an object definition
  const manifestClassName = "ClockifyManifest";
  const manifestRequired = schema.required || [];
  const manifestProperties = getPropertiesInfo(schema.properties, manifestRequired);
  objectDefs.push({ defName: null, className: manifestClassName, properties: manifestProperties, requiredList: manifestRequired });

  // Generate Interfaces
  for (const obj of objectDefs) {
    const isManifest = obj.defName === null;
    const isResource = obj.defName !== null && ["lifecycle", "webhook", "component"].includes(obj.defName);
    const heritage = isResource ? " extends ClockifyResource" : "";

    content += `export interface ${obj.className}${heritage} {\n`;
    if (isManifest) {
      content += `  readonly schemaVersion: "${version}";\n`;
    }
    for (const prop of obj.properties) {
      const optional = prop.isReq ? "" : "?";
      content += `  readonly ${prop.name}${optional}: ${prop.tsType};\n`;
    }
    content += `}\n\n`;
  }

  // Generate Step Builders
  for (const obj of objectDefs) {
    const isManifest = obj.defName === null;
    // Required builder steps must follow the schema's `required` array order to match the
    // Java annotation processor (DefinitionProcessor reads `required`, not declaration order).
    const requiredProps = obj.requiredList
      .map((name: string) => obj.properties.find((p: any) => p.name === name))
      .filter((p: any): p is any => p != null && p.isReq);
    const optionalProps = obj.properties.filter(p => !p.isReq);

    // Write step interfaces
    for (let i = 0; i < requiredProps.length; i++) {
      const prop = requiredProps[i];
      const stepName = `${obj.className}Builder_${prop.name}`;
      const nextStepName = i === requiredProps.length - 1
        ? (optionalProps.length > 0 ? `${obj.className}Builder_Optional` : `${obj.className}Builder_Build`)
        : `${obj.className}Builder_${requiredProps[i + 1].name}`;

      content += `export interface ${stepName} {\n`;
      content += `  ${prop.name}(value: ${prop.tsType}): ${nextStepName};\n`;

      // Enum helpers
      let enumNode = prop.node;
      if (enumNode.$ref) {
        const refName = resolveRef(enumNode.$ref);
        enumNode = definitions[refName];
      }
      if (enumNode && enumNode.enum) {
        for (const enumVal of enumNode.enum) {
          const helperName = getEnumSetterMethodName(obj.defName, prop.name, enumVal);
          content += `  ${helperName}(): ${nextStepName};\n`;
        }
      }
      content += `}\n\n`;
    }

    // Optional steps or Build step
    const optionalStepName = `${obj.className}Builder_Optional`;
    if (optionalProps.length > 0) {
      content += `export interface ${optionalStepName} {\n`;
      for (const prop of optionalProps) {
        content += `  ${prop.name}(value: ${prop.tsType}): ${optionalStepName};\n`;

        // Enum helpers for optional fields
        let enumNode = prop.node;
        if (enumNode.$ref) {
          const refName = resolveRef(enumNode.$ref);
          enumNode = definitions[refName];
        }
        if (enumNode && enumNode.enum) {
          for (const enumVal of enumNode.enum) {
            const helperName = getEnumSetterMethodName(obj.defName, prop.name, enumVal);
            content += `  ${helperName}(): ${optionalStepName};\n`;
          }
        }
      }
      content += `  build(): ${obj.className};\n`;
      content += `}\n\n`;
    } else {
      const buildStepName = `${obj.className}Builder_Build`;
      content += `export interface ${buildStepName} {\n`;
      content += `  build(): ${obj.className};\n`;
      content += `}\n\n`;
    }

    // Implementation class
    const builderName = `${obj.className}BuilderImpl`;
    const firstStep = requiredProps.length > 0
      ? `${obj.className}Builder_${requiredProps[0].name}`
      : (optionalProps.length > 0 ? `${obj.className}Builder_Optional` : `${obj.className}Builder_Build`);

    content += `class ${builderName} implements `;
    const interfacesList: string[] = [];
    for (const prop of requiredProps) {
      interfacesList.push(`${obj.className}Builder_${prop.name}`);
    }
    if (optionalProps.length > 0) {
      interfacesList.push(`${obj.className}Builder_Optional`);
    } else {
      interfacesList.push(`${obj.className}Builder_Build`);
    }
    content += interfacesList.join(", ") + " {\n";

    // Fields
    for (const prop of obj.properties) {
      content += `  private _${prop.name}: any;\n`;
    }
    content += `\n`;

    // Constructor
    content += `  constructor() {\n`;
    for (const prop of obj.properties) {
      // Arrays default to empty list in Java SDK
      if (prop.node.type === "array") {
        content += `    this._${prop.name} = [];\n`;
      }
    }
    content += `  }\n\n`;

    // Implement primary setters
    for (const prop of obj.properties) {
      content += `  ${prop.name}(value: ${prop.tsType}): any {\n`;
      content += `    this._${prop.name} = value;\n`;
      content += `    return this;\n`;
      content += `  }\n\n`;

      // Enum helpers
      let enumNode = prop.node;
      if (enumNode.$ref) {
        const refName = resolveRef(enumNode.$ref);
        enumNode = definitions[refName];
      }
      if (enumNode && enumNode.enum) {
        for (const enumVal of enumNode.enum) {
          const helperName = getEnumSetterMethodName(obj.defName, prop.name, enumVal);
          content += `  ${helperName}(): any {\n`;
          content += `    return this.${prop.name}("${enumVal}");\n`;
          content += `  }\n\n`;
        }
      }
    }

    // Build method
    content += `  build(): ${obj.className} {\n`;
    // Required fields non-null assertion
    for (const prop of requiredProps) {
      content += `    if (this._${prop.name} === undefined || this._${prop.name} === null) {\n`;
      content += `      throw new Error("Required field '${prop.name}' is missing.");\n`;
      content += `    }\n`;
    }
    content += `    return {\n`;
    if (isManifest) {
      content += `      schemaVersion: "${version}",\n`;
    }
    for (const prop of obj.properties) {
      content += `      ${prop.name}: this._${prop.name},\n`;
    }
    content += `    } as any;\n`;
    content += `  }\n`;
    content += `}\n\n`;

    // Static builder entrypoint
    content += `export namespace ${obj.className} {\n`;
    content += `  export function builder(): ${firstStep} {\n`;
    content += `    return new ${builderName}();\n`;
    content += `  }\n`;
    content += `}\n\n`;

    content += `export function ${obj.className}Builder(): ${firstStep} {\n`;
    content += `  return new ${builderName}();\n`;
    content += `}\n\n`;
  }

  const outPath = path.join(outDir, `v${versionSuffix}.ts`);
  fs.writeFileSync(outPath, content, "utf-8");
  console.log(`Generated manifest builder for version ${version} at ${outPath}`);
}

function main() {
  const rootDir = path.join(__dirname, "..");
  const schemasDir = path.join(rootDir, "schemas", "clockify-manifests");
  const outDir = path.join(rootDir, "src", "clockify", "generated");

  fs.mkdirSync(outDir, { recursive: true });

  const schemas = ["1.2.json", "1.3.json", "1.4.json", "1.5.json"];
  for (const schemaName of schemas) {
    const schemaPath = path.join(schemasDir, schemaName);
    if (fs.existsSync(schemaPath)) {
      generateVersion(schemaPath, outDir);
    } else {
      console.warn(`Schema file not found: ${schemaPath}`);
    }
  }

  // Generate index.ts for the generated folder
  let indexContent = "";
  for (const schemaName of schemas) {
    const ver = schemaName.replace(".json", "").replace(".", "_");
    indexContent += `export * as v${ver} from "./v${ver}";\n`;
  }
  fs.writeFileSync(path.join(outDir, "index.ts"), indexContent, "utf-8");
  console.log(`Generated generated/index.ts`);
}

main();
