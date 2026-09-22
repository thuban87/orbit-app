/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source of truth: docs/decisions/ADR-*.md
 * Regenerate:      npm run gen:adr-registry
 *
 * Exists to be read by graphify, not by the app. Each ADR-NNNN token below
 * becomes a graph node shared with every source file that cites the same ADR
 * in a comment, so an ADR's supersession state is one hop from the code it
 * governs. See scripts/gen-adr-registry.ts for why markdown cannot do this.
 */

// NOTE: ADR-0001 [ACCEPTED] Normalized Custom-Field Values
// IMPORTANT: ADR-0002 [SUPERSEDED BY ADR-003 (partial)] Cross-Version Contact Import — Hybrid Two-Picker
// NOTE: ADR-0003 [ACCEPTED] `READ_CONTACTS` on API 37+ for Reconcile
// NOTE: ADR-0004 [ACCEPTED] Flat Single-App Repository
// NOTE: ADR-0005 [ACCEPTED] AiService Port Omits the Local/LAN (Ollama) Provider
// IMPORTANT: ADR-0006 [SUPERSEDED BY ADR-083 (partial)] Theme-Token Architecture
// NOTE: ADR-0007 [ACCEPTED] Cross-Machine Android Build Pipeline & Physical-Pixel FND-01 Proof
// IMPORTANT: ADR-0008 [SUPERSEDED BY ADR-059 (partial)] Initial Contact Schema as a Cross-Phase Data Contract
// NOTE: ADR-0009 [ACCEPTED] Crash-Safe Forward-Only SQLite Migrations
// NOTE: ADR-0010 [ACCEPTED] Single-Writer Interaction Recency Spine
// NOTE: ADR-0011 [ACCEPTED] Query-Time Status and Never-Contacted Segregation
// NOTE: ADR-0012 [ACCEPTED] Opt-Out Android Backup for Third-Party PII
// IMPORTANT: ADR-0013 [SUPERSEDED BY ADR-001] Runtime Two-Table Custom Fields with Whitelist-Constructed DDL
// IMPORTANT: ADR-0014 [SUPERSEDED BY ADR-001 (partial)] Read-Time Custom-Field Type Semantics and a Single Sort Expression
// IMPORTANT: ADR-0015 [SUPERSEDED BY ADR-001 (partial)] Lossless Field Changes with Quarantine and Launch-Time Retention Sweep
// NOTE: ADR-0016 [ACCEPTED] Fixed-First Contact Forms and Atomic Contact Creation
// NOTE: ADR-0017 [ACCEPTED] Multi-Link Contact Reachability
// IMPORTANT: ADR-0018 [SUPERSEDED BY ADR-080 (note — Archived list entry points only; gate unchanged)] Archive-Gated Contact Purge with Explicit Fan-Out
// IMPORTANT: ADR-0019 [SUPERSEDED BY ADR-080 (partial — root shell)] Native Stack Contact Lifecycle Navigation
// NOTE: ADR-0020 [ACCEPTED] Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download
// NOTE: ADR-0021 [ACCEPTED] Durable Relative-Path Photo Masters with Crash-Safe Lifecycle Cleanup
// NOTE: ADR-0022 [ACCEPTED] Tokenized Deterministic Initials Avatars
// IMPORTANT: ADR-0023 [SUPERSEDED BY ADR-116 (partial — the stored channel/quality value vocabulary; the structured-touchpoint architecture, one-tap defaults, and `unspecified` channel remain in forc
// IMPORTANT: ADR-0024 [SUPERSEDED BY ADR-123 (partial — the newest-first profile timeline as the interaction-refinement surface is replaced by the History section, Interaction Detail, and Edit Intera
// NOTE: ADR-0025 [ACCEPTED] Immutable Lifecycle Events in a Unified Timeline
// NOTE: ADR-0026 [ACCEPTED] Rogue Status for Unresponsive or Far-Overdue Contacts
// IMPORTANT: ADR-0027 [SUPERSEDED BY ADR-106 (partial — Orrery Gravity display scope and companion context)] Derived Profile-Only Gravity and Intensity
// NOTE: ADR-0028 [ACCEPTED] Per-Item Conversational Fuel with Fixed Kinds
// IMPORTANT: ADR-0029 [SUPERSEDED BY ADR-039 (partial)] In-Query Fuel Eligibility and a Shared Ranked Projection
// IMPORTANT: ADR-0030 [SUPERSEDED BY ADR-081] Explicit Confirmation of AI-Proposed Fuel
// IMPORTANT: ADR-0031 [SUPERSEDED BY ADR-032 (partial)] Bound Local Fuel Search without FTS5
// NOTE: ADR-0032 [ACCEPTED] Flat Dashboard Discovery and In-Query Contact Search
// IMPORTANT: ADR-0033 [SUPERSEDED BY ADR-075] Profile Marking and Shared Drag-Reordered Favourites
// IMPORTANT: ADR-0034 [SUPERSEDED BY ADR-076 (partial — banner)] Birthday Banner and Re-query Dashboard Freshness
// IMPORTANT: ADR-0035 [SUPERSEDED BY ADR-061 (partial)] Native SMS Handoff with Guaranteed Clipboard Copy
// IMPORTANT: ADR-0036 [SUPERSEDED BY ADR-078 (partial — Off Limits visible on the Research side)] Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails
// NOTE: ADR-0037 [ACCEPTED] Text-Only Android Share Intent Integration
// NOTE: ADR-0038 [ACCEPTED] Contact-Owned Share Capture Fuel
// NOTE: ADR-0039 [ACCEPTED] Pre-Scheduled Inexact Decay Reminders
// NOTE: ADR-0040 [ACCEPTED] Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing
// NOTE: ADR-0041 [ACCEPTED] Notification Settings, Privacy Channels, and Birthday Alerts
// NOTE: ADR-0042 [ACCEPTED] Shared Status Palette for Dashboard and Widget Rings
// IMPORTANT: ADR-0043 [SUPERSEDED BY ADR-075 (partial — ordering source only)] Static Globally Mirrored Favourites Widget
// IMPORTANT: ADR-0044 [SUPERSEDED BY ADR-074 (partial)] Headless Widget Actions and Dashboard-Rooted Deep Links
// NOTE: ADR-0045 [ACCEPTED] Event-Driven Widget Refresh and Boot Recovery
// NOTE: ADR-0046 [ACCEPTED] Query-Time Orrery Placement and Transactional Ring Ordering
// NOTE: ADR-0047 [ACCEPTED] App-Level Assignable Sun and Themed Self Identity
// IMPORTANT: ADR-0048 [SUPERSEDED BY ADR-077 (partial — dual view/morph)] Status-Default Static Orrery with a Single-Canvas Morph
// NOTE: ADR-0049 [ACCEPTED] BYO-Key AI Configuration and Credential Boundary
// IMPORTANT: ADR-0050 [SUPERSEDED BY ADR-078 (partial — Off Limits and permitted interaction notes)] Closed AI Prompt Egress Allowlist and Opt-In Field Sharing
// NOTE: ADR-0051 [ACCEPTED] Public-HTTPS Custom AI Egress Guard
// IMPORTANT: ADR-0052 [SUPERSEDED BY ADR-079 (partial — acknowledgement and Profile entry)] Compose-Owned AI Draft Lifecycle and Acknowledged Egress
// NOTE: ADR-0053 [ACCEPTED] Local-First LiteLLM AI Model Catalog
// IMPORTANT: ADR-0054 [SUPERSEDED BY ADR-147 (partial)] Live Weekly Digest Retrospective and Overlooked Relationship Read
// NOTE: ADR-0055 [ACCEPTED] Dedicated Weekly Digest Scheduling and Persisted Notification Policy
// IMPORTANT: ADR-0056 [SUPERSEDED BY ADR-060 (partial)] Tombstone-Backed UID Reconciliation for Portable Restores
// NOTE: ADR-0057 [ACCEPTED] Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots
// NOTE: ADR-0058 [ACCEPTED] Optional Encrypted Backups and Previewed Local Restoration
// NOTE: ADR-0059 [ACCEPTED] Normalized Contact Methods, Canonical Actionability, and Local Provenance
// IMPORTANT: ADR-0060 [SUPERSEDED BY ADR-063 (partial)] Versioned Portable Method Graph and Collision-Normalized Restoration
// NOTE: ADR-0061 [ACCEPTED] DAO-Selected Actionable Primary SMS Handoff
// IMPORTANT: ADR-0062 [SUPERSEDED BY ADR-147 (partial)] Bound/Unbound Lifecycle and One-Way Cadence Assignment
// IMPORTANT: ADR-0063 [SUPERSEDED BY ADR-145 (partial)] Versioned Lifecycle Backup and Dormant-Cadence Restore
// NOTE: ADR-0064 [ACCEPTED] Permissionless Android 17 System-Contact Snapshot Acquisition
// NOTE: ADR-0065 [ACCEPTED] Durable Resumable Contact-Import Sessions with Failure-Isolated Photos
// NOTE: ADR-0066 [ACCEPTED] Deliberate Reviewed Import with Unbound Bulk Defaults
// NOTE: ADR-0067 [ACCEPTED] Conservative Advisory Identity Matching and Explicit Source Consolidation
// NOTE: ADR-0068 [ACCEPTED] User-Triggered, Source-Only Reconciliation with Durable Review
// NOTE: ADR-0069 [ACCEPTED] Atomic Tombstone-Backed Orbit Contact Merge
// NOTE: ADR-0070 [ACCEPTED] Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out
// NOTE: ADR-0071 [ACCEPTED] User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer
// NOTE: ADR-0072 [ACCEPTED] Shared Actionable Reach Out Router with Native Channel Handoff
// NOTE: ADR-0073 [ACCEPTED] Merge-Reparented, Purge-Cascaded Interaction Assists
// NOTE: ADR-0074 [ACCEPTED] Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe
// NOTE: ADR-0075 [ACCEPTED] Binary Favourite Membership Without a User-Facing Order
// NOTE: ADR-0076 [ACCEPTED] Population-Reached Birthdays Without a Dashboard Banner
// NOTE: ADR-0077 [ACCEPTED] Single Canonical Orrery with a Constrained Inspection Camera
// IMPORTANT: ADR-0078 [SUPERSEDED BY ADR-107 (partial — Off Limits AI egress reversed; the gated recent-interaction-note carry and the Group Notes ban below remain in force)] Negative-Constraint Off
// NOTE: ADR-0079 [ACCEPTED] On-Demand AI Transparency and Compose-Only Three-Suggestion Invocation
// IMPORTANT: ADR-0080 [SUPERSEDED BY ADR-146 (partial)] Four-Tab Bottom Navigation Shell with Per-Tab Stacks
// NOTE: ADR-0081 [ACCEPTED] Retire AI-Proposed Fuel for Explicit Per-Item Permission
// IMPORTANT: ADR-0082 [SUPERSEDED BY ADR-132 (partial — the visible “Log Contact” action name and its placeholder workflow)] Universal Capture FAB, Canonical Picker, and Truthful Quick Log
// NOTE: ADR-0083 [ACCEPTED] Durable Multi-Package Theme Configuration and Restore-Before-Paint
// NOTE: ADR-0084 [ACCEPTED] Four Semantic Theme Palettes, Curated Accents, and Contrast Validation
// NOTE: ADR-0085 [ACCEPTED] Live Reduced-Motion Signal for Skia Ambient Animation
// NOTE: ADR-0086 [ACCEPTED] Semantic Icons and Accessible Interaction Primitives
// IMPORTANT: ADR-0087 [SUPERSEDED BY ADR-115 (partial — host/card opacity coupling, Standard flat-only treatment, and Android translucent-card elevation)] Bundled Background Presets and Package-Speci
// NOTE: ADR-0088 [ACCEPTED] Additive Contact-Knowledge Schema and Application-Owned Memory Registry
// NOTE: ADR-0089 [ACCEPTED] Recoverable Memory Lifecycle and Contact-Operation Integrity
// NOTE: ADR-0090 [ACCEPTED] Additive Custom-Field Value History and Deferred Contact Scope
// NOTE: ADR-0091 [ACCEPTED] Imported Contact Notes as AI-Off Typed Memories
// NOTE: ADR-0092 [ACCEPTED] Durable Shared Dashboard Query State
// NOTE: ADR-0093 [ACCEPTED] Scoped Composable Dashboard Population and Filter Model
// NOTE: ADR-0094 [ACCEPTED] Eligibility-Scoped Semantic Dashboard Search
// NOTE: ADR-0095 [ACCEPTED] Live-Applying Dashboard Floating Control Surface
// NOTE: ADR-0096 [ACCEPTED] Dashboard Header and Overflow Discovery Paths
// NOTE: ADR-0097 [ACCEPTED] Scoped Dashboard Search and Dedicated Unbound Retrieval
// NOTE: ADR-0098 [ACCEPTED] Scan-First, Accessible Dashboard List Rows
// NOTE: ADR-0099 [ACCEPTED] Durable Global Dashboard Right-Swipe Action
// NOTE: ADR-0100 [ACCEPTED] Relevance-First, Visibility-Safe Dashboard List Search
// IMPORTANT: ADR-0101 [SUPERSEDED BY ADR-153 (partial — normal Grid card context row)] Avatar-First Accessible Dashboard Card Renderer
// NOTE: ADR-0102 [ACCEPTED] Frozen-Universe Dashboard Multi-Select
// NOTE: ADR-0103 [ACCEPTED] Atomic Composed Dashboard Bulk Mutations
// NOTE: ADR-0104 [ACCEPTED] Durable Orrery Preferences and Live System Scope
// NOTE: ADR-0105 [ACCEPTED] Scoped Relationship Satellites for System-Member Context
// NOTE: ADR-0106 [ACCEPTED] Derived Orrery Gravity Visual Mass and Accessible Context
// NOTE: ADR-0107 [ACCEPTED] Off Limits Excluded from All AI Egress
// NOTE: ADR-0108 [ACCEPTED] Durable Independent-Axis Profile Presentation and Inheritance
// NOTE: ADR-0109 [ACCEPTED] Fixed-Hero Semantic Profile Composition and Focused Accessible Editors
// NOTE: ADR-0110 [ACCEPTED] Coherent Local Profile Snapshot and Source-Owned Knowledge Projection
// NOTE: ADR-0111 [ACCEPTED] Cadence-Guarded Profile Metrics and Composed Relationship Actions
// NOTE: ADR-0112 [ACCEPTED] App-Owned Profile Background Derivatives and Launch Reconciliation
// NOTE: ADR-0113 [ACCEPTED] Persistent Shared System Background Selection
// NOTE: ADR-0114 [ACCEPTED] Route-Aware App-Wide System Background Composition
// NOTE: ADR-0115 [ACCEPTED] Visible Mode-Aware Background Surface Composition
// NOTE: ADR-0116 [ACCEPTED] Value-Remapped Interaction Vocabulary and Optional Descriptive Duration
// NOTE: ADR-0117 [ACCEPTED] Per-Interaction Allow-AI Consent Gate, Default-Off and Fail-Closed on Restore
// NOTE: ADR-0118 [ACCEPTED] Bind/Unbind Immutable Lifecycle Events Without a Migration
// NOTE: ADR-0119 [ACCEPTED] Reusable Count-Only History Aggregation and Canonical Single-Contact History Read
// NOTE: ADR-0120 [ACCEPTED] Shared-Window Heatmap and Intensity with Globally-Persisted Lenses
// NOTE: ADR-0121 [ACCEPTED] Rolodex Month/Day/Year History Browser (Reanimated, No Skia)
// IMPORTANT: ADR-0122 [SUPERSEDED BY ADR-127 (partial — dormant group-context and edit-scope routing only)] Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet Through the Sole Rec
// NOTE: ADR-0123 [ACCEPTED] Profile History Section Replacing the Vertical Timeline, with Detailed-Log Backfill Routing
// NOTE: ADR-0124 [ACCEPTED] Group Event Parents with Canonical Per-Contact Children
// NOTE: ADR-0125 [ACCEPTED] Three-Field Live Inheritance with Separate Local-Only Group Notes
// NOTE: ADR-0126 [ACCEPTED] Explicit Group Lifecycle and Identity-Preserving Conversion
// NOTE: ADR-0127 [ACCEPTED] Canonical Event-First Group Logging and Explicit Child Edit Scope
// NOTE: ADR-0128 [ACCEPTED] Same-Group Contact Merge Refusal with Remediation
// NOTE: ADR-0129 [ACCEPTED] Portable Group Identity and History-Preserving Orphan Disposition
// NOTE: ADR-0130 [ACCEPTED] Durable Scoped Default Interaction Channel
// NOTE: ADR-0131 [ACCEPTED] Progressive Contact Creation and Complete-Record Editing
// NOTE: ADR-0132 [ACCEPTED] Focused Rapid Capture Workflows
// NOTE: ADR-0133 [ACCEPTED] Session-Scoped Compose Modes and Truthful External Handoff
// NOTE: ADR-0134 [ACCEPTED] Read-Only Compose Research and Permission-Bounded Message Focus
// NOTE: ADR-0135 [ACCEPTED] Multi-Connection AI Configuration and Fail-Closed Readiness
// NOTE: ADR-0136 [ACCEPTED] Permission-Bounded Prompt Assembly and AI Transparency
// NOTE: ADR-0137 [ACCEPTED] Structured Personalization and Explicit Context Capacity
// NOTE: ADR-0138 [ACCEPTED] Complete Portable Backup Format v5
// NOTE: ADR-0139 [ACCEPTED] Loopback-Only OpenRouter Authorization Callback
// NOTE: ADR-0140 [ACCEPTED] Navigation-First Settings Directory and Canonical Sub-Routes
// IMPORTANT: ADR-0141 [SUPERSEDED BY ADR-146 (partial)] Explicit-Host Dual-Home Backup Navigation
// NOTE: ADR-0142 [ACCEPTED] User-Owned Categories with Stable Identity and Canonical Ordering
// NOTE: ADR-0143 [ACCEPTED] Lock-Time-Revalidated Atomic Category Deletion and System Fallout
// NOTE: ADR-0144 [ACCEPTED] Complete Category Selection and Grouped Orrery System Discovery
// IMPORTANT: ADR-0145 [SUPERSEDED BY ADR-148 (partial)] Category-Aware Portable Backup Format v6 and Exact Taxonomy Restore
// NOTE: ADR-0146 [ACCEPTED] Digest-Centered Five-Tab Shell and Semantic Root Routing
// NOTE: ADR-0147 [ACCEPTED] Derived Digest Composition and Canonical Contacts Drill-Through
// NOTE: ADR-0148 [ACCEPTED] Portable Your Week Period and Group-Deduplicated Activity Aggregation
// NOTE: ADR-0149 [ACCEPTED] Orrery-Specific Translucent Overlay Treatment and Icon Controls
// NOTE: ADR-0150 [ACCEPTED] Semantic Profile Hierarchy and Source-Owned Knowledge Editing
// NOTE: ADR-0151 [ACCEPTED] Visual-Only Relationship Overview Orphan Packing
// NOTE: ADR-0152 [ACCEPTED] Vertical History Heatmap and Minute-Precision Timestamps
// NOTE: ADR-0153 [ACCEPTED] Two-Row Normal Contacts Grid

export const ADR_COUNT = 153;
