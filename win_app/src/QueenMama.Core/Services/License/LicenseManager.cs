using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Models;
using QueenMama.Core.Services.Auth;

namespace QueenMama.Core.Services.License;

/// <summary>
/// Manages license validation and feature gating
/// </summary>
public partial class LicenseManager : ObservableObject, ILicenseManager
{
    private readonly AuthApiClient _api;
    private readonly IAuthenticationManager _authManager;
    private readonly ILogger<LicenseManager> _logger;

    private const string CacheKey = "cached_license";
    private const string CacheExpiryKey = "cached_license_expiry";
    private const string UsageResetKey = "usage_reset_date";
    private const int GracePeriodDays = 7;
    private const int RevalidationIntervalMinutes = 60;

    private Timer? _revalidationTimer;
    private readonly string _settingsPath;

    public event Action<Models.License?>? OnLicenseChanged;

    [ObservableProperty]
    private Models.License _currentLicense = Models.License.Free;

    [ObservableProperty]
    private bool _isValidating;

    [ObservableProperty]
    private bool _isOffline;

    [ObservableProperty]
    private DateTime? _lastValidatedAt;

    [ObservableProperty]
    private int _smartModeUsedToday;

    [ObservableProperty]
    private int _aiRequestsToday;

    public LicenseTier CurrentTier => CurrentLicense.Tier;

    /// <summary>
    /// License secret for HMAC signature verification
    /// </summary>
    private string LicenseSecret
    {
        get
        {
            var envSecret = Environment.GetEnvironmentVariable("LICENSE_SECRET");
            return envSecret ?? BundledLicenseSecret;
        }
    }

    /// <summary>
    /// Bundled license secret (obfuscated)
    /// </summary>
    private static readonly string BundledLicenseSecret = string.Join("",
        new[] { "FpOU+px9", "sASk0/+e", "Zu5uDQBP", "4r0rhZ2g", "2h5u5iqf", "0Uw=" });

    public LicenseManager(
        IAuthApiClient api,
        IAuthenticationManager authManager,
        ILogger<LicenseManager> logger)
    {
        _api = (AuthApiClient)api;
        _authManager = authManager;
        _logger = logger;

        _settingsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "QueenMama", "settings");
        Directory.CreateDirectory(_settingsPath);

        // Load cached license
        LoadCachedLicense();

        // Reset daily usage if needed
        ResetDailyUsageIfNeeded();

        // Subscribe to auth changes
        _authManager.OnAuthStateChanged += OnAuthStateChangedHandler;

