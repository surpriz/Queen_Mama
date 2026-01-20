using System.Text;
using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Services.Auth;

namespace QueenMama.Core.Services.Transcription;

/// <summary>
/// Transcription service with provider fallback support
/// </summary>
public partial class TranscriptionService : ObservableObject, ITranscriptionService
{
    private readonly ILogger<TranscriptionService> _logger;
    private readonly DeepgramProvider _deepgramProvider;
    private readonly IAuthenticationManager _authManager;
    private readonly AuthApiClient _authApiClient;

    private ITranscriptionProvider? _currentProvider;
    private bool _isReconnecting;
    private int _reconnectAttempts;
    private bool _intentionalDisconnect;
    private CancellationTokenSource? _reconnectCts;

    private const int MaxReconnectAttempts = 3;

    private readonly StringBuilder _transcriptBuilder = new();

    public event Action<TranscriptionResult>? OnTranscript;
    public event Action<bool>? OnConnectionStateChanged;
    public event Action<Exception>? OnError;

    [ObservableProperty]
    private bool _isConnected;

    [ObservableProperty]
    private string _currentTranscript = "";

    [ObservableProperty]
    private string _interimTranscript = "";

    [ObservableProperty]
    private string? _currentProviderName;

    public TranscriptionService(
        ILogger<TranscriptionService> logger,
        DeepgramProvider deepgramProvider,
        IAuthenticationManager authManager,
        IAuthApiClient authApiClient)
    {
        _logger = logger;
        _deepgramProvider = deepgramProvider;
        _authManager = authManager;
        _authApiClient = (AuthApiClient)authApiClient;

        SetupProviderCallbacks();
    }

    private void SetupProviderCallbacks()
    {
        _deepgramProvider.OnTranscript += HandleTranscript;
        _deepgramProvider.OnConnectionStateChanged += HandleConnectionStateChanged;
        _deepgramProvider.OnError += HandleProviderError;
    }

    public async Task ConnectAsync(string? language = null)
    {
        _logger.LogInformation("Connecting to transcription service...");

        // Clean up existing connection
        if (_currentProvider != null)
        {
            await _currentProvider.DisconnectAsync();
            _currentProvider = null;
        }

        _intentionalDisconnect = false;
        _reconnectAttempts = 0;

        // Check authentication
        if (!_authManager.IsAuthenticated)
        {
            _logger.LogWarning("Not authenticated, cannot connect to transcription");
            throw new InvalidOperationException("Please sign in to use transcription.");
        }

        // Get temporary token from proxy
        string temporaryToken;
        try
        {
            var tokenResponse = await GetTranscriptionTokenAsync();
            temporaryToken = tokenResponse;
            _logger.LogInformation("Got temporary transcription token");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get transcription token");
            throw new InvalidOperationException("Failed to get transcription token.", ex);
        }

        // Try Deepgram provider
        try
        {
            _logger.LogInformation("Trying Deepgram provider...");
            await _deepgramProvider.ConnectAsync(temporaryToken, language);
            _currentProvider = _deepgramProvider;
            CurrentProviderName = _deepgramProvider.ProviderName;
            IsConnected = true;
            _logger.LogInformation("Successfully connected with {Provider}", _deepgramProvider.ProviderName);
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Deepgram provider failed");
            throw;
        }
    }

    public async Task DisconnectAsync()
    {
        _logger.LogInformation("Disconnecting transcription service...");
        _intentionalDisconnect = true;
        _reconnectCts?.Cancel();

        if (_currentProvider != null)
        {
            await _currentProvider.DisconnectAsync();
            _currentProvider = null;
        }

        IsConnected = false;
        _isReconnecting = false;
        CurrentProviderName = null;
    }

    public async Task SendAudioAsync(byte[] pcmData)
    {
        if (!IsConnected || _currentProvider == null)
            return;

        try
        {
            await _currentProvider.SendAudioAsync(pcmData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending audio");
            HandleProviderError(ex);
        }
    }

    public void ClearTranscript()
    {
        _transcriptBuilder.Clear();
        CurrentTranscript = "";
        InterimTranscript = "";
    }

    private async Task<string> GetTranscriptionTokenAsync()
    {
        // Request temporary token from proxy server
        using var httpClient = new HttpClient();
        httpClient.BaseAddress = new Uri(GetApiBaseUrl());

        var accessToken = await ((AuthenticationManager)_authManager).GetAccessTokenAsync();
        if (accessToken == null)
        {
            throw new InvalidOperationException("No access token available");
        }

        httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

        var response = await httpClient.PostAsync("/api/proxy/transcription/token",
            new StringContent("{\"provider\":\"deepgram\"}", Encoding.UTF8, "application/json"));

        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        var tokenResponse = System.Text.Json.JsonSerializer.Deserialize<TranscriptionTokenResponse>(content);

        return tokenResponse?.Token ?? throw new InvalidOperationException("No token in response");
    }

    private static string GetApiBaseUrl()
    {
#if DEBUG
        return Environment.GetEnvironmentVariable("API_BASE_URL") ?? "http://localhost:3000";
#else
        return Environment.GetEnvironmentVariable("API_BASE_URL") ?? "https://queenmama.app";
#endif
    }

    private void HandleTranscript(TranscriptionResult result)
    {
        if (result.IsFinal)
        {
            _transcriptBuilder.Append(result.Text);
            _transcriptBuilder.Append(' ');
            CurrentTranscript = _transcriptBuilder.ToString();
            InterimTranscript = "";
        }
        else
        {
            InterimTranscript = result.Text;
        }

        OnTranscript?.Invoke(result);
    }

    private void HandleConnectionStateChanged(bool connected)
    {
        IsConnected = connected;
        OnConnectionStateChanged?.Invoke(connected);

        if (!connected && !_intentionalDisconnect)
        {
            AttemptReconnect();
        }
    }

    private void HandleProviderError(Exception ex)
    {
        _logger.LogError(ex, "Transcription provider error");
        OnError?.Invoke(ex);

        if (!_intentionalDisconnect && !_isReconnecting)
        {
            AttemptReconnect();
        }
    }

    private async void AttemptReconnect()
    {
        if (_isReconnecting)
            return;

        _isReconnecting = true;
        _reconnectAttempts++;

        if (_reconnectAttempts > MaxReconnectAttempts)
        {
            _logger.LogWarning("Max reconnection attempts reached");
            _isReconnecting = false;
            return;
        }

        var delay = _reconnectAttempts * 2.0; // 2s, 4s, 6s...
        _logger.LogInformation("Will reconnect in {Delay}s (attempt {Attempt}/{Max})",
            delay, _reconnectAttempts, MaxReconnectAttempts);

        _reconnectCts = new CancellationTokenSource();

        try
        {
            await Task.Delay(TimeSpan.FromSeconds(delay), _reconnectCts.Token);
            await ConnectAsync();
            _isReconnecting = false;
            _logger.LogInformation("Reconnected successfully!");
        }
        catch (OperationCanceledException)
        {
            // Cancelled, don't reconnect
            _isReconnecting = false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Reconnection failed");
            _isReconnecting = false;
            AttemptReconnect();
        }
    }

    public void Dispose()
    {
        DisconnectAsync().Wait();
        _deepgramProvider.Dispose();
    }

    private class TranscriptionTokenResponse
    {
        public string? Token { get; set; }
        public int? ExpiresIn { get; set; }
    }
}
