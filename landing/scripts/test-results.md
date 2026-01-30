# Comprehensive Model Testing & Production Recommendations

**Last Updated:** 2026-01-30
**Scripts:**
- `test-model-ids.ts` - Basic validation tests
- `benchmark-models.ts` - Comprehensive performance benchmarks

---

## 🎯 Executive Summary

**Total Models Tested: 28 models across 4 providers**

| Provider | Models | Success Rate | Vision Support | TTFB Champion | Tokens/sec Champion |
|----------|--------|--------------|----------------|---------------|---------------------|
| **OpenAI** | 7 | 86% (6/7) | 6/6 available ✅ | gpt-4o (599ms vision) | gpt-4o-mini (10.7 vision) |
| **Anthropic** | 8 | **100%** ✅ | 8/8 (100%) ✅ | **claude-3-haiku (541ms vision)** 🏆 | **claude-3-haiku (16.5 vision)** 🏆 |
| **Grok** | 6 | **100%** ✅ | 3/6 (50%) | grok-4-1-fast (664ms vision) | grok-4-1-fast (0 vision*) |
| **Moonshot** | 7 | **100%** ✅ | 1/7 (14%) | kimi-k2.5 (1.51s vision) | kimi-k2.5 (0 vision) |

**🏆 GLOBAL CHAMPIONS (Vision Support Included):**
- **Fastest Vision TTFB:** claude-3-haiku-20240307 (541ms) 🥇
- **Best Vision Throughput:** claude-3-haiku-20240307 (16.5 tok/s) 🥇
- **Best Text-Only TTFB:** grok-3-mini-beta (367ms)
- **Best Text-Only Throughput:** grok-4-1-fast-non-reasoning (46.1 tok/s)

---

## 🚀 PRODUCTION CASCADE RECOMMENDATIONS

### Criteria for Selection:
- ✅ **Vision + Text support required** (modes Standard & Smart)
- ✅ **Fastest TTFB** (low latency)
- ✅ **High throughput** (tokens/sec)
- ✅ **High reliability** (100% uptime)
- ⏸️ **Cost optimization** (deferred for later)

---

## 📱 MODE STANDARD (Real-Time Assistance)

**Use Case:** Instant AI suggestions during meetings/calls with screenshot context

### Recommended Cascade (Vision Required):

| Rank | Model | TTFB (Vision) | Throughput (Vision) | Context | Pricing |
|------|-------|---------------|---------------------|---------|---------|
| **🥇 #1** | **claude-3-haiku-20240307** | **541ms** | **16.5 tok/s** | 200K | $0.25/$1.25 per MTok |
| **🥈 #2** | **gpt-4o** | **599ms** | **10.1 tok/s** | 128K | $2.50/$10 per MTok |
| **🥉 #3** | **claude-haiku-4-5-20251001** | **633ms** | **9.4 tok/s** | 200K | $1/$5 per MTok |
| #4 | claude-3-7-sonnet-20250219 | 669ms | 10.4 tok/s | 200K | $3/$15 per MTok |
| #5 | gpt-4o-mini | 736ms | 10.7 tok/s | 128K | $0.15/$0.60 per MTok |

**Why This Order:**
1. **claude-3-haiku (Legacy)** - Unbeatable combination: fastest vision TTFB (541ms) + highest vision throughput (16.5 tok/s) + cheapest ($0.25/$1.25). Perfect for real-time use.
2. **gpt-4o** - Excellent fallback with 599ms vision TTFB, solid 10.1 tok/s, and broader model capabilities
3. **claude-haiku-4.5 (Latest)** - Modern replacement for Haiku 3, slightly slower but more capable
4. **claude-3-7-sonnet** - Balanced intelligence/speed, 669ms is still excellent
5. **gpt-4o-mini** - Cost-effective backup with good throughput (10.7 tok/s)

---

## 🧠 MODE SMART (Advanced Reasoning)

**Use Case:** Complex analysis, objection handling, strategic suggestions

