namespace QueenMama.Core.Interfaces;

public interface ITranscriptionService : IDisposable
{
    event Action<TranscriptionResult>? OnTranscript;
    event Action<bool>? OnConnectionStateChanged;
    event Action<Exception>? OnError;

    bool IsConnected { get; }
    string CurrentTranscript { get; }

    Task ConnectAsync(string? language = null);
    Task DisconnectAsync();
    Task SendAudioAsync(byte[] pcmData);
    void ClearTranscript();
}

public interface ITranscriptionProvider : IDisposable
{
    event Action<TranscriptionResult>? OnTranscript;
    event Action<bool>? OnConnectionStateChanged;
    event Action<Exception>? OnError;

    bool IsConnected { get; }
    string ProviderName { get; }

    Task ConnectAsync(string temporaryToken, string? language = null);
    Task DisconnectAsync();
    Task SendAudioAsync(byte[] pcmData);
}

public record TranscriptionResult(
    string Text,
    bool IsFinal,
    float Confidence,
    TimeSpan StartTime,
    TimeSpan EndTime,
    string? SpeakerId = null
);
