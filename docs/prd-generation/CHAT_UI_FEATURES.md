# CSCX.AI Chat UI Features

> Detailed inventory of Chat UI capabilities available to CSMs

---

## 1. AI Panel (Embedded Chat Interface)

### 1.1 Location
- Embedded in UnifiedOnboarding view (30% right panel)
- Context-aware based on current workflow phase
- Collapsible/expandable

### 1.2 Core Chat Features
| Feature | Description |
|---------|-------------|
| **Message Input** | Free-text input with Enter to send |
| **Streaming Responses** | Real-time token-by-token response display |
| **Stop Generation** | Abort button to stop streaming responses |
| **Auto-retry** | Exponential backoff retry on connection errors (3 attempts) |
| **Message History** | Persisted to database per session |
| **Typing Indicator** | "Thinking..." animation during processing |

### 1.3 Phase-Specific Context
The AI adapts its behavior based on the current workflow phase:

| Phase | Welcome Message | AI Behavior |
|-------|-----------------|-------------|
| `upload` | "Ready to analyze your contract!" | Guide through upload process |
| `parsing` | "Analyzing your contract..." | Narrate extraction progress |
| `review` | "Contract analysis complete!" | Explain extracted data, help fix issues |
| `enriching` | "Gathering additional intelligence..." | Research company, map stakeholders |
| `planning` | "Creating your onboarding plan..." | Generate customized 30-60-90 day plan |
| `plan_review` | "Onboarding plan ready for review!" | Walk through phases, explain reasoning |
| `executing` | "Agents are active!" | Coordinate onboarding, report progress |
| `monitoring` | "Monitoring customer health..." | Track engagement, watch for signals |
| `completed` | "Onboarding complete!" | Provide summary, suggest next steps |

### 1.4 Quick Actions
Phase-specific quick action buttons:

#### Upload Phase
- **Explain Process**: "What will happen when I upload a contract?"
- **Supported Formats**: "What file formats can I upload?"

#### Parsing/Review Phase
- **Explain Data**: "Explain what data was extracted and why it matters."
- **Missing Info**: "What information is missing from this contract?"
- **Validate Data**: "Are there any issues with the extracted data?"

#### Planning Phase
- **Explain Plan**: "Walk me through this onboarding plan."
- **Customize**: "How can I customize this plan for this customer?"

#### Execution Phase
- **Next Steps**: "What should I focus on next for this customer?"
- **Schedule Meeting**: "Help me schedule a kickoff meeting with the stakeholders."
- **Draft Email**: "Draft a welcome email for this customer."
- **Check Health**: "What is the current health score and any risk signals?"

#### Monitoring Phase
- **Churn Analysis**: "Are there any churn signals for this customer?"
- **Expansion**: "What expansion opportunities exist for this customer?"

---

## 2. Chat Commands & Capabilities

### 2.1 Natural Language Commands
The AI can interpret and execute these types of requests:

#### Email Actions
| Request Type | Example Prompt |
|-------------|----------------|
| Draft email | "Draft a welcome email for this customer" |
| Draft follow-up | "Help me write a follow-up email after our kickoff meeting" |
| Find customer emails | "Show me recent emails from this customer" |
| Summarize thread | "Summarize our email communication with this customer" |

#### Calendar Actions
| Request Type | Example Prompt |
|-------------|----------------|
| Check availability | "When am I free this week?" |
| Schedule meeting | "Schedule a kickoff meeting with the stakeholders" |
| Find meetings | "Show me past meetings with this customer" |
| Propose time | "Find a time for a 1-hour QBR next week" |

#### Document Actions
| Request Type | Example Prompt |
|-------------|----------------|
| Create document | "Create an onboarding plan document" |
| Find documents | "Find all documents for this customer" |
| Create spreadsheet | "Create a health score tracker for this customer" |
| Generate QBR | "Prepare the QBR materials for this customer" |

#### Analysis Actions
| Request Type | Example Prompt |
|-------------|----------------|
| Health check | "What's the current health score?" |
| Risk analysis | "Are there any churn risks?" |
| Usage analysis | "How is this customer using the product?" |
| Stakeholder map | "Who are the key stakeholders?" |

### 2.2 Tool Use Display
When the AI uses tools, the UI shows:
- Tool name being executed
- Thinking indicator
- Tool results (on completion)

---

## 3. Pending Approvals Widget

### 3.1 Location
Embedded in AI Panel, above chat messages

### 3.2 Features
| Feature | Description |
|---------|-------------|
| **Compact View** | Minimized by default, expandable |
| **Approval List** | Shows pending actions requiring approval |
| **Action Details** | Tool name, description, preview |
| **Approve Button** | One-click approval |
| **Reject Button** | Reject with optional note |
| **Urgency Indicator** | Blocking, important, informational |

### 3.3 Approval Types Shown
- Send email (blocking)
- Book meeting (important)
- Create document (informational)
- Share externally (blocking)
- Escalation (blocking)

---

## 4. Customer Context Display

### 4.1 Header Information
Always visible in AI Panel header:
- Customer name
- ARR (formatted as currency)
- Current workflow phase

