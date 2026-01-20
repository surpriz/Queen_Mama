using System.Text;
using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Data;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Models;
using QueenMama.Core.Services.License;
using Microsoft.EntityFrameworkCore;

namespace QueenMama.Core.Services.AI;

/// <summary>
/// AI service with provider fallback and streaming support
/// </summary>
public partial class AIService : ObservableObject, IAIService
{
    private readonly IProxyAIProvider _proxyProvider;
    private readonly ILicenseManager _licenseManager;
    private readonly QueenMamaDbContext _dbContext;
    private readonly ILogger<AIService> _logger;

    private CancellationTokenSource? _generationCts;

    public event Action<string>? OnStreamingChunk;
    public event Action<AIResponse>? OnResponseComplete;
    public event Action<Exception>? OnError;

    [ObservableProperty]
    private bool _isGenerating;

    [ObservableProperty]
    private string _currentResponse = "";

    [ObservableProperty]
    private AIProviderType? _lastProvider;

    [ObservableProperty]
    private List<AIResponse> _responses = new();

    public AIService(
        IProxyAIProvider proxyProvider,
        ILicenseManager licenseManager,
        QueenMamaDbContext dbContext,
        ILogger<AIService> logger)
    {
        _proxyProvider = proxyProvider;
        _licenseManager = licenseManager;
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task LoadHistoryAsync()
    {
        try
        {
            Responses = await _dbContext.AIResponses
                .OrderByDescending(r => r.Timestamp)
                .Take(100)
                .ToListAsync();

            _logger.LogInformation("Loaded {Count} responses from history", Responses.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load AI history");
        }
    }

    public async Task<AIResponse> GenerateResponseAsync(AIContext context)
    {
        IsGenerating = true;
        CurrentResponse = "";

        try
        {
            // License checks
            CheckLicense(context.ResponseType);

            _logger.LogInformation("Generating AI response, type: {Type}", context.ResponseType);

            var response = await _proxyProvider.GenerateAsync(context);
            LastProvider = response.Provider;

            // Record usage
            RecordUsage(context.ResponseType);

            // Save to database
            await SaveResponseAsync(response);

            OnResponseComplete?.Invoke(response);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI generation failed");
            OnError?.Invoke(ex);
            throw;
        }
        finally
        {
            IsGenerating = false;
        }
    }

    public async IAsyncEnumerable<string> GenerateStreamingResponseAsync(AIContext context)
    {
        IsGenerating = true;
        CurrentResponse = "";
        _generationCts = new CancellationTokenSource();

        var responseBuilder = new StringBuilder();
        AIProviderType? provider = null;
        var startTime = DateTime.UtcNow;

        try
        {
            // License checks
            CheckLicense(context.ResponseType);

            _logger.LogInformation("Streaming AI response, type: {Type}", context.ResponseType);

            await foreach (var chunk in _proxyProvider.StreamAsync(context, _generationCts.Token))
            {
                responseBuilder.Append(chunk);
                CurrentResponse = responseBuilder.ToString();
                OnStreamingChunk?.Invoke(chunk);
                yield return chunk;
            }

            provider = AIProviderType.Proxy;
            LastProvider = provider;

            // Record usage
            RecordUsage(context.ResponseType);

            // Save completed response
            var latencyMs = (int)(DateTime.UtcNow - startTime).TotalMilliseconds;
            var response = new AIResponse
            {
                Type = context.ResponseType,
                Content = responseBuilder.ToString(),
                Provider = provider.Value,
                LatencyMs = latencyMs
            };

            await SaveResponseAsync(response);
            OnResponseComplete?.Invoke(response);

            _logger.LogInformation("Streaming complete, {Length} chars, {Latency}ms",
                response.Content.Length, latencyMs);
        }
        finally
        {
            IsGenerating = false;
            _generationCts?.Dispose();
            _generationCts = null;
        }
    }

    public void CancelGeneration()
    {
        _generationCts?.Cancel();
        IsGenerating = false;
        _logger.LogInformation("AI generation cancelled");
    }

    private void CheckLicense(ResponseType responseType)
    {
        var access = ((LicenseManager)_licenseManager).CheckFeatureAccess(Feature.AIAssist);
        if (!access.IsAllowed)
        {
            throw new InvalidOperationException(access.ErrorMessage);
        }
    }

    private void RecordUsage(ResponseType responseType)
    {
        ((LicenseManager)_licenseManager).RecordUsage(Feature.AIAssist);
    }

    private async Task SaveResponseAsync(AIResponse response)
    {
        try
        {
            _dbContext.AIResponses.Add(response);
            await _dbContext.SaveChangesAsync();
            Responses.Insert(0, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save AI response");
        }
    }

    public async Task ClearHistoryAsync()
    {
        try
        {
            _dbContext.AIResponses.RemoveRange(_dbContext.AIResponses);
            await _dbContext.SaveChangesAsync();
            Responses.Clear();
            CurrentResponse = "";
            _logger.LogInformation("Cleared AI history");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to clear AI history");
        }
    }

    // Convenience methods

    public Task<AIResponse> AssistAsync(string transcript, byte[]? screenshot, Mode? mode)
    {
        return GenerateResponseAsync(new AIContext(
            Transcript: transcript,
            ResponseType: ResponseType.Assist,
            SystemPrompt: mode?.SystemPrompt,
            ScreenshotData: screenshot));
    }

    public Task<AIResponse> WhatToSayAsync(string transcript, byte[]? screenshot, Mode? mode)
    {
        return GenerateResponseAsync(new AIContext(
            Transcript: transcript,
            ResponseType: ResponseType.WhatToSay,
            SystemPrompt: mode?.SystemPrompt,
            ScreenshotData: screenshot));
    }

    public Task<AIResponse> FollowUpAsync(string transcript, byte[]? screenshot, Mode? mode)
    {
        return GenerateResponseAsync(new AIContext(
            Transcript: transcript,
            ResponseType: ResponseType.FollowUp,
            SystemPrompt: mode?.SystemPrompt,
            ScreenshotData: screenshot));
    }

    public Task<AIResponse> RecapAsync(string transcript, byte[]? screenshot, Mode? mode)
    {
        return GenerateResponseAsync(new AIContext(
            Transcript: transcript,
            ResponseType: ResponseType.Recap,
            SystemPrompt: mode?.SystemPrompt,
            ScreenshotData: screenshot));
    }

    public IAsyncEnumerable<string> AssistStreamingAsync(string transcript, byte[]? screenshot, Mode? mode)
    {
        return GenerateStreamingResponseAsync(new AIContext(
            Transcript: transcript,
            ResponseType: ResponseType.Assist,
            SystemPrompt: mode?.SystemPrompt,
            ScreenshotData: screenshot));
    }

    public async Task<string> GenerateSessionTitleAsync(string transcript)
    {
        if (string.IsNullOrEmpty(transcript))
        {
            return $"Session - {DateTime.Now:g}";
        }

        try
        {
            var response = await GenerateResponseAsync(new AIContext(
                Transcript: transcript.Length > 3000 ? transcript[..3000] : transcript,
                ResponseType: ResponseType.Custom,
                AdditionalContext: """
                    Generate a SHORT, CONCISE title (maximum 6-8 words) for this conversation.
                    The title should capture the main topic or purpose discussed.
                    Return ONLY the title, no quotes, no explanation, no punctuation at the end.
                    Match the language of the transcript (French or English).
                    """));

            var title = response.Content
                .Trim()
                .Trim('"', '\'');

            return string.IsNullOrEmpty(title) ? "Untitled Session" : title;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Title generation failed");
            return $"Session - {DateTime.Now:g}";
        }
    }

    public async Task<string?> GenerateSessionSummaryAsync(string transcript)
    {
        if (transcript.Length < 100)
            return null;

        try
        {
            var response = await RecapAsync(transcript, null, null);
            return response.Content;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Summary generation failed");
            return null;
        }
    }
}
