# create-clockify-addon

Scaffolds fail-closed Node or Fetch/Worker Clockify add-on projects using
`@apet97/clockify-addon-sdk`.

```bash
npm create clockify-addon ./my-addon -- --runtime=node
```

Choose `--runtime=worker` for a Fetch/Worker entrypoint and `--features=all`
to include lifecycle and webhook routes. Generated projects require explicit
`PUBLIC_BASE_URL` and `CLOCKIFY_PARENT_ORIGIN` values. They fail closed until a
durable installation store is wired; `ALLOW_EPHEMERAL_STORAGE=true` enables the
generated in-memory store for local development only and must not be used in
production.
