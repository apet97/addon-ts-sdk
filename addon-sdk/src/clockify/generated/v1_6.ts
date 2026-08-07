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
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  readonly event: "APPROVAL_REQUEST_STATUS_UPDATED" | "ASSIGNMENT_CREATED" | "ASSIGNMENT_DELETED" | "ASSIGNMENT_PUBLISHED" | "ASSIGNMENT_UPDATED" | "BALANCE_UPDATED" | "BILLABLE_RATE_UPDATED" | "CLIENT_DELETED" | "CLIENT_UPDATED" | "COST_RATE_UPDATED" | "EXPENSE_CREATED" | "EXPENSE_DELETED" | "EXPENSE_RESTORED" | "EXPENSE_UPDATED" | "INVOICE_UPDATED" | "LIMITED_USERS_ADDED_TO_WORKSPACE" | "NEW_APPROVAL_REQUEST" | "NEW_CLIENT" | "NEW_INVOICE" | "NEW_PROJECT" | "NEW_TAG" | "NEW_TASK" | "NEW_TIME_ENTRY" | "NEW_TIMER_STARTED" | "PROJECT_DELETED" | "PROJECT_UPDATED" | "TAG_DELETED" | "TAG_UPDATED" | "TASK_DELETED" | "TASK_UPDATED" | "TIME_ENTRY_DELETED" | "TIME_ENTRY_RESTORED" | "TIME_ENTRY_SPLIT" | "TIME_ENTRY_UPDATED" | "TIME_OFF_REQUEST_APPROVED" | "TIME_OFF_REQUEST_REJECTED" | "TIME_OFF_REQUEST_STARTED" | "TIME_OFF_REQUEST_UPDATED" | "TIME_OFF_REQUEST_WITHDRAWN" | "TIME_OFF_REQUESTED" | "TIMER_STOPPED" | "USER_ACTIVATED_ON_WORKSPACE" | "USER_DEACTIVATED_ON_WORKSPACE" | "USER_DELETED_FROM_WORKSPACE" | "USER_EMAIL_CHANGED" | "USER_GROUP_CREATED" | "USER_GROUP_DELETED" | "USER_GROUP_UPDATED" | "USER_JOINED_WORKSPACE" | "USER_UPDATED" | "USERS_INVITED_TO_WORKSPACE";
  /** Path to addon endpoint designated for receiving webhooks from Clockify side. Path is just part of url to which webhook will be sent. Full url is constructed by concatenating addon 'baseUrl' and path. */
  readonly path: string;
}

/** Specialized webhook triggered on addon lifecycle event. */
export interface ClockifyLifecycleEvent extends ClockifyResource {
  /** Path to addon endpoint designated for receiving lifecycle hooks from Clockify side. Path is just part of url to which a lifecycle hook will be sent. Full url is constructed by concatenating addon 'baseUrl' and path. */
  readonly path: string;
  /** Specifies addon lifecycle event you want to be notified by Clockify. */
  readonly type: "INSTALLED" | "DELETED" | "SETTINGS_UPDATED" | "STATUS_CHANGED";
}

/** UI element shown in Clockify web app. It serves as a placeholder for addon app i.e. addon app will be rendered inside Clockify component. */
export interface ClockifyComponent extends ClockifyResource {
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  readonly type: "sidebar" | "widget" | "timeoff.tab" | "schedule.tab" | "approvals.tab" | "reports.tab" | "activity.tab" | "team.tab" | "projects.tab" | "invoices.action" | "timeentries.action.uiblocks";
  /** If you want to define some component-specific options for component that holds your addon app, this is the place to define them. */
  readonly options?: Record<string, any>;
  /** Label of the component e.g. if component is 'tab', value of 'label' property will be shown in UI. Label is not required for WIDGET component type. */
  readonly label: string;
  /** Specifies who can access addon component. You can either choose to give access only to Clockify workspace admins, or everyone. */
  readonly accessLevel: "ADMINS" | "EVERYONE";
  /** Path to addon web app that will be rendered inside Clockify component. Path is part of the url from which component content will be served. Full url is constructed by concatenating addon 'baseUrl' and path. */
  readonly path: string;
  /** Path to addon hosted image which will serve as an icon for Clockify component. Path is part of the url from which the image will be served. Full url is constructed by concatenating addon 'baseUrl' and path. */
  readonly iconPath?: string;
  /** Defines rendered component width expressed in 'vw'. Applicable only to WIDGET components. */
  readonly width?: number;
  /** Defines rendered component height expressed in 'vw'. Applicable only to WIDGET components. */
  readonly height?: number;
}

