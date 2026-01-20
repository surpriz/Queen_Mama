using QueenMama.Core.Models;

namespace QueenMama.Core.Interfaces;

public interface ILicenseManager
{
    event Action<License?>? OnLicenseChanged;

    License? CurrentLicense { get; }
    LicenseTier CurrentTier { get; }

    Task<License?> ValidateLicenseAsync();
    Task<License?> FetchLicenseAsync();
    bool HasFeature(Feature feature);
    bool IsFeatureEnabled(Feature feature);
}

public enum LicenseTier
{
    Free,
    Pro,
    Enterprise
}

public enum Feature
{
    BasicTranscription,
    AIAssist,
    ScreenCapture,
    AutoAnswer,
    CustomModes,
    SessionHistory,
    Export,
    UndetectableOverlay,
    PrioritySupport
}
