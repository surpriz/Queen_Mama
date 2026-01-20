using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;

namespace QueenMama.Core.Services.Storage;

/// <summary>
/// Secure storage using Windows DPAPI (Data Protection API)
/// Replaces macOS SecureStorage functionality
/// </summary>
public class SecureStorage : ISecureStorage
{
    private readonly ILogger<SecureStorage> _logger;
    private readonly string _storagePath;

    public SecureStorage(ILogger<SecureStorage> logger)
    {
        _logger = logger;
        _storagePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "QueenMama", "secure");
        Directory.CreateDirectory(_storagePath);
    }

    public byte[] Encrypt(byte[] data)
    {
        try
        {
            return ProtectedData.Protect(data, null, DataProtectionScope.CurrentUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to encrypt data");
            throw;
        }
    }

    public byte[] Decrypt(byte[] data)
    {
        try
        {
            return ProtectedData.Unprotect(data, null, DataProtectionScope.CurrentUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to decrypt data");
            throw;
        }
    }

    public async Task SaveSecureAsync(string key, byte[] data)
    {
        var filePath = GetFilePath(key);

        try
        {
            var encryptedData = Encrypt(data);
            await File.WriteAllBytesAsync(filePath, encryptedData);
            _logger.LogDebug("Saved secure data for key {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save secure data for key {Key}", key);
            throw;
        }
    }

    public async Task<byte[]?> LoadSecureAsync(string key)
    {
        var filePath = GetFilePath(key);

        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Secure data not found for key {Key}", key);
            return null;
        }

        try
        {
            var encryptedData = await File.ReadAllBytesAsync(filePath);
            var data = Decrypt(encryptedData);
            _logger.LogDebug("Loaded secure data for key {Key}", key);
            return data;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load secure data for key {Key}", key);
            return null;
        }
    }

    public Task DeleteSecureAsync(string key)
    {
        var filePath = GetFilePath(key);

        try
        {
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                _logger.LogDebug("Deleted secure data for key {Key}", key);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete secure data for key {Key}", key);
        }

        return Task.CompletedTask;
    }

    private string GetFilePath(string key)
    {
        // Sanitize key for file name
        var safeKey = Convert.ToBase64String(Encoding.UTF8.GetBytes(key))
            .Replace('/', '_')
            .Replace('+', '-');
        return Path.Combine(_storagePath, $"{safeKey}.bin");
    }
}