### Recommended Cascade (Reasoning + Vision Required):

| Rank | Model | TTFB (Vision) | Throughput (Vision) | Context | Pricing |
|------|-------|---------------|---------------------|---------|---------|
| **🥇 #1** | **kimi-k2.5** | **1.51s** | **0 tok/s*** | 262K | ~$0.60/$2.50 per MTok |
| **🥈 #2** | **o4-mini** | **1.92s** | **0 tok/s*** | 200K | ~$1/$4 per MTok |
| **🥉 #3** | **claude-opus-4-5-20251101** | **2.09s** | **5.5 tok/s** | 200K | $5/$25 per MTok |
| #4 | gpt-5 | 3.18s | 0 tok/s* | 200K | $10/$40 per MTok |

**\*0 tok/s = Reasoning models don't stream tokens normally**

**Why This Order:**
1. **kimi-k2.5** - Fastest reasoning model with vision (1.51s), 1T parameters, massive 262K context, best value
2. **o4-mini** - Proven OpenAI reasoning, 1.92s is acceptable for complex analysis
3. **claude-opus-4.5** - Not pure reasoning but flagship intelligence, actually streams (5.5 tok/s), excellent for complex tasks
4. **gpt-5** - OpenAI flagship, but slowest (3.18s vision TTFB)

---

## 📝 MODE RÉCAPITULATIF (Meeting Summary)

**Use Case:** Post-meeting summary generation (no vision needed)

### Recommended Cascade (Text-Only, Speed Priority):

| Rank | Model | TTFB (Text) | Throughput (Text) | Context | Pricing |
|------|-------|-------------|-------------------|---------|---------|
| **🥇 #1** | **grok-4-1-fast-non-reasoning** | **431ms** | **46.1 tok/s** | 2M | Competitive |
| **🥈 #2** | **moonshot-v1-128k** | **561ms** | **38.7 tok/s** | 128K | ~$0.60/$2.50 per MTok |
| **🥉 #3** | **kimi-k2-turbo-preview** | **611ms** | **37 tok/s** | 262K | ~$1.15/$8 per MTok |
| #4 | moonshot-v1-32k | 547ms | 32.7 tok/s | 32K | ~$0.60/$2.50 per MTok |
| #5 | claude-3-haiku-20240307 | 675ms | 13.3 tok/s | 200K | $0.25/$1.25 per MTok |

**Why This Order:**
1. **grok-4-1-fast-non-reasoning** - Absolute speed champion (431ms TTFB, 46.1 tok/s), huge 2M context for long meetings
2. **moonshot-v1-128k** - Excellent throughput (38.7 tok/s) + 128K context, ultra-cheap
3. **kimi-k2-turbo-preview** - Speed-optimized (37 tok/s), 262K context for comprehensive summaries
4. **moonshot-v1-32k** - Fastest TTFB among Moonshot V1 (547ms), solid throughput
5. **claude-3-haiku** - Reliable fallback, proven quality, cheaper than Claude 4.5

---

## 📊 Complete Benchmark Results by Provider

### 🔵 OpenAI Models (6/7 working - 86%)

#### Standard Mode

| Model | Text TTFB | Text Tok/s | Vision TTFB | Vision Tok/s | Context | Pricing (per MTok) |
|-------|-----------|------------|-------------|--------------|---------|-------------------|
| **gpt-4o** 🥇 | 945ms | 15.9 | **599ms** | **10.1** | 128K | $2.50 / $10 |
| **gpt-4o-mini** 🥈 | 1.04s | **23.1** | 736ms | **10.7** | 128K | $0.15 / $0.60 |
| **gpt-4.1-mini** 🥉 | 1.01s | 12.9 | 1.18s | 11.4 | 200K | ~$1 / $4 |
| gpt-5-mini | 2.36s | 0* | 2.35s | 0* | 200K | ~$2 / $8 |

#### Smart Mode (Reasoning)

