## Emela examples

The docs describe the emela version in `.emela-version`. Every example is checked against that version in CI (`.github/workflows/examples.yml`); run the same check locally with `pnpm check:examples` (set `EMELA=/path/to/emela` to use another binary).

- ` ```emela check ` must pass `emela check`; ` ```emela check=error ` must be rejected by it.
- A ` ```console ` block right after a `check` block is run: each `$ command` runs in the example's directory, and its output must equal the lines below it. Mark a block whose output changes from run to run (times, random values) ` ```console no-check `.
- To move the docs to a newer emela, bump `.emela-version` and fix the examples in the same pull request. A weekly job opens an issue listing the examples that fail on the latest release and on emela main.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
