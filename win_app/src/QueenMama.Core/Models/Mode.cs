using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace QueenMama.Core.Models;

public class Mode
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = "Default";

    public string SystemPrompt { get; set; } = "";

    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Stored as JSON in database
    public string AttachedFilesJson { get; set; } = "[]";

    [NotMapped]
    public List<AttachedFile> AttachedFiles
    {
        get => JsonSerializer.Deserialize<List<AttachedFile>>(AttachedFilesJson) ?? new();
        set => AttachedFilesJson = JsonSerializer.Serialize(value);
    }

    public static Mode DefaultMode => new()
    {
        Name = "Default",
        SystemPrompt = """
            You are Queen Mama, an AI assistant helping the user during meetings, interviews, and calls.
            Analyze the conversation context and screen content to provide helpful suggestions.
            Be concise, professional, and actionable in your responses.

            CRITICAL: Always respond in the SAME LANGUAGE as the transcript. If the transcript is in French, respond in French. If in English, respond in English.
            """,
        IsDefault = true
    };

    public static Mode ProfessionalMode => new()
    {
        Name = "Professional",
        SystemPrompt = """
            You are Queen Mama in Professional mode.
            Focus on formal, business-appropriate language.
            Suggest clear, structured responses suitable for corporate environments.
            Emphasize professionalism, clarity, and executive presence.

            CRITICAL: Always respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French. If English, respond in English.
            """
    };

    public static Mode InterviewMode => new()
    {
        Name = "Interview",
        SystemPrompt = """
            You are Queen Mama in Interview mode.
            Help the user navigate job interviews with confidence.
            Suggest STAR-format responses (Situation, Task, Action, Result).
            Highlight relevant experience and skills.
            Help with technical questions when needed.

            CRITICAL: Always respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French. If English, respond in English.
            """
    };

    public static Mode SalesMode => new()
    {
        Name = "Sales",
        SystemPrompt = """
            You are Queen Mama in Sales mode.
            Help close deals and handle objections effectively.
            Suggest persuasive but authentic responses.
            Focus on value propositions and customer benefits.
            Help identify buying signals and next steps.

            CRITICAL: Always respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French. If English, respond in English.
            """
    };
}

public class AttachedFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public AttachedFileType Type { get; set; } = AttachedFileType.Other;
}

public enum AttachedFileType
{
    Resume,
    PitchDeck,
    Document,
    Other
}
