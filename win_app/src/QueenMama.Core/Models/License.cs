using System.Text.Json.Serialization;
using QueenMama.Core.Interfaces;

namespace QueenMama.Core.Models;

public class License
{
    [JsonPropertyName("valid")]
    public bool Valid { get; set; }

    [JsonPropertyName("plan")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public SubscriptionPlan Plan { get; set; }

    [JsonPropertyName("status")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public SubscriptionStatus Status { get; set; }

    [JsonPropertyName("features")]
    public LicenseFeatures Features { get; set; } = new();

    [JsonPropertyName("trial")]
    public TrialInfo? Trial { get; set; }

    [JsonPropertyName("cacheTTL")]
    public int CacheTTL { get; set; }

    [JsonPropertyName("validatedAt")]
    public string ValidatedAt { get; set; } = "";

    [JsonPropertyName("usage")]
    public UsageStats? Usage { get; set; }

    [JsonPropertyName("signature")]
    public string Signature { get; set; } = "";

    public static License Free => new()
    {
        Valid = true,
        Plan = SubscriptionPlan.Free,
        Status = SubscriptionStatus.Active,
        Features = LicenseFeatures.FreeDefaults,
        CacheTTL = 86400,
        ValidatedAt = DateTime.UtcNow.ToString("O")
    };

    public LicenseTier Tier => Plan switch
    {
        SubscriptionPlan.Enterprise => LicenseTier.Enterprise,
        SubscriptionPlan.Pro => LicenseTier.Pro,
        _ => LicenseTier.Free
    };

    public bool HasFeature(Feature feature)
    {
        return feature switch
        {
            Feature.BasicTranscription => true,
            Feature.AIAssist => true,
            Feature.ScreenCapture => Features.ScreenshotEnabled,
            Feature.AutoAnswer => Features.AutoAnswerEnabled,
            Feature.CustomModes => Features.CustomModesEnabled,
            Feature.SessionHistory => true,
            Feature.Export => Features.ExportFormats.Count > 1,
            Feature.UndetectableOverlay => Features.UndetectableEnabled,
            Feature.PrioritySupport => Plan == SubscriptionPlan.Enterprise,
            _ => false
        };
    }

    public FeatureAccess CheckFeatureAccess(Feature feature, UsageStats? currentUsage = null)
    {
        var usage = currentUsage ?? Usage;

        return feature switch
        {
            Feature.SmartMode when !Features.SmartModeEnabled => FeatureAccess.RequiresEnterprise,
            Feature.SmartMode when Features.SmartModeLimit.HasValue && usage != null
                && usage.SmartModeUsedToday >= Features.SmartModeLimit.Value =>
                FeatureAccess.LimitReached(usage.SmartModeUsedToday, Features.SmartModeLimit.Value),

            Feature.CustomModes when !Features.CustomModesEnabled => FeatureAccess.RequiresPro,

            Feature.AutoAnswer when !Features.AutoAnswerEnabled => FeatureAccess.RequiresEnterprise,

            Feature.SessionHistory when !Features.SessionSyncEnabled => FeatureAccess.RequiresPro,

            Feature.UndetectableOverlay when !Features.UndetectableEnabled => FeatureAccess.RequiresEnterprise,

            Feature.AIAssist when Features.DailyAiRequestLimit.HasValue && usage != null
                && usage.AiRequestsToday >= Features.DailyAiRequestLimit.Value =>
                FeatureAccess.LimitReached(usage.AiRequestsToday, Features.DailyAiRequestLimit.Value),

            _ => FeatureAccess.Allowed
        };
    }
}

public enum SubscriptionPlan
{
    [JsonPropertyName("FREE")]
    Free,

    [JsonPropertyName("PRO")]
    Pro,

    [JsonPropertyName("ENTERPRISE")]
    Enterprise
}

public enum SubscriptionStatus
{
    [JsonPropertyName("ACTIVE")]
    Active,

    [JsonPropertyName("TRIALING")]
    Trialing,

    [JsonPropertyName("PAST_DUE")]
    PastDue,

    [JsonPropertyName("CANCELED")]
    Canceled,

    [JsonPropertyName("INCOMPLETE")]
    Incomplete
}

public class LicenseFeatures
{
    [JsonPropertyName("smartModeEnabled")]
    public bool SmartModeEnabled { get; set; }

    [JsonPropertyName("smartModeLimit")]
    public int? SmartModeLimit { get; set; }

    [JsonPropertyName("customModesEnabled")]
    public bool CustomModesEnabled { get; set; }

    [JsonPropertyName("exportFormats")]
    public List<string> ExportFormats { get; set; } = new();

    [JsonPropertyName("autoAnswerEnabled")]
    public bool AutoAnswerEnabled { get; set; }

    [JsonPropertyName("sessionSyncEnabled")]
    public bool SessionSyncEnabled { get; set; }

    [JsonPropertyName("dailyAiRequestLimit")]
    public int? DailyAiRequestLimit { get; set; }

    [JsonPropertyName("maxSyncedSessions")]
    public int? MaxSyncedSessions { get; set; }

    [JsonPropertyName("maxTranscriptSize")]
    public int? MaxTranscriptSize { get; set; }

    [JsonPropertyName("undetectableEnabled")]
    public bool UndetectableEnabled { get; set; }

    [JsonPropertyName("screenshotEnabled")]
    public bool ScreenshotEnabled { get; set; } = true;

    public static LicenseFeatures FreeDefaults => new()
    {
        SmartModeEnabled = false,
        SmartModeLimit = 0,
        CustomModesEnabled = false,
        ExportFormats = new List<string> { "plainText" },
        AutoAnswerEnabled = false,
        SessionSyncEnabled = false,
        DailyAiRequestLimit = 50,
        MaxSyncedSessions = 0,
        MaxTranscriptSize = 10240,
        UndetectableEnabled = false,
        ScreenshotEnabled = true
    };

    public static LicenseFeatures ProDefaults => new()
    {
        SmartModeEnabled = false,
        SmartModeLimit = 0,
        CustomModesEnabled = true,
        ExportFormats = new List<string> { "plainText", "markdown", "json" },
        AutoAnswerEnabled = false,
        SessionSyncEnabled = true,
        DailyAiRequestLimit = null,
        MaxSyncedSessions = null,
        MaxTranscriptSize = 1048576,
        UndetectableEnabled = false,
        ScreenshotEnabled = true
    };

    public static LicenseFeatures EnterpriseDefaults => new()
    {
        SmartModeEnabled = true,
        SmartModeLimit = null,
        CustomModesEnabled = true,
        ExportFormats = new List<string> { "plainText", "markdown", "json" },
        AutoAnswerEnabled = true,
        SessionSyncEnabled = true,
        DailyAiRequestLimit = null,
        MaxSyncedSessions = null,
        MaxTranscriptSize = 10485760,
        UndetectableEnabled = true,
        ScreenshotEnabled = true
    };
}

public class TrialInfo
{
    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }

    [JsonPropertyName("daysRemaining")]
    public int DaysRemaining { get; set; }

    [JsonPropertyName("endsAt")]
    public string EndsAt { get; set; } = "";
}

public class UsageStats
{
    [JsonPropertyName("smartModeUsedToday")]
    public int SmartModeUsedToday { get; set; }