        // Start periodic revalidation
        StartPeriodicRevalidation();
    }

    partial void OnCurrentLicenseChanged(Models.License value)
    {
        OnLicenseChanged?.Invoke(value);
    }

    private void OnAuthStateChangedHandler(AuthState state)
    {
        Task.Run(async () =>
        {
            if (state == AuthState.Authenticated)
            {
                await RevalidateAsync();
            }
            else if (state == AuthState.SignedOut)
            {
                CurrentLicense = Models.License.Free;
                ResetUsage();
            }
        });
    }

    private void StartPeriodicRevalidation()
    {
        _revalidationTimer?.Dispose();
        _revalidationTimer = new Timer(
            async _ => await RevalidateIfNeededAsync(),
            null,
            TimeSpan.FromMinutes(RevalidationIntervalMinutes),
            TimeSpan.FromMinutes(RevalidationIntervalMinutes));
    }

    private async Task RevalidateIfNeededAsync()
    {
        if (!_authManager.IsAuthenticated)
            return;

        // Skip if validated recently (within last 5 minutes)
        if (LastValidatedAt.HasValue &&
            DateTime.UtcNow.Subtract(LastValidatedAt.Value).TotalMinutes < 5)
        {
            return;
        }

        await RevalidateAsync();
    }

    public bool HasFeature(Feature feature)
    {
        return CurrentLicense.HasFeature(feature);
    }

    public bool IsFeatureEnabled(Feature feature)
    {
        var access = CheckFeatureAccess(feature);
        return access.IsAllowed;
    }

    public FeatureAccess CheckFeatureAccess(Feature feature)
    {
        // Block all features for unauthenticated users
        if (!_authManager.IsAuthenticated)
        {
            if (feature == Feature.SessionHistory)
                return FeatureAccess.RequiresAuth;
            return FeatureAccess.Blocked;
        }

        var currentUsage = new UsageStats
        {
            SmartModeUsedToday = SmartModeUsedToday,
            AiRequestsToday = AiRequestsToday
        };

        return CurrentLicense.CheckFeatureAccess(feature, currentUsage);
    }

    public void RecordUsage(Feature feature, string? provider = null)
    {
        string action;
        switch (feature)
        {
            case Feature.SmartMode:
                SmartModeUsedToday++;
                SaveUsage();
                action = "smart_mode";
                break;
            case Feature.AIAssist:
                AiRequestsToday++;
                SaveUsage();
                action = "ai_request";
                break;
            case Feature.SessionStart:
                action = "session_start";
                break;
            case Feature.AutoAnswer:
                action = "auto_answer";
                break;
            default:
                return;
        }

        // Record usage to server asynchronously
        _ = Task.Run(async () =>
        {
            try
            {
                await _api.RecordUsageAsync(action, provider);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record usage to server");
            }
        });
    }

    public async Task<Models.License?> ValidateLicenseAsync()
    {
        await RevalidateAsync();
        return CurrentLicense;
    }

    public async Task<Models.License?> FetchLicenseAsync()
    {
        if (!_authManager.IsAuthenticated)
        {
            return Models.License.Free;
        }

        try
        {
            var license = await _api.ValidateLicenseAsync(DeviceInfo.Current().DeviceId);

            if (VerifyLicenseSignature(license))
            {
                return license;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch license");
        }

        return null;
    }

    private async Task RevalidateAsync()
    {
        if (!_authManager.IsAuthenticated)
        {
            CurrentLicense = Models.License.Free;
            return;
        }

        IsValidating = true;
        IsOffline = false;

        try
        {
            var license = await _api.ValidateLicenseAsync(DeviceInfo.Current().DeviceId);

            if (VerifyLicenseSignature(license))
            {
                CurrentLicense = license;
                LastValidatedAt = DateTime.UtcNow;

                // Update usage from server
                if (license.Usage != null)
                {
                    SmartModeUsedToday = license.Usage.SmartModeUsedToday;
                    AiRequestsToday = license.Usage.AiRequestsToday;
                }

                // Cache the license
                CacheLicense(license);
                _logger.LogInformation("License validated: {Plan}", license.Plan);
            }
            else
            {
                _logger.LogWarning("SECURITY: Invalid license signature detected");

                // Fall back to cached license if valid
                var cachedLicense = LoadCachedLicense();
                if (cachedLicense != null && VerifyLicenseSignature(cachedLicense))
                {
                    CurrentLicense = cachedLicense;
                }
                else
                {
                    CurrentLicense = Models.License.Free;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "License validation failed, using cached");
            IsOffline = true;

            // Use cached license with grace period
            var cachedLicense = LoadCachedLicense();
            if (cachedLicense != null && VerifyLicenseSignature(cachedLicense))
            {
                var expiry = GetCacheExpiry();
                if (cachedLicense.Plan == SubscriptionPlan.Pro && expiry != null && expiry > DateTime.UtcNow)
                {
                    CurrentLicense = cachedLicense;
                }
                else if (cachedLicense.Plan != SubscriptionPlan.Pro)
                {
                    CurrentLicense = cachedLicense;
                }
                else
                {
                    CurrentLicense = Models.License.Free;
                }
            }
        }

        IsValidating = false;
    }

    private bool VerifyLicenseSignature(Models.License license)
    {
        // Skip verification for local free license (no signature)
        if (string.IsNullOrEmpty(license.Signature) && license.Plan == SubscriptionPlan.Free)
        {
            return true;
        }

        var signedPayload = BuildSignaturePayload(license);
        var payloadBytes = Encoding.UTF8.GetBytes(signedPayload);

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(LicenseSecret));
        var hash = hmac.ComputeHash(payloadBytes);
        var computedSignature = Convert.ToHexString(hash).ToLowerInvariant();

        // Constant-time comparison
        return ConstantTimeCompare(computedSignature, license.Signature);
    }

    private static bool ConstantTimeCompare(string a, string b)
    {
        if (a.Length != b.Length)
            return false;

        var result = 0;
        for (var i = 0; i < a.Length; i++)
        {
            result |= a[i] ^ b[i];
        }

        return result == 0;
    }

    private static string BuildSignaturePayload(Models.License license)
    {
        var sb = new StringBuilder();
        sb.Append('{');
        sb.Append($"\"valid\":{license.Valid.ToString().ToLower()},");
        sb.Append($"\"plan\":\"{license.Plan}\",");
        sb.Append($"\"status\":\"{license.Status}\",");
        sb.Append($"\"features\":{BuildFeaturesJson(license.Features)},");
        sb.Append($"\"trial\":{BuildTrialJson(license.Trial)},");
        sb.Append($"\"cacheTTL\":{license.CacheTTL},");
        sb.Append($"\"validatedAt\":\"{license.ValidatedAt}\"");
        sb.Append('}');
        return sb.ToString();
    }

    private static string BuildFeaturesJson(LicenseFeatures features)
    {
        var sb = new StringBuilder();
        sb.Append('{');
        sb.Append($"\"smartModeEnabled\":{features.SmartModeEnabled.ToString().ToLower()},");
        sb.Append($"\"smartModeLimit\":{(features.SmartModeLimit.HasValue ? features.SmartModeLimit.ToString() : "null")},");
        sb.Append($"\"customModesEnabled\":{features.CustomModesEnabled.ToString().ToLower()},");
        sb.Append($"\"exportFormats\":[{string.Join(",", features.ExportFormats.Select(f => $"\"{f}\""))}],");
        sb.Append($"\"autoAnswerEnabled\":{features.AutoAnswerEnabled.ToString().ToLower()},");
        sb.Append($"\"sessionSyncEnabled\":{features.SessionSyncEnabled.ToString().ToLower()},");
        sb.Append($"\"dailyAiRequestLimit\":{(features.DailyAiRequestLimit.HasValue ? features.DailyAiRequestLimit.ToString() : "null")},");
        sb.Append($"\"maxSyncedSessions\":{(features.MaxSyncedSessions.HasValue ? features.MaxSyncedSessions.ToString() : "null")},");
        sb.Append($"\"maxTranscriptSize\":{(features.MaxTranscriptSize.HasValue ? features.MaxTranscriptSize.ToString() : "null")},");
        sb.Append($"\"undetectableEnabled\":{features.UndetectableEnabled.ToString().ToLower()},");
        sb.Append($"\"screenshotEnabled\":{features.ScreenshotEnabled.ToString().ToLower()}");
        sb.Append('}');
        return sb.ToString();
    }

    private static string BuildTrialJson(TrialInfo? trial)
    {
        if (trial == null)
            return "null";

        return $"{{\"isActive\":{trial.IsActive.ToString().ToLower()},\"daysRemaining\":{trial.DaysRemaining},\"endsAt\":\"{trial.EndsAt}\"}}";
    }

    private Models.License? LoadCachedLicense()
    {
        var path = Path.Combine(_settingsPath, CacheKey);
        if (!File.Exists(path))
            return null;

        try
        {
            var json = File.ReadAllText(path);
            var license = JsonSerializer.Deserialize<Models.License>(json);
            if (license != null)
            {
                CurrentLicense = license;
            }
            return license;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load cached license");
            return null;
        }
    }

    private void CacheLicense(Models.License license)
    {
        try
        {
            var json = JsonSerializer.Serialize(license);
            var path = Path.Combine(_settingsPath, CacheKey);
            File.WriteAllText(path, json);

            // Set expiry with grace period for PRO
            var expiryDays = license.Plan == SubscriptionPlan.Pro ? GracePeriodDays : 1;
            var expiry = DateTime.UtcNow.AddDays(expiryDays);
            var expiryPath = Path.Combine(_settingsPath, CacheExpiryKey);
            File.WriteAllText(expiryPath, expiry.ToString("O"));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to cache license");
        }
    }

    private DateTime? GetCacheExpiry()
    {
        var path = Path.Combine(_settingsPath, CacheExpiryKey);
        if (!File.Exists(path))
            return null;

        try
        {
            var str = File.ReadAllText(path);
            return DateTime.Parse(str);
        }
        catch
        {
            return null;
        }
    }

    private void ResetDailyUsageIfNeeded()
    {
        var today = DateTime.UtcNow.Date;
        var resetPath = Path.Combine(_settingsPath, UsageResetKey);

        DateTime? lastReset = null;
        if (File.Exists(resetPath))
        {
            try
            {
                lastReset = DateTime.Parse(File.ReadAllText(resetPath));
            }
            catch { }
        }

        if (lastReset == null || lastReset.Value.Date != today)
        {
            ResetUsage();
            File.WriteAllText(resetPath, today.ToString("O"));
        }
        else
        {
            LoadUsage();
        }
    }

    private void ResetUsage()
    {
        SmartModeUsedToday = 0;
        AiRequestsToday = 0;
        SaveUsage();
    }

    private void LoadUsage()
    {
        var smartModePath = Path.Combine(_settingsPath, "smartModeUsedToday");
        var aiRequestsPath = Path.Combine(_settingsPath, "aiRequestsToday");

        if (File.Exists(smartModePath))
        {
            try { SmartModeUsedToday = int.Parse(File.ReadAllText(smartModePath)); } catch { }
        }

        if (File.Exists(aiRequestsPath))
        {
            try { AiRequestsToday = int.Parse(File.ReadAllText(aiRequestsPath)); } catch { }
        }
    }

    private void SaveUsage()
    {
        var smartModePath = Path.Combine(_settingsPath, "smartModeUsedToday");
        var aiRequestsPath = Path.Combine(_settingsPath, "aiRequestsToday");

        File.WriteAllText(smartModePath, SmartModeUsedToday.ToString());
        File.WriteAllText(aiRequestsPath, AiRequestsToday.ToString());
    }
}
