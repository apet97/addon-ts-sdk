import { describe, expect, it } from "vitest";
import {
  createClockifyCheckboxSetting,
  createClockifyDropdownMultipleSetting,
  createClockifyDropdownSingleSetting,
  createClockifyLinkSetting,
  createClockifyNumberSetting,
  createClockifyTextSetting,
  createClockifyUserDropdownMultipleSetting,
  createClockifyUserDropdownSingleSetting,
  ValidationException,
} from "../src";

describe("Clockify settings helpers", () => {
  it("creates text, number, checkbox, and link settings with matching value types", () => {
    expect(
      createClockifyTextSetting({
        id: "description",
        name: "Description",
        accessLevel: "ADMINS",
        value: "Required note",
        placeholder: "Add a note",
        required: true,
      }),
    ).toEqual({
      id: "description",
      name: "Description",
      accessLevel: "ADMINS",
      type: "TXT",
      value: "Required note",
      placeholder: "Add a note",
      required: true,
    });

    expect(
      createClockifyNumberSetting({
        id: "rate",
        name: "Mileage rate",
        accessLevel: "ADMINS",
        value: 0.42,
        key: "mileage-rate",
      }),
    ).toEqual({
      id: "rate",
      name: "Mileage rate",
      accessLevel: "ADMINS",
      type: "NUMBER",
      value: 0.42,
      key: "mileage-rate",
    });

    expect(
      createClockifyCheckboxSetting({
        id: "enabled",
        name: "Enabled",
        accessLevel: "EVERYONE",
        value: false,
        readOnly: true,
      }),
    ).toEqual({
      id: "enabled",
      name: "Enabled",
      accessLevel: "EVERYONE",
      type: "CHECKBOX",
      value: false,
      readOnly: true,
    });

    expect(
      createClockifyLinkSetting({
        id: "docs",
        name: "Docs",
        accessLevel: "EVERYONE",
        value: "https://example.com/docs",
        copyable: true,
      }),
    ).toEqual({
      id: "docs",
      name: "Docs",
      accessLevel: "EVERYONE",
      type: "LINK",
      value: "https://example.com/docs",
      copyable: true,
    });
  });

  it("creates dropdown settings with required allowed values", () => {
    expect(
      createClockifyDropdownSingleSetting({
        id: "distance-unit",
        name: "Distance unit",
        accessLevel: "ADMINS",
        value: "km",
        allowedValues: ["km", "mi"],
      }),
    ).toEqual({
      id: "distance-unit",
      name: "Distance unit",
      accessLevel: "ADMINS",
      type: "DROPDOWN_SINGLE",
      value: "km",
      allowedValues: ["km", "mi"],
    });

    expect(
      createClockifyDropdownMultipleSetting({
        id: "categories",
        name: "Categories",
        accessLevel: "ADMINS",
        value: ["fuel", "parking"],
        allowedValues: ["fuel", "parking", "tolls"],
      }),
    ).toEqual({
      id: "categories",
      name: "Categories",
      accessLevel: "ADMINS",
      type: "DROPDOWN_MULTIPLE",
      value: ["fuel", "parking"],
      allowedValues: ["fuel", "parking", "tolls"],
    });
  });

  it("creates user dropdown settings without requiring allowed values", () => {
    expect(
      createClockifyUserDropdownSingleSetting({
        id: "approver",
        name: "Approver",
        accessLevel: "ADMINS",
        value: "user-1",
      }),
    ).toEqual({
      id: "approver",
      name: "Approver",
      accessLevel: "ADMINS",
      type: "USER_DROPDOWN_SINGLE",
      value: "user-1",
    });

    expect(
      createClockifyUserDropdownMultipleSetting({
        id: "reviewers",
        name: "Reviewers",
        accessLevel: "ADMINS",
        value: ["user-1", "user-2"],
      }),
    ).toEqual({
      id: "reviewers",
      name: "Reviewers",
      accessLevel: "ADMINS",
      type: "USER_DROPDOWN_MULTIPLE",
      value: ["user-1", "user-2"],
    });
  });

  it("createClockifyTextSetting rejects a non-string value at runtime for JS callers", () => {
    expect(() =>
      createClockifyTextSetting({
        id: "description",
        name: "Description",
        accessLevel: "ADMINS",
        // @ts-expect-error — exercising the runtime guard for non-TS-checked callers
        value: 42,
      }),
    ).toThrow(ValidationException);
  });

  // Every setting factory validates its runtime value/allowedValues shape,
  // not just createClockifyTextSetting — a JS (non-TS-checked) caller can
  // pass anything, and TypeScript's compile-time check does not help there.
  const base = { id: "s", name: "Setting", accessLevel: "ADMINS" as const };

  it("createClockifyNumberSetting rejects a non-finite-number value at runtime", () => {
    expect(() =>
      createClockifyNumberSetting({ ...base, value: "123" as unknown as number }),
    ).toThrow(ValidationException);
    expect(() => createClockifyNumberSetting({ ...base, value: Number.POSITIVE_INFINITY })).toThrow(
      ValidationException,
    );
  });

  it("createClockifyCheckboxSetting rejects a non-boolean value at runtime", () => {
    expect(() =>
      createClockifyCheckboxSetting({ ...base, value: "true" as unknown as boolean }),
    ).toThrow(ValidationException);
  });

  it("createClockifyLinkSetting rejects a non-string value at runtime", () => {
    expect(() => createClockifyLinkSetting({ ...base, value: 42 as unknown as string })).toThrow(
      ValidationException,
    );
  });

  it("createClockifyDropdownSingleSetting rejects a non-string value or non-string allowedValues", () => {
    expect(() =>
      createClockifyDropdownSingleSetting({
        ...base,
        value: 1 as unknown as string,
        allowedValues: ["a"],
      }),
    ).toThrow(ValidationException);
    expect(() =>
      createClockifyDropdownSingleSetting({
        ...base,
        value: "a",
        allowedValues: "a" as unknown as string[],
      }),
    ).toThrow(ValidationException);
  });

  it("createClockifyDropdownMultipleSetting rejects a non-array value or non-string allowedValues entries", () => {
    expect(() =>
      createClockifyDropdownMultipleSetting({
        ...base,
        value: "a" as unknown as string[],
        allowedValues: ["a"],
      }),
    ).toThrow(ValidationException);
    expect(() =>
      createClockifyDropdownMultipleSetting({
        ...base,
        value: ["a"],
        allowedValues: [1 as unknown as string],
      }),
    ).toThrow(ValidationException);
  });

  it("createClockifyUserDropdownSingleSetting rejects a non-string value at runtime", () => {
    expect(() =>
      createClockifyUserDropdownSingleSetting({ ...base, value: 1 as unknown as string }),
    ).toThrow(ValidationException);
  });

  it("createClockifyUserDropdownMultipleSetting rejects a non-array value at runtime", () => {
    expect(() =>
      createClockifyUserDropdownMultipleSetting({ ...base, value: "a" as unknown as string[] }),
    ).toThrow(ValidationException);
  });
});