/** This is definition of Clockify addon setting. Each setting must have id, name, type and value. Value and type of setting must be compatible. */
export interface ClockifySetting {
  /** Setting unique identifier. */
  readonly id: string;
  /** Setting name. */
  readonly name: string;
  /** Brief description of setting. What is it used for, what does it affect, etc. */
  readonly description?: string;
  /** Text that is shown in UI form field if setting has no value. */
  readonly placeholder?: string;
  /** Specifies who can access addon settings. You can either choose to give access only to Clockify workspace admins, or everyone. */
  readonly accessLevel: "ADMINS" | "EVERYONE";
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  readonly type: "TXT" | "NUMBER" | "DROPDOWN_SINGLE" | "DROPDOWN_MULTIPLE" | "CHECKBOX" | "LINK" | "USER_DROPDOWN_SINGLE" | "USER_DROPDOWN_MULTIPLE";
  /** Serves as key for setting that represents key-value pair e.g. if you have documentation addon which shows document corresponding to the Clockify page i.e. you need to match the Clockify page to the url of the document describing how to use that page. In that case, key would be 'Clockify page', and 'value' would be 'url of the document'. */
  readonly key?: string;
  /** Value of the setting. Value must be of type 'setting.type' e.g. For USER_DROPDOWN, value will be the user ID of the installer upon installation. */
  readonly value: string | number | any[] | boolean;
  /** Required if 'setting.type' is DROPDOWN_SINGLE or DROPDOWN_MULTIPLE. Specifies which options will be shown in dropdown. */
  readonly allowedValues?: string[];
  /** Toggles whether setting value is required or not. */
  readonly required?: boolean;
  /** Toggles whether setting value will be shown with 'Copy' button for easier copying. */
  readonly copyable?: boolean;
  /** Toggles whether setting value is read-only i.e. setting value cannot be updated. */
  readonly readOnly?: boolean;
}

/** Setting banner that shows info about setting group or tab. It is shown as a blue banner before all settings contained in a given group. */
export interface ClockifySettingsHeader {
  /** Text shown in banner. */
  readonly title: string;
}

/** Serves as another level of hierarchy when defining settings. Group can be part of tabs, and one tab can contain multiple groups. */
export interface ClockifySettingsGroup {
  /** Group identifier. */
  readonly id: string;
  /** Group title. Shown in UI. */
  readonly title: string;
  /** Brief description of the settings that given group contains. */
  readonly description?: string;
  /** Banner with info text shown before all settings that given group contains. */
  readonly header?: ClockifySettingsHeader;
  /** List of settings the group contains */
  readonly settings: ClockifySetting[];
}

/** Serves as top level of hierarchy when defining settings. Tabs cannot be nested in other tabs or groups. */
export interface ClockifySettingsTab {
  /** Tab identifier. */
  readonly id: string;
  /** Tab name shown in UI. */
  readonly name: string;
  /** Banner with info text shown before all settings and groups contained in tab. */
  readonly header?: ClockifySettingsHeader;
  /** List of setting groups contained in tab. */
  readonly groups?: ClockifySettingsGroup[];
  /** List of settings contained in tab */
  readonly settings?: ClockifySetting[];
}

/** Top level settings property. All settings grouped in tabs are defined here. */
export interface ClockifySettings {
  readonly tabs: ClockifySettingsTab[];
}

