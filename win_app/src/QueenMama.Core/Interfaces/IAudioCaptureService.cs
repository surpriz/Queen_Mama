namespace QueenMama.Core.Interfaces;

public interface IAudioCaptureService : IDisposable
{
    event Action<byte[]>? OnAudioBuffer;
    event Action<float>? OnAudioLevelChanged;
    event Action<Exception>? OnError;

    bool IsCapturing { get; }
    float CurrentLevel { get; }

    Task StartCaptureAsync();
    Task StopCaptureAsync();
    IEnumerable<AudioDevice> GetAvailableDevices();
    void SetDevice(string deviceId);
}

public record AudioDevice(string Id, string Name, bool IsDefault);
