# Introduction

Source: https://dev-docs.marketplace.cake.com/clockify/learn/introduction.html

---

## Clockify Add-on basics

### What is the structure of an add-on?

Each add-on has three main elements:

- Manifest
- Business logic
- UI (optional)

***[Manifest](manifest.md)*** describes the add-on’s capabilities and the way it integrates with the Clockify app.

***Business logic*** represents the functionalities provided by an add-on.

***[UI](components.md)*** is the visual representation of an add-on that is displayed to users. Add-ons that don’t contain a UI can also be developed.

### How does add-on hosting infrastructure work?

Add-on resources are not hosted by CAKE.com. You must host all the resources needed for an add-on to function, including a manifest file, a database, a web server to handle communication with Clockify and any other integral part of an add-on e.g. UI.

You need to make sure that all the resources mentioned above are working and accessible.

### How does the add-on interact with the Clockify API?

An add-on interacts with [Clockify's API](https://docs.clockify.me/) by supplying an [authentication token](authentication-and-authorization.md) as part of the `X-Addon-Token` header.
This authentication token will be commonly called the `add-on token` throughout the documentation.

There are several ways this token can be retrieved, as well as several [types of tokens](authentication-and-authorization.md#tokens) that are available.
The two primary ways an add-on token can be retrieved are:

- during installation as part of the `installed` [lifecycle](lifecycle.md)
- when a [UI component](components.md#interacting-with-the-api) is loaded

### How does the add-on UI integrate with Clockify?

An add-on can define its UI elements in the manifest by defining [UI components](components.md).

UI components are entry points to the UI of the add-on. They are HTML pages which Clockify loads inside [iframes](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) in order to integrate them into Clockify's UI.
There are [several types](components.md#types) of UI components, each with its own locations, that can be configured.

### How does the add-on UI interact with Clockify?

UI components can interact with Clockify in several ways:

- by calling the [Clockify API](https://docs.clockify.me/)
- by calling the add-on backend, which in turn interacts with the Clockify API
- by listening to or dispatching [window events](window-events.md)

UI components are loaded and rendered inside iframes. At the time they are loaded, the components are provided with an [authentication token](authentication-and-authorization.md#user-token) that they can use in order to communicate with the Clockify API.
This authentication token will also contain a [set of claims](authentication-and-authorization.md#claims) that can be used to retrieve information regarding the environment, the workspace and the user that is currently viewing the UI.

### How do add-on settings work?

There are two ways an add-on can display an interface for its settings:

- ***Using configurable no-code UI***

Add-on settings can be defined in the [manifest](manifest.md) with Clockify taking care of both rendering them to the user and storing the data.
This approach is the fastest way to get started with building add-ons and supports building customizable settings screens in a straightforward way.
Visit the [structured settings](structured-settings.md) section for more information.

- ***Using a custom settings UI***

An add-on can be configured to define and host its own settings screen. This setup can be beneficial if the UI is complex, if you’d like to store settings in your own infrastructure, or if the settings need to follow a specific design.
The settings UI will work the same as any other [UI component](components.md).

### How does an add-on work?

After an add-on is installed, it's added to the workspace and loaded whenever a user loads the Clockify app.

There are several ways in which Clockify interacts with the add-on:

- ***Lifecycle events***: Add-on receives events when installed, deleted, if its settings are updated, or status is changed
- ***Webhooks***: Add-on receives webhooks for all the events it has subscribed to on the manifest
- ***Components***: Add-on receives requests to render a component whenever a user navigates to it
- ***Components Window Messages***: Add-on components can receive [window events](window-events.md) after they are loaded

An add-on can work in both interactive (responding to user interactions or events) and non-interactive (responding to Clockify webhooks or processing server side jobs) ways.

### Can new features be added after an add-on is published?

You can add new features or improve existing ones after an add-on is published.

However, there are certain changes that require updating the manifest and/or other data such as the add-on name and the [marketplace](https://marketplace.cake.com/) listing that are required to go through an approval process.

Changes to the manifest, such as adding or updating components, lifecycle webhooks or scopes, will only take effect after a new version of the add-on is approved and published.

## Developer Resources

***Add-on code examples***

[Add-on code examples](https://github.com/clockify/addon-examples) are used to demonstrate how to use add-on’s specific features or functionality. These examples are tested and functional, therefore you can use them as a reference and build upon them to create your own custom integrations.

***Add-on SDK***

[Add-on SDK](https://github.com/clockify/addon-java-sdk) is written in Java and aims to help you with the development of your add-ons. It contains various modules to help you with the development, including schema models, validators, helpers, as well as support for web frameworks.

***Add-on web components***

Add-on web components are a set of components and CSS styles aimed to help you develop your UIs, and, at the same time maintain a design style that is consistent with the [CAKE.com style guide](https://www.figma.com/@cake_dot_com).
For more information, visit the Add-on web components [documentation](https://resources.developer.clockify.me/ui/latest/showcase/?path=/story/introduction--page).

## Next steps

For further information on how add-ons work in practice and how to develop an add-on you can read our [Quick Start Guide](quick-start.md).
