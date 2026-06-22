import { ClockifyResource } from "../clockify-resource";

export const ClockifyScope = {
  "CLIENT_READ": "CLIENT_READ",
  "CLIENT_WRITE": "CLIENT_WRITE",
  "PROJECT_READ": "PROJECT_READ",
  "PROJECT_WRITE": "PROJECT_WRITE",
  "TAG_READ": "TAG_READ",
  "TAG_WRITE": "TAG_WRITE",
  "TASK_READ": "TASK_READ",
  "TASK_WRITE": "TASK_WRITE",
  "TIME_ENTRY_READ": "TIME_ENTRY_READ",
  "TIME_ENTRY_WRITE": "TIME_ENTRY_WRITE",
  "EXPENSE_READ": "EXPENSE_READ",
  "EXPENSE_WRITE": "EXPENSE_WRITE",
  "INVOICE_READ": "INVOICE_READ",
  "INVOICE_WRITE": "INVOICE_WRITE",
  "USER_READ": "USER_READ",
  "USER_WRITE": "USER_WRITE",
  "GROUP_READ": "GROUP_READ",
  "GROUP_WRITE": "GROUP_WRITE",
  "WORKSPACE_READ": "WORKSPACE_READ",
  "WORKSPACE_WRITE": "WORKSPACE_WRITE",
  "CUSTOM_FIELDS_READ": "CUSTOM_FIELDS_READ",
  "CUSTOM_FIELDS_WRITE": "CUSTOM_FIELDS_WRITE",
  "APPROVAL_READ": "APPROVAL_READ",
  "APPROVAL_WRITE": "APPROVAL_WRITE",
  "SCHEDULING_READ": "SCHEDULING_READ",
  "SCHEDULING_WRITE": "SCHEDULING_WRITE",
  "REPORTS_READ": "REPORTS_READ",
  "REPORTS_WRITE": "REPORTS_WRITE",
  "TIME_OFF_READ": "TIME_OFF_READ",
  "TIME_OFF_WRITE": "TIME_OFF_WRITE",
} as const;

export type ClockifyScope = typeof ClockifyScope[keyof typeof ClockifyScope];

export const ClockifyMinimalSubscriptionPlan = {
  "FREE": "FREE",
  "BASIC": "BASIC",
  "STANDARD": "STANDARD",
  "PRO": "PRO",
  "ENTERPRISE": "ENTERPRISE",
} as const;

export type ClockifyMinimalSubscriptionPlan = typeof ClockifyMinimalSubscriptionPlan[keyof typeof ClockifyMinimalSubscriptionPlan];

export interface ClockifyWebhook extends ClockifyResource {
  readonly event: "NEW_PROJECT" | "NEW_TASK" | "NEW_CLIENT" | "NEW_TAG" | "NEW_TIMER_STARTED" | "TIMER_STOPPED" | "TIME_ENTRY_UPDATED" | "TIME_ENTRY_DELETED" | "NEW_TIME_ENTRY" | "NEW_INVOICE" | "INVOICE_UPDATED" | "USER_JOINED_WORKSPACE" | "USER_DELETED_FROM_WORKSPACE" | "USER_DEACTIVATED_ON_WORKSPACE" | "USER_ACTIVATED_ON_WORKSPACE" | "NEW_APPROVAL_REQUEST" | "APPROVAL_REQUEST_STATUS_UPDATED" | "TIME_OFF_REQUESTED" | "TIME_OFF_REQUEST_APPROVED" | "TIME_OFF_REQUEST_REJECTED" | "TIME_OFF_REQUEST_WITHDRAWN" | "BALANCE_UPDATED";
  readonly path: string;
}

export interface ClockifyLifecycleEvent extends ClockifyResource {
  readonly path: string;
  readonly type: "INSTALLED" | "DELETED" | "SETTINGS_UPDATED" | "STATUS_CHANGED";
}

