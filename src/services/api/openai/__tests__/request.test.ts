import { describe, expect, test } from 'bun:test'
import {
  createChatCompletionStreamWithTokenRecovery,
  getOpenAICompatibleMaxOutputTokens,
} from '../request.js'

describe('getOpenAICompatibleMaxOutputTokens', () => {
  test('prefers explicit override', () => {
    expect(
      getOpenAICompatibleMaxOutputTokens('claude-3-7-sonnet-20250219', 2048),
    ).toBe(2048)
  })
})

describe('createChatCompletionStreamWithTokenRecovery', () => {
  test('retries with a smaller max_tokens value after context overflow', async () => {
    const calls: number[] = []
    const stream = { ok: true }
    const client = {
      chat: {
        completions: {
          create: async (params: { max_tokens?: number }) => {
            calls.push(params.max_tokens ?? -1)

            if (calls.length === 1) {
              throw new Error(
                `'max_tokens' or 'max_completion_tokens' is too large: 4096. This model's maximum context length is 65536 tokens and your request has 63366 input tokens (4096 > 65536 - 63366).`,
              )
            }

            return stream
          },
        },
      },
    } as any

    const result = await createChatCompletionStreamWithTokenRecovery({
      client,
      params: {
        model: 'MiniMax-M2.5',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
        max_tokens: 4096,
      },
      providerLabel: 'OpenAI',
      signal: new AbortController().signal,
    })

    expect(calls).toEqual([4096, 2170])
    expect(result).toBe(stream)
  })
})