### 4.2 Contextual Awareness
The AI has access to:
- Customer profile (name, industry, ARR, health score, status)
- Contract data (entitlements, stakeholders, requirements)
- Onboarding plan (phases, tasks, owners)
- Recent interactions
- Risk signals
- Workflow state

---

## 5. Workspace Agent Quick Actions

### 5.1 Email Category
| Action ID | Description | Requires Approval |
|-----------|-------------|-------------------|
| `summarize_thread` | Get recent email threads | No |
| `draft_email` | Create email draft | Yes |
| `find_customer_emails` | Search customer emails | No |

### 5.2 Calendar Category
| Action ID | Description | Requires Approval |
|-----------|-------------|-------------------|
| `check_availability` | Find free slots | No |
| `schedule_meeting` | Create calendar event | Yes |
| `find_customer_meetings` | Search past meetings | No |

### 5.3 Documents Category
| Action ID | Description | Requires Approval |
|-----------|-------------|-------------------|
| `find_documents` | Search Drive files | No |
| `create_document` | Create Google Doc | No |
| `create_spreadsheet` | Create Google Sheet | No |

### 5.4 Health Score Category
| Action ID | Description | Requires Approval |
|-----------|-------------|-------------------|
| `calculate_score` | Calculate current health score | No |
| `get_trends` | Get health score history | No |

### 5.5 QBR Category
| Action ID | Description | Requires Approval |
|-----------|-------------|-------------------|
| `prepare_qbr` | Create QBR prep document | No |
| `generate_slides` | Create QBR presentation | No |

### 5.6 Renewal Category
| Action ID | Description | Requires Approval |
|-----------|-------------|-------------------|
| `check_renewal` | Get renewal information | No |
| `start_playbook` | Start renewal playbook | No |

### 5.7 Knowledge Base Category
| Action ID | Description | Requires Approval |
|-----------|-------------|-------------------|
| `search` | Search knowledge base | No |
| `get_playbook` | Get specific playbook | No |

---

## 6. Chat History & Sessions

### 6.1 Persistence
| Data | Storage |
|------|---------|
| Messages | `chat_messages` table |
| Sessions | Session ID per conversation |
| Tool calls | Stored with message metadata |

### 6.2 History Features
| Feature | Endpoint | Description |
|---------|----------|-------------|
| Get customer history | `GET /api/chat/customer/:customerId` | All messages for a customer |
| Get session history | `GET /api/chat/session/:sessionId` | Messages in specific session |
| Search history | `GET /api/chat/history?search=...` | Full-text search |
| Delete session | `DELETE /api/chat/session/:sessionId` | Remove session messages |

---

## 7. Streaming & Real-time Updates

### 7.1 Response Streaming
- Server-Sent Events (SSE) from `/api/agents/chat/stream`
- Token-by-token display
- Progressive content rendering

### 7.2 Event Types
| Event | Description |
|-------|-------------|
| `token` | New token of response content |
| `thinking` | AI is processing |
| `tool_start` | Tool execution beginning |
| `tool_end` | Tool execution complete |
| `done` | Stream complete |
| `error` | Error occurred |

### 7.3 WebSocket Updates
Real-time notifications for:
- Agent run start/end
- Step completion
- Approval requests
- Trace events

---

## 8. Error Handling

### 8.1 Connection Errors
- Auto-retry with exponential backoff
- System message: "Connection lost, retrying... (attempt X/3)"
- Final error: "Connection failed after multiple attempts"

### 8.2 AI Errors
- Display error message to user
- Allow retry of last message

### 8.3 Tool Errors
- Show tool-specific error
- Suggest alternative actions

---

## 9. UI Components Available

### 9.1 Message Bubbles
| Type | Styling |
|------|---------|
| User message | Right-aligned, accent color background |
| Assistant message | Left-aligned, gray background |
| System message | Yellow background, border |

### 9.2 Status Indicators
- Streaming cursor (animated block)
- Thinking spinner
- "Stopped by user" indicator
- Retry status messages

### 9.3 Interactive Elements
- Quick action buttons (phase-specific)
- Send button (with loading state)
- Stop button (during streaming)
- Minimize/expand toggle

---

## 10. Agent Types Referenced

The Chat UI can interact with these specialist agents:

| Agent | Capabilities via Chat |
|-------|----------------------|
| **Orchestrator** | Coordinate tasks, delegate to specialists |
| **Scheduler** | Meeting scheduling, availability checks |
| **Communicator** | Email drafting, outreach sequences |
| **Researcher** | Company research, stakeholder mapping |
| **Monitor** | Health checks, risk analysis |
| **Expansion** | Upsell opportunities, proposals |

---

## 11. Workflows Accessible from Chat

### 11.1 Onboarding Workflow
- Contract upload and analysis
- Plan generation and review
- Agent execution monitoring

### 11.2 Health Monitoring
- Real-time health score checks
- Risk signal alerts
- Trend analysis

### 11.3 Renewal Management
- Renewal status checks
- Playbook initiation
- Proposal preparation

### 11.4 QBR Preparation
- Document generation
- Slide creation
- Metrics aggregation

### 11.5 Communication
- Email drafting (with approval)
- Meeting scheduling (with approval)
- Slack messaging (with approval)
