# Webhooks

Source: https://dev-docs.marketplace.cake.com/clockify/build/manifest/webhooks.html

---

## Definition

Webhooks are a way for your add-on to respond to events and triggers in real-time without the user directly interacting with the add-on UI itself.
They can be used to integrate your add-on with Clockify in a seamless way.

Webhook messages are automatically sent by Clockify whenever an event that the add-on has subscribed to is triggered.
Clockify provides a variety of [Webhook Event types](#types) that an add-on can subscribe to according to its needs.

## Types

There are different types of webhooks that your add-on can subscribe to.
The webhooks that are available for your add-on depend on the specific version of the [manifest schema](manifest.md#top-level-properties) that you choose.

Generally, the following webhooks are available to add-ons:

### Time Tracking

Events related to the timer, time entries, and tags.

| Webhook             | Description                 |
| ------------------- | --------------------------- |
| NEW_TIMER_STARTED   | Timer started               |
| TIMER_STOPPED       | Timer stopped               |
| NEW_TIME_ENTRY      | Time entry created manually |
| TIME_ENTRY_UPDATED  | Time entry updated          |
| TIME_ENTRY_DELETED  | Time entry deleted          |
| TIME_ENTRY_RESTORED | Time entry restored         |
| TIME_ENTRY_SPLIT    | Time entry split            |
| NEW_TAG             | Tag created                 |
| TAG_UPDATED         | Tag updated                 |
| TAG_DELETED         | Tag deleted                 |

### Client & Project Management

Events related to clients, projects, and tasks.

| Webhook         | Description     |
| --------------- | --------------- |
| NEW_CLIENT      | Client created  |
| CLIENT_UPDATED  | Client updated  |
| CLIENT_DELETED  | Client deleted  |
| NEW_PROJECT     | Project created |
| PROJECT_UPDATED | Project updated |
| PROJECT_DELETED | Project deleted |
| NEW_TASK        | Task created    |
| TASK_UPDATED    | Task updated    |
| TASK_DELETED    | Task deleted    |

### Scheduling

Events related to assignments and schedule publishing.

| Webhook              | Description          |
| -------------------- | -------------------- |
| ASSIGNMENT_CREATED   | Assignment created   |
| ASSIGNMENT_UPDATED   | Assignment updated   |
| ASSIGNMENT_DELETED   | Assignment deleted   |
| ASSIGNMENT_PUBLISHED | Assignment published |

### Financials

Events related to invoices and billing rates.

| Webhook               | Description           |
| --------------------- | --------------------- |
| NEW_INVOICE           | Invoice created       |
| INVOICE_UPDATED       | Invoice updated       |
| COST_RATE_UPDATED     | Cost rate updated     |
| BILLABLE_RATE_UPDATED | Billable rate updated |

### Expenses

Events related to recording and managing expenses.

| Webhook          | Description      |
| ---------------- | ---------------- |
| EXPENSE_CREATED  | Expense created  |
| EXPENSE_UPDATED  | Expense updated  |
| EXPENSE_DELETED  | Expense deleted  |
| EXPENSE_RESTORED | Expense restored |

### Workspace & User Management

Events related to workspace membership, user status, and groups.

| Webhook                          | Description                      |
| -------------------------------- | -------------------------------- |
| USER_JOINED_WORKSPACE            | User joined workspace            |
| USERS_INVITED_TO_WORKSPACE       | Users invited to workspace       |
| LIMITED_USERS_ADDED_TO_WORKSPACE | Limited users added to workspace |
| USER_DELETED_FROM_WORKSPACE      | User deleted from workspace      |
| USER_ACTIVATED_ON_WORKSPACE      | User activated on workspace      |
| USER_DEACTIVATED_ON_WORKSPACE    | User deactivated on workspace    |
| USER_UPDATED                     | User updated                     |
| USER_EMAIL_CHANGED               | User email changed               |
| USER_GROUP_CREATED               | User group created               |
| USER_GROUP_UPDATED               | User group updated               |
| USER_GROUP_DELETED               | User group deleted               |

### Approvals

Events related to the approval workflow.

| Webhook                         | Description                     |
| ------------------------------- | ------------------------------- |
| NEW_APPROVAL_REQUEST            | New approval request            |
| APPROVAL_REQUEST_STATUS_UPDATED | Approval request status updated |

### Time Off

Events related to leave management and balances.

| Webhook                    | Description                |
| -------------------------- | -------------------------- |
| TIME_OFF_REQUESTED         | Time off requested         |
| TIME_OFF_REQUEST_UPDATED   | Time off request updated   |
| TIME_OFF_REQUEST_APPROVED  | Time off request approved  |
| TIME_OFF_REQUEST_REJECTED  | Time off request rejected  |
| TIME_OFF_REQUEST_WITHDRAWN | Time off request withdrawn |
| BALANCE_UPDATED            | Time off balance updated   |

You can test and visualize how the webhooks work and their respective payloads by triggering and listening for the events on your [development environment](quick-start.md#testing-environment).

## Requests

Webhook requests are `POST` requests that are sent to notify the add-on of events it has subscribed to.
Each specific event will contain its specific payload as well as an accompanying [signature](#signature) that can be used to verify the request.
After installing an add-on, you can view a list of all the registered webhooks by navigating to the add-ons tab and clicking on the webhooks option.

![Webhooks Dropdown](https://dev-docs.marketplace.cake.com/static/image/webhooks-dropdown.c82ed612.png)

A list of all the registered webhooks along with their endpoints will be displayed.

![Webhooks List](https://dev-docs.marketplace.cake.com/static/image/webhooks-list.54b91c7b.png)

You can access a webhook's logs by clicking on the webhook event. The logs will contain information such as the timestamp when the request was made, the HTTP status as well as the request and response bodies.

![Webhooks Logs](https://dev-docs.marketplace.cake.com/static/image/webhooks-logs.95eff78b.png)

> Webhook logs are deleted after 7 days.

## Signature

Each webhook that is dispatched by Clockify will contain a signature that can be used to verify its authenticity.
A typical webhook request will contain the following request headers:

```
clockify-signature - this represents the token that is signed on behalf of a single webhook type for a single add-on installation
clockify-webhook-event-type - this represents the event that triggered the webhook, must be one of the webhook values above
```

### Webhook token

The webhook token supplied as part of the `clockify-signature` headers does not expire.
It contains the following claims that can be used to verify its authenticity and determine its context:

```
  "iss": "clockify",
  "sub": "{add-on key}",
  "type": "addon",
  "workspaceId": "{workspace id}",
  "addonId": "{add-on id}"
```

- iss - the issuer of a JWT will always be `clockify`
- sub - the sub must be the same as the add-on key
- type - the type of a JWT will always be `addon`
- workspaceId - the ID where the add-on is installed and where the event was triggered
- addonId - the ID of the add-on installation on the workspace

### Authenticity

There are a couple of precautions that we must take to verify a webhook's authenticity and prevent request spoofing.

1. Verify the JWT

The JWT token must be verified and the issuer and the sub claims must match the expected values for our add-on. To learn more about the tokens, visit the [Authentication & Authorization](authentication-and-authorization.md) section.

2. Assert the webhook type is the one you expect

You must assert that the webhook types and the payloads supplied with the request match the webhook types that you expect for each endpoint.

3. Compare webhook tokens

When an add-on which has defined an [installed lifecycle](manifest.md#lifecycles) gets installed on a workspace, an installation payload is provided along with the `installed` event.
If the add-on has defined webhooks in its manifest, the payload will contain information regarding registered webhooks as well as the webhook token for each of them.

```
{
  ...
  "webhooks": [
      {
         "authToken": "{JWT for the webhook}",
         "path": "{path defined in the manifest}",
         "webhookType": "ADDON"
      }
   ],
   ...
}
```

It is recommended that add-ons retrieve and store the `authToken` for each registered webhook, so that it can later be used to verify the authenticity of the requests.

The webhook token does not expire, and the same token registered for a particular webhook will be sent as part of the `clockify-signature` header for every webhook event of that type that is triggered on the workspace.