export interface ClockifyComponent extends ClockifyResource {
  readonly type: "sidebar" | "widget" | "timeoff.tab" | "schedule.tab" | "approvals.tab" | "reports.tab" | "activity.tab" | "team.tab" | "projects.tab" | "invoices.action";
  readonly options?: Record<string, any>;
  readonly label: string;
  readonly accessLevel: "ADMINS" | "EVERYONE";
  readonly path: string;
  readonly iconPath?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface ClockifySetting {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly accessLevel: "ADMINS" | "EVERYONE";
  readonly type: "TXT" | "NUMBER" | "DROPDOWN_SINGLE" | "DROPDOWN_MULTIPLE" | "CHECKBOX" | "LINK" | "USER_DROPDOWN_SINGLE" | "USER_DROPDOWN_MULTIPLE";
  readonly key?: string;
  readonly value: string | number | any[] | boolean;
  readonly allowedValues?: string[];
  readonly required?: boolean;
  readonly copyable?: boolean;
  readonly readOnly?: boolean;
}

export interface ClockifySettingsHeader {
  readonly title: string;
}

export interface ClockifySettingsGroup {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly header?: ClockifySettingsHeader;
  readonly settings: ClockifySetting[];
}

export interface ClockifySettingsTab {
  readonly id: string;
  readonly name: string;
  readonly header?: ClockifySettingsHeader;
  readonly groups?: ClockifySettingsGroup[];
  readonly settings?: ClockifySetting[];
}

export interface ClockifySettings {
  readonly tabs: ClockifySettingsTab[];
}

export interface ClockifyManifest {
  readonly schemaVersion: "1.4";
  readonly key: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly minimalSubscriptionPlan: ClockifyMinimalSubscriptionPlan;
  readonly scopes?: ClockifyScope[];
  readonly description?: string;
  readonly iconPath?: string;
  readonly lifecycle?: ClockifyLifecycleEvent[];
  readonly webhooks?: ClockifyWebhook[];
  readonly components?: ClockifyComponent[];
  readonly settings?: string | ClockifySettings;
}

export interface ClockifyWebhookBuilder_event {
  event(value: "NEW_PROJECT" | "NEW_TASK" | "NEW_CLIENT" | "NEW_TAG" | "NEW_TIMER_STARTED" | "TIMER_STOPPED" | "TIME_ENTRY_UPDATED" | "TIME_ENTRY_DELETED" | "NEW_TIME_ENTRY" | "NEW_INVOICE" | "INVOICE_UPDATED" | "USER_JOINED_WORKSPACE" | "USER_DELETED_FROM_WORKSPACE" | "USER_DEACTIVATED_ON_WORKSPACE" | "USER_ACTIVATED_ON_WORKSPACE" | "NEW_APPROVAL_REQUEST" | "APPROVAL_REQUEST_STATUS_UPDATED" | "TIME_OFF_REQUESTED" | "TIME_OFF_REQUEST_APPROVED" | "TIME_OFF_REQUEST_REJECTED" | "TIME_OFF_REQUEST_WITHDRAWN" | "BALANCE_UPDATED"): ClockifyWebhookBuilder_path;
  onNewProject(): ClockifyWebhookBuilder_path;
  onNewTask(): ClockifyWebhookBuilder_path;
  onNewClient(): ClockifyWebhookBuilder_path;
  onNewTag(): ClockifyWebhookBuilder_path;
  onNewTimerStarted(): ClockifyWebhookBuilder_path;
  onTimerStopped(): ClockifyWebhookBuilder_path;
  onTimeEntryUpdated(): ClockifyWebhookBuilder_path;
  onTimeEntryDeleted(): ClockifyWebhookBuilder_path;
  onNewTimeEntry(): ClockifyWebhookBuilder_path;
  onNewInvoice(): ClockifyWebhookBuilder_path;
  onInvoiceUpdated(): ClockifyWebhookBuilder_path;
  onUserJoinedWorkspace(): ClockifyWebhookBuilder_path;
  onUserDeletedFromWorkspace(): ClockifyWebhookBuilder_path;
  onUserDeactivatedOnWorkspace(): ClockifyWebhookBuilder_path;
  onUserActivatedOnWorkspace(): ClockifyWebhookBuilder_path;
  onNewApprovalRequest(): ClockifyWebhookBuilder_path;
  onApprovalRequestStatusUpdated(): ClockifyWebhookBuilder_path;
  onTimeOffRequested(): ClockifyWebhookBuilder_path;
  onTimeOffRequestApproved(): ClockifyWebhookBuilder_path;
  onTimeOffRequestRejected(): ClockifyWebhookBuilder_path;
  onTimeOffRequestWithdrawn(): ClockifyWebhookBuilder_path;
  onBalanceUpdated(): ClockifyWebhookBuilder_path;
}

export interface ClockifyWebhookBuilder_path {
  path(value: string): ClockifyWebhookBuilder_Build;
}

export interface ClockifyWebhookBuilder_Build {
  build(): ClockifyWebhook;
}

class ClockifyWebhookBuilderImpl implements ClockifyWebhookBuilder_event, ClockifyWebhookBuilder_path, ClockifyWebhookBuilder_Build {
  private _event: any;
  private _path: any;

  constructor() {
  }

