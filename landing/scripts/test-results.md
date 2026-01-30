# Model ID Test Results

**Date:** 2026-01-30
**Script:** `test-model-ids.ts`
**Command:** `npx tsx landing/scripts/test-model-ids.ts`

---

## Summary

| Provider | Working | Total | Success Rate | Status |
|----------|---------|-------|--------------|--------|
| **Anthropic** | 8 | 8 | 100% | ✅ All models verified |
| **Grok** | 2 | 2 | 100% | ✅ All models verified |
| **OpenAI** | 3 | 4 | 75% | ⚠️ o4-mini requires temperature=1 |
| **TOTAL** | **13** | **14** | **93%** | ✅ |

---

## Anthropic Models (8/8 ✅)

All Anthropic models are fully functional and tested successfully.

### Latest Models (Claude 4.5 Family)

| Model ID | Display Name | Latency | Status | Notes |
|----------|--------------|---------|--------|-------|
| `claude-opus-4-5-20251101` | Opus 4.5 | 1726ms | ✅ | Premium model with maximum intelligence |
| `claude-sonnet-4-5-20250929` | Sonnet 4.5 | 3908ms | ✅ | Best balance for complex agents & coding |
| `claude-haiku-4-5-20251001` | Haiku 4.5 | 1007ms | ✅ | Fastest with near-frontier intelligence |

**Key Features:**
- 200K token context window (1M beta for Sonnet 4.5)
- 64K max output tokens
- Extended thinking support
- Vision capabilities
- Multilingual support

**Pricing:**
- Opus 4.5: $5/MTok input, $25/MTok output
- Sonnet 4.5: $3/MTok input, $15/MTok output
- Haiku 4.5: $1/MTok input, $5/MTok output

### Legacy Models (Still Available)

| Model ID | Display Name | Latency | Status | Notes |
|----------|--------------|---------|--------|-------|
| `claude-opus-4-1-20250805` | Opus 4.1 | 1986ms | ✅ | Legacy premium model |
| `claude-sonnet-4-20250514` | Sonnet 4 | 1403ms | ✅ | Legacy smart model (1M context beta) |
| `claude-3-7-sonnet-20250219` | Sonnet 3.7 | 791ms | ✅ | Legacy model with 128K output beta |
| `claude-opus-4-20250514` | Opus 4 | 1698ms | ✅ | Legacy flagship |
| `claude-3-haiku-20240307` | Haiku 3 | 529ms | ✅ | Fastest legacy model |

**Performance Insights:**
- **Fastest:** Haiku 3 (529ms) - Best for high-throughput scenarios
- **Best value:** Haiku 4.5 (1007ms) - Near-frontier at $1/MTok
- **Most intelligent:** Opus 4.5 (1726ms) - Premium reasoning

---

## Grok Models (2/2 ✅)

| Model ID | Display Name | Latency | Status | Notes |
|----------|--------------|---------|--------|-------|
| `grok-4-1-fast-non-reasoning` | Grok Fast | 595ms | ✅ | Fast inference without reasoning |
| `grok-4-1-fast-reasoning` | Grok Reasoning | 1444ms | ✅ | With reasoning capabilities |

**API Endpoint:** `https://api.x.ai/v1/chat/completions`

---

## OpenAI Models (3/4 ⚠️)

| Model ID | Latency | Status | Notes |
|----------|---------|--------|-------|
| `gpt-5-mini` | 1169ms | ✅ | Standard mode fallback |
| `gpt-4.1-mini` | 1019ms | ✅ | Efficient model |
| `o4-mini` | - | ❌ | **Error:** Unsupported temperature value (requires temperature=1) |
| `gpt-5` | 850ms | ✅ | Flagship model |

**Known Issue - o4-mini:**
```
HTTP 400: Unsupported value: 'temperature' does not support 0.7 with this model.
Only the default (1) value is supported.
```

**Fix Required:** Update test script to use `temperature: 1` for o-series models.

---

## API Configuration

### Anthropic API
```typescript
{
  url: "https://api.anthropic.com/v1/messages",
  headers: {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01"
  },
  body: {
    model: "claude-opus-4-5-20251101",
    messages: [{ role: "user", content: "..." }],
    max_tokens: 10
  }
}
```

### Grok API
```typescript
{
  url: "https://api.x.ai/v1/chat/completions",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  }
}
```

### OpenAI API
```typescript
{
  url: "https://api.openai.com/v1/chat/completions",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: {
    model: "gpt-5",
    max_completion_tokens: 10, // For gpt-5*, gpt-4.1*, o4-*
    temperature: 1 // Required for o-series models
  }
}
```

---

## Recommendations

### Production Use

**For Standard Mode:**
1. **Primary:** `gpt-4o` (349ms, see benchmark results)
2. **Fallback:** `grok-4-1-fast-non-reasoning` (595ms)
3. **Backup:** `claude-haiku-4-5-20251001` (1007ms)

**For Smart Mode:**
1. **Primary:** `o4-mini` (needs temperature fix)
2. **Fallback:** `grok-4-1-fast-reasoning` (1444ms)
3. **Backup:** `claude-sonnet-4-5-20250929` (3908ms)

**For Premium/Complex Tasks:**
1. **Primary:** `claude-opus-4-5-20251101` (1726ms, max intelligence)
2. **Fallback:** `gpt-5` (850ms)

### Cost Optimization

**Most Economical:**
- Haiku 4.5: $1/MTok input (fastest among affordable options)
- Haiku 3: $0.25/MTok input (legacy but cheapest)

**Best Value:**
- Sonnet 4.5: $3/MTok input (exceptional quality-to-cost ratio)
- gpt-4o: Fast inference + reasonable pricing

---

## Testing Methodology

1. **API Key Loading:** Keys retrieved from database via Prisma
2. **Request:** Simple prompt "Say 'test ok' in 2 words"
3. **Validation:** Successful response = model verified
4. **Latency:** Measured from request start to response completion

**Database Provider Mapping:**
- Anthropic → `ANTHROPIC`
- Grok → `GROK`
- OpenAI → `OPENAI`

---

## Next Steps

1. ✅ All Anthropic models verified and documented
2. ⚠️ Fix o4-mini temperature issue in test script
3. 📊 Run comprehensive benchmark (TTFB, tokens/sec, vision) on all Anthropic models
4. 🔄 Update MODEL_CASCADE in `ai-providers.ts` if needed based on performance data

---

*Last updated: 2026-01-30*
*Test run: `npx tsx landing/scripts/test-model-ids.ts`*