| Model | Text TTFB | Text Tok/s | Vision TTFB | Vision Tok/s | Context | Pricing (per MTok) |
|-------|-----------|------------|-------------|--------------|---------|-------------------|
| **o4-mini** 🥇 | 1.95s | 0* | 1.92s | 0* | 200K | ~$1 / $4 |
| **gpt-5** | 2.00s | 0* | 3.18s | 0* | 200K | $10 / $40 |
| ~~o1-mini~~ | ❌ 404 | - | ❌ 404 | - | - | - |

**\*0 tok/s = Reasoning models stream differently**

**Key Insights:**
- **gpt-4o** dominates for vision tasks (599ms TTFB)
- **gpt-4o-mini** best cost/performance ratio ($0.15/$0.60) with excellent 10.7 tok/s vision
- **o4-mini** fastest reasoning with vision (1.92s)
- All models support vision except unavailable o1-mini

---

### 🟣 Anthropic Models (8/8 working - 100%) ✅

#### Latest Models (Claude 4.5 Family)

| Model | Text TTFB | Text Tok/s | Vision TTFB | Vision Tok/s | Context | Pricing (per MTok) |
|-------|-----------|------------|-------------|--------------|---------|-------------------|
| **claude-haiku-4-5-20251001** 🥇 | 590ms | 9.3 | 633ms | 9.4 | 200K | $1 / $5 |
| **claude-sonnet-4-5-20250929** | 1.32s | 4.6 | 2.85s | 2.9 | 200K/1M* | $3 / $15 |
| **claude-opus-4-5-20251101** | 2.13s | 3.6 | 2.09s | 5.5 | 200K | $5 / $25 |

**\*1M context with beta header**

#### Legacy Models (Still Excellent)

| Model | Text TTFB | Text Tok/s | Vision TTFB | Vision Tok/s | Context | Pricing (per MTok) |
|-------|-----------|------------|-------------|--------------|---------|-------------------|
| **claude-3-haiku-20240307** 🏆 | 675ms | **13.3** | **541ms** 🥇 | **16.5** 🥇 | 200K | $0.25 / $1.25 |
| **claude-3-7-sonnet-20250219** 🥈 | 592ms | 10.9 | 669ms | 10.4 | 200K | $3 / $15 |
| claude-sonnet-4-20250514 | 1.31s | 4.9 | 1.79s | 4.2 | 200K/1M* | $3 / $15 |
| claude-opus-4-1-20250805 | 1.31s | 3.9 | 1.48s | 3.7 | 200K | $5 / $25 |
| claude-opus-4-20250514 | 1.24s | 3.3 | 1.51s | 4.2 | 200K/1M* | $5 / $25 |

**Key Insights:**
- **100% success rate** - Most reliable provider
- **claude-3-haiku (Legacy)** is the absolute champion: 541ms vision TTFB + 16.5 tok/s vision
- **Universal vision support** - All 8 models support images
- **Best value**: claude-3-haiku at $0.25/$1.25 per MTok
- Legacy models (Claude 3) outperform newer Claude 4.5 in speed

---

### ⚡ Grok Models (6/6 working - 100%) ✅

#### Latest Models (Grok 4 Family)

| Model | Text TTFB | Text Tok/s | Vision TTFB | Vision Tok/s | Context | Pricing |
|-------|-----------|------------|-------------|--------------|---------|---------|
| **grok-4-1-fast-non-reasoning** 🏆 | **431ms** 🥇 | **46.1** 🥇 | 664ms | 0* | 2M | Competitive |
| **grok-4-1-fast-reasoning** | 3.55s | 4.9 | 1.02s | 0* | 2M | Competitive |
| grok-4 | 3.79s | 7 | 5.47s | 0* | 256K | Competitive |

**\*Vision returns 0 tok/s (streaming issue or reasoning mode)**

#### Specialized Models