  event(value: "NEW_PROJECT" | "NEW_TASK" | "NEW_CLIENT" | "NEW_TAG" | "NEW_TIMER_STARTED" | "TIMER_STOPPED" | "TIME_ENTRY_UPDATED" | "TIME_ENTRY_DELETED" | "NEW_TIME_ENTRY" | "NEW_INVOICE" | "INVOICE_UPDATED" | "USER_JOINED_WORKSPACE" | "USER_DELETED_FROM_WORKSPACE" | "USER_DEACTIVATED_ON_WORKSPACE" | "USER_ACTIVATED_ON_WORKSPACE" | "NEW_APPROVAL_REQUEST" | "APPROVAL_REQUEST_STATUS_UPDATED" | "TIME_OFF_REQUESTED" | "TIME_OFF_REQUEST_APPROVED" | "TIME_OFF_REQUEST_REJECTED" | "TIME_OFF_REQUEST_WITHDRAWN" | "BALANCE_UPDATED"): any {
    this._event = value;
    return this;
  }

  onNewProject(): any {
    return this.event("NEW_PROJECT");
  }

  onNewTask(): any {
    return this.event("NEW_TASK");
  }

  onNewClient(): any {
    return this.event("NEW_CLIENT");
  }

  onNewTag(): any {
    return this.event("NEW_TAG");
  }

  onNewTimerStarted(): any {
    return this.event("NEW_TIMER_STARTED");
  }

  onTimerStopped(): any {
    return this.event("TIMER_STOPPED");
  }

  onTimeEntryUpdated(): any {
    return this.event("TIME_ENTRY_UPDATED");
  }

  onTimeEntryDeleted(): any {
    return this.event("TIME_ENTRY_DELETED");
  }

  onNewTimeEntry(): any {
    return this.event("NEW_TIME_ENTRY");
  }

  onNewInvoice(): any {
    return this.event("NEW_INVOICE");
  }

  onInvoiceUpdated(): any {
    return this.event("INVOICE_UPDATED");
  }

  onUserJoinedWorkspace(): any {
    return this.event("USER_JOINED_WORKSPACE");
  }

  onUserDeletedFromWorkspace(): any {
    return this.event("USER_DELETED_FROM_WORKSPACE");
  }

  onUserDeactivatedOnWorkspace(): any {
    return this.event("USER_DEACTIVATED_ON_WORKSPACE");
  }

  onUserActivatedOnWorkspace(): any {
    return this.event("USER_ACTIVATED_ON_WORKSPACE");
  }

  onNewApprovalRequest(): any {
    return this.event("NEW_APPROVAL_REQUEST");
  }

  onApprovalRequestStatusUpdated(): any {
    return this.event("APPROVAL_REQUEST_STATUS_UPDATED");
  }

  onTimeOffRequested(): any {
    return this.event("TIME_OFF_REQUESTED");
  }

  onTimeOffRequestApproved(): any {
    return this.event("TIME_OFF_REQUEST_APPROVED");
  }

  onTimeOffRequestRejected(): any {
    return this.event("TIME_OFF_REQUEST_REJECTED");
  }

  onTimeOffRequestWithdrawn(): any {
    return this.event("TIME_OFF_REQUEST_WITHDRAWN");
  }

  onBalanceUpdated(): any {
    return this.event("BALANCE_UPDATED");
  }

  path(value: string): any {
    this._path = value;
    return this;
  }

  build(): ClockifyWebhook {
    if (this._event === undefined || this._event === null) {
      throw new Error("Required field 'event' is missing.");
    }
    if (this._path === undefined || this._path === null) {
      throw new Error("Required field 'path' is missing.");
    }
    return {
      event: this._event,
      path: this._path,
    } as any;
  }
}

export namespace ClockifyWebhook {
  export function builder(): ClockifyWebhookBuilder_event {
    return new ClockifyWebhookBuilderImpl();
  }
}

export function ClockifyWebhookBuilder(): ClockifyWebhookBuilder_event {
  return new ClockifyWebhookBuilderImpl();
}

export interface ClockifyLifecycleEventBuilder_path {
  path(value: string): ClockifyLifecycleEventBuilder_type;
}

export interface ClockifyLifecycleEventBuilder_type {
  type(value: "INSTALLED" | "DELETED" | "SETTINGS_UPDATED" | "STATUS_CHANGED"): ClockifyLifecycleEventBuilder_Build;
  onInstalled(): ClockifyLifecycleEventBuilder_Build;
  onDeleted(): ClockifyLifecycleEventBuilder_Build;
  onSettingsUpdated(): ClockifyLifecycleEventBuilder_Build;
  onStatusChanged(): ClockifyLifecycleEventBuilder_Build;
}

export interface ClockifyLifecycleEventBuilder_Build {
  build(): ClockifyLifecycleEvent;
}

class ClockifyLifecycleEventBuilderImpl implements ClockifyLifecycleEventBuilder_path, ClockifyLifecycleEventBuilder_type, ClockifyLifecycleEventBuilder_Build {
  private _path: any;
  private _type: any;

  constructor() {
  }

  path(value: string): any {
    this._path = value;
    return this;
  }

  type(value: "INSTALLED" | "DELETED" | "SETTINGS_UPDATED" | "STATUS_CHANGED"): any {
    this._type = value;
    return this;
  }

