## ADDED Requirements

### Requirement: Real-time summary generation
System SHALL provide an auto-updating summary of the ongoing call, displaying customer's main issue, emotion state, completed steps, and suggested next action.

#### Scenario: Mock mode summary
- **WHEN** voiceMode is 'mock' and a conversation step includes `summary` field
- **THEN** `currentSummary` state updates with the scripted summary data

#### Scenario: Gemini Live mode summary via function call
- **WHEN** voiceMode is 'gemini-live' and Gemini invokes `generate_summary` tool
- **THEN** `currentSummary` state updates with the returned structured data (summary, mainIssue, emotionState, completedSteps, nextAction)

#### Scenario: WS Live fallback
- **WHEN** voiceMode is 'rest-live' (no function calling support)
- **THEN** system displays the latest `currentAnalysis` intent + entities as a simplified summary substitute

#### Scenario: Summary display format
- **WHEN** `currentSummary` contains data
- **THEN** AI Summary panel renders: summary text, emotion indicator, completed steps checklist, and suggested next action highlighted

### Requirement: generate_summary tool declaration
System SHALL declare a `generate_summary` function in `GEMINI_TOOL_DECLARATIONS` for Gemini Live mode.

#### Scenario: Tool schema correctness
- **WHEN** Gemini Live session is established
- **THEN** setup message includes `generate_summary` tool with properties: summary (string), customerName (string, optional), mainIssue (string), emotionState (enum: positive/neutral/frustrated/angry), completedSteps (array of strings, optional), nextAction (string, optional)

#### Scenario: Tool response handling
- **WHEN** Gemini sends a toolCall for `generate_summary`
- **THEN** CallContext `onToolCall` handler updates `currentSummary` state and returns `{ success: true }` as toolResponse

### Requirement: Suggested response display
Right column SHALL display a suggested response text that the agent can reference when speaking to the customer.

#### Scenario: Mock mode suggested response
- **WHEN** voiceMode is 'mock' and scenario step includes `suggestedResponse`
- **THEN** `suggestedResponse` state updates and panel displays the suggestion text

#### Scenario: Gemini Live suggested response
- **WHEN** `currentSummary.nextAction` is available
- **THEN** suggested response panel displays `nextAction` as the recommendation

#### Scenario: No suggestion available
- **WHEN** neither `suggestedResponse` nor `currentSummary.nextAction` is set
- **THEN** panel displays placeholder "AI 正在分析中..."

### Requirement: Summary updates on conversation progress
System SHALL update the summary at appropriate intervals during the call.

#### Scenario: Mock mode progressive updates
- **WHEN** each conversation step advances in mock mode
- **THEN** summary updates if the step contains new summary data

#### Scenario: Gemini Live periodic updates
- **WHEN** system prompt instructs Gemini to call `generate_summary` every 2-3 turns
- **THEN** summary refreshes with latest conversation context

### Requirement: Quick query panel
Right column SHALL display quick-query buttons that simulate CRM/system lookups.

#### Scenario: Query button clicked in mock mode
- **WHEN** agent clicks a quick query button (e.g., "帳號查詢", "線路狀態")
- **THEN** panel displays mock query results (pre-defined data from scenario)

#### Scenario: Query button display
- **WHEN** call is connected
- **THEN** panel shows 2-4 context-relevant query buttons based on scenario type