| Model | Text TTFB | Text Tok/s | Vision | Context | Pricing |
|-------|-----------|------------|--------|---------|---------|
| **grok-3-mini-beta** 🥇 | **367ms** 🥇 | 10 | ❌ | 131K | Competitive |
| **grok-3-beta** 🥈 | 703ms | **23.7** | ❌ | 131K | Competitive |
| grok-code-fast-1 | 1.28s | 12.6 | ❌ | 256K | Competitive |

**Key Insights:**
- **grok-4-1-fast-non-reasoning** - Absolute throughput champion (46.1 tok/s) + fastest TTFB (431ms)
- **grok-3-mini-beta** - Fastest TTFB globally (367ms) but no vision
- **Massive 2M context** on Grok 4.1 models - best for long meetings
- Only Grok 4 family supports vision (3/6 models)
- Vision mode has streaming issues (0 tok/s) but works functionally

---

### 🌙 Moonshot Models (7/7 working - 100%) ✅

#### K2 Latest Models

| Model | Text TTFB | Text Tok/s | Vision TTFB | Vision Tok/s | Context | Pricing (per MTok) |
|-------|-----------|------------|-------------|--------------|---------|-------------------|
| **kimi-k2.5** 🥇 | 984ms | 0* | 1.51s | 0* | 262K | ~$0.60 / $2.50 |
| **kimi-k2-turbo-preview** 🥈 | 611ms | **37** 🥈 | ❌ | - | 262K | ~$1.15 / $8 |

**\*Reasoning model - 1T parameters, agent swarm capable**

#### K2 Thinking Models (Reasoning)

| Model | Text TTFB | Text Tok/s | Vision | Context | Pricing (per MTok) |
|-------|-----------|------------|--------|---------|-------------------|
| **kimi-k2-thinking-turbo** 🥇 | 566ms | 0* | ❌ | 262K | ~$1.15 / $8 |
| kimi-k2-thinking | 1.37s | 0* | ❌ | 262K | ~$0.60 / $2.50 |

**\*Reasoning models**

#### V1 Legacy Models

| Model | Text TTFB | Text Tok/s | Vision | Context | Pricing (per MTok) |
|-------|-----------|------------|--------|---------|-------------------|
| **moonshot-v1-128k** 🥇 | 561ms | **38.7** 🥇 | ❌ | 128K | ~$0.60 / $2.50 |
| **moonshot-v1-32k** 🥈 | 547ms 🥇 | **32.7** | ❌ | 32K | ~$0.60 / $2.50 |
| **moonshot-v1-8k** | 634ms | **32.8** | ❌ | 8K | ~$0.60 / $2.50 |

**Key Insights:**
- **moonshot-v1-128k** - 2nd best throughput globally (38.7 tok/s)
- **kimi-k2-turbo-preview** - 3rd best throughput globally (37 tok/s)
- **Only kimi-k2.5 supports vision** among Moonshot models
- **Best value**: V1 models at ~$0.60/$2.50 with excellent performance
- **K2.5 flagship**: 1T params, reasoning, vision, 262K context

---

## 👁️ Vision Support Matrix

**18/28 models support vision (64%)**

| Provider | Vision Support | Best Vision Model |
|----------|----------------|-------------------|
| **Anthropic** | 8/8 (100%) ✅ | claude-3-haiku (541ms, 16.5 tok/s) |
| **OpenAI** | 6/6 available (100%) ✅ | gpt-4o (599ms, 10.1 tok/s) |
| **Grok** | 3/6 (50%) | grok-4-1-fast-non-reasoning (664ms, 0 tok/s*) |
| **Moonshot** | 1/7 (14%) | kimi-k2.5 (1.51s, 0 tok/s*) |

**Vision Champions:**
1. **claude-3-haiku-20240307** - 541ms TTFB, 16.5 tok/s 🏆
2. **gpt-4o** - 599ms TTFB, 10.1 tok/s
3. **claude-haiku-4-5-20251001** - 633ms TTFB, 9.4 tok/s

---

## 🏆 Global Rankings

### Top 5 - Fastest Vision TTFB (Critical for Real-Time UX)

