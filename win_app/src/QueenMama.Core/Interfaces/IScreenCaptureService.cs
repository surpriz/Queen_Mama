namespace QueenMama.Core.Interfaces;

public interface IScreenCaptureService : IDisposable
{
    event Action<byte[]>? OnScreenshotCaptured;
    event Action<Exception>? OnError;

    bool IsCapturing { get; }
    byte[]? LastScreenshot { get; }
    string? LastScreenshotHash { get; }

    Task<byte[]?> CaptureScreenshotAsync();
    Task StartPeriodicCaptureAsync(TimeSpan interval);
    Task StopPeriodicCaptureAsync();
}
