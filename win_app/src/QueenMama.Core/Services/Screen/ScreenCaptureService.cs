using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;

namespace QueenMama.Core.Services.Screen;

/// <summary>
/// Screen capture service using Windows GDI+ (fallback) or Windows.Graphics.Capture API
/// Captures screenshots for visual context analysis
/// </summary>
public partial class ScreenCaptureService : ObservableObject, IScreenCaptureService
{
    private readonly ILogger<ScreenCaptureService> _logger;

    private Timer? _periodicCaptureTimer;
    private string? _lastScreenshotHash;
    private bool _disposed;

    // Capture settings
    private const int MaxWidth = 1280;
    private const int MaxHeight = 720;
    private const int JpegQuality = 60;

    public event Action<byte[]>? OnScreenshotCaptured;
    public event Action<Exception>? OnError;

    [ObservableProperty]
    private bool _isCapturing;

    [ObservableProperty]
    private byte[]? _lastScreenshot;

    public string? LastScreenshotHash => _lastScreenshotHash;

    public ScreenCaptureService(ILogger<ScreenCaptureService> logger)
    {
        _logger = logger;
    }

    public async Task<byte[]?> CaptureScreenshotAsync()
    {
        try
        {
            _logger.LogDebug("Capturing screenshot...");

            // Capture the primary screen
            var screenshot = await Task.Run(CaptureScreen);

            if (screenshot == null)
            {
                _logger.LogWarning("Screenshot capture returned null");
                return null;
            }

            // Check for duplicate
            var hash = ComputeHash(screenshot);
            if (hash == _lastScreenshotHash)
            {
                _logger.LogDebug("Duplicate screenshot detected, skipping");
                return null;
            }

            _lastScreenshotHash = hash;
            LastScreenshot = screenshot;
            OnScreenshotCaptured?.Invoke(screenshot);

            _logger.LogDebug("Screenshot captured: {Size} bytes", screenshot.Length);
            return screenshot;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to capture screenshot");
            OnError?.Invoke(ex);
            return null;
        }
    }

    public async Task StartPeriodicCaptureAsync(TimeSpan interval)
    {
        if (IsCapturing)
        {
            _logger.LogWarning("Periodic capture already running");
            return;
        }

        _logger.LogInformation("Starting periodic capture with interval: {Interval}", interval);
        IsCapturing = true;

        _periodicCaptureTimer = new Timer(
            async _ => await CaptureScreenshotAsync(),
            null,
            TimeSpan.Zero,
            interval);

        await Task.CompletedTask;
    }

    public Task StopPeriodicCaptureAsync()
    {
        _periodicCaptureTimer?.Dispose();
        _periodicCaptureTimer = null;
        IsCapturing = false;
        _logger.LogInformation("Stopped periodic capture");
        return Task.CompletedTask;
    }

    private byte[]? CaptureScreen()
    {
        try
        {
            // Get primary screen bounds
            var screenWidth = GetSystemMetrics(SM_CXSCREEN);
            var screenHeight = GetSystemMetrics(SM_CYSCREEN);

            using var bitmap = new Bitmap(screenWidth, screenHeight, PixelFormat.Format32bppArgb);
            using var graphics = Graphics.FromImage(bitmap);

            // Capture the screen
            graphics.CopyFromScreen(0, 0, 0, 0, new Size(screenWidth, screenHeight));

            // Resize if necessary
            Bitmap resizedBitmap;
            if (screenWidth > MaxWidth || screenHeight > MaxHeight)
            {
                var scale = Math.Min((double)MaxWidth / screenWidth, (double)MaxHeight / screenHeight);
                var newWidth = (int)(screenWidth * scale);
                var newHeight = (int)(screenHeight * scale);

                resizedBitmap = new Bitmap(newWidth, newHeight);
                using var resizeGraphics = Graphics.FromImage(resizedBitmap);
                resizeGraphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                resizeGraphics.DrawImage(bitmap, 0, 0, newWidth, newHeight);
            }
            else
            {
                resizedBitmap = (Bitmap)bitmap.Clone();
            }

            // Convert to JPEG with quality setting
            using var ms = new MemoryStream();
            var encoder = GetEncoder(ImageFormat.Jpeg);
            var encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)JpegQuality);

            resizedBitmap.Save(ms, encoder!, encoderParams);
            resizedBitmap.Dispose();

            return ms.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Screen capture failed");
            return null;
        }
    }

    private static ImageCodecInfo? GetEncoder(ImageFormat format)
    {
        var codecs = ImageCodecInfo.GetImageDecoders();
        return codecs.FirstOrDefault(codec => codec.FormatID == format.Guid);
    }

    private static string ComputeHash(byte[] data)
    {
        var hash = SHA256.HashData(data);
        return Convert.ToHexString(hash);
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;
        _periodicCaptureTimer?.Dispose();
    }

    #region Native Methods

    private const int SM_CXSCREEN = 0;
    private const int SM_CYSCREEN = 1;

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);

    #endregion
}