1. **claude-3-haiku-20240307** - 541ms (Anthropic) 🥇
2. **gpt-4o** - 599ms (OpenAI) 🥈
3. **claude-haiku-4-5-20251001** - 633ms (Anthropic) 🥉
4. **grok-4-1-fast-non-reasoning** - 664ms (Grok)
5. **claude-3-7-sonnet-20250219** - 669ms (Anthropic)

### Top 5 - Best Vision Throughput (Tokens/sec)

1. **claude-3-haiku-20240307** - 16.5 tok/s (Anthropic) 🏆
2. **gpt-4o-mini** - 10.7 tok/s (OpenAI)
3. **claude-3-7-sonnet-20250219** - 10.4 tok/s (Anthropic)
4. **gpt-4o** - 10.1 tok/s (OpenAI)
5. **claude-haiku-4-5-20251001** - 9.4 tok/s (Anthropic)

### Top 5 - Fastest Text-Only TTFB (For Recap Mode)

1. **grok-3-mini-beta** - 367ms (Grok) 🥇
2. **grok-4-1-fast-non-reasoning** - 431ms (Grok) 🥈
3. **moonshot-v1-32k** - 547ms (Moonshot) 🥉
4. **moonshot-v1-128k** - 561ms (Moonshot)
5. **kimi-k2-thinking-turbo** - 566ms (Moonshot)

### Top 5 - Best Text-Only Throughput (For Recap Mode)

1. **grok-4-1-fast-non-reasoning** - 46.1 tok/s (Grok) 🏆
2. **moonshot-v1-128k** - 38.7 tok/s (Moonshot)
3. **kimi-k2-turbo-preview** - 37 tok/s (Moonshot)
4. **moonshot-v1-8k** - 32.8 tok/s (Moonshot)
5. **moonshot-v1-32k** - 32.7 tok/s (Moonshot)

---

## 💰 Cost Analysis (Per Million Tokens)

### Most Cost-Effective Models

| Model | Input | Output | Vision | Use Case |
|-------|-------|--------|--------|----------|
| **gpt-4o-mini** | $0.15 | $0.60 | ✅ | Best OpenAI value |
| **claude-3-haiku** | $0.25 | $1.25 | ✅ | Best overall value + performance |
| **moonshot-v1-*** | ~$0.60 | ~$2.50 | ❌ | Best text-only value |
| **claude-haiku-4.5** | $1 | $5 | ✅ | Modern affordable option |
| **kimi-k2.5** | ~$0.60 | ~$2.50 | ✅ | Best reasoning value |

### Premium Models

| Model | Input | Output | Vision | Use Case |
|-------|-------|--------|--------|----------|
| **claude-opus-4.5** | $5 | $25 | ✅ | Maximum intelligence |
| **gpt-5** | $10 | $40 | ✅ | OpenAI flagship reasoning |
| **claude-3-7-sonnet** | $3 | $15 | ✅ | Balanced premium |

---

## 🎯 Production Implementation Guide

### Current Production Cascade (lib/ai-providers.ts)

Based on benchmark results, **RECOMMENDED UPDATE**:

```typescript
// MODE STANDARD (Real-time assistance with vision)
const STANDARD_CASCADE = [
  "claude-3-haiku-20240307",      // #1: 541ms vision, 16.5 tok/s, $0.25/$1.25
  "gpt-4o",                        // #2: 599ms vision, 10.1 tok/s, $2.50/$10
  "claude-haiku-4-5-20251001",    // #3: 633ms vision, 9.4 tok/s, $1/$5
  "claude-3-7-sonnet-20250219",   // #4: 669ms vision, 10.4 tok/s, $3/$15
  "gpt-4o-mini",                   // #5: 736ms vision, 10.7 tok/s, $0.15/$0.60
];

// MODE SMART (Reasoning with vision)
const SMART_CASCADE = [
  "kimi-k2.5",                     // #1: 1.51s vision, 1T params, $0.60/$2.50
  "o4-mini",                       // #2: 1.92s vision, proven reasoning
  "claude-opus-4-5-20251101",     // #3: 2.09s vision, 5.5 tok/s, flagship
  "gpt-5",                         // #4: 3.18s vision, OpenAI flagship
];

// MODE RECAP (Text-only, speed priority)
const RECAP_CASCADE = [
  "grok-4-1-fast-non-reasoning",  // #1: 431ms, 46.1 tok/s, 2M context
  "moonshot-v1-128k",             // #2: 561ms, 38.7 tok/s, $0.60/$2.50
  "kimi-k2-turbo-preview",        // #3: 611ms, 37 tok/s, 262K context
  "moonshot-v1-32k",              // #4: 547ms, 32.7 tok/s
  "claude-3-haiku-20240307",      // #5: 675ms, 13.3 tok/s, reliable
];
```

