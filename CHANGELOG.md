# Changelog

Newest first. Each release is one `## vX.Y.Z (date)` section; the release workflow publishes that section as the release notes.

## v2.0.0 (2026-10-31)

- Removed: the change-tutor plugin, with no replacement. Removing a plugin is a major change.
- Existing change-tutor users: after updating, `/plugin` lists change-tutor as `failed to load` until you remove it with `claude plugin uninstall change-tutor@my-mods --scope user`. Its saved learning notes and `/config` values are deleted with it. See `docs/migration/REMOVE_CHANGE_TUTOR.md`.
- The install scripts now list change-tutor as a retired plugin and print the uninstall command if it is installed (no automatic removal).
- agent-flow 0.6.1: header comments only, no behavior change.
- Plugins: qhud 0.18.0, pinboard 0.3.0, agent-flow 0.6.1.

## v1.0.0 (2026-10-28)

First public release. The private history before it was squashed and its releases removed; version numbers v1.1.0 to v1.4.0 that still appear in some docs refer to those private builds.

- Plugins: qhud 0.18.0, change-tutor 0.4.0, pinboard 0.3.0, agent-flow 0.6.0.
- MIT license (`LICENSE`, also shipped in the release zip).
- Plugin and marketplace author name is now `gloriouslegacy`. No setting or behavior change.
- CI and release workflows use `actions/checkout` and `actions/setup-node` v7.
