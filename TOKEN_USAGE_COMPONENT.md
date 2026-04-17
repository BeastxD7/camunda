# Token Usage Analysis Component

## Overview
A comprehensive token usage visualization component for displaying both **BankSupportAgent** and **LLMJudge** token consumption on the process detail page (`http://localhost:5173/process/{instanceKey}`).

## Features

### Components Created
- **`token-usage.tsx`** - Main component responsible for token usage visualization

### What It Displays

#### 1. **Summary Cards** (3 cards in a grid)
- **BankSupportAgent Card** (Blue)
  - Total tokens used by the agent
  - Percentage of total tokens
  - Input/Output token breakdown
  
- **LLMJudge Card** (Purple)
  - Total tokens used by the judge
  - Percentage of total tokens
  - Input/Output token breakdown
  
- **Total Tokens Card** (Green)
  - Grand total of all tokens
  - Number of agents and models

#### 2. **Detailed Breakdown Section**
- Visual token distribution bars showing:
  - **BankSupportAgent**: Input vs Output token split
  - **LLMJudge**: Input vs Output token split
- Color-coded progress bars (blue for agent, purple for judge)

#### 3. **Efficiency Metrics**
- Average tokens per agent call
- Agent vs Judge ratio (e.g., `11.85:1`)

## Data Sources

### Agent Metrics
Extracted from `details.normalized.agentData.metrics`:
- `inputTokenCount`: Total input tokens
- `outputTokenCount`: Total output tokens
- `totalTokens`: Sum of input + output

### Judge Metrics
Extracted from process variables (`llmjudge` variable):
- `context.metrics.tokenUsage.inputTokenCount`
- `context.metrics.tokenUsage.outputTokenCount`

## Integration Points

### Updated Files
1. **`case-details.tsx`** 
   - Added import for `TokenUsage` component
   - Integrated token usage display after the conversation section

### Rendering Location
Token usage appears on the case detail page after the "Customer and AI Conversation" section.

## Token Distribution Example

Based on the analyzed process (instance: 2251799819308706):

| Component | Input | Output | Total | % of Total |
|-----------|-------|--------|-------|-----------|
| **BankSupportAgent** | 12,779 | 421 | **13,200** | 92.2% |
| **LLMJudge** | 981 | 135 | **1,116** | 7.8% |
| **TOTAL** | 13,760 | 556 | **14,316** | 100% |

## How To Use

1. Navigate to any process detail page: `http://localhost:5173/process/{instanceKey}`
2. The token usage section appears automatically below the conversation section
3. View the breakdown of tokens used by each component
4. Analyze efficiency metrics to understand agent and judge computational load

## UI Design

- **Responsive**: Works on mobile, tablet, and desktop
- **Color-coded**: 
  - Blue = BankSupportAgent
  - Purple = LLMJudge
  - Green = Totals
- **Visual indicators**: Progress bars and percentage badges
- **Clean layout**: Matches existing support card styling

## Technical Details

- Built with React and TypeScript
- Uses Lucide icons for visual indicators
- Tailwind CSS for styling
- Handles missing data gracefully (displays "No judge evaluation available" if judge metrics missing)
- JSON parsing for nested metrics from process variables

## Future Enhancements

Possible additions:
- Export token usage data as CSV/JSON
- Historical token usage trends
- Cost calculations based on token pricing
- Token usage alerts/thresholds
- Comparison across multiple process instances