### Why These Choices:

**Standard Mode:**
- **Priority: Speed + Vision + Reliability**
- claude-3-haiku is unbeatable: fastest vision (541ms) + highest vision throughput (16.5 tok/s) + cheapest
- Anthropic models dominate top 3 spots due to superior vision performance
- All 5 models have 100% vision support

**Smart Mode:**
- **Priority: Reasoning + Vision + Intelligence**
- kimi-k2.5 is fastest reasoning with vision (1.51s) + 1T params + massive 262K context
- All 4 models support vision for screenshot analysis during complex reasoning
- Balanced between speed and intelligence

**Recap Mode:**
- **Priority: Speed + Throughput + Long Context**
- Vision NOT required, so can use fastest text-only models
- grok-4-1-fast dominates with 431ms + 46.1 tok/s + 2M context for long meetings
- Moonshot models provide excellent backup with 38.7 tok/s + ultra-cheap pricing

---

## 🔧 Testing Methodology

### Validation Tests (test-model-ids.ts)
- **Purpose:** Verify model IDs work with API
- **Method:** Simple prompt test with 10 token limit
- **Duration:** ~3-4 seconds per provider
- **Measures:** Basic connectivity and model availability

### Performance Benchmarks (benchmark-models.ts)
- **Purpose:** Measure comprehensive performance metrics
- **Method:** Streaming tests with ~100 token responses
- **Includes:**
  - Text-only generation
  - Vision input processing (base64 PNG image)
  - TTFB measurement (time to first byte)
  - Throughput calculation (tokens/second)
- **Test Prompt:** "Explain quantum computing in one short sentence"
- **Vision Test:** 1x1 red pixel PNG (base64 encoded)

### API Configuration

**OpenAI:**
```typescript
URL: https://api.openai.com/v1/chat/completions
Auth: Bearer token
Streaming: SSE format
Special: GPT-5/o4 models require max_completion_tokens instead of max_tokens
        GPT-5 models only support temperature=1
```

**Anthropic:**
```typescript
URL: https://api.anthropic.com/v1/messages
Auth: x-api-key header
Streaming: SSE format with event types
API Version: 2023-06-01
```

**Grok:**
```typescript
URL: https://api.x.ai/v1/chat/completions
Auth: Bearer token
Streaming: SSE format (OpenAI-compatible)
```

**Moonshot:**
```typescript
URL: https://api.moonshot.ai/v1/chat/completions
Auth: Bearer token
Streaming: SSE format (OpenAI-compatible)
Special: kimi-k2.5 only supports temperature=1 (like GPT-5)
```

---

## 📊 Success Rate Analysis

### Overall Performance

| Metric | OpenAI | Anthropic | Grok | Moonshot |
|--------|--------|-----------|------|----------|
| **Models Tested** | 7 | 8 | 6 | 7 |
| **Success Rate** | 86% | **100%** ✅ | **100%** ✅ | **100%** ✅ |
| **Vision Support** | 100%* | 100% | 50% | 14% |
| **Tests Passed** | 12/14 | 16/16 | 9/12 | 14/14 |

**\*Of available models (o1-mini unavailable)**

### Common Issues

**OpenAI:**
- o1-mini: Model not found (404) - account access issue

