export type ContextOverflowData = {
  inputTokens: number
  maxTokens: number
  contextLimit: number
}

function parseContextOverflowMatch(
  match: RegExpMatchArray | null,
  positions: {
    inputTokens: number
    maxTokens: number
    contextLimit: number
  },
): ContextOverflowData | undefined {
  if (!match) {
    return undefined
  }

  const inputTokens = parseInt(match[positions.inputTokens]!, 10)
  const maxTokens = parseInt(match[positions.maxTokens]!, 10)
  const contextLimit = parseInt(match[positions.contextLimit]!, 10)

  if (
    Number.isNaN(inputTokens) ||
    Number.isNaN(maxTokens) ||
    Number.isNaN(contextLimit)
  ) {
    return undefined
  }

  return {
    inputTokens,
    maxTokens,
    contextLimit,
  }
}

export function parseMaxTokensContextOverflowFromMessage(
  rawMessage: string,
): ContextOverflowData | undefined {
  const message = rawMessage.replace(/\s+/g, ' ').trim()
  if (!message) {
    return undefined
  }

  const anthropicStyle = parseContextOverflowMatch(
    message.match(
      /input length and [`']max_tokens[`'] exceed context limit:\s*(\d+)\s*\+\s*(\d+)\s*>\s*(\d+)/i,
    ),
    {
      inputTokens: 1,
      maxTokens: 2,
      contextLimit: 3,
    },
  )
  if (anthropicStyle) {
    return anthropicStyle
  }

  const openAITooLargeStyle = parseContextOverflowMatch(
    message.match(
      /(?:'max_tokens'|'max_completion_tokens'|max_tokens|max_completion_tokens)(?:\s+or\s+(?:'max_tokens'|'max_completion_tokens'|max_tokens|max_completion_tokens))?[^:]*:\s*(\d+).*?maximum context length is\s*(\d+)\s*tokens?.*?request has\s*(\d+)\s*input tokens/i,
    ),
    {
      maxTokens: 1,
      contextLimit: 2,
      inputTokens: 3,
    },
  )
  if (openAITooLargeStyle) {
    return openAITooLargeStyle
  }

  return parseContextOverflowMatch(
    message.match(
      /maximum context length is\s*(\d+)\s*tokens?.*?requested\s*(\d+)\s*tokens?.*?\(\s*(\d+)\s+in the messages,\s*(\d+)\s+in the completion\)/i,
    ),
    {
      contextLimit: 1,
      inputTokens: 3,
      maxTokens: 4,
    },
  )
}

export function calculateAdjustedMaxTokensForContextOverflow(
  overflow: ContextOverflowData,
  options?: {
    minTokens?: number
    safetyBuffer?: number
  },
): number | undefined {
  const minTokens = options?.minTokens ?? 1
  const safetyBuffer = options?.safetyBuffer ?? 0
  const availableContext =
    overflow.contextLimit - overflow.inputTokens - safetyBuffer

  if (!Number.isFinite(availableContext)) {
    return undefined
  }

  const adjustedMaxTokens = Math.min(overflow.maxTokens - 1, availableContext)
  if (adjustedMaxTokens < minTokens) {
    return undefined
  }

  return adjustedMaxTokens
}