  onInstalled(): any {
    return this.type("INSTALLED");
  }

  onDeleted(): any {
    return this.type("DELETED");
  }

  onSettingsUpdated(): any {
    return this.type("SETTINGS_UPDATED");
  }

  onStatusChanged(): any {
    return this.type("STATUS_CHANGED");
  }

  build(): ClockifyLifecycleEvent {
    if (this._path === undefined || this._path === null) {
      throw new Error("Required field 'path' is missing.");
    }
    if (this._type === undefined || this._type === null) {
      throw new Error("Required field 'type' is missing.");
    }
    return {
      path: this._path,
      type: this._type,
    } as any;
  }
}

export namespace ClockifyLifecycleEvent {
  export function builder(): ClockifyLifecycleEventBuilder_path {
    return new ClockifyLifecycleEventBuilderImpl();
  }
}

export function ClockifyLifecycleEventBuilder(): ClockifyLifecycleEventBuilder_path {
  return new ClockifyLifecycleEventBuilderImpl();
}

export interface ClockifyComponentBuilder_type {
  type(value: "sidebar" | "widget" | "timeoff.tab" | "schedule.tab" | "approvals.tab" | "reports.tab" | "activity.tab" | "team.tab" | "projects.tab" | "invoices.action"): ClockifyComponentBuilder_accessLevel;
  sidebar(): ClockifyComponentBuilder_accessLevel;
  widget(): ClockifyComponentBuilder_accessLevel;
  timeoffTab(): ClockifyComponentBuilder_accessLevel;
  scheduleTab(): ClockifyComponentBuilder_accessLevel;
  approvalsTab(): ClockifyComponentBuilder_accessLevel;
  reportsTab(): ClockifyComponentBuilder_accessLevel;
  activityTab(): ClockifyComponentBuilder_accessLevel;
  teamTab(): ClockifyComponentBuilder_accessLevel;
  projectsTab(): ClockifyComponentBuilder_accessLevel;
  invoicesAction(): ClockifyComponentBuilder_accessLevel;
}

export interface ClockifyComponentBuilder_accessLevel {
  accessLevel(value: "ADMINS" | "EVERYONE"): ClockifyComponentBuilder_path;
  allowAdmins(): ClockifyComponentBuilder_path;
  allowEveryone(): ClockifyComponentBuilder_path;
}

export interface ClockifyComponentBuilder_path {
  path(value: string): ClockifyComponentBuilder_label;
}

export interface ClockifyComponentBuilder_label {
  label(value: string): ClockifyComponentBuilder_Optional;
}

export interface ClockifyComponentBuilder_Optional {
  options(value: Record<string, any>): ClockifyComponentBuilder_Optional;
  iconPath(value: string): ClockifyComponentBuilder_Optional;
  width(value: number): ClockifyComponentBuilder_Optional;
  height(value: number): ClockifyComponentBuilder_Optional;
  build(): ClockifyComponent;
}

class ClockifyComponentBuilderImpl implements ClockifyComponentBuilder_type, ClockifyComponentBuilder_accessLevel, ClockifyComponentBuilder_path, ClockifyComponentBuilder_label, ClockifyComponentBuilder_Optional {
  private _type: any;
  private _options: any;
  private _label: any;
  private _accessLevel: any;
  private _path: any;
  private _iconPath: any;
  private _width: any;
  private _height: any;

  constructor() {
  }

  type(value: "sidebar" | "widget" | "timeoff.tab" | "schedule.tab" | "approvals.tab" | "reports.tab" | "activity.tab" | "team.tab" | "projects.tab" | "invoices.action"): any {
    this._type = value;
    return this;
  }

  sidebar(): any {
    return this.type("sidebar");
  }

  widget(): any {
    return this.type("widget");
  }

  timeoffTab(): any {
    return this.type("timeoff.tab");
  }

  scheduleTab(): any {
    return this.type("schedule.tab");
  }

  approvalsTab(): any {
    return this.type("approvals.tab");
  }

  reportsTab(): any {
    return this.type("reports.tab");
  }

  activityTab(): any {
    return this.type("activity.tab");
  }

  teamTab(): any {
    return this.type("team.tab");
  }

  projectsTab(): any {
    return this.type("projects.tab");
  }

  invoicesAction(): any {
    return this.type("invoices.action");
  }

  options(value: Record<string, any>): any {
    this._options = value;
    return this;
  }

  label(value: string): any {
    this._label = value;
    return this;
  }

  accessLevel(value: "ADMINS" | "EVERYONE"): any {
    this._accessLevel = value;
    return this;
  }

  allowAdmins(): any {
    return this.accessLevel("ADMINS");
  }

  allowEveryone(): any {
    return this.accessLevel("EVERYONE");
  }

