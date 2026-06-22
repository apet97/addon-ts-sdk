import {
  createClockifyCheckboxSetting,
  createClockifyDropdownMultipleSetting,
  createClockifyDropdownSingleSetting,
  createClockifyNumberSetting,
  createClockifyTextSetting,
  createClockifyUserDropdownMultipleSetting,
  createClockifyUserDropdownSingleSetting,
} from "../../src";

createClockifyTextSetting({
  id: "description",
  name: "Description",
  accessLevel: "ADMINS",
  value: "text",
});

createClockifyNumberSetting({
  id: "rate",
  name: "Rate",
  accessLevel: "ADMINS",
  value: 0,
});

createClockifyCheckboxSetting({
  id: "enabled",
  name: "Enabled",
  accessLevel: "EVERYONE",
  value: false,
});

createClockifyDropdownSingleSetting({
  id: "unit",
  name: "Unit",
  accessLevel: "ADMINS",
  value: "km",
  allowedValues: ["km", "mi"],
});

createClockifyDropdownMultipleSetting({
  id: "categories",
  name: "Categories",
  accessLevel: "ADMINS",
  value: ["fuel"],
  allowedValues: ["fuel", "parking"],
});

createClockifyUserDropdownSingleSetting({
  id: "approver",
  name: "Approver",
  accessLevel: "ADMINS",
  value: "user-1",
});

createClockifyUserDropdownMultipleSetting({
  id: "reviewers",
  name: "Reviewers",
  accessLevel: "ADMINS",
  value: ["user-1", "user-2"],
});

// @ts-expect-error text settings require string values
createClockifyTextSetting({ id: "bad", name: "Bad", accessLevel: "ADMINS", value: 1 });

// @ts-expect-error number settings require number values
createClockifyNumberSetting({ id: "bad", name: "Bad", accessLevel: "ADMINS", value: "1" });

// @ts-expect-error checkbox settings require boolean values
createClockifyCheckboxSetting({ id: "bad", name: "Bad", accessLevel: "ADMINS", value: "true" });

// @ts-expect-error dropdown single settings require allowedValues
createClockifyDropdownSingleSetting({
  id: "bad",
  name: "Bad",
  accessLevel: "ADMINS",
  value: "km",
});

createClockifyDropdownMultipleSetting({
  id: "bad",
  name: "Bad",
  accessLevel: "ADMINS",
  // @ts-expect-error dropdown multiple settings require string-array values
  value: "km",
  allowedValues: ["km"],
});

createClockifyUserDropdownSingleSetting({
  id: "bad",
  name: "Bad",
  accessLevel: "ADMINS",
  // @ts-expect-error user dropdown single settings require string values
  value: ["user-1"],
});

createClockifyUserDropdownMultipleSetting({
  id: "bad",
  name: "Bad",
  accessLevel: "ADMINS",
  // @ts-expect-error user dropdown multiple settings require string-array values
  value: "user-1",
});
