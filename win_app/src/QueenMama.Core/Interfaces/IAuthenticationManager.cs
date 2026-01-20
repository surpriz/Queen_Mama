using QueenMama.Core.Models;

namespace QueenMama.Core.Interfaces;

public interface IAuthenticationManager
{
    event Action<AuthState>? OnAuthStateChanged;
    event Action<Exception>? OnError;

    AuthState CurrentState { get; }
    User? CurrentUser { get; }
    bool IsAuthenticated { get; }

    Task<DeviceCodeResponse> StartDeviceCodeFlowAsync();
    Task<AuthResult> PollForAuthorizationAsync(string deviceCode, CancellationToken cancellationToken = default);
    Task<bool> RefreshTokenAsync();
    Task SignOutAsync();
    Task<bool> ValidateSessionAsync();
}

public interface IAuthApiClient
{
    Task<DeviceCodeResponse> RequestDeviceCodeAsync();
    Task<AuthResult> PollDeviceCodeAsync(string deviceCode);
    Task<AuthResult> RefreshTokenAsync(string refreshToken);
    Task RevokeTokenAsync(string token);
}

public interface IAuthTokenStore
{
    Task SaveTokensAsync(string accessToken, string refreshToken, DateTime expiresAt);
    Task<(string? accessToken, string? refreshToken, DateTime? expiresAt)> GetTokensAsync();
    Task ClearTokensAsync();
}

public enum AuthState
{
    Unknown,
    SignedOut,
    Authenticating,
    Authenticated,
    TokenExpired,
    Error
}