  path(value: string): any {
    this._path = value;
    return this;
  }

  iconPath(value: string): any {
    this._iconPath = value;
    return this;
  }

  width(value: number): any {
    this._width = value;
    return this;
  }

  height(value: number): any {
    this._height = value;
    return this;
  }

  build(): ClockifyComponent {
    if (this._type === undefined || this._type === null) {
      throw new Error("Required field 'type' is missing.");
    }
    if (this._accessLevel === undefined || this._accessLevel === null) {
      throw new Error("Required field 'accessLevel' is missing.");
    }
    if (this._path === undefined || this._path === null) {
      throw new Error("Required field 'path' is missing.");
    }
    if (this._label === undefined || this._label === null) {
      throw new Error("Required field 'label' is missing.");
    }
    return {
      type: this._type,
      options: this._options,
      label: this._label,
      accessLevel: this._accessLevel,
      path: this._path,
      iconPath: this._iconPath,
      width: this._width,
      height: this._height,
    } as any;
  }
}

export namespace ClockifyComponent {
  export function builder(): ClockifyComponentBuilder_type {
    return new ClockifyComponentBuilderImpl();
  }
}

export function ClockifyComponentBuilder(): ClockifyComponentBuilder_type {
  return new ClockifyComponentBuilderImpl();
}

export interface ClockifySettingBuilder_id {
  id(value: string): ClockifySettingBuilder_name;
}

export interface ClockifySettingBuilder_name {
  name(value: string): ClockifySettingBuilder_accessLevel;
}

export interface ClockifySettingBuilder_accessLevel {
  accessLevel(value: "ADMINS" | "EVERYONE"): ClockifySettingBuilder_type;
  allowAdmins(): ClockifySettingBuilder_type;
  allowEveryone(): ClockifySettingBuilder_type;
}

export interface ClockifySettingBuilder_type {
  type(value: "TXT" | "NUMBER" | "DROPDOWN_SINGLE" | "DROPDOWN_MULTIPLE" | "CHECKBOX" | "LINK" | "USER_DROPDOWN_SINGLE" | "USER_DROPDOWN_MULTIPLE"): ClockifySettingBuilder_value;
  asTxt(): ClockifySettingBuilder_value;
  asNumber(): ClockifySettingBuilder_value;
  asDropdownSingle(): ClockifySettingBuilder_value;
  asDropdownMultiple(): ClockifySettingBuilder_value;
  asCheckbox(): ClockifySettingBuilder_value;
  asLink(): ClockifySettingBuilder_value;
  asUserDropdownSingle(): ClockifySettingBuilder_value;
  asUserDropdownMultiple(): ClockifySettingBuilder_value;
}

export interface ClockifySettingBuilder_value {
  value(value: string | number | any[] | boolean): ClockifySettingBuilder_Optional;
}

export interface ClockifySettingBuilder_Optional {
  description(value: string): ClockifySettingBuilder_Optional;
  placeholder(value: string): ClockifySettingBuilder_Optional;
  key(value: string): ClockifySettingBuilder_Optional;
  allowedValues(value: string[]): ClockifySettingBuilder_Optional;
  required(value: boolean): ClockifySettingBuilder_Optional;
  copyable(value: boolean): ClockifySettingBuilder_Optional;
  readOnly(value: boolean): ClockifySettingBuilder_Optional;
  build(): ClockifySetting;
}

class ClockifySettingBuilderImpl implements ClockifySettingBuilder_id, ClockifySettingBuilder_name, ClockifySettingBuilder_accessLevel, ClockifySettingBuilder_type, ClockifySettingBuilder_value, ClockifySettingBuilder_Optional {
  private _id: any;
  private _name: any;
  private _description: any;
  private _placeholder: any;
  private _accessLevel: any;
  private _type: any;
  private _key: any;
  private _value: any;
  private _allowedValues: any;
  private _required: any;
  private _copyable: any;
  private _readOnly: any;

  constructor() {
    this._allowedValues = [];
  }

  id(value: string): any {
    this._id = value;
    return this;
  }

  name(value: string): any {
    this._name = value;
    return this;
  }

  description(value: string): any {
    this._description = value;
    return this;
  }

  placeholder(value: string): any {
    this._placeholder = value;
    return this;
  }

  accessLevel(value: "ADMINS" | "EVERYONE"): any {
    this._accessLevel = value;
    return this;
  }

  allowAdmins(): any {
    return this.accessLevel("ADMINS");
  }

  allowEveryone(): any {
    return this.accessLevel("EVERYONE");
  }

  type(value: "TXT" | "NUMBER" | "DROPDOWN_SINGLE" | "DROPDOWN_MULTIPLE" | "CHECKBOX" | "LINK" | "USER_DROPDOWN_SINGLE" | "USER_DROPDOWN_MULTIPLE"): any {
    this._type = value;
    return this;
  }

