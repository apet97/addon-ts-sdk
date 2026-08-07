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
});
