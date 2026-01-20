using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;

namespace QueenMama.Core.Services.Transcription;

/// <summary>
/// Deepgram Nova-3 transcription provider using WebSocket
/// </summary>
public class DeepgramProvider : ITranscriptionProvider, IDisposable
{
    private readonly ILogger<DeepgramProvider> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    private ClientWebSocket? _webSocket;
    private CancellationTokenSource? _receiveCts;
    private Timer? _keepaliveTimer;
    private long _audioBytesSent;
    private string? _currentToken;
    private DateTime _tokenExpiresAt;
    private bool _disposed;

    // Deepgram configuration
    private const string BaseUrl = "wss://api.deepgram.com/v1/listen";
    private const string Model = "nova-3";
    private const string Language = "multi";
    private const int KeepaliveIntervalSeconds = 8;

    public event Action<TranscriptionResult>? OnTranscript;
    public event Action<bool>? OnConnectionStateChanged;
    public event Action<Exception>? OnError;

    public bool IsConnected { get; private set; }
    public string ProviderName => "Deepgram Nova-3";

    public DeepgramProvider(
        ILogger<DeepgramProvider> logger,
        IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    public async Task ConnectAsync(string temporaryToken, string? language = null)
    {
        _logger.LogInformation("Connecting to Deepgram...");

        // Clean up existing connection
        if (_webSocket != null)
        {
            await DisconnectAsync();
            await Task.Delay(100);
        }

        _currentToken = temporaryToken;

        // Build WebSocket URL with parameters
        var queryParams = new Dictionary<string, string>
        {
            ["model"] = Model,
            ["language"] = language ?? Language,
            ["smart_format"] = "true",
            ["interim_results"] = "true",
            ["punctuate"] = "true",
            ["encoding"] = "linear16",
            ["sample_rate"] = "16000",
            ["channels"] = "1"
        };

        var queryString = string.Join("&", queryParams.Select(p => $"{p.Key}={p.Value}"));
        var uri = new Uri($"{BaseUrl}?{queryString}");

        _webSocket = new ClientWebSocket();
        _webSocket.Options.SetRequestHeader("Authorization", $"Token {temporaryToken}");

        try
        {
            _receiveCts = new CancellationTokenSource();
            await _webSocket.ConnectAsync(uri, CancellationToken.None);

            IsConnected = true;
            _audioBytesSent = 0;
            OnConnectionStateChanged?.Invoke(true);

            _logger.LogInformation("Deepgram WebSocket connected successfully");

            // Start receiving messages
            _ = ReceiveLoopAsync(_receiveCts.Token);

            // Start keepalive timer
            StartKeepalive();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to Deepgram");
            IsConnected = false;
            OnConnectionStateChanged?.Invoke(false);
            throw;
        }
    }

    public async Task DisconnectAsync()
    {
        _logger.LogInformation("Disconnecting from Deepgram...");

        StopKeepalive();
        _receiveCts?.Cancel();

        if (_webSocket != null)
        {
            try
            {
                if (_webSocket.State == WebSocketState.Open)
                {
                    await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                }
            }
            catch { }
            finally
            {
                _webSocket.Dispose();
                _webSocket = null;
            }
        }

        IsConnected = false;
        _audioBytesSent = 0;
        _currentToken = null;
        OnConnectionStateChanged?.Invoke(false);
    }

    public async Task SendAudioAsync(byte[] pcmData)
    {
        if (!IsConnected || _webSocket == null || _webSocket.State != WebSocketState.Open)
        {
            return;
        }

        try
        {
            _audioBytesSent += pcmData.Length;

            if (_audioBytesSent % 50000 < pcmData.Length)
            {
                _logger.LogDebug("Sent {KB}KB of audio to Deepgram", _audioBytesSent / 1000);
            }

            await _webSocket.SendAsync(
                new ArraySegment<byte>(pcmData),
                WebSocketMessageType.Binary,
                true,
                CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending audio to Deepgram");
            OnError?.Invoke(ex);
        }
    }

    private void StartKeepalive()
    {
        StopKeepalive();
        _keepaliveTimer = new Timer(
            SendKeepalive,
            null,
            TimeSpan.FromSeconds(KeepaliveIntervalSeconds),
            TimeSpan.FromSeconds(KeepaliveIntervalSeconds));
    }

    private void StopKeepalive()
    {
        _keepaliveTimer?.Dispose();
        _keepaliveTimer = null;
    }

    private async void SendKeepalive(object? state)
    {
        if (!IsConnected || _webSocket == null || _webSocket.State != WebSocketState.Open)
            return;

        try
        {
            var keepaliveMessage = "{\"type\": \"KeepAlive\"}";
            var bytes = Encoding.UTF8.GetBytes(keepaliveMessage);
            await _webSocket.SendAsync(
                new ArraySegment<byte>(bytes),
                WebSocketMessageType.Text,
                true,
                CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Keepalive error");
        }
    }

    private async Task ReceiveLoopAsync(CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];

        try
        {
            while (!cancellationToken.IsCancellationRequested &&
                   _webSocket != null &&
                   _webSocket.State == WebSocketState.Open)
            {
                var result = await _webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer),
                    cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogInformation("WebSocket closed by server");
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = Encoding.UTF8.GetString(buffer, 0, result.Count);

                    // Handle messages that span multiple frames
                    while (!result.EndOfMessage)
                    {
                        result = await _webSocket.ReceiveAsync(
                            new ArraySegment<byte>(buffer),
                            cancellationToken);
                        message += Encoding.UTF8.GetString(buffer, 0, result.Count);
                    }

                    ParseTranscriptionResponse(message);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal cancellation
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in receive loop");
            OnError?.Invoke(ex);
        }
        finally
        {
            IsConnected = false;
            OnConnectionStateChanged?.Invoke(false);
        }
    }

    private void ParseTranscriptionResponse(string jsonString)
    {
        try
        {
            var response = JsonSerializer.Deserialize<DeepgramResponse>(jsonString);

            if (response?.Channel?.Alternatives == null ||
                response.Channel.Alternatives.Length == 0)
                return;

            var alternative = response.Channel.Alternatives[0];
            var transcript = alternative.Transcript ?? "";

            if (string.IsNullOrEmpty(transcript))
                return;

            var result = new TranscriptionResult(
                Text: transcript,
                IsFinal: response.IsFinal ?? false,
                Confidence: (float)(alternative.Confidence ?? 0),
                StartTime: TimeSpan.FromSeconds(response.Start ?? 0),
                EndTime: TimeSpan.FromSeconds((response.Start ?? 0) + (response.Duration ?? 0))
            );

            if (response.IsFinal == true)
            {
                _logger.LogDebug("FINAL: \"{Transcript}\"", transcript);
            }

            OnTranscript?.Invoke(result);
        }
        catch (JsonException)
        {
            // Ignore non-transcript messages (like metadata)
        }
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;
        DisconnectAsync().Wait();
    }

    // Deepgram response models
    private class DeepgramResponse
    {
        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("channel")]
        public DeepgramChannel? Channel { get; set; }

        [JsonPropertyName("is_final")]
        public bool? IsFinal { get; set; }

        [JsonPropertyName("start")]
        public double? Start { get; set; }

        [JsonPropertyName("duration")]
        public double? Duration { get; set; }
    }

    private class DeepgramChannel
    {
        [JsonPropertyName("alternatives")]
        public DeepgramAlternative[]? Alternatives { get; set; }
    }

    private class DeepgramAlternative
    {
        [JsonPropertyName("transcript")]
        public string? Transcript { get; set; }

        [JsonPropertyName("confidence")]
        public double? Confidence { get; set; }
    }
}
