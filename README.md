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
