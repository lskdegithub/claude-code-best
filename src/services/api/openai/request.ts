import type OpenAI from 'openai'
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions/completions.mjs'
import { getModelMaxOutputTokens } from '../../../utils/context.js'
import { logForDebugging } from '../../../utils/debug.js'
import { validateBoundedIntEnvVar } from '../../../utils/envValidation.js'
import {
  calculateAdjustedMaxTokensForContextOverflow,
  parseMaxTokensContextOverflowFromMessage,
} from '../contextOverflow.js'

const MAX_CONTEXT_OVERFLOW_RECOVERY_ATTEMPTS = 2

export function getOpenAICompatibleMaxOutputTokens(
  model: string,
  override?: number,
): number {
  if (override !== undefined) {
    return override
  }

  const maxOutputTokens = getModelMaxOutputTokens(model)
  return validateBoundedIntEnvVar(
    'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS,
    maxOutputTokens.default,
    maxOutputTokens.upperLimit,
  ).effective
}

export async function createChatCompletionStreamWithTokenRecovery({
  client,
  params,
  providerLabel,
  signal,
}: {
  client: OpenAI
  params: ChatCompletionCreateParamsStreaming
  providerLabel: string
  signal: AbortSignal
}) {
  let nextParams = { ...params }
  let recoveryAttempts = 0

  for (;;) {
    try {
      return await client.chat.completions.create(nextParams, { signal })
    } catch (error) {
      const currentMaxTokens = nextParams.max_tokens
      const overflow =
        currentMaxTokens !== undefined && typeof currentMaxTokens === 'number'
          ? parseMaxTokensContextOverflowFromMessage(
              error instanceof Error ? error.message : String(error),
            )
          : undefined
      const adjustedMaxTokens = overflow
        ? calculateAdjustedMaxTokensForContextOverflow(overflow)
        : undefined

      if (
        currentMaxTokens === undefined ||
        typeof currentMaxTokens !== 'number' ||
        !adjustedMaxTokens ||
        adjustedMaxTokens >= currentMaxTokens ||
        recoveryAttempts >= MAX_CONTEXT_OVERFLOW_RECOVERY_ATTEMPTS
      ) {
        throw error
      }

      recoveryAttempts += 1
      logForDebugging(
        `[${providerLabel}] Context overflow detected (input=${overflow.inputTokens}, limit=${overflow.contextLimit}, requested=${currentMaxTokens}); retrying with max_tokens=${adjustedMaxTokens}`,
      )
      nextParams = {
        ...nextParams,
        max_tokens: adjustedMaxTokens,
      }
    }
  }
}
