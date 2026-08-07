# UI Components

Source: https://dev-docs.marketplace.cake.com/clockify/build/manifest/components.html

---

The UI components are pages which are used to integrate your add-ons UI with Clockify. They serve as an entry point to the user's interaction with your add-on.

UI components are served as HTML pages and loaded inside [iframes](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) when redered on the Clockify site. At the time of loading, components will be provided with the relevant context they need in order to function such as an [authentication token](authentication-and-authorization.md) as well as information the current location on the app and [information about the user](environments-and-regions.md#retrieving-information-related-to-the-add-on-user).

Entrypoints to your components can be added to a variety of available [locations](#types) on the Clockify site.

## Definition

UI components must be defined in the [add-on manifest](https://dev-docs.marketplace.cake.com/). They contain information about the location, label, icon and other component-specific attributes as detailed on the [components section of the manifest](manifest.md#components).
Components can be added, modified or removed in subsequent [versions of you add-on](publishing-and-guidelines.md). Changes to an add-on components will not take effect until the new version of the add-on is approved and published.

### Settings UI

The [settings UI](manifest.md#settings) is also a UI component, with the only difference being that it's not defined as part of the `components` but rather as part of the `settings` field of the manifest.

## Interacting with the API

UI components can interact with the [Clockify API](https://docs.clockify.me/) in two ways:

- by calling the [API](https://docs.clockify.me/) directly

All components are provided with an [authentication token](authentication-and-authorization.md#tokens) in the form of a query parameter. This token has the same permissions and access as the user who is currently viewing the UI.
This token, which in case it's provided to UI components is called the `user token`, can be used to make authenticated requests to the [Clockify API](https://docs.clockify.me/).

- by interacting with an add-on backend service

In this case it's up to the developer to implement the relevant authentication mechanisms and APIs.
The add-on will be provided with an [installation token](authentication-and-authorization.md#tokens) in case the `installed` lifecycle has been configured, although you may also choose to forward the [user token](authentication-and-authorization.md#tokens) to your backend service as part of the requests.

## Types

There are three types of components in Clockify, each having its own location where the component will be shown.

### Sidebar

![Sidebar location](https://dev-docs.marketplace.cake.com/static/image/ui-component-sidebar.17faa65d.png)

A sidebar entry is an entry that is added to the Add-ons section of the Clockify sidebar, located on the left side of the page.
You can specify one sidebar element per add-on within your manifest file.

How it works

- The Add-ons section is added to the sidebar automatically if at least one enabled add-on includes the required "Sidebar" component in its manifest
- The section remains visible, even when empty, for layout consistency
- New elements added by your add-on are placed in the Add-ons section by default
- The element is removed from the sidebar if the corresponding add-on is uninstalled or disabled via optional add-on settings

While your manifest defines one element per add-on, users can manually move and manage multiple sidebar elements from this section.

### Widget

A widget is a small icon which is displayed at the bottom-right section of the page. It serves an entrypoint to UI components that are defined with the `WIDGET` type.

![Widget location](https://dev-docs.marketplace.cake.com/static/image/ui-component-widget.96b2604c.png)

The widget icon will serve as an entrypoint to one or more UI components according to the rules below:

***Widget icon*** is displayed if at least one add-on with widget component is installed and enabled at the bottom right corner of the page.

***Widget list*** is displayed if more than one add-on with widget component is installed and enabled at the bottom right corner of the page.

Widget is not visible if there are no installed add-ons that have widget as a component in the manifest, or if all add-ons with widget component are disabled.

### Tabs

A tab is a location that can be defined for components which extend the functionality of existing pages with tabs. Add-on tabs will be added after the default tabs of the pages that support them.

![Tab location](https://dev-docs.marketplace.cake.com/static/image/ui-component-tab.17a95dbe.png)

Add-on can add new element in tab automatically, or if user enables it through ***Settings***. Add-on tabs are added after the existing tabs and are sorted by the date when they where added.

Tabs can be added to the following pages:

- Time off
- Schedule
- Approvals
- Reports
- Activity
- Team
- Project

### Send invoice to action

Clockify has dedicated locations on the Invoices page for your third-party add-on functions to easily integrate certain actions, like sending invoices to other services (e.g. Xero). This functionality appears automatically once a relevant add-on is installed.
You need to set the specific location and define the label for your invoice action within your add-on's manifest. It should be clearly named (e.g. Send to Xero) and visible to users.

![UI Location](https://dev-docs.marketplace.cake.com/static/image/invoice-action.3adfa83e.png)

UI location

The location depends on whether the user is viewing a single or multiple invoices:

- Bulk invoice actions (multiple invoices) allows users to process multiple invoices at once
- Located in the Add-on actions dropdown (next to the Export button)
- Single invoice action allows action on one invoice at a time
- Located in the three-dot menu next to each individual invoice

### Settings UI

The [Settings UI](#settings-ui) is technically also a UI location, although it must be configured on the settings field rather than as a component.
The UI can be accessed through the add-on options dropdown on the add-ons tab.

![Settings location](https://dev-docs.marketplace.cake.com/static/image/ui-component-settings.603281ab.png)

## Access

A component can be configured to be visible to everyone, or only to users with the admin role.