  asTxt(): any {
    return this.type("TXT");
  }

  asNumber(): any {
    return this.type("NUMBER");
  }

  asDropdownSingle(): any {
    return this.type("DROPDOWN_SINGLE");
  }

  asDropdownMultiple(): any {
    return this.type("DROPDOWN_MULTIPLE");
  }

  asCheckbox(): any {
    return this.type("CHECKBOX");
  }

  asLink(): any {
    return this.type("LINK");
  }

  asUserDropdownSingle(): any {
    return this.type("USER_DROPDOWN_SINGLE");
  }

  asUserDropdownMultiple(): any {
    return this.type("USER_DROPDOWN_MULTIPLE");
  }

  key(value: string): any {
    this._key = value;
    return this;
  }

  value(value: string | number | any[] | boolean): any {
    this._value = value;
    return this;
  }

  allowedValues(value: string[]): any {
    this._allowedValues = value;
    return this;
  }

  required(value: boolean): any {
    this._required = value;
    return this;
  }

  copyable(value: boolean): any {
    this._copyable = value;
    return this;
  }

  readOnly(value: boolean): any {
    this._readOnly = value;
    return this;
  }

  build(): ClockifySetting {
    if (this._id === undefined || this._id === null) {
      throw new Error("Required field 'id' is missing.");
    }
    if (this._name === undefined || this._name === null) {
      throw new Error("Required field 'name' is missing.");
    }
    if (this._accessLevel === undefined || this._accessLevel === null) {
      throw new Error("Required field 'accessLevel' is missing.");
    }
    if (this._type === undefined || this._type === null) {
      throw new Error("Required field 'type' is missing.");
    }
    if (this._value === undefined || this._value === null) {
      throw new Error("Required field 'value' is missing.");
    }
    return {
      id: this._id,
      name: this._name,
      description: this._description,
      placeholder: this._placeholder,
      accessLevel: this._accessLevel,
      type: this._type,
      key: this._key,
      value: this._value,
      allowedValues: this._allowedValues,
      required: this._required,
      copyable: this._copyable,
      readOnly: this._readOnly,
    } as any;
  }
}

export namespace ClockifySetting {
  export function builder(): ClockifySettingBuilder_id {
    return new ClockifySettingBuilderImpl();
  }
}

export function ClockifySettingBuilder(): ClockifySettingBuilder_id {
  return new ClockifySettingBuilderImpl();
}

export interface ClockifySettingsHeaderBuilder_title {
  title(value: string): ClockifySettingsHeaderBuilder_Build;
}

export interface ClockifySettingsHeaderBuilder_Build {
  build(): ClockifySettingsHeader;
}

class ClockifySettingsHeaderBuilderImpl implements ClockifySettingsHeaderBuilder_title, ClockifySettingsHeaderBuilder_Build {
  private _title: any;

  constructor() {
  }

  title(value: string): any {
    this._title = value;
    return this;
  }

  build(): ClockifySettingsHeader {
    if (this._title === undefined || this._title === null) {
      throw new Error("Required field 'title' is missing.");
    }
    return {
      title: this._title,
    } as any;
  }
}

export namespace ClockifySettingsHeader {
  export function builder(): ClockifySettingsHeaderBuilder_title {
    return new ClockifySettingsHeaderBuilderImpl();
  }
}

export function ClockifySettingsHeaderBuilder(): ClockifySettingsHeaderBuilder_title {
  return new ClockifySettingsHeaderBuilderImpl();
}

export interface ClockifySettingsGroupBuilder_id {
  id(value: string): ClockifySettingsGroupBuilder_title;
}

export interface ClockifySettingsGroupBuilder_title {
  title(value: string): ClockifySettingsGroupBuilder_settings;
}

export interface ClockifySettingsGroupBuilder_settings {
  settings(value: ClockifySetting[]): ClockifySettingsGroupBuilder_Optional;
}

export interface ClockifySettingsGroupBuilder_Optional {
  description(value: string): ClockifySettingsGroupBuilder_Optional;
  header(value: ClockifySettingsHeader): ClockifySettingsGroupBuilder_Optional;
  build(): ClockifySettingsGroup;
}

class ClockifySettingsGroupBuilderImpl implements ClockifySettingsGroupBuilder_id, ClockifySettingsGroupBuilder_title, ClockifySettingsGroupBuilder_settings, ClockifySettingsGroupBuilder_Optional {
  private _id: any;
  private _title: any;
  private _description: any;
  private _header: any;
  private _settings: any;
  private _settingsSet = false;

  constructor() {
    this._settings = [];
  }

  id(value: string): any {
    this._id = value;
    return this;
  }

  title(value: string): any {
    this._title = value;
    return this;
  }

  description(value: string): any {
    this._description = value;
    return this;
  }

