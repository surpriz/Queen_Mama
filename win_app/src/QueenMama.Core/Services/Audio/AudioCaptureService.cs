using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.Logging;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using QueenMama.Core.Interfaces;

namespace QueenMama.Core.Services.Audio;

/// <summary>
/// Audio capture service using NAudio WASAPI
/// Captures microphone input and converts to 16kHz mono PCM16 for Deepgram
/// </summary>
public partial class AudioCaptureService : ObservableObject, IAudioCaptureService
{
    private readonly ILogger<AudioCaptureService> _logger;

    private WasapiCapture? _capture;
    private WaveFormat? _sourceFormat;
    private WaveFormat _targetFormat;

    // Resampling
    private BufferedWaveProvider? _bufferedWaveProvider;
    private MediaFoundationResampler? _resampler;

    private string? _selectedDeviceId;
    private int _bufferCount;
    private bool _disposed;

    public event Action<byte[]>? OnAudioBuffer;
    public event Action<float>? OnAudioLevelChanged;
    public event Action<Exception>? OnError;

    [ObservableProperty]
    private bool _isCapturing;

    [ObservableProperty]
    private float _currentLevel;

    // Target format for Deepgram: 16kHz mono 16-bit PCM
    private const int TargetSampleRate = 16000;
    private const int TargetChannels = 1;
    private const int TargetBitsPerSample = 16;

    public AudioCaptureService(ILogger<AudioCaptureService> logger)
    {
        _logger = logger;
        _targetFormat = new WaveFormat(TargetSampleRate, TargetBitsPerSample, TargetChannels);
    }

    public IEnumerable<AudioDevice> GetAvailableDevices()
    {
        var devices = new List<AudioDevice>();

        try
        {
            using var enumerator = new MMDeviceEnumerator();

            // Get default device
            try
            {
                var defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console);
                devices.Add(new AudioDevice(defaultDevice.ID, $"{defaultDevice.FriendlyName} (Default)", true));
            }
            catch { }

            // Get all capture devices
            var captureDevices = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);
            foreach (var device in captureDevices)
            {
                if (!devices.Any(d => d.Id == device.ID))
                {
                    devices.Add(new AudioDevice(device.ID, device.FriendlyName, false));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enumerate audio devices");
        }

        return devices;
    }

    public void SetDevice(string deviceId)
    {
        _selectedDeviceId = deviceId;
        _logger.LogInformation("Selected audio device: {DeviceId}", deviceId);
    }

    public async Task StartCaptureAsync()
    {
        if (IsCapturing)
        {
            _logger.LogWarning("Already capturing, skipping start");
            return;
        }

        try
        {
            _logger.LogInformation("Starting audio capture...");

            // Get capture device
            using var enumerator = new MMDeviceEnumerator();
            MMDevice device;

            if (!string.IsNullOrEmpty(_selectedDeviceId))
            {
                device = enumerator.GetDevice(_selectedDeviceId);
            }
            else
            {
                device = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console);
            }

            _logger.LogInformation("Using audio device: {DeviceName}", device.FriendlyName);

            // Create WASAPI capture
            _capture = new WasapiCapture(device);
            _sourceFormat = _capture.WaveFormat;

            _logger.LogInformation("Source format: {SampleRate}Hz, {Channels}ch, {Bits}bit",
                _sourceFormat.SampleRate, _sourceFormat.Channels, _sourceFormat.BitsPerSample);

            // Setup resampling if needed
            if (_sourceFormat.SampleRate != TargetSampleRate ||
                _sourceFormat.Channels != TargetChannels ||
                _sourceFormat.BitsPerSample != TargetBitsPerSample)
            {
                _logger.LogInformation("Setting up audio resampling to {SampleRate}Hz mono {Bits}bit",
                    TargetSampleRate, TargetBitsPerSample);
            }

            // Subscribe to data available event
            _capture.DataAvailable += OnDataAvailable;

            // Start recording
            _capture.StartRecording();
            IsCapturing = true;
            _bufferCount = 0;

            _logger.LogInformation("Audio capture started successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start audio capture");
            OnError?.Invoke(ex);
            throw;
        }

