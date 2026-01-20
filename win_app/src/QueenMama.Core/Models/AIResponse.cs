using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace QueenMama.Core.Models;

public class AIResponse
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public ResponseType Type { get; set; } = ResponseType.Assist;

    public string Content { get; set; } = "";

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public AIProviderType Provider { get; set; } = AIProviderType.OpenAI;

    public int? LatencyMs { get; set; }

    public bool IsAutomatic { get; set; }

    public Guid? SessionId { get; set; }

    [ForeignKey(nameof(SessionId))]
    public virtual Session? Session { get; set; }

    public static AIResponse CreateAutomatic(ResponseType type, string content, AIProviderType provider)
    {
        return new AIResponse
        {
            Type = type,
            Content = content,
            Provider = provider,
            IsAutomatic = true
        };
    }
}

public enum ResponseType
{
    Assist,
    WhatToSay,
    FollowUp,
    Recap,
    Custom
}

public enum AIProviderType
{
    Anthropic,
    Grok,
    OpenAI,
    Gemini,
    Proxy
}

public static class ResponseTypeExtensions
{
    public static string GetDisplayName(this ResponseType type) => type switch
    {
        ResponseType.Assist => "Assist",
        ResponseType.WhatToSay => "What should I say?",
        ResponseType.FollowUp => "Follow-up questions",
        ResponseType.Recap => "Recap",
        ResponseType.Custom => "Custom",
        _ => type.ToString()
    };

    public static string GetIcon(this ResponseType type) => type switch
    {
        ResponseType.Assist => "\uE9D9",      // Sparkle
        ResponseType.WhatToSay => "\uE8BD",   // Chat
        ResponseType.FollowUp => "\uE8C8",    // Help
        ResponseType.Recap => "\uE72C",       // Refresh
        ResponseType.Custom => "\uE8F2",      // Edit
        _ => "\uE8BD"
    };

    public static string GetSystemPromptAddition(this ResponseType type)
    {
        const string languageInstruction = "\n\nIMPORTANT: Respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French.";

        return type switch
        {
            ResponseType.Assist => """
                Provide general guidance and help understanding the current conversation or screen content.
                Analyze both the transcript (if available) and screen content to give contextual advice.
                Be helpful but concise.
                """ + languageInstruction,

            ResponseType.WhatToSay => """
                Generate specific phrases the user can say right now.
                Provide 2-3 natural, conversational options.
                Each suggestion should be ready to use verbatim.
                Format as a numbered list.
                """ + languageInstruction,

            ResponseType.FollowUp => """
                Suggest 3-5 follow-up questions the user could ask.
                Questions should be relevant to the current conversation or screen content.
                Make them open-ended to encourage discussion.
                Format as a numbered list.
                """ + languageInstruction,

            ResponseType.Recap => """
                Provide a concise summary of the conversation or screen content so far.
                Include:
                - Key points discussed or visible
                - Decisions made
                - Action items identified
                - Any important details mentioned
                Format with clear sections.
                """ + languageInstruction,

            ResponseType.Custom => languageInstruction,
            _ => languageInstruction
        };
    }
}

public static class AIProviderTypeExtensions
{
    public static string GetDisplayName(this AIProviderType provider) => provider switch
    {
        AIProviderType.Anthropic => "Anthropic",
        AIProviderType.Grok => "xAI Grok",
        AIProviderType.OpenAI => "OpenAI",
        AIProviderType.Gemini => "Google Gemini",
        AIProviderType.Proxy => "Queen Mama Proxy",
        _ => provider.ToString()
    };
}
