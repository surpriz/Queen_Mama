using QueenMama.Core.Models;

namespace QueenMama.Core.Interfaces;

public interface IAIService
{
    event Action<string>? OnStreamingChunk;
    event Action<AIResponse>? OnResponseComplete;
    event Action<Exception>? OnError;

    bool IsGenerating { get; }

    Task<AIResponse> GenerateResponseAsync(AIContext context);
    IAsyncEnumerable<string> GenerateStreamingResponseAsync(AIContext context);
    void CancelGeneration();
}

public interface IProxyAIProvider
{
    Task<AIResponse> GenerateAsync(AIContext context);
    IAsyncEnumerable<string> StreamAsync(AIContext context, CancellationToken cancellationToken = default);
}

public record AIContext(
    string Transcript,
    ResponseType ResponseType,
    string? SystemPrompt = null,
    byte[]? ScreenshotData = null,
    string? AdditionalContext = null
);
