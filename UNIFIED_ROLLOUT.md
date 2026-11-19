# Unified rollout preparation

**DO NOT MERGE — Unified API is not enabled in production; hold until production rollout is confirmed.**

This is an unpublished-contract preview, not a production API sync. Do not
publish, import, deploy, or enable it before rollout is confirmed. Existing
split operations and API-Version 2 remain the default. A failed write is never
retried with another layout.

## Contract provenance

The response fixture is handwritten from `flag-on.json` at application commit
`5d45c23840a62fcf38ff13e8deea5587ab1b961c`:
SHA-256 `34972cc67f1cc20b32371a4365f3fe69980f06e52c8559ad4e805e1c1d58feba`.
The same-source `flag-off.json` baseline has SHA-256
`418f71fbf02fd8e319b69ece7e143842ef2c45ff36b4a2deb1fa4d76e2171320`.

Query response schemas are `search.QueryResult` and `search.QueryChunk`.
The preview SDK JSON does **not** declare JSON context ingestion: its ingest
request exposes multipart only. The JSON write contract instead comes from
`application/internal/domain/memories/unified_ingest.go` and
`application/internal/api/handler/{context_ingest_route.go,type_rule_matrix_test.go,unified_defaults_test.go}`
at that commit. Response behavior is implemented in
`application/internal/domain/search/unified_response.go`.
No generated SDK or Nango models are checked in or modified here.
Published `@hydradb/sdk@2.1.8` has no typed unified declarations; this preview
uses raw transport rather than inventing an SDK version. Site publication is
independently blocked by the source's documentation lint failures.

## Unified writes

Unified ingestion sends JSON `{database, collection, context: [...]}`, never
split `type`/`kind`, `app_knowledge`, or `memories`. Each context has nonblank
`text` XOR a nonempty `conversation: [{role, content}]`; roles are `user`,
`assistant`, or `system`, with at least one user/assistant turn.

Optional context fields are `context_id`, `title`, `user_name`, `attributes`,
`custom_attributes`, `happened_at` (YYYY-MM-DD), `enrich`, `instructions`,
`upsert`, `forceful_relations: {context_ids, properties}`, and `acl`.
False, zero, empty strings and an explicitly empty ACL are not defaulted away.
Unknown item/turn/relation keys are rejected, including removed
`context_category` and split `metadata`/`additional_metadata`.
The executable adapters validate structure, identities and text budgets before
sending; the server remains authoritative for metadata policy, ACL principal
normalization and asynchronous acceptance. A 202 means queued, not indexed.

## Unified reads

Read shape is independent of the selected write layout. Unified `chunk_id`
becomes the host record's `id`, `content` becomes `text` verbatim, and
`context_id`, score, enrichment, receipt time, optional temporal facts and CSV
row ranges remain separate. JSON-looking content is literal, not a split
content envelope. Source title/metadata are not invented or fetched.
Root `graph[]`, `forceful_relations[]`, `llm_prompt` and `tabular_data` are
preserved. Pass `llm_prompt` verbatim to a downstream model; do not trim,
unwrap, reconstruct or concatenate it with chunk prose.

## Nango interface and verification

Connection metadata is `{database, collection?, layout?}`. Explicitly set
`layout: "unified"` to write unified contexts; omission means split and other
values are rejected. Ingest accepts the existing Text/Title convenience or a
`context` array replacing them. Convenience notes receive a Nango-prefixed
context ID; use explicit context_id for controlled upserts. Context arrays
cannot be sent with split layout.

`recall-context` still returns `Chunk[]`, with no fabricated chunks when the
response has only roots. The additive `recall-context-envelope` action returns
the full API envelope for graph-only/prompt-only responses. `nango.yaml`
declares the additional input/output models; no generated models are edited.
Ingestion still reports success only on affirmative per-item acceptance and
reports false on partial failures or empty acknowledgments.

Run `npm test` with Node 24+. Tests load the action source with native type
stripping and a mocked Nango transport. They verify runtime behavior but do
not generate hosted models, typecheck against them, or deploy/import to Nango.

This repository still uses Nango's legacy YAML configuration. Nango's
[September 16, 2026 sunset notice](https://nango.dev/docs/updates/changelog#nango-yaml-sunset)
says new YAML-based deployments are rejected; already deployed functions keep
running. A separate migration to TypeScript function configuration and host
validation is required before this scaffold can be deployed. The offline tests
here do not clear that prerequisite, and this rollout preparation does not run
the migration or deploy anything.