export interface ClockifyManifest {
  readonly schemaVersion: "1.6";
  /** Serves as addon identifier. All addons must have unique key. */
  readonly key: string;
  /** Addon name */
  readonly name: string;
  /** Base url on which addon app is hosted. This url with 'path' from the following entities is used when constructing urls for webhooks, components, lifecycle hooks, etc. */
  readonly baseUrl: string;
  /** Minimal Clockify's subscription plan that is required for addon. This plan is used when checking if user's current plan is at least equal to the plan required by addon. */
  readonly minimalSubscriptionPlan: ClockifyMinimalSubscriptionPlan;
  /** API scopes that addon is using. */
  readonly scopes?: ClockifyScope[];
  /** Brief description of given addon functionalities and purpose. */
  readonly description?: string;
  /** Path to addon icon. Path is part of the url where image icon is being hosted. Full url is constructed by concatenating addon 'baseUrl' and path. */
  readonly iconPath?: string;
  /** List of defined lifecycle hooks for given addon. */
  readonly lifecycle?: ClockifyLifecycleEvent[];
  /** List of defined webhooks for given addon. */
  readonly webhooks?: ClockifyWebhook[];
  /** List of defined components for given addon. */
  readonly components?: ClockifyComponent[];
  readonly settings?: string | ClockifySettings;
}

