using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Extensions.Logging;
using QueenMama.Core.Interfaces;

namespace QueenMama.Core.Services.Storage;

/// <summary>
/// Windows Credential Manager wrapper for secure credential storage
/// Replaces macOS Keychain functionality
/// </summary>
public class CredentialManager : ICredentialManager
{
    private const string TargetPrefix = "QueenMama:";
    private readonly ILogger<CredentialManager> _logger;

    public CredentialManager(ILogger<CredentialManager> logger)
    {
        _logger = logger;
    }

    public Task SaveCredentialAsync(string key, string value)
    {
        var targetName = $"{TargetPrefix}{key}";

        try
        {
            var credential = new CREDENTIAL
            {
                Type = CRED_TYPE.GENERIC,
                TargetName = targetName,
                CredentialBlobSize = (uint)Encoding.UTF8.GetByteCount(value),
                CredentialBlob = Marshal.StringToCoTaskMemUni(value),
                Persist = CRED_PERSIST.LOCAL_MACHINE,
                UserName = key
            };

            if (!CredWrite(ref credential, 0))
            {
                var error = Marshal.GetLastWin32Error();
                _logger.LogError("Failed to save credential {Key}, error: {Error}", key, error);
                throw new InvalidOperationException($"Failed to save credential: {error}");
            }

            Marshal.FreeCoTaskMem(credential.CredentialBlob);
            _logger.LogDebug("Saved credential {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving credential {Key}", key);
            throw;
        }

        return Task.CompletedTask;
    }

    public Task<string?> GetCredentialAsync(string key)
    {
        var targetName = $"{TargetPrefix}{key}";

        try
        {
            if (!CredRead(targetName, CRED_TYPE.GENERIC, 0, out var credentialPtr))
            {
                var error = Marshal.GetLastWin32Error();
                if (error == ERROR_NOT_FOUND)
                {
                    _logger.LogDebug("Credential {Key} not found", key);
                    return Task.FromResult<string?>(null);
                }

                _logger.LogError("Failed to read credential {Key}, error: {Error}", key, error);
                return Task.FromResult<string?>(null);
            }

            try
            {
                var credential = Marshal.PtrToStructure<CREDENTIAL>(credentialPtr);
                var password = Marshal.PtrToStringUni(credential.CredentialBlob);
                _logger.LogDebug("Retrieved credential {Key}", key);
                return Task.FromResult(password);
            }
            finally
            {
                CredFree(credentialPtr);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading credential {Key}", key);
            return Task.FromResult<string?>(null);
        }
    }

    public Task DeleteCredentialAsync(string key)
    {
        var targetName = $"{TargetPrefix}{key}";

        try
        {
            if (!CredDelete(targetName, CRED_TYPE.GENERIC, 0))
            {
                var error = Marshal.GetLastWin32Error();
                if (error != ERROR_NOT_FOUND)
                {
                    _logger.LogError("Failed to delete credential {Key}, error: {Error}", key, error);
                }
            }
            else
            {
                _logger.LogDebug("Deleted credential {Key}", key);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting credential {Key}", key);
        }

        return Task.CompletedTask;
    }

    public async Task<bool> HasCredentialAsync(string key)
    {
        var value = await GetCredentialAsync(key);
        return value != null;
    }

    #region Native Methods

    private const int ERROR_NOT_FOUND = 1168;

    private enum CRED_TYPE : uint
    {
        GENERIC = 1,
        DOMAIN_PASSWORD = 2,
        DOMAIN_CERTIFICATE = 3,
        DOMAIN_VISIBLE_PASSWORD = 4,
        GENERIC_CERTIFICATE = 5,
        DOMAIN_EXTENDED = 6,
        MAXIMUM = 7,
        MAXIMUM_EX = (MAXIMUM + 1000)
    }

    private enum CRED_PERSIST : uint
    {
        SESSION = 1,
        LOCAL_MACHINE = 2,
        ENTERPRISE = 3
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public CRED_TYPE Type;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string TargetName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public CRED_PERSIST Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string UserName;
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredWrite([In] ref CREDENTIAL userCredential, [In] uint flags);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(string target, CRED_TYPE type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CredDelete(string target, CRED_TYPE type, int flags);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree([In] IntPtr cred);

    #endregion
}
