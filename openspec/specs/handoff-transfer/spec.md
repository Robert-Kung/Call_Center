# handoff-transfer Specification

## Purpose
TBD - created by archiving change agent-copilot-redesign. Update Purpose after archive.
## Requirements
### Requirement: Handoff trigger button
Agent toolbar SHALL include a "轉接真人" button that triggers the handoff flow when clicked during an active call.

#### Scenario: Button enabled during call
- **WHEN** callState is 'connected'
- **THEN** "轉接真人" button is enabled and visible in toolbar

#### Scenario: Button disabled when idle
- **WHEN** callState is 'idle' or 'ended'
- **THEN** "轉接真人" button is disabled or hidden

### Requirement: Handoff package generation
System SHALL generate a structured handoff package containing call summary, customer info, intent, entities, flags, conversation count, and suggested action.

#### Scenario: Handoff triggered in mock mode
- **WHEN** agent clicks "轉接真人" in mock mode
- **THEN** system assembles handoff package from `currentAnalysis`, `displayedConversations`, `currentSummary`, `callDuration` and sets `handoffPackage` state

#### Scenario: Handoff triggered in Gemini Live mode
- **WHEN** agent clicks "轉接真人" in gemini-live mode
- **THEN** system first triggers `generate_summary` (if not recent), then assembles handoff package with latest data

#### Scenario: Handoff package structure
- **WHEN** handoff package is generated
- **THEN** package contains: handoffTime (ISO string), duration (formatted), customer (object with name/phone/relation), intent (string), summary (string), entities (array), flags (array), conversationCount (number), suggestedAction (string)

### Requirement: Handoff overlay display
System SHALL display a handoff overlay/panel showing the structured handoff package in a readable format when `isHandoffMode` is true.

#### Scenario: Overlay appears on trigger
- **WHEN** `isHandoffMode` becomes true
- **THEN** an overlay panel renders on top of right column showing the handoff package

#### Scenario: Overlay content sections
- **WHEN** handoff overlay is displayed
- **THEN** it shows sections: 通話摘要, 客戶資料, 意圖分析, 標記事項, 建議行動

#### Scenario: Copy summary action
- **WHEN** agent clicks "複製摘要" button in overlay
- **THEN** handoff package text is copied to clipboard

#### Scenario: Close overlay
- **WHEN** agent clicks "關閉" or "返回" button
- **THEN** `isHandoffMode` is set to false and overlay dismisses

### Requirement: Call state after handoff
System SHALL end the current call (or mark as transferred) after handoff is confirmed.

#### Scenario: Confirm transfer
- **WHEN** agent clicks "確認轉接" in overlay
- **THEN** call is ended with status 'transferred', handoff package is logged via SessionLogger

#### Scenario: Cancel transfer
- **WHEN** agent clicks "取消" in overlay
- **THEN** call continues normally, overlay closes, `isHandoffMode` resets to false

