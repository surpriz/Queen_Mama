using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Models;
using QueenMama.Core.Services.Auth;

namespace QueenMama.Core.Services.AI;

/// <summary>
/// AI provider that routes requests through the Queen Mama backend proxy
/// Supports Server-Sent Events (SSE) streaming
/// </summary>
public class ProxyAIProvider : IProxyAIProvider
{
    private readonly HttpClient _httpClient;
    private readonly IAuthenticationManager _authManager;
    private readonly ILogger<ProxyAIProvider> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public ProxyAIProvider(
        IHttpClientFactory httpClientFactory,
        IAuthenticationManager authManager,
        ILogger<ProxyAIProvider> logger)
    {
        _httpClient = httpClientFactory.CreateClient("AIProxy");
        _authManager = authManager;
        _logger = logger;

        // Configure base URL
#if DEBUG
        var baseUrl = Environment.GetEnvironmentVariable("API_BASE_URL") ?? "http://localhost:3000";
#else
        var baseUrl = Environment.GetEnvironmentVariable("API_BASE_URL") ?? "https://queenmama.app";
#endif
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(120);
    }

    public async Task<AIResponse> GenerateAsync(AIContext context)
    {
        _logger.LogInformation("Generating AI response via proxy, type: {Type}", context.ResponseType);

        var accessToken = await ((AuthenticationManager)_authManager).GetAccessTokenAsync();
        if (accessToken == null)
        {
            throw new InvalidOperationException("Not authenticated");
        }

        var request = BuildRequest(context);
        request.Stream = false;

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/api/proxy/ai/generate")
        {
            Content = JsonContent.Create(request, options: JsonOptions)
        };
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(httpRequest);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<ProxyAIResponse>(JsonOptions);

        if (result == null || string.IsNullOrEmpty(result.Content))
        {
            throw new InvalidOperationException("Empty response from AI proxy");
        }

        return new AIResponse
        {
            Type = context.ResponseType,
            Content = result.Content,
            Provider = MapProvider(result.Provider ?? "proxy"),
            LatencyMs = result.LatencyMs
        };
    }

    public async IAsyncEnumerable<string> StreamAsync(AIContext context,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Streaming AI response via proxy, type: {Type}", context.ResponseType);

        var accessToken = await ((AuthenticationManager)_authManager).GetAccessTokenAsync();
        if (accessToken == null)
        {
            throw new InvalidOperationException("Not authenticated");
        }

        var request = BuildRequest(context);
        request.Stream = true;

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/api/proxy/ai/stream")
        {
            Content = JsonContent.Create(request, options: JsonOptions)
        };
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

        using var response = await _httpClient.SendAsync(
            httpRequest,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        while (!reader.EndOfStream && !cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken);

            if (string.IsNullOrEmpty(line))
                continue;

            // SSE format: "data: {...}"
            if (line.StartsWith("data: "))
            {
                var data = line[6..];

                if (data == "[DONE]")
                {
                    _logger.LogDebug("Stream complete");
                    break;
                }

                var chunk = ParseStreamChunk(data);
                if (chunk != null)
                {
                    yield return chunk;
                }
            }
        }
    }

    private ProxyAIRequest BuildRequest(AIContext context)
    {
        var systemPrompt = context.SystemPrompt ?? Mode.DefaultMode.SystemPrompt;
        systemPrompt += "\n\n" + context.ResponseType.GetSystemPromptAddition();

        var userMessage = BuildUserMessage(context);

        return new ProxyAIRequest
        {
            SystemPrompt = systemPrompt,
            UserMessage = userMessage,
            ResponseType = context.ResponseType.ToString().ToLower(),
            ScreenshotBase64 = context.ScreenshotData != null ? Convert.ToBase64String(context.ScreenshotData) : null,
            SmartMode = false
        };
    }

    private static string BuildUserMessage(AIContext context)
    {
        var sb = new StringBuilder();

        if (!string.IsNullOrEmpty(context.Transcript))
        {
            // Limit transcript to ~8000 chars (~2000 tokens) for cost optimization
            const int maxTranscriptLength = 8000;
            var truncatedTranscript = context.Transcript.Length > maxTranscriptLength
                ? "[...conversation précédente tronquée...]\n\n" + context.Transcript[^maxTranscriptLength..]
                : context.Transcript;

            sb.AppendLine("## Current Conversation Transcript:");
            sb.AppendLine(truncatedTranscript);
            sb.AppendLine();
        }

        if (context.ScreenshotData != null)
        {
            sb.AppendLine("[Screenshot of current screen is attached - analyze it carefully]");
            sb.AppendLine();
        }

        if (!string.IsNullOrEmpty(context.AdditionalContext))
        {
            sb.AppendLine("## User's Question:");
            sb.AppendLine(context.AdditionalContext);
        }
        else
        {
            if (string.IsNullOrEmpty(context.Transcript) && context.ScreenshotData != null)
            {
                sb.AppendLine($"Analyze the screenshot and provide {context.ResponseType.GetDisplayName().ToLower()} based on what you see.");
            }
            else
            {
                sb.AppendLine($"Based on the above context, please provide {context.ResponseType.GetDisplayName().ToLower()}.");
            }
        }

        return sb.ToString();
    }

    private string? ParseStreamChunk(string jsonData)
    {
        try
        {
            var chunk = JsonSerializer.Deserialize<StreamChunk>(jsonData, JsonOptions);
            return chunk?.Content ?? chunk?.Delta?.Content;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse stream chunk: {Data}", jsonData);
            return null;
        }
    }

    private static AIProviderType MapProvider(string provider)
    {
        return provider.ToLower() switch
        {
            "openai" => AIProviderType.OpenAI,
            "anthropic" => AIProviderType.Anthropic,
            "gemini" => AIProviderType.Gemini,
            "grok" or "xai" => AIProviderType.Grok,
            _ => AIProviderType.Proxy
        };
    }

    private class ProxyAIRequest
    {
        [JsonPropertyName("systemPrompt")]
        public string? SystemPrompt { get; set; }

        [JsonPropertyName("userMessage")]
        public string? UserMessage { get; set; }

        [JsonPropertyName("responseType")]
        public string? ResponseType { get; set; }

        [JsonPropertyName("screenshotBase64")]
        public string? ScreenshotBase64 { get; set; }

        [JsonPropertyName("smartMode")]
        public bool SmartMode { get; set; }

        [JsonPropertyName("stream")]
        public bool Stream { get; set; }
    }

    private class ProxyAIResponse
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }

        [JsonPropertyName("provider")]
        public string? Provider { get; set; }

        [JsonPropertyName("latencyMs")]
        public int? LatencyMs { get; set; }
    }

    private class StreamChunk
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }

        [JsonPropertyName("delta")]
        public StreamDelta? Delta { get; set; }
    }

    private class StreamDelta
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }
}
