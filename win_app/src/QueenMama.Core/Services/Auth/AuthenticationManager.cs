using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Models;

namespace QueenMama.Core.Services.Auth;

/// <summary>
/// Main authentication coordinator
/// Manages login flows, token refresh, and authentication state
/// </summary>
public partial class AuthenticationManager : ObservableObject, IAuthenticationManager
{
    private readonly IAuthApiClient _api;
    private readonly AuthTokenStore _tokenStore;
    private readonly ILogger<AuthenticationManager> _logger;

    private CancellationTokenSource? _pollingCts;
    private const int PollingIntervalSeconds = 5;

    public event Action<AuthState>? OnAuthStateChanged;
    public event Action<Exception>? OnError;

    [ObservableProperty]
    private AuthState _currentState = AuthState.Unknown;

    [ObservableProperty]
    private User? _currentUser;

    [ObservableProperty]
    private bool _isAuthenticated;

    public AuthenticationManager(
        IAuthApiClient api,
        IAuthTokenStore tokenStore,
        ILogger<AuthenticationManager> logger)
    {
        _api = api;
        _tokenStore = (AuthTokenStore)tokenStore;
        _logger = logger;
    }

    partial void OnCurrentStateChanged(AuthState value)
    {
        OnAuthStateChanged?.Invoke(value);
    }

    /// <summary>
    /// Check for existing authentication on app launch
    /// </summary>
    public async Task<bool> CheckExistingAuthAsync()
    {
        CurrentState = AuthState.Unknown;

        // Check for stored credentials
        if (!await _tokenStore.HasStoredCredentialsAsync())
        {
            CurrentState = AuthState.SignedOut;
            return false;
        }

        var storedUser = await _tokenStore.GetStoredUserAsync();
        if (storedUser == null)
        {
            CurrentState = AuthState.SignedOut;
            return false;
        }

        // Try to validate/refresh tokens
        try
        {
            if (!_tokenStore.IsAccessTokenValid)
            {
                var refreshToken = await _tokenStore.GetRefreshTokenAsync();
                if (refreshToken == null)
                {
                    throw new AuthException(AuthErrorType.TokenExpired);
                }

                var result = await _api.RefreshTokenAsync(refreshToken);
                if (!result.Success || result.AccessToken == null)
                {
                    throw new AuthException(AuthErrorType.TokenExpired);
                }

                _tokenStore.SetAccessToken(result.AccessToken, result.ExpiresAt ?? DateTime.UtcNow.AddHours(1));
                if (result.RefreshToken != null)
                {
                    await _tokenStore.SetRefreshTokenAsync(result.RefreshToken);
                }
            }

            // Successfully authenticated
            CurrentUser = storedUser;
            IsAuthenticated = true;
            CurrentState = AuthState.Authenticated;

            _logger.LogInformation("Existing auth validated for {Email}", storedUser.Email);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Existing auth validation failed");
            await _tokenStore.ClearTokensAsync();
            CurrentState = AuthState.SignedOut;
            return false;
        }
    }

    /// <summary>
    /// Start the device code flow for OAuth users
    /// </summary>
    public async Task<DeviceCodeResponse> StartDeviceCodeFlowAsync()
    {
        CurrentState = AuthState.Authenticating;

        try
        {
            var response = await _api.RequestDeviceCodeAsync();
            _logger.LogInformation("Device code flow started, user code: {UserCode}", response.UserCode);

            // Start polling in background
            StartPolling(response.DeviceCode, response.ExpiresAt);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start device code flow");
            CurrentState = AuthState.Error;
            OnError?.Invoke(ex);
            throw;
        }
    }

    /// <summary>
    /// Poll for authorization completion
    /// </summary>
    public async Task<AuthResult> PollForAuthorizationAsync(string deviceCode, CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _api.PollDeviceCodeAsync(deviceCode);

            if (result.Success && result.User != null && result.AccessToken != null)
            {
                // Store tokens
                var tokens = new AuthTokens
                {
                    AccessToken = result.AccessToken,
                    RefreshToken = result.RefreshToken ?? "",
                    ExpiresIn = (int)(result.ExpiresAt ?? DateTime.UtcNow.AddHours(1)).Subtract(DateTime.UtcNow).TotalSeconds
                };

                await _tokenStore.StoreTokensAndUserAsync(tokens, result.User);

                // Update state
                CurrentUser = result.User;
                IsAuthenticated = true;
                CurrentState = AuthState.Authenticated;

                _logger.LogInformation("Authentication successful for {Email}", result.User.Email);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Polling failed");
            throw;
        }
    }

