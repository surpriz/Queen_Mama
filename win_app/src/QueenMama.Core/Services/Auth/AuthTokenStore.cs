using System.Text.Json;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Models;

namespace QueenMama.Core.Services.Auth;

/// <summary>
/// Secure token storage service
/// - Access token: stored in memory (short-lived)
/// - Refresh token: stored in Windows Credential Manager (long-lived)
/// - User info: stored encrypted with DPAPI
/// </summary>
public class AuthTokenStore : IAuthTokenStore
{
    private readonly ICredentialManager _credentialManager;
    private readonly ISecureStorage _secureStorage;
    private readonly ILogger<AuthTokenStore> _logger;

    private const string RefreshTokenKey = "refresh_token";
    private const string UserInfoKey = "user_info";
    private const string TokenExpiryKey = "token_expiry";

    // In-memory storage for access token
    private string? _accessToken;
    private DateTime? _accessTokenExpiry;

    public AuthTokenStore(
        ICredentialManager credentialManager,
        ISecureStorage secureStorage,
        ILogger<AuthTokenStore> logger)
    {
        _credentialManager = credentialManager;
        _secureStorage = secureStorage;
        _logger = logger;
    }

    public string? AccessToken
    {
        get
        {
            if (_accessToken == null || _accessTokenExpiry == null)
                return null;

            // Return null if token is expired
            if (_accessTokenExpiry <= DateTime.UtcNow)
                return null;

            return _accessToken;
        }
        private set => _accessToken = value;
    }

    public DateTime? AccessTokenExpiry
    {
        get => _accessTokenExpiry;
        private set => _accessTokenExpiry = value;
    }

    public bool IsAccessTokenValid
    {
        get
        {
            if (_accessTokenExpiry == null)
                return false;

            // Consider token expired 60 seconds early to avoid edge cases
            return _accessTokenExpiry.Value.AddSeconds(-60) > DateTime.UtcNow;
        }
    }

    public async Task<string?> GetRefreshTokenAsync()
    {
        return await _credentialManager.GetCredentialAsync(RefreshTokenKey);
    }

    public async Task SetRefreshTokenAsync(string? token)
    {
        if (token != null)
        {
            await _credentialManager.SaveCredentialAsync(RefreshTokenKey, token);
        }
        else
        {
            await _credentialManager.DeleteCredentialAsync(RefreshTokenKey);
        }
    }

    public async Task<User?> GetStoredUserAsync()
    {
        var data = await _secureStorage.LoadSecureAsync(UserInfoKey);
        if (data == null)
            return null;

        try
        {
            var json = System.Text.Encoding.UTF8.GetString(data);
            return JsonSerializer.Deserialize<User>(json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize stored user");
            return null;
        }
    }

    public async Task SetStoredUserAsync(User? user)
    {
        if (user != null)
        {
            var json = JsonSerializer.Serialize(user);
            var data = System.Text.Encoding.UTF8.GetBytes(json);
            await _secureStorage.SaveSecureAsync(UserInfoKey, data);
        }
        else
        {
            await _secureStorage.DeleteSecureAsync(UserInfoKey);
        }
    }

    public async Task<DateTime?> GetStoredTokenExpiryAsync()
    {
        var data = await _secureStorage.LoadSecureAsync(TokenExpiryKey);
        if (data == null)
            return null;

        try
        {
            var str = System.Text.Encoding.UTF8.GetString(data);
            return DateTime.Parse(str);
        }
        catch
        {
            return null;
        }
    }

    public async Task SetStoredTokenExpiryAsync(DateTime? expiry)
    {
        if (expiry != null)
        {
            var str = expiry.Value.ToString("O");
            var data = System.Text.Encoding.UTF8.GetBytes(str);
            await _secureStorage.SaveSecureAsync(TokenExpiryKey, data);
        }
        else
        {
            await _secureStorage.DeleteSecureAsync(TokenExpiryKey);
        }
    }

    public async Task SaveTokensAsync(string accessToken, string refreshToken, DateTime expiresAt)
    {
        _accessToken = accessToken;
        _accessTokenExpiry = expiresAt;

        await SetRefreshTokenAsync(refreshToken);
        await SetStoredTokenExpiryAsync(expiresAt);

        _logger.LogDebug("Tokens saved, expires at {ExpiresAt}", expiresAt);
    }

    public async Task<(string? accessToken, string? refreshToken, DateTime? expiresAt)> GetTokensAsync()
    {
        var refreshToken = await GetRefreshTokenAsync();
        var expiresAt = await GetStoredTokenExpiryAsync();
        return (AccessToken, refreshToken, expiresAt);
    }

    public async Task ClearTokensAsync()
    {
        _accessToken = null;
        _accessTokenExpiry = null;

        await SetRefreshTokenAsync(null);
        await SetStoredUserAsync(null);
        await SetStoredTokenExpiryAsync(null);

        _logger.LogInformation("All tokens cleared");
    }

    public async Task<bool> HasStoredCredentialsAsync()
    {
        var refreshToken = await GetRefreshTokenAsync();
        var user = await GetStoredUserAsync();
        return refreshToken != null && user != null;
    }

    public async Task StoreTokensAndUserAsync(AuthTokens tokens, User user)
    {
        _accessToken = tokens.AccessToken;
        _accessTokenExpiry = tokens.ExpiresAt;

        await SetRefreshTokenAsync(tokens.RefreshToken);
        await SetStoredUserAsync(user);
        await SetStoredTokenExpiryAsync(tokens.ExpiresAt);

        _logger.LogInformation("Tokens and user info stored for {Email}", user.Email);
    }

    public void SetAccessToken(string accessToken, DateTime expiresAt)
    {
        _accessToken = accessToken;
        _accessTokenExpiry = expiresAt;
    }
}
