using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace QueenMama.Core.Models;

public class Session
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = "New Session";

    public DateTime StartTime { get; set; } = DateTime.UtcNow;

    public DateTime? EndTime { get; set; }

    public string Transcript { get; set; } = "";

    public string? Summary { get; set; }

    public List<string> ActionItems { get; set; } = new();

    public Guid? ModeId { get; set; }

    public virtual ICollection<TranscriptEntry> Entries { get; set; } = new List<TranscriptEntry>();

    public virtual ICollection<AIResponse> Responses { get; set; } = new List<AIResponse>();

    [NotMapped]
    public TimeSpan? Duration => EndTime.HasValue ? EndTime.Value - StartTime : null;

    [NotMapped]
    public string FormattedDuration
    {
        get
        {
            if (!Duration.HasValue)
                return "In progress";

            var minutes = (int)Duration.Value.TotalMinutes;
            var seconds = Duration.Value.Seconds;
            return $"{minutes}:{seconds:D2}";
        }
    }

    [NotMapped]
    public string FormattedDate => StartTime.ToString("g");
}

public class TranscriptEntry
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [MaxLength(100)]
    public string Speaker { get; set; } = "Unknown";

    public string Text { get; set; } = "";

    public bool IsFinal { get; set; }

    public Guid SessionId { get; set; }

    [ForeignKey(nameof(SessionId))]
    public virtual Session? Session { get; set; }

    [NotMapped]
    public string FormattedTimestamp => Timestamp.ToString("T");
}