export interface ClockifyWebhookBuilder_event {
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  event(value: "APPROVAL_REQUEST_STATUS_UPDATED" | "ASSIGNMENT_CREATED" | "ASSIGNMENT_DELETED" | "ASSIGNMENT_PUBLISHED" | "ASSIGNMENT_UPDATED" | "BALANCE_UPDATED" | "BILLABLE_RATE_UPDATED" | "CLIENT_DELETED" | "CLIENT_UPDATED" | "COST_RATE_UPDATED" | "EXPENSE_CREATED" | "EXPENSE_DELETED" | "EXPENSE_RESTORED" | "EXPENSE_UPDATED" | "INVOICE_UPDATED" | "LIMITED_USERS_ADDED_TO_WORKSPACE" | "NEW_APPROVAL_REQUEST" | "NEW_CLIENT" | "NEW_INVOICE" | "NEW_PROJECT" | "NEW_TAG" | "NEW_TASK" | "NEW_TIME_ENTRY" | "NEW_TIMER_STARTED" | "PROJECT_DELETED" | "PROJECT_UPDATED" | "TAG_DELETED" | "TAG_UPDATED" | "TASK_DELETED" | "TASK_UPDATED" | "TIME_ENTRY_DELETED" | "TIME_ENTRY_RESTORED" | "TIME_ENTRY_SPLIT" | "TIME_ENTRY_UPDATED" | "TIME_OFF_REQUEST_APPROVED" | "TIME_OFF_REQUEST_REJECTED" | "TIME_OFF_REQUEST_STARTED" | "TIME_OFF_REQUEST_UPDATED" | "TIME_OFF_REQUEST_WITHDRAWN" | "TIME_OFF_REQUESTED" | "TIMER_STOPPED" | "USER_ACTIVATED_ON_WORKSPACE" | "USER_DEACTIVATED_ON_WORKSPACE" | "USER_DELETED_FROM_WORKSPACE" | "USER_EMAIL_CHANGED" | "USER_GROUP_CREATED" | "USER_GROUP_DELETED" | "USER_GROUP_UPDATED" | "USER_JOINED_WORKSPACE" | "USER_UPDATED" | "USERS_INVITED_TO_WORKSPACE"): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onApprovalRequestStatusUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onAssignmentCreated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onAssignmentDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onAssignmentPublished(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onAssignmentUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onBalanceUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onBillableRateUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onClientDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onClientUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onCostRateUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onExpenseCreated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onExpenseDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onExpenseRestored(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onExpenseUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onInvoiceUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onLimitedUsersAddedToWorkspace(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewApprovalRequest(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewClient(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewInvoice(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewProject(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewTag(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewTask(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewTimeEntry(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onNewTimerStarted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onProjectDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onProjectUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTagDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTagUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTaskDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTaskUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeEntryDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeEntryRestored(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeEntrySplit(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeEntryUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeOffRequestApproved(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeOffRequestRejected(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeOffRequestStarted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeOffRequestUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeOffRequestWithdrawn(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimeOffRequested(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onTimerStopped(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserActivatedOnWorkspace(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserDeactivatedOnWorkspace(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserDeletedFromWorkspace(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserEmailChanged(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserGroupCreated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserGroupDeleted(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserGroupUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserJoinedWorkspace(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUserUpdated(): ClockifyWebhookBuilder_path;
  /** Clockify event that triggers webhook is sending to specified url. Url is constructed by concatenating addon 'baseUrl' and 'webhook.path'. */
  onUsersInvitedToWorkspace(): ClockifyWebhookBuilder_path;
}

export interface ClockifyWebhookBuilder_path {
  /** Path to addon endpoint designated for receiving webhooks from Clockify side. Path is just part of url to which webhook will be sent. Full url is constructed by concatenating addon 'baseUrl' and path. */
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

  event(value: "APPROVAL_REQUEST_STATUS_UPDATED" | "ASSIGNMENT_CREATED" | "ASSIGNMENT_DELETED" | "ASSIGNMENT_PUBLISHED" | "ASSIGNMENT_UPDATED" | "BALANCE_UPDATED" | "BILLABLE_RATE_UPDATED" | "CLIENT_DELETED" | "CLIENT_UPDATED" | "COST_RATE_UPDATED" | "EXPENSE_CREATED" | "EXPENSE_DELETED" | "EXPENSE_RESTORED" | "EXPENSE_UPDATED" | "INVOICE_UPDATED" | "LIMITED_USERS_ADDED_TO_WORKSPACE" | "NEW_APPROVAL_REQUEST" | "NEW_CLIENT" | "NEW_INVOICE" | "NEW_PROJECT" | "NEW_TAG" | "NEW_TASK" | "NEW_TIME_ENTRY" | "NEW_TIMER_STARTED" | "PROJECT_DELETED" | "PROJECT_UPDATED" | "TAG_DELETED" | "TAG_UPDATED" | "TASK_DELETED" | "TASK_UPDATED" | "TIME_ENTRY_DELETED" | "TIME_ENTRY_RESTORED" | "TIME_ENTRY_SPLIT" | "TIME_ENTRY_UPDATED" | "TIME_OFF_REQUEST_APPROVED" | "TIME_OFF_REQUEST_REJECTED" | "TIME_OFF_REQUEST_STARTED" | "TIME_OFF_REQUEST_UPDATED" | "TIME_OFF_REQUEST_WITHDRAWN" | "TIME_OFF_REQUESTED" | "TIMER_STOPPED" | "USER_ACTIVATED_ON_WORKSPACE" | "USER_DEACTIVATED_ON_WORKSPACE" | "USER_DELETED_FROM_WORKSPACE" | "USER_EMAIL_CHANGED" | "USER_GROUP_CREATED" | "USER_GROUP_DELETED" | "USER_GROUP_UPDATED" | "USER_JOINED_WORKSPACE" | "USER_UPDATED" | "USERS_INVITED_TO_WORKSPACE"): any {
    this._event = value;
    return this;
  }

  onApprovalRequestStatusUpdated(): any {
    return this.event("APPROVAL_REQUEST_STATUS_UPDATED");
  }

  onAssignmentCreated(): any {
    return this.event("ASSIGNMENT_CREATED");
  }

  onAssignmentDeleted(): any {
    return this.event("ASSIGNMENT_DELETED");
  }

  onAssignmentPublished(): any {
    return this.event("ASSIGNMENT_PUBLISHED");
  }

  onAssignmentUpdated(): any {
    return this.event("ASSIGNMENT_UPDATED");
  }

  onBalanceUpdated(): any {
    return this.event("BALANCE_UPDATED");
  }

  onBillableRateUpdated(): any {
    return this.event("BILLABLE_RATE_UPDATED");
  }

  onClientDeleted(): any {
    return this.event("CLIENT_DELETED");
  }

  onClientUpdated(): any {
    return this.event("CLIENT_UPDATED");
  }

  onCostRateUpdated(): any {
    return this.event("COST_RATE_UPDATED");
  }

  onExpenseCreated(): any {
    return this.event("EXPENSE_CREATED");
  }

  onExpenseDeleted(): any {
    return this.event("EXPENSE_DELETED");
  }

  onExpenseRestored(): any {
    return this.event("EXPENSE_RESTORED");
  }

  onExpenseUpdated(): any {
    return this.event("EXPENSE_UPDATED");
  }

  onInvoiceUpdated(): any {
    return this.event("INVOICE_UPDATED");
  }

  onLimitedUsersAddedToWorkspace(): any {
    return this.event("LIMITED_USERS_ADDED_TO_WORKSPACE");
  }

  onNewApprovalRequest(): any {
    return this.event("NEW_APPROVAL_REQUEST");
  }

  onNewClient(): any {
    return this.event("NEW_CLIENT");
  }

  onNewInvoice(): any {
    return this.event("NEW_INVOICE");
  }

  onNewProject(): any {
    return this.event("NEW_PROJECT");
  }

  onNewTag(): any {
    return this.event("NEW_TAG");
  }

  onNewTask(): any {
    return this.event("NEW_TASK");
  }

  onNewTimeEntry(): any {
    return this.event("NEW_TIME_ENTRY");
  }

  onNewTimerStarted(): any {
    return this.event("NEW_TIMER_STARTED");
  }

  onProjectDeleted(): any {
    return this.event("PROJECT_DELETED");
  }

  onProjectUpdated(): any {
    return this.event("PROJECT_UPDATED");
  }

  onTagDeleted(): any {
    return this.event("TAG_DELETED");
  }

  onTagUpdated(): any {
    return this.event("TAG_UPDATED");
  }

  onTaskDeleted(): any {
    return this.event("TASK_DELETED");
  }

  onTaskUpdated(): any {
    return this.event("TASK_UPDATED");
  }

  onTimeEntryDeleted(): any {
    return this.event("TIME_ENTRY_DELETED");
  }

  onTimeEntryRestored(): any {
    return this.event("TIME_ENTRY_RESTORED");
  }

  onTimeEntrySplit(): any {
    return this.event("TIME_ENTRY_SPLIT");
  }

  onTimeEntryUpdated(): any {
    return this.event("TIME_ENTRY_UPDATED");
  }

  onTimeOffRequestApproved(): any {
    return this.event("TIME_OFF_REQUEST_APPROVED");
  }

  onTimeOffRequestRejected(): any {
    return this.event("TIME_OFF_REQUEST_REJECTED");
  }

  onTimeOffRequestStarted(): any {
    return this.event("TIME_OFF_REQUEST_STARTED");
  }

  onTimeOffRequestUpdated(): any {
    return this.event("TIME_OFF_REQUEST_UPDATED");
  }

  onTimeOffRequestWithdrawn(): any {
    return this.event("TIME_OFF_REQUEST_WITHDRAWN");
  }

  onTimeOffRequested(): any {
    return this.event("TIME_OFF_REQUESTED");
  }

  onTimerStopped(): any {
    return this.event("TIMER_STOPPED");
  }

  onUserActivatedOnWorkspace(): any {
    return this.event("USER_ACTIVATED_ON_WORKSPACE");
  }

  onUserDeactivatedOnWorkspace(): any {
    return this.event("USER_DEACTIVATED_ON_WORKSPACE");
  }

  onUserDeletedFromWorkspace(): any {
    return this.event("USER_DELETED_FROM_WORKSPACE");
  }

  onUserEmailChanged(): any {
    return this.event("USER_EMAIL_CHANGED");
  }

  onUserGroupCreated(): any {
    return this.event("USER_GROUP_CREATED");
  }

  onUserGroupDeleted(): any {
    return this.event("USER_GROUP_DELETED");
  }

  onUserGroupUpdated(): any {
    return this.event("USER_GROUP_UPDATED");
  }

  onUserJoinedWorkspace(): any {
    return this.event("USER_JOINED_WORKSPACE");
  }

  onUserUpdated(): any {
    return this.event("USER_UPDATED");
  }

  onUsersInvitedToWorkspace(): any {
    return this.event("USERS_INVITED_TO_WORKSPACE");
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
  /** Path to addon endpoint designated for receiving lifecycle hooks from Clockify side. Path is just part of url to which a lifecycle hook will be sent. Full url is constructed by concatenating addon 'baseUrl' and path. */
  path(value: string): ClockifyLifecycleEventBuilder_type;
}

export interface ClockifyLifecycleEventBuilder_type {
  /** Specifies addon lifecycle event you want to be notified by Clockify. */
  type(value: "INSTALLED" | "DELETED" | "SETTINGS_UPDATED" | "STATUS_CHANGED"): ClockifyLifecycleEventBuilder_Build;
  /** Specifies addon lifecycle event you want to be notified by Clockify. */
  onInstalled(): ClockifyLifecycleEventBuilder_Build;
  /** Specifies addon lifecycle event you want to be notified by Clockify. */
  onDeleted(): ClockifyLifecycleEventBuilder_Build;
  /** Specifies addon lifecycle event you want to be notified by Clockify. */
  onSettingsUpdated(): ClockifyLifecycleEventBuilder_Build;
  /** Specifies addon lifecycle event you want to be notified by Clockify. */
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
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  type(value: "sidebar" | "widget" | "timeoff.tab" | "schedule.tab" | "approvals.tab" | "reports.tab" | "activity.tab" | "team.tab" | "projects.tab" | "invoices.action" | "timeentries.action.uiblocks"): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  sidebar(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  widget(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  timeoffTab(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  scheduleTab(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  approvalsTab(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  reportsTab(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  activityTab(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  teamTab(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  projectsTab(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  invoicesAction(): ClockifyComponentBuilder_accessLevel;
  /** Specifies which kind of component will be rendered. If component is 'tab', it also comes with the name of Clockify page where 'tab' component will be rendered. */
  timeentriesActionUiblocks(): ClockifyComponentBuilder_accessLevel;
}

export interface ClockifyComponentBuilder_accessLevel {
  /** Specifies who can access addon component. You can either choose to give access only to Clockify workspace admins, or everyone. */
  accessLevel(value: "ADMINS" | "EVERYONE"): ClockifyComponentBuilder_path;
  /** Specifies who can access addon component. You can either choose to give access only to Clockify workspace admins, or everyone. */
  allowAdmins(): ClockifyComponentBuilder_path;
  /** Specifies who can access addon component. You can either choose to give access only to Clockify workspace admins, or everyone. */
  allowEveryone(): ClockifyComponentBuilder_path;
}

export interface ClockifyComponentBuilder_path {
  /** Path to addon web app that will be rendered inside Clockify component. Path is part of the url from which component content will be served. Full url is constructed by concatenating addon 'baseUrl' and path. */
  path(value: string): ClockifyComponentBuilder_label;
}

export interface ClockifyComponentBuilder_label {
  /** Label of the component e.g. if component is 'tab', value of 'label' property will be shown in UI. Label is not required for WIDGET component type. */
  label(value: string): ClockifyComponentBuilder_Optional;
}

export interface ClockifyComponentBuilder_Optional {
  /** If you want to define some component-specific options for component that holds your addon app, this is the place to define them. */
  options(value: Record<string, any>): ClockifyComponentBuilder_Optional;
  /** Path to addon hosted image which will serve as an icon for Clockify component. Path is part of the url from which the image will be served. Full url is constructed by concatenating addon 'baseUrl' and path. */
  iconPath(value: string): ClockifyComponentBuilder_Optional;
  /** Defines rendered component width expressed in 'vw'. Applicable only to WIDGET components. */
  width(value: number): ClockifyComponentBuilder_Optional;
  /** Defines rendered component height expressed in 'vw'. Applicable only to WIDGET components. */
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

  type(value: "sidebar" | "widget" | "timeoff.tab" | "schedule.tab" | "approvals.tab" | "reports.tab" | "activity.tab" | "team.tab" | "projects.tab" | "invoices.action" | "timeentries.action.uiblocks"): any {
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

  timeentriesActionUiblocks(): any {
    return this.type("timeentries.action.uiblocks");
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
  /** Setting unique identifier. */
  id(value: string): ClockifySettingBuilder_name;
}

export interface ClockifySettingBuilder_name {
  /** Setting name. */
  name(value: string): ClockifySettingBuilder_accessLevel;
}

export interface ClockifySettingBuilder_accessLevel {
  /** Specifies who can access addon settings. You can either choose to give access only to Clockify workspace admins, or everyone. */
  accessLevel(value: "ADMINS" | "EVERYONE"): ClockifySettingBuilder_type;
  /** Specifies who can access addon settings. You can either choose to give access only to Clockify workspace admins, or everyone. */
  allowAdmins(): ClockifySettingBuilder_type;
  /** Specifies who can access addon settings. You can either choose to give access only to Clockify workspace admins, or everyone. */
  allowEveryone(): ClockifySettingBuilder_type;
}

export interface ClockifySettingBuilder_type {
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  type(value: "TXT" | "NUMBER" | "DROPDOWN_SINGLE" | "DROPDOWN_MULTIPLE" | "CHECKBOX" | "LINK" | "USER_DROPDOWN_SINGLE" | "USER_DROPDOWN_MULTIPLE"): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asTxt(): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asNumber(): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asDropdownSingle(): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asDropdownMultiple(): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asCheckbox(): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asLink(): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asUserDropdownSingle(): ClockifySettingBuilder_value;
  /** Specifies setting value type. Each type is shown differently in UI and value must be compatible with a specified type e.g. if 'type' is TXT, 'value' must be 'string', if 'type' is DROPDOWN, 'value' must be 'array'. */
  asUserDropdownMultiple(): ClockifySettingBuilder_value;
}

export interface ClockifySettingBuilder_value {
  /** Value of the setting. Value must be of type 'setting.type' e.g. For USER_DROPDOWN, value will be the user ID of the installer upon installation. */
  value(value: string | number | any[] | boolean): ClockifySettingBuilder_Optional;
}

export interface ClockifySettingBuilder_Optional {
  /** Brief description of setting. What is it used for, what does it affect, etc. */
  description(value: string): ClockifySettingBuilder_Optional;
  /** Text that is shown in UI form field if setting has no value. */
  placeholder(value: string): ClockifySettingBuilder_Optional;
  /** Serves as key for setting that represents key-value pair e.g. if you have documentation addon which shows document corresponding to the Clockify page i.e. you need to match the Clockify page to the url of the document describing how to use that page. In that case, key would be 'Clockify page', and 'value' would be 'url of the document'. */
  key(value: string): ClockifySettingBuilder_Optional;
  /** Required if 'setting.type' is DROPDOWN_SINGLE or DROPDOWN_MULTIPLE. Specifies which options will be shown in dropdown. */
  allowedValues(value: string[]): ClockifySettingBuilder_Optional;
  /** Toggles whether setting value is required or not. */
  required(value: boolean): ClockifySettingBuilder_Optional;
  /** Toggles whether setting value will be shown with 'Copy' button for easier copying. */
  copyable(value: boolean): ClockifySettingBuilder_Optional;
  /** Toggles whether setting value is read-only i.e. setting value cannot be updated. */
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
  /** Text shown in banner. */
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
  /** Group identifier. */
  id(value: string): ClockifySettingsGroupBuilder_title;
}

export interface ClockifySettingsGroupBuilder_title {
  /** Group title. Shown in UI. */
  title(value: string): ClockifySettingsGroupBuilder_settings;
}

export interface ClockifySettingsGroupBuilder_settings {
  /** List of settings the group contains */
  settings(value: ClockifySetting[]): ClockifySettingsGroupBuilder_Optional;
}

export interface ClockifySettingsGroupBuilder_Optional {
  /** Brief description of the settings that given group contains. */
  description(value: string): ClockifySettingsGroupBuilder_Optional;
  /** Banner with info text shown before all settings that given group contains. */
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
  /** Tab identifier. */
  id(value: string): ClockifySettingsTabBuilder_name;
}

export interface ClockifySettingsTabBuilder_name {
  /** Tab name shown in UI. */
  name(value: string): ClockifySettingsTabBuilder_Optional;
}

export interface ClockifySettingsTabBuilder_Optional {
  /** Banner with info text shown before all settings and groups contained in tab. */
  header(value: ClockifySettingsHeader): ClockifySettingsTabBuilder_Optional;
  /** List of setting groups contained in tab. */
  groups(value: ClockifySettingsGroup[]): ClockifySettingsTabBuilder_Optional;
  /** List of settings contained in tab */
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
  /** Serves as addon identifier. All addons must have unique key. */
  key(value: string): ClockifyManifestBuilder_name;
}

export interface ClockifyManifestBuilder_name {
  /** Addon name */
  name(value: string): ClockifyManifestBuilder_baseUrl;
}

export interface ClockifyManifestBuilder_baseUrl {
  /** Base url on which addon app is hosted. This url with 'path' from the following entities is used when constructing urls for webhooks, components, lifecycle hooks, etc. */
  baseUrl(value: string): ClockifyManifestBuilder_minimalSubscriptionPlan;
}

export interface ClockifyManifestBuilder_minimalSubscriptionPlan {
  /** Minimal Clockify's subscription plan that is required for addon. This plan is used when checking if user's current plan is at least equal to the plan required by addon. */
  minimalSubscriptionPlan(value: ClockifyMinimalSubscriptionPlan): ClockifyManifestBuilder_Optional;
  /** Minimal Clockify's subscription plan that is required for addon. This plan is used when checking if user's current plan is at least equal to the plan required by addon. */
  requireFreePlan(): ClockifyManifestBuilder_Optional;
  /** Minimal Clockify's subscription plan that is required for addon. This plan is used when checking if user's current plan is at least equal to the plan required by addon. */
  requireBasicPlan(): ClockifyManifestBuilder_Optional;
  /** Minimal Clockify's subscription plan that is required for addon. This plan is used when checking if user's current plan is at least equal to the plan required by addon. */
  requireStandardPlan(): ClockifyManifestBuilder_Optional;
  /** Minimal Clockify's subscription plan that is required for addon. This plan is used when checking if user's current plan is at least equal to the plan required by addon. */
  requireProPlan(): ClockifyManifestBuilder_Optional;
  /** Minimal Clockify's subscription plan that is required for addon. This plan is used when checking if user's current plan is at least equal to the plan required by addon. */
  requireEnterprisePlan(): ClockifyManifestBuilder_Optional;
}

export interface ClockifyManifestBuilder_Optional {
  /** API scopes that addon is using. */
  scopes(value: ClockifyScope[]): ClockifyManifestBuilder_Optional;
  /** Brief description of given addon functionalities and purpose. */
  description(value: string): ClockifyManifestBuilder_Optional;
  /** Path to addon icon. Path is part of the url where image icon is being hosted. Full url is constructed by concatenating addon 'baseUrl' and path. */
  iconPath(value: string): ClockifyManifestBuilder_Optional;
  /** List of defined lifecycle hooks for given addon. */
  lifecycle(value: ClockifyLifecycleEvent[]): ClockifyManifestBuilder_Optional;
  /** List of defined webhooks for given addon. */
  webhooks(value: ClockifyWebhook[]): ClockifyManifestBuilder_Optional;
  /** List of defined components for given addon. */
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
      schemaVersion: "1.6",
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

