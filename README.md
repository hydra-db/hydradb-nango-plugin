<p align="center"><img src="assets/icon.png" width="96" alt="HydraDB" /></p>

# HydraDB for Nango

A [Nango](https://nango.dev) provider and actions for
[HydraDB](https://hydradb.com): authenticate once, then ingest and recall
through Nango.

## Contents

- `providers.snippet.yaml` - the provider entry (auth + proxied base URL).
- `nango.yaml` - integration and model definitions.
- `hydradb/actions/` - the two actions.

## Actions

| Action | What it does |
|--------|--------------|
| `ingest-knowledge` | Store a note (`text` + optional `title`). |
| `recall-context`   | Recall matching chunks for a query (text, score, title, id). |

## Authentication

`API_KEY` (Bearer). The connection credential is the HydraDB API key; connection
metadata carries `{ database, collection? }`, which the actions read per call.

## Deploy

1. Add `providers.snippet.yaml` to Nango's `providers.yaml`.
2. Copy `hydradb/` into your `nango-integrations/` project.
3. Deploy:

```bash
npx nango deploy <env>
```

## Usage

Create a HydraDB connection with an API key and set its metadata. Call
`ingest-knowledge` to store data and `recall-context` to retrieve it.

### Query tables and response metadata

The query action accepts optional `includeTableSql` and `tableLimit` (1–100);
omit the limit to use the API default. Table SQL can include query literals, so
only enable it when downstream workflow steps may receive that information.
Query records retain their existing fields and include `chunk_metadata`,
`tabular_data`, `temporal_facts`, `temporal_duration`, `temporal_filter`, and
response `warnings` when present. These response-level fields are repeated on
each chunk. If there are no chunks but any of these fields are present, a
single record with an empty text value carries them instead. A completely empty
response still produces no records.

## Offline tests

The commands below are supported and tested with Python 3.12 and Node.js 24.
Node.js 24 can run the TypeScript action directly via its built-in type
stripping; no Nango installation, generated models, credentials, or hosted
provider is needed for these offline tests. From a fresh checkout, run:

```bash
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m unittest discover -s test -p 'schema_test.py'
node --test test/query.test.mjs
```

These tests use mocked requests and validate the local YAML contract; they do
not validate a deployment or generate Nango models.

For generated-model and TypeScript compilation, the legacy YAML-compatible
Nango CLI 0.58.7 can be run offline against a temporary copy (no Nango
credentials or deployment):

```bash
repo="$PWD"
workdir="$(mktemp -d)"
cp -R "$repo/nango.yaml" "$repo/hydradb" "$workdir/"
cd "$workdir"
npm install --no-save --ignore-scripts nango@0.58.7
env -u NANGO_SECRET_KEY_DEV -u NANGO_SECRET_KEY_PROD \
  NANGO_CLI_UPGRADE_MODE=ignore ./node_modules/.bin/nango compile --auto-confirm
cd "$repo"
```

This generates temporary models and compiles both actions. The legacy CLI warns
about the `Chunk[]` output alias, although compilation succeeds. The current
CLI 0.71.14 rejects `nango.yaml` as deprecated; hosted model generation and
provider behavior remain unverified, and migration to the current TypeScript
configuration requires separate work.
