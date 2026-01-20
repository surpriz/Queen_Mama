using System.Text.Json.Serialization;

namespace QueenMama.Core.Models;

// MARK: - Auth User

public class User
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("email")]
    public string Email { get; set; } = "";

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonIgnore]
    public string DisplayName => Name ?? Email.Split('@').FirstOrDefault() ?? Email;
}

// MARK: - Auth Tokens

public class AuthTokens
{
    [JsonPropertyName("accessToken")]
    public string AccessToken { get; set; } = "";

    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; } = "";

    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }

    [JsonIgnore]
    public DateTime ExpiresAt => DateTime.UtcNow.AddSeconds(ExpiresIn);
}

// MARK: - Device Info

public class DeviceInfo
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("platform")]
    public string Platform { get; set; } = "Windows";

    [JsonPropertyName("osVersion")]
    public string? OsVersion { get; set; }

    [JsonPropertyName("appVersion")]
    public string? AppVersion { get; set; }

    public static DeviceInfo Current()
    {
        return new DeviceInfo
        {
            DeviceId = DeviceIdentifier.GetOrCreateDeviceId(),
            Name = Environment.MachineName,
            Platform = "Windows",
            OsVersion = Environment.OSVersion.VersionString,
            AppVersion = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString()
        };
    }
}

// MARK: - API Response Types

public class DeviceCodeResponse
{
    [JsonPropertyName("userCode")]
    public string UserCode { get; set; } = "";

    [JsonPropertyName("deviceCode")]
    public string DeviceCode { get; set; } = "";

    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }

    [JsonPropertyName("interval")]
    public int Interval { get; set; }

    [JsonPropertyName("verificationUrl")]
    public string VerificationUrl { get; set; } = "";

    [JsonIgnore]
    public DateTime ExpiresAt => DateTime.UtcNow.AddSeconds(ExpiresIn);
}

public class LoginResponse
{
    [JsonPropertyName("accessToken")]
    public string AccessToken { get; set; } = "";

    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; } = "";

    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }

    [JsonPropertyName("user")]
    public User? User { get; set; }
}

public class RefreshResponse
{
    [JsonPropertyName("accessToken")]
    public string AccessToken { get; set; } = "";

    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; } = "";

    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }
}

public class DevicePollResponse
{
    [JsonPropertyName("accessToken")]
    public string? AccessToken { get; set; }

    [JsonPropertyName("refreshToken")]
    public string? RefreshToken { get; set; }

    [JsonPropertyName("expiresIn")]
    public int? ExpiresIn { get; set; }

    [JsonPropertyName("user")]
    public User? User { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

public class AuthResult
{
    public bool Success { get; set; }
    public User? User { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Error { get; set; }
    public string? Message { get; set; }

    public static AuthResult FromPollResponse(DevicePollResponse response)
    {
        if (response.AccessToken != null && response.User != null)
        {
            return new AuthResult
            {
                Success = true,
                User = response.User,
                AccessToken = response.AccessToken,
                RefreshToken = response.RefreshToken,
                ExpiresAt = DateTime.UtcNow.AddSeconds(response.ExpiresIn ?? 3600)
            };
        }

        return new AuthResult
        {
            Success = false,
            Error = response.Error,
            Message = response.Message
        };
    }
}

// MARK: - Device Identifier

public static class DeviceIdentifier
{
    private static string? _deviceId;
    private const string DeviceIdFileName = "device_id";

    public static string GetOrCreateDeviceId()
    {
        if (!string.IsNullOrEmpty(_deviceId))
            return _deviceId;

        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "QueenMama");

        Directory.CreateDirectory(appDataPath);

        var deviceIdPath = Path.Combine(appDataPath, DeviceIdFileName);

        if (File.Exists(deviceIdPath))
        {
            _deviceId = File.ReadAllText(deviceIdPath).Trim();
            if (!string.IsNullOrEmpty(_deviceId))
                return _deviceId;
        }

        _deviceId = Guid.NewGuid().ToString();
        File.WriteAllText(deviceIdPath, _deviceId);

        return _deviceId;
    }
}

// MARK: - Auth Errors

public class AuthException : Exception
{
    public AuthErrorType ErrorType { get; }

    public AuthException(AuthErrorType errorType, string? message = null)
        : base(message ?? GetDefaultMessage(errorType))
    {
        ErrorType = errorType;
    }

    public AuthException(AuthErrorType errorType, Exception innerException)
        : base(GetDefaultMessage(errorType), innerException)
    {
        ErrorType = errorType;
    }

    private static string GetDefaultMessage(AuthErrorType errorType) => errorType switch
    {
        AuthErrorType.NotAuthenticated => "Please sign in to continue",
        AuthErrorType.InvalidCredentials => "Invalid email or password",
        AuthErrorType.AccountBlocked => "Your account has been blocked",
        AuthErrorType.OAuthUserNeedsDeviceCode => "Please use the device code flow to sign in",
        AuthErrorType.DeviceLimitReached => "Maximum device limit reached",
        AuthErrorType.NetworkError => "Network error occurred",
        AuthErrorType.ServerError => "Server error occurred",
        AuthErrorType.TokenExpired => "Session expired. Please sign in again.",
        AuthErrorType.InvalidToken => "Invalid session. Please sign in again.",
        _ => "An authentication error occurred"
    };
}

public enum AuthErrorType
{
    NotAuthenticated,
    InvalidCredentials,
    AccountBlocked,
    OAuthUserNeedsDeviceCode,
    DeviceLimitReached,
    NetworkError,
    ServerError,
    TokenExpired,
    InvalidToken
}
