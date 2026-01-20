namespace QueenMama.Core.Interfaces;

public interface ICredentialManager
{
    Task SaveCredentialAsync(string key, string value);
    Task<string?> GetCredentialAsync(string key);
    Task DeleteCredentialAsync(string key);
    Task<bool> HasCredentialAsync(string key);
}

public interface ISecureStorage
{
    byte[] Encrypt(byte[] data);
    byte[] Decrypt(byte[] data);
    Task SaveSecureAsync(string key, byte[] data);
    Task<byte[]?> LoadSecureAsync(string key);
    Task DeleteSecureAsync(string key);
}

public static class CredentialKeys
{
    public const string AccessToken = "access_token";
    public const string RefreshToken = "refresh_token";
    public const string TokenExpiry = "token_expiry";
    public const string UserId = "user_id";
    public const string DeepgramApiKey = "deepgram_api_key";
    public const string OpenAIApiKey = "openai_api_key";
    public const string AnthropicApiKey = "anthropic_api_key";
    public const string GeminiApiKey = "gemini_api_key";
}
