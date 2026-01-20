using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Models;

namespace QueenMama.Core.Services.Auth;

/// <summary>
/// HTTP client for authentication API endpoints
/// </summary>
public class AuthApiClient : IAuthApiClient
{
    private readonly HttpClient _httpClient;
    private readonly AuthTokenStore _tokenStore;
    private readonly ILogger<AuthApiClient> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public AuthApiClient(
        IHttpClientFactory httpClientFactory,
        IAuthTokenStore tokenStore,
        ILogger<AuthApiClient> logger)
    {
        _httpClient = httpClientFactory.CreateClient("AuthApi");
        _tokenStore = (AuthTokenStore)tokenStore;
        _logger = logger;

        // Configure base URL
#if DEBUG
        var baseUrl = Environment.GetEnvironmentVariable("API_BASE_URL") ?? "http://localhost:3000";
#else
        var baseUrl = Environment.GetEnvironmentVariable("API_BASE_URL") ?? "https://queenmama.app";
#endif
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<DeviceCodeResponse> RequestDeviceCodeAsync()
    {
        var deviceInfo = DeviceInfo.Current();
        var body = new
        {
            deviceId = deviceInfo.DeviceId,
            deviceName = deviceInfo.Name,
            platform = deviceInfo.Platform
        };

        var response = await PostAsync<DeviceCodeResponse>("/api/auth/device/code", body, requiresAuth: false);
        return response;
    }

    public async Task<AuthResult> PollDeviceCodeAsync(string deviceCode)
    {
        var response = await GetAsync<DevicePollResponse>(
            $"/api/auth/device/poll?deviceCode={Uri.EscapeDataString(deviceCode)}",
            requiresAuth: false);

        return AuthResult.FromPollResponse(response);
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken)
    {
        var body = new { refreshToken };

        try
        {
            var response = await PostAsync<RefreshResponse>("/api/auth/macos/refresh", body, requiresAuth: false);

            return new AuthResult
            {
                Success = true,
                AccessToken = response.AccessToken,
                RefreshToken = response.RefreshToken,
                ExpiresAt = DateTime.UtcNow.AddSeconds(response.ExpiresIn)
            };
        }
        catch (AuthException ex)
        {
            return new AuthResult
            {
                Success = false,
                Error = ex.ErrorType.ToString(),
                Message = ex.Message
            };
        }
    }

    public async Task RevokeTokenAsync(string token)
    {
        var body = new { refreshToken = token, allDevices = false };

        try
        {
            await PostAsync<object>("/api/auth/macos/logout", body, requiresAuth: true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to revoke token");
        }
    }

    public async Task<License> ValidateLicenseAsync(string deviceId)
    {
        var body = new { deviceId };
        return await PostAsync<License>("/api/license/validate", body, requiresAuth: true);
    }

    public async Task RecordUsageAsync(string action, string? provider = null, int? tokensUsed = null)
    {
        var body = new Dictionary<string, object>
        {
            ["deviceId"] = DeviceInfo.Current().DeviceId,
            ["action"] = action
        };

        if (provider != null)
            body["provider"] = provider;
        if (tokensUsed != null)
            body["tokensUsed"] = tokensUsed.Value;

        await PostAsync<object>("/api/usage/record", body, requiresAuth: true);
    }

    private async Task<T> GetAsync<T>(string endpoint, bool requiresAuth)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Add("Accept", "application/json");

        if (requiresAuth)
        {
            var token = await GetValidAccessTokenAsync();
            if (token == null)
                throw new AuthException(AuthErrorType.NotAuthenticated);
            request.Headers.Add("Authorization", $"Bearer {token}");
        }

        return await SendRequestAsync<T>(request);
    }

    private async Task<T> PostAsync<T>(string endpoint, object body, bool requiresAuth)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        request.Headers.Add("Accept", "application/json");

        if (requiresAuth)
        {
            var token = await GetValidAccessTokenAsync();
            if (token == null)
                throw new AuthException(AuthErrorType.NotAuthenticated);
            request.Headers.Add("Authorization", $"Bearer {token}");
        }

        return await SendRequestAsync<T>(request);
    }

    private async Task<T> SendRequestAsync<T>(HttpRequestMessage request)
    {
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Network error during request to {Uri}", request.RequestUri);
            throw new AuthException(AuthErrorType.NetworkError, ex);
        }

        var content = await response.Content.ReadAsStringAsync();

        if (response.IsSuccessStatusCode)
        {
            if (typeof(T) == typeof(object) && string.IsNullOrEmpty(content))
                return default!;

            return JsonSerializer.Deserialize<T>(content, JsonOptions)!;
        }

        // Handle error responses
        ErrorResponse? errorResponse = null;
        try
        {
            errorResponse = JsonSerializer.Deserialize<ErrorResponse>(content, JsonOptions);
        }
        catch { }

        throw response.StatusCode switch
        {
            System.Net.HttpStatusCode.Unauthorized when errorResponse?.Error == "oauth_user"
                => new AuthException(AuthErrorType.OAuthUserNeedsDeviceCode),
            System.Net.HttpStatusCode.Unauthorized
                => new AuthException(AuthErrorType.InvalidToken),
            System.Net.HttpStatusCode.Forbidden when errorResponse?.Error == "account_blocked"
                => new AuthException(AuthErrorType.AccountBlocked),
            System.Net.HttpStatusCode.Forbidden when errorResponse?.Error == "device_limit"
                => new AuthException(AuthErrorType.DeviceLimitReached),
            System.Net.HttpStatusCode.Forbidden
                => new AuthException(AuthErrorType.ServerError, errorResponse?.Message ?? "Access denied"),
            _ => new AuthException(AuthErrorType.ServerError, errorResponse?.Message ?? "Request failed")
        };
    }

    private async Task<string?> GetValidAccessTokenAsync()
    {
        // Check if we have a valid access token
        if (_tokenStore.IsAccessTokenValid && _tokenStore.AccessToken != null)
        {
            return _tokenStore.AccessToken;
        }

        // Try to refresh
        var refreshToken = await _tokenStore.GetRefreshTokenAsync();
        if (refreshToken == null)
            return null;

        try
        {
            var result = await RefreshTokenAsync(refreshToken);
            if (result.Success && result.AccessToken != null)
            {
                _tokenStore.SetAccessToken(result.AccessToken, result.ExpiresAt ?? DateTime.UtcNow.AddHours(1));
                if (result.RefreshToken != null)
                {
                    await _tokenStore.SetRefreshTokenAsync(result.RefreshToken);
                }
                return result.AccessToken;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Token refresh failed");
        }

        return null;
    }

    private class ErrorResponse
    {
        public string? Error { get; set; }
        public string? Message { get; set; }
    }
}