  header(value: ClockifySettingsHeader): any {
    this._header = value;
    return this;
  }

  settings(value: ClockifySetting[]): any {
    this._settings = value;
    this._settingsSet = true;
    return this;
  }

  build(): ClockifySettingsGroup {
    if (this._id === undefined || this._id === null) {
      throw new Error("Required field 'id' is missing.");
    }
    if (this._title === undefined || this._title === null) {
      throw new Error("Required field 'title' is missing.");
    }
    if (!this._settingsSet || this._settings === undefined || this._settings === null) {
      throw new Error("Required field 'settings' is missing.");
    }
    return {
      id: this._id,
      title: this._title,
      description: this._description,
      header: this._header,
      settings: this._settings,
    } as any;
  }
}

export namespace ClockifySettingsGroup {
  export function builder(): ClockifySettingsGroupBuilder_id {
    return new ClockifySettingsGroupBuilderImpl();
  }
}

export function ClockifySettingsGroupBuilder(): ClockifySettingsGroupBuilder_id {
  return new ClockifySettingsGroupBuilderImpl();
}

export interface ClockifySettingsTabBuilder_id {
  id(value: string): ClockifySettingsTabBuilder_name;
}

export interface ClockifySettingsTabBuilder_name {
  name(value: string): ClockifySettingsTabBuilder_Optional;
}

export interface ClockifySettingsTabBuilder_Optional {
  header(value: ClockifySettingsHeader): ClockifySettingsTabBuilder_Optional;
  groups(value: ClockifySettingsGroup[]): ClockifySettingsTabBuilder_Optional;
  settings(value: ClockifySetting[]): ClockifySettingsTabBuilder_Optional;
  build(): ClockifySettingsTab;
}

class ClockifySettingsTabBuilderImpl implements ClockifySettingsTabBuilder_id, ClockifySettingsTabBuilder_name, ClockifySettingsTabBuilder_Optional {
  private _id: any;
  private _name: any;
  private _header: any;
  private _groups: any;
  private _settings: any;

  constructor() {
    this._groups = [];
    this._settings = [];
  }

  id(value: string): any {
    this._id = value;
    return this;
  }

  name(value: string): any {
    this._name = value;
    return this;
  }

  header(value: ClockifySettingsHeader): any {
    this._header = value;
    return this;
  }

  groups(value: ClockifySettingsGroup[]): any {
    this._groups = value;
    return this;
  }

  settings(value: ClockifySetting[]): any {
    this._settings = value;
    return this;
  }

  build(): ClockifySettingsTab {
    if (this._id === undefined || this._id === null) {
      throw new Error("Required field 'id' is missing.");
    }
    if (this._name === undefined || this._name === null) {
      throw new Error("Required field 'name' is missing.");
    }
    return {
      id: this._id,
      name: this._name,
      header: this._header,
      groups: this._groups,
      settings: this._settings,
    } as any;
  }
}

export namespace ClockifySettingsTab {
  export function builder(): ClockifySettingsTabBuilder_id {
    return new ClockifySettingsTabBuilderImpl();
  }
}

export function ClockifySettingsTabBuilder(): ClockifySettingsTabBuilder_id {
  return new ClockifySettingsTabBuilderImpl();
}

export interface ClockifySettingsBuilder_tabs {
  tabs(value: ClockifySettingsTab[]): ClockifySettingsBuilder_Build;
}

export interface ClockifySettingsBuilder_Build {
  build(): ClockifySettings;
}

class ClockifySettingsBuilderImpl implements ClockifySettingsBuilder_tabs, ClockifySettingsBuilder_Build {
  private _tabs: any;
  private _tabsSet = false;

  constructor() {
    this._tabs = [];
  }

  tabs(value: ClockifySettingsTab[]): any {
    this._tabs = value;
    this._tabsSet = true;
    return this;
  }