        await Task.CompletedTask;
    }

    public Task StopCaptureAsync()
    {
        if (!IsCapturing)
            return Task.CompletedTask;

        try
        {
            _capture?.StopRecording();
            _capture?.Dispose();
            _capture = null;

            _resampler?.Dispose();
            _resampler = null;

            _bufferedWaveProvider = null;

            IsCapturing = false;
            CurrentLevel = 0;

            _logger.LogInformation("Audio capture stopped");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping audio capture");
        }

        return Task.CompletedTask;
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        if (e.BytesRecorded == 0)
            return;

        try
        {
            _bufferCount++;

            // Calculate audio level for visualization
            var level = CalculateRmsLevel(e.Buffer, e.BytesRecorded);
            CurrentLevel = level;
            OnAudioLevelChanged?.Invoke(level);

            // Convert to target format
            var convertedData = ConvertAudio(e.Buffer, e.BytesRecorded);

            if (convertedData != null && convertedData.Length > 0)
            {
                if (_bufferCount % 100 == 0)
                {
                    _logger.LogDebug("Processed {Count} buffers, sending {Bytes} bytes",
                        _bufferCount, convertedData.Length);
                }

                OnAudioBuffer?.Invoke(convertedData);
            }
        }
        catch (Exception ex)
        {
            if (_bufferCount % 100 == 0)
            {
                _logger.LogWarning(ex, "Error processing audio buffer");
            }
        }
    }

    private byte[]? ConvertAudio(byte[] buffer, int bytesRecorded)
    {
        if (_sourceFormat == null)
            return null;

        // If source format matches target, return as-is
        if (_sourceFormat.SampleRate == TargetSampleRate &&
            _sourceFormat.Channels == TargetChannels &&
            _sourceFormat.BitsPerSample == TargetBitsPerSample)
        {
            var result = new byte[bytesRecorded];
            Array.Copy(buffer, result, bytesRecorded);
            return result;
        }

        // Convert using MediaFoundation resampler
        try
        {
            // Create a raw source wave stream
            using var sourceStream = new RawSourceWaveStream(
                new MemoryStream(buffer, 0, bytesRecorded),
                _sourceFormat);

            // Resample to target format
            using var resampler = new MediaFoundationResampler(sourceStream, _targetFormat);
            resampler.ResamplerQuality = 60; // High quality

            // Calculate expected output size
            var ratio = (double)TargetSampleRate / _sourceFormat.SampleRate;
            var channelRatio = (double)TargetChannels / _sourceFormat.Channels;
            var bitsRatio = (double)TargetBitsPerSample / _sourceFormat.BitsPerSample;
            var expectedBytes = (int)(bytesRecorded * ratio * channelRatio * bitsRatio) + 1024;

            var outputBuffer = new byte[expectedBytes];
            var bytesRead = resampler.Read(outputBuffer, 0, outputBuffer.Length);

            if (bytesRead > 0)
            {
                var result = new byte[bytesRead];
                Array.Copy(outputBuffer, result, bytesRead);
                return result;
            }
        }
        catch (Exception ex)
        {
            if (_bufferCount % 100 == 0)
            {
                _logger.LogWarning(ex, "Audio conversion error");
            }
        }

        return null;
    }

    private float CalculateRmsLevel(byte[] buffer, int bytesRecorded)
    {
        if (_sourceFormat == null || bytesRecorded == 0)
            return 0;

        float sum = 0;
        int sampleCount = 0;

        // Handle different bit depths
        if (_sourceFormat.BitsPerSample == 16)
        {
            for (int i = 0; i < bytesRecorded - 1; i += 2)
            {
                var sample = BitConverter.ToInt16(buffer, i);
                var normalized = sample / 32768f;
                sum += normalized * normalized;
                sampleCount++;
            }
        }
        else if (_sourceFormat.BitsPerSample == 32)
        {
            // IEEE Float
            for (int i = 0; i < bytesRecorded - 3; i += 4)
            {
                var sample = BitConverter.ToSingle(buffer, i);
                sum += sample * sample;
                sampleCount++;
            }
        }
        else if (_sourceFormat.BitsPerSample == 24)
        {
            // 24-bit samples
            for (int i = 0; i < bytesRecorded - 2; i += 3)
            {
                var sample = (buffer[i] | (buffer[i + 1] << 8) | (buffer[i + 2] << 16));
                if ((sample & 0x800000) != 0) // Sign extend
                    sample |= unchecked((int)0xFF000000);
                var normalized = sample / 8388608f;
                sum += normalized * normalized;
                sampleCount++;
            }
        }

        if (sampleCount == 0)
            return 0;

        var rms = MathF.Sqrt(sum / sampleCount);
        var db = 20 * MathF.Log10(rms + 1e-10f);

        // Scale from dB to 0-1 range
        return ScalePower(db);
    }

    private static float ScalePower(float power)
    {
        const float minDb = -80f;
        const float maxDb = 0f;

        if (power < minDb)
            return 0;
        if (power >= maxDb)
            return 1;

        return (power - minDb) / (maxDb - minDb);
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;
        StopCaptureAsync().Wait();

        _capture?.Dispose();
        _resampler?.Dispose();
    }
}