    private void StartPolling(string deviceCode, DateTime expiresAt)
    {
        _pollingCts?.Cancel();
        _pollingCts = new CancellationTokenSource();

        _ = Task.Run(async () =>
        {
            while (!_pollingCts.Token.IsCancellationRequested && DateTime.UtcNow < expiresAt)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(PollingIntervalSeconds), _pollingCts.Token);

                    if (_pollingCts.Token.IsCancellationRequested)
                        break;

                    var result = await PollForAuthorizationAsync(deviceCode, _pollingCts.Token);

                    if (result.Success)
                    {
                        return;
                    }

                    // Continue polling if authorization is pending
                    if (result.Error == "authorization_pending")
                    {
                        continue;
                    }

                    // Some other error
                    if (result.Error != null && result.Error != "authorization_pending")
                    {
                        CurrentState = AuthState.Error;
                        OnError?.Invoke(new AuthException(AuthErrorType.ServerError, result.Message));
                        return;
                    }
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Polling error, continuing...");
                }
            }

            // Expired without authorization
            if (!_pollingCts.Token.IsCancellationRequested && CurrentState != AuthState.Authenticated)
            {
                CurrentState = AuthState.Error;
                OnError?.Invoke(new AuthException(AuthErrorType.ServerError, "Device code expired. Please try again."));
            }
        });
    }

    /// <summary>
    /// Cancel the device code flow
    /// </summary>
    public void CancelDeviceCodeFlow()
    {
        _pollingCts?.Cancel();
        _pollingCts = null;
        CurrentState = AuthState.SignedOut;
    }

    /// <summary>
    /// Refresh the access token
    /// </summary>
    public async Task<bool> RefreshTokenAsync()
    {
        var refreshToken = await _tokenStore.GetRefreshTokenAsync();
        if (refreshToken == null)
        {
            _logger.LogWarning("No refresh token available");
            return false;
        }

        try
        {
            var result = await _api.RefreshTokenAsync(refreshToken);
            if (result.Success && result.AccessToken != null)
            {
                _tokenStore.SetAccessToken(result.AccessToken, result.ExpiresAt ?? DateTime.UtcNow.AddHours(1));
                if (result.RefreshToken != null)
                {
                    await _tokenStore.SetRefreshTokenAsync(result.RefreshToken);
                }
                return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Token refresh failed");
        }

        return false;
    }

    /// <summary>
    /// Sign out from current device
    /// </summary>
    public async Task SignOutAsync()
    {
        _pollingCts?.Cancel();

        var refreshToken = await _tokenStore.GetRefreshTokenAsync();
        if (refreshToken != null)
        {
            try
            {
                await _api.RevokeTokenAsync(refreshToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to revoke token on server");
            }
        }

        await _tokenStore.ClearTokensAsync();
        CurrentUser = null;
        IsAuthenticated = false;
        CurrentState = AuthState.SignedOut;

        _logger.LogInformation("User signed out");
    }

    /// <summary>
    /// Validate the current session
    /// </summary>
    public async Task<bool> ValidateSessionAsync()
    {
        if (!IsAuthenticated)
            return false;

        if (_tokenStore.IsAccessTokenValid)
            return true;

        return await RefreshTokenAsync();
    }

    /// <summary>
    /// Get a valid access token
    /// </summary>
    public async Task<string?> GetAccessTokenAsync()
    {
        if (_tokenStore.IsAccessTokenValid && _tokenStore.AccessToken != null)
        {
            return _tokenStore.AccessToken;
        }

        if (await RefreshTokenAsync())
        {
            return _tokenStore.AccessToken;
        }

        return null;
    }
}
