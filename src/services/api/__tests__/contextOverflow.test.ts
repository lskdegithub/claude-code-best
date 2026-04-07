import { describe, expect, test } from 'bun:test'
import {
  calculateAdjustedMaxTokensForContextOverflow,
  parseMaxTokensContextOverflowFromMessage,
} from '../contextOverflow.js'

describe('parseMaxTokensContextOverflowFromMessage', () => {
  test('parses Anthropic-style context overflow errors', () => {
    const parsed = parseMaxTokensContextOverflowFromMessage(
      'input length and `max_tokens` exceed context limit: 188059 + 20000 > 200000',
    )

    expect(parsed).toEqual({
      inputTokens: 188059,
      maxTokens: 20000,
      contextLimit: 200000,
    })
  })

  test('parses OpenAI-compatible max_tokens too large errors', () => {
    const parsed = parseMaxTokensContextOverflowFromMessage(
      `Error from provider(minimax, MiniMax-M2.5: 400):
      {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large: 4096.
      This model's maximum context length is 65536 tokens and your request has 63366 input tokens
      (4096 > 65536 - 63366). (parameter=max_tokens, value=4096) None"}}`,
    )

    expect(parsed).toEqual({
      inputTokens: 63366,
      maxTokens: 4096,
      contextLimit: 65536,
    })
  })

  test('parses OpenAI requested tokens errors', () => {
    const parsed = parseMaxTokensContextOverflowFromMessage(
      "This model's maximum context length is 8192 tokens. However, you requested 9000 tokens (1000 in the messages, 8000 in the completion).",
    )

    expect(parsed).toEqual({
      inputTokens: 1000,
      maxTokens: 8000,
      contextLimit: 8192,
    })
  })
})

describe('calculateAdjustedMaxTokensForContextOverflow', () => {
  test('shrinks max_tokens to the remaining context window', () => {
    const adjusted = calculateAdjustedMaxTokensForContextOverflow({
      inputTokens: 63366,
      maxTokens: 4096,
      contextLimit: 65536,
    })

    expect(adjusted).toBe(2170)
  })

  test('returns undefined when there is no usable completion budget left', () => {
    const adjusted = calculateAdjustedMaxTokensForContextOverflow({
      inputTokens: 65536,
      maxTokens: 4096,
      contextLimit: 65536,
    })

    expect(adjusted).toBeUndefined()
  })
})