    [JsonPropertyName("aiRequestsToday")]
    public int AiRequestsToday { get; set; }
}

// MARK: - Feature Access

public enum Feature
{
    SmartMode,
    CustomModes,
    ExportMarkdown,
    ExportJson,
    AutoAnswer,
    SessionHistory,
    AIAssist,
    UndetectableOverlay,
    ScreenCapture,
    SessionStart
}

public abstract class FeatureAccess
{
    public abstract bool IsAllowed { get; }
    public abstract string ErrorMessage { get; }

    public static FeatureAccess Allowed => new AllowedAccess();
    public static FeatureAccess RequiresPro => new RequiresProAccess();
    public static FeatureAccess RequiresEnterprise => new RequiresEnterpriseAccess();
    public static FeatureAccess RequiresAuth => new RequiresAuthAccess();
    public static FeatureAccess Blocked => new BlockedAccess();
    public static FeatureAccess LimitReached(int used, int limit) => new LimitReachedAccess(used, limit);

    private class AllowedAccess : FeatureAccess
    {
        public override bool IsAllowed => true;
        public override string ErrorMessage => "";
    }

    private class RequiresProAccess : FeatureAccess
    {
        public override bool IsAllowed => false;
        public override string ErrorMessage => "This feature requires a PRO subscription.";
    }

    private class RequiresEnterpriseAccess : FeatureAccess
    {
        public override bool IsAllowed => false;
        public override string ErrorMessage => "This feature requires an Enterprise subscription.";
    }

    private class RequiresAuthAccess : FeatureAccess
    {
        public override bool IsAllowed => false;
        public override string ErrorMessage => "Please sign in to use this feature.";
    }

    private class BlockedAccess : FeatureAccess
    {
        public override bool IsAllowed => false;
        public override string ErrorMessage => "Please sign in to access Queen Mama features.";
    }

    private class LimitReachedAccess : FeatureAccess
    {
        private readonly int _used;
        private readonly int _limit;

        public LimitReachedAccess(int used, int limit)
        {
            _used = used;
            _limit = limit;
        }

        public override bool IsAllowed => false;
        public override string ErrorMessage => $"Daily limit reached ({_used}/{_limit}). Upgrade to continue.";
    }
}