  build(): ClockifySettings {
    if (!this._tabsSet || this._tabs === undefined || this._tabs === null) {
      throw new Error("Required field 'tabs' is missing.");
    }
    return {
      tabs: this._tabs,
    } as any;
  }
}

export namespace ClockifySettings {
  export function builder(): ClockifySettingsBuilder_tabs {
    return new ClockifySettingsBuilderImpl();
  }
}

export function ClockifySettingsBuilder(): ClockifySettingsBuilder_tabs {
  return new ClockifySettingsBuilderImpl();
}

export interface ClockifyManifestBuilder_key {
  key(value: string): ClockifyManifestBuilder_name;
}

export interface ClockifyManifestBuilder_name {
  name(value: string): ClockifyManifestBuilder_baseUrl;
}

export interface ClockifyManifestBuilder_baseUrl {
  baseUrl(value: string): ClockifyManifestBuilder_minimalSubscriptionPlan;
}

export interface ClockifyManifestBuilder_minimalSubscriptionPlan {
  minimalSubscriptionPlan(value: ClockifyMinimalSubscriptionPlan): ClockifyManifestBuilder_Optional;
  requireFreePlan(): ClockifyManifestBuilder_Optional;
  requireBasicPlan(): ClockifyManifestBuilder_Optional;
  requireStandardPlan(): ClockifyManifestBuilder_Optional;
  requireProPlan(): ClockifyManifestBuilder_Optional;
  requireEnterprisePlan(): ClockifyManifestBuilder_Optional;
}

export interface ClockifyManifestBuilder_Optional {
  scopes(value: ClockifyScope[]): ClockifyManifestBuilder_Optional;
  description(value: string): ClockifyManifestBuilder_Optional;
  iconPath(value: string): ClockifyManifestBuilder_Optional;
  lifecycle(value: ClockifyLifecycleEvent[]): ClockifyManifestBuilder_Optional;
  webhooks(value: ClockifyWebhook[]): ClockifyManifestBuilder_Optional;
  components(value: ClockifyComponent[]): ClockifyManifestBuilder_Optional;
  settings(value: string | ClockifySettings): ClockifyManifestBuilder_Optional;
  build(): ClockifyManifest;
}

class ClockifyManifestBuilderImpl implements ClockifyManifestBuilder_key, ClockifyManifestBuilder_name, ClockifyManifestBuilder_baseUrl, ClockifyManifestBuilder_minimalSubscriptionPlan, ClockifyManifestBuilder_Optional {
  private _key: any;
  private _name: any;
  private _baseUrl: any;
  private _minimalSubscriptionPlan: any;
  private _scopes: any;
  private _description: any;
  private _iconPath: any;
  private _lifecycle: any;
  private _webhooks: any;
  private _components: any;
  private _settings: any;

  constructor() {
    this._scopes = [];
    this._lifecycle = [];
    this._webhooks = [];
    this._components = [];
  }

  key(value: string): any {
    this._key = value;
    return this;
  }

  name(value: string): any {
    this._name = value;
    return this;
  }

  baseUrl(value: string): any {
    this._baseUrl = value;
    return this;
  }

  minimalSubscriptionPlan(value: ClockifyMinimalSubscriptionPlan): any {
    this._minimalSubscriptionPlan = value;
    return this;
  }

  requireFreePlan(): any {
    return this.minimalSubscriptionPlan("FREE");
  }

  requireBasicPlan(): any {
    return this.minimalSubscriptionPlan("BASIC");
  }

  requireStandardPlan(): any {
    return this.minimalSubscriptionPlan("STANDARD");
  }

  requireProPlan(): any {
    return this.minimalSubscriptionPlan("PRO");
  }

  requireEnterprisePlan(): any {
    return this.minimalSubscriptionPlan("ENTERPRISE");
  }

  scopes(value: ClockifyScope[]): any {
    this._scopes = value;
    return this;
  }

  description(value: string): any {
    this._description = value;
    return this;
  }

  iconPath(value: string): any {
    this._iconPath = value;
    return this;
  }

  lifecycle(value: ClockifyLifecycleEvent[]): any {
    this._lifecycle = value;
    return this;
  }

  webhooks(value: ClockifyWebhook[]): any {
    this._webhooks = value;
    return this;
  }

  components(value: ClockifyComponent[]): any {
    this._components = value;
    return this;
  }

  settings(value: string | ClockifySettings): any {
    this._settings = value;
    return this;
  }

  build(): ClockifyManifest {
    if (this._key === undefined || this._key === null) {
      throw new Error("Required field 'key' is missing.");
    }
    if (this._name === undefined || this._name === null) {
      throw new Error("Required field 'name' is missing.");
    }
    if (this._baseUrl === undefined || this._baseUrl === null) {
      throw new Error("Required field 'baseUrl' is missing.");
    }
    if (this._minimalSubscriptionPlan === undefined || this._minimalSubscriptionPlan === null) {
      throw new Error("Required field 'minimalSubscriptionPlan' is missing.");
    }
    return {
      schemaVersion: "1.4",
      key: this._key,
      name: this._name,
      baseUrl: this._baseUrl,
      minimalSubscriptionPlan: this._minimalSubscriptionPlan,
      scopes: this._scopes,
      description: this._description,
      iconPath: this._iconPath,
      lifecycle: this._lifecycle,
      webhooks: this._webhooks,
      components: this._components,
      settings: this._settings,
    } as any;
  }
}

export namespace ClockifyManifest {
  export function builder(): ClockifyManifestBuilder_key {
    return new ClockifyManifestBuilderImpl();
  }
}

export function ClockifyManifestBuilder(): ClockifyManifestBuilder_key {
  return new ClockifyManifestBuilderImpl();
}

