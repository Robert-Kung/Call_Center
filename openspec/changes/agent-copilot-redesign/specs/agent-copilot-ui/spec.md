## ADDED Requirements

### Requirement: Three-column layout
AgentView SHALL render a three-column layout (left: transcript, center: customer context, right: AI assistance) when viewport width ≥ 1280px.

#### Scenario: Desktop display
- **WHEN** viewport width is ≥ 1280px
- **THEN** system displays three columns side-by-side with approximate ratio 30%/35%/35%

#### Scenario: Narrow viewport fallback
- **WHEN** viewport width is < 1280px
- **THEN** system stacks panels vertically or uses a tab-based navigation

### Requirement: Real-time transcript panel
Left column SHALL display all conversation messages in real-time chat bubble format, with speaker differentiation (customer vs AI) and auto-scroll to latest message.

#### Scenario: Message received during call
- **WHEN** a new message is added to `displayedConversations`
- **THEN** transcript panel renders message with speaker icon (User/Bot) and auto-scrolls to bottom

#### Scenario: Streaming AI text display
- **WHEN** `streamingAiText` is non-empty during Gemini Live mode
- **THEN** transcript panel displays a typing indicator bubble with partial text

#### Scenario: Mock mode step-through
- **WHEN** voiceMode is 'mock' and user clicks "下一步"
- **THEN** transcript panel appends the next scripted message

### Requirement: Customer identification card
Center column SHALL display a structured customer info card extracted from `currentAnalysis.entities`, showing parsed key-value pairs (name, phone, service type) and emotion flags.

#### Scenario: Entities parsed from analysis
- **WHEN** `currentAnalysis` contains entities like "戶名:林美玲"
- **THEN** customer card displays structured rows: label "戶名", value "林美玲"

#### Scenario: Emotion flags displayed
- **WHEN** `currentAnalysis.flags` contains items
- **THEN** customer card renders colored badges (red for error-type, amber for warning-type)

#### Scenario: No analysis available
- **WHEN** `currentAnalysis` is null (call not started or no speech yet)
- **THEN** customer card displays placeholder "等待客戶發話..."

### Requirement: Intent analysis in center column
Center column SHALL include a compact intent analysis section showing recognized intent, confidence score, and entity tags — reusing data from existing `currentAnalysis` state.

#### Scenario: Intent recognized
- **WHEN** `currentAnalysis.intent` is set
- **THEN** center column shows intent badge with confidence percentage

### Requirement: Ticket display in center column
Center column SHALL show generated tickets in a compact list format, reusing existing `tickets` state from CallContext.

#### Scenario: Ticket created
- **WHEN** a new ticket is added to `tickets` array
- **THEN** ticket card shows ticket type, ID, and creation time

### Requirement: Agent toolbar
Top toolbar SHALL display: scenario name, mode badge, call duration, latency metric, mute button, hangup button, and "轉接真人" (handoff) button.

#### Scenario: Call connected
- **WHEN** callState is 'connected'
- **THEN** toolbar shows green indicator, duration timer, all action buttons enabled

#### Scenario: Handoff button clicked
- **WHEN** user clicks "轉接真人" button
- **THEN** system triggers handoff flow (see handoff-transfer spec)

### Requirement: Scene selection before call
AgentView SHALL display a scene selection interface when no scenario is selected, allowing the agent to pick which call to "accept".

#### Scenario: Idle state
- **WHEN** callState is 'idle' and no scenario selected
- **THEN** display scenario cards with name, service line, and "接聽" button

#### Scenario: Auto-dial on select
- **WHEN** agent selects a scenario
- **THEN** system automatically dials (existing behavior preserved)
