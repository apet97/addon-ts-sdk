import type { ClockifySetting } from "./clockify-models";
import { ValidationException } from "../shared/errors";

export type ClockifySettingAccessLevel = ClockifySetting["accessLevel"];

export interface ClockifyBaseSettingOptions {
  readonly id: string;
  readonly name: string;
  readonly accessLevel: ClockifySettingAccessLevel;
  readonly description?: string;
  readonly placeholder?: string;
  readonly key?: string;
  readonly required?: boolean;
  readonly copyable?: boolean;
  readonly readOnly?: boolean;
}

export interface ClockifyValueSettingOptions<Value> extends ClockifyBaseSettingOptions {
  readonly value: Value;
}

export interface ClockifyDropdownSettingOptions<Value> extends ClockifyValueSettingOptions<Value> {
  readonly allowedValues: string[];
}

type ClockifyBaseSettingFields = Omit<ClockifySetting, "type" | "value" | "allowedValues">;

export type ClockifyTypedSetting<
  Type extends ClockifySetting["type"],
  Value,
> = ClockifyBaseSettingFields & {
  readonly type: Type;
  readonly value: Value;
};

export type ClockifyDropdownSetting<
  Type extends ClockifySetting["type"],
  Value,
> = ClockifyTypedSetting<Type, Value> & {
  readonly allowedValues: string[];
};

export type ClockifyTextSettingOptions = ClockifyValueSettingOptions<string>;
export type ClockifyNumberSettingOptions = ClockifyValueSettingOptions<number>;
export type ClockifyCheckboxSettingOptions = ClockifyValueSettingOptions<boolean>;
export type ClockifyLinkSettingOptions = ClockifyValueSettingOptions<string>;
export type ClockifyDropdownSingleSettingOptions = ClockifyDropdownSettingOptions<string>;
export type ClockifyDropdownMultipleSettingOptions = ClockifyDropdownSettingOptions<string[]>;
export type ClockifyUserDropdownSingleSettingOptions = ClockifyValueSettingOptions<string>;
export type ClockifyUserDropdownMultipleSettingOptions = ClockifyValueSettingOptions<string[]>;

function baseSetting(input: ClockifyBaseSettingOptions): ClockifyBaseSettingFields {
  return {
    id: input.id,
    name: input.name,
    accessLevel: input.accessLevel,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.placeholder !== undefined ? { placeholder: input.placeholder } : {}),
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.required !== undefined ? { required: input.required } : {}),
    ...(input.copyable !== undefined ? { copyable: input.copyable } : {}),
    ...(input.readOnly !== undefined ? { readOnly: input.readOnly } : {}),
  };
}

function valueSetting<Type extends ClockifySetting["type"], Value>(
  type: Type,
  input: ClockifyValueSettingOptions<Value>,
): ClockifyTypedSetting<Type, Value> {
  return {
    ...baseSetting(input),
    type,
    value: input.value,
  };
}

function dropdownSetting<Type extends ClockifySetting["type"], Value>(
  type: Type,
  input: ClockifyDropdownSettingOptions<Value>,
): ClockifyDropdownSetting<Type, Value> {
  return {
    ...valueSetting(type, input),
    allowedValues: input.allowedValues,
  };
}

export function createClockifyTextSetting(
  input: ClockifyTextSettingOptions,
): ClockifyTypedSetting<"TXT", string> {
  // The type signature already enforces `value: string`; this guard exists for
  // JavaScript (non-TS-checked) callers who can pass anything at runtime.
  if (typeof input.value !== "string") {
    throw new ValidationException(
      `createClockifyTextSetting requires a string value — got ${typeof input.value}.`,
    );
  }
  return valueSetting("TXT", input);
}

export function createClockifyNumberSetting(
  input: ClockifyNumberSettingOptions,
): ClockifyTypedSetting<"NUMBER", number> {
  return valueSetting("NUMBER", input);
}

export function createClockifyCheckboxSetting(
  input: ClockifyCheckboxSettingOptions,
): ClockifyTypedSetting<"CHECKBOX", boolean> {
  return valueSetting("CHECKBOX", input);
}

export function createClockifyLinkSetting(
  input: ClockifyLinkSettingOptions,
): ClockifyTypedSetting<"LINK", string> {
  return valueSetting("LINK", input);
}

export function createClockifyDropdownSingleSetting(
  input: ClockifyDropdownSingleSettingOptions,
): ClockifyDropdownSetting<"DROPDOWN_SINGLE", string> {
  return dropdownSetting("DROPDOWN_SINGLE", input);
}

export function createClockifyDropdownMultipleSetting(
  input: ClockifyDropdownMultipleSettingOptions,
): ClockifyDropdownSetting<"DROPDOWN_MULTIPLE", string[]> {
  return dropdownSetting("DROPDOWN_MULTIPLE", input);
}

export function createClockifyUserDropdownSingleSetting(
  input: ClockifyUserDropdownSingleSettingOptions,
): ClockifyTypedSetting<"USER_DROPDOWN_SINGLE", string> {
  return valueSetting("USER_DROPDOWN_SINGLE", input);
}

export function createClockifyUserDropdownMultipleSetting(
  input: ClockifyUserDropdownMultipleSettingOptions,
): ClockifyTypedSetting<"USER_DROPDOWN_MULTIPLE", string[]> {
  return valueSetting("USER_DROPDOWN_MULTIPLE", input);
}