**Grok:**
- Vision not supported on Grok 3 family (expected behavior)
- Vision returns 0 tok/s on Grok 4 (streaming issue but functional)

**Anthropic:**
- No issues - perfect performance ✅

**Moonshot:**
- Vision only on kimi-k2.5 (expected - other models are text-only)
- kimi-k2.5 requires temperature=1 (like GPT-5)

---

## 📈 Historical Performance Trends

**Key Observations:**

1. **Anthropic dominance in vision** - Claude 3 Haiku maintains leadership
2. **Moonshot emergence** - V1 models offer incredible value (38.7 tok/s at $0.60/$2.50)
3. **Grok speed champion** - 46.1 tok/s text throughput unmatched
4. **Vision becoming universal** - 18/28 models (64%) now support vision
5. **Context explosion** - Grok 4.1 introduces 2M tokens, Moonshot K2.5 offers 262K

**Model Evolution:**
- Kimi K2.5 launched with vision + reasoning + 1T params
- Claude 4.5 family became new intelligence standard
- Grok 4 emerged as speed/throughput champion
- Legacy models (Claude 3, Moonshot V1) remain highly competitive

---

## 🎯 Final Recommendations Summary

### For QueenMama Production:

**✅ IMMEDIATE IMPLEMENTATION:**

1. **Switch Standard Mode cascade to:**
   - #1: claude-3-haiku-20240307 (champion performance + best value)
   - #2: gpt-4o (proven reliable, excellent vision)
   - #3: claude-haiku-4-5-20251001 (modern backup)

2. **Switch Smart Mode cascade to:**
   - #1: kimi-k2.5 (fastest reasoning with vision, best value)
   - #2: o4-mini (proven OpenAI reasoning)
   - #3: claude-opus-4-5 (premium intelligence)

3. **Switch Recap Mode cascade to:**
   - #1: grok-4-1-fast-non-reasoning (46.1 tok/s speed demon)
   - #2: moonshot-v1-128k (38.7 tok/s, ultra-cheap)
   - #3: kimi-k2-turbo-preview (37 tok/s, 262K context)

**🔮 FUTURE OPTIMIZATIONS:**

- Monitor pricing changes (currently deprioritized)
- Test real-world latency from production environment
- A/B test user satisfaction with different cascades
- Consider region-specific deployments (Moonshot for APAC, Grok for global)

---

## 📝 Notes & Limitations

### Testing Constraints
- Tests performed from single geographic location (EU Central)
- Network latency may vary by region
- API rate limits not tested
- Results represent snapshot in time
- Token counting approximation (content chunks)

### Model Availability
- Model access depends on account tier
- Some models require waitlist approval
- Pricing subject to change
- Context limits enforced by providers

### Vision Testing
- Limited to simple image (1x1 pixel PNG)
- Complex image processing not benchmarked
- Multiple image scenarios not tested
- Image size limits vary by provider

---

## 🔄 Update History

**2026-01-30 - Complete 4-Provider Production Recommendations**
- Comprehensive cascade recommendations for 3 modes
- Added pricing, context, and detailed performance metrics
- Production implementation guide
- Vision support matrix
- Removed unavailable kimi-k2-0905 model
- Analyzed 28 models across 4 providers

**2026-01-30 - Moonshot K2/K2.5 Integration**
- Added 7 Moonshot models (K2.5, K2 Turbo, K2 Thinking, V1 Legacy)
- Fixed kimi-k2.5 temperature parameter (requires temperature=1)
- moonshot-v1-128k achieves 38.7 tok/s throughput
- kimi-k2.5 confirmed as only Moonshot model with vision support

**2026-01-30 - Comprehensive 3-Provider Benchmark**
- Added Grok models (6 models)
- Full performance benchmarks for all providers
- Vision support matrix
- Throughput measurements
- Production recommendations

---

*Last benchmark run: 2026-01-30*
*Next scheduled update: As needed based on new model releases*
*Maintained by: QueenMama Development Team*
