import { ClockifyAddonClient, type ClockifyAddonRequestOptions } from "../../src/client";

const options: ClockifyAddonRequestOptions = {
  query: new URLSearchParams({ page: "2" }),
};

export function requestPage(client: ClockifyAddonClient): Promise<Response> {
  return client.request(["workspaces", "workspace-1", "items"], options);
}
