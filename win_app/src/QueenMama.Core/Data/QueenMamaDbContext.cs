using Microsoft.EntityFrameworkCore;
using QueenMama.Core.Models;
using SessionModel = QueenMama.Core.Models.Session;

namespace QueenMama.Core.Data;

public class QueenMamaDbContext : DbContext
{
    public DbSet<SessionModel> Sessions => Set<SessionModel>();
    public DbSet<TranscriptEntry> TranscriptEntries => Set<TranscriptEntry>();
    public DbSet<Mode> Modes => Set<Mode>();
    public DbSet<AIResponse> AIResponses => Set<AIResponse>();

    private readonly string _dbPath;

    public QueenMamaDbContext()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "QueenMama");
        Directory.CreateDirectory(appDataPath);
        _dbPath = Path.Combine(appDataPath, "queenmama.db");
    }

    public QueenMamaDbContext(DbContextOptions<QueenMamaDbContext> options)
        : base(options)
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "QueenMama");
        Directory.CreateDirectory(appDataPath);
        _dbPath = Path.Combine(appDataPath, "queenmama.db");
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            optionsBuilder.UseSqlite($"Data Source={_dbPath}");
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Session configuration
        modelBuilder.Entity<SessionModel>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(200);

            // Store ActionItems as JSON
            entity.Property(e => e.ActionItems)
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>()
                );

            entity.HasMany(e => e.Entries)
                .WithOne(e => e.Session)
                .HasForeignKey(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.Responses)
                .WithOne(e => e.Session)
                .HasForeignKey(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // TranscriptEntry configuration
        modelBuilder.Entity<TranscriptEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Speaker).HasMaxLength(100);
        });

        // Mode configuration
        modelBuilder.Entity<Mode>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100);
        });

        // AIResponse configuration
        modelBuilder.Entity<AIResponse>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Type)
                .HasConversion<string>();
            entity.Property(e => e.Provider)
                .HasConversion<string>();
        });

        // Seed default modes
        SeedDefaultModes(modelBuilder);
    }

    private static void SeedDefaultModes(ModelBuilder modelBuilder)
    {
        var defaultModeId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var professionalModeId = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var interviewModeId = Guid.Parse("00000000-0000-0000-0000-000000000003");
        var salesModeId = Guid.Parse("00000000-0000-0000-0000-000000000004");

        modelBuilder.Entity<Mode>().HasData(
            new Mode
            {
                Id = defaultModeId,
                Name = "Default",
                SystemPrompt = """
                    You are Queen Mama, an AI assistant helping the user during meetings, interviews, and calls.
                    Analyze the conversation context and screen content to provide helpful suggestions.
                    Be concise, professional, and actionable in your responses.

                    CRITICAL: Always respond in the SAME LANGUAGE as the transcript. If the transcript is in French, respond in French. If in English, respond in English.
                    """,
                IsDefault = true,
                CreatedAt = DateTime.UtcNow,
                AttachedFilesJson = "[]"
            },
            new Mode
            {
                Id = professionalModeId,
                Name = "Professional",
                SystemPrompt = """
                    You are Queen Mama in Professional mode.
                    Focus on formal, business-appropriate language.
                    Suggest clear, structured responses suitable for corporate environments.
                    Emphasize professionalism, clarity, and executive presence.

                    CRITICAL: Always respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French. If English, respond in English.
                    """,
                IsDefault = false,
                CreatedAt = DateTime.UtcNow,
                AttachedFilesJson = "[]"
            },
            new Mode
            {
                Id = interviewModeId,
                Name = "Interview",
                SystemPrompt = """
                    You are Queen Mama in Interview mode.
                    Help the user navigate job interviews with confidence.
                    Suggest STAR-format responses (Situation, Task, Action, Result).
                    Highlight relevant experience and skills.
                    Help with technical questions when needed.

                    CRITICAL: Always respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French. If English, respond in English.
                    """,
                IsDefault = false,
                CreatedAt = DateTime.UtcNow,
                AttachedFilesJson = "[]"
            },
            new Mode
            {
                Id = salesModeId,
                Name = "Sales",
                SystemPrompt = """
                    You are Queen Mama in Sales mode.
                    Help close deals and handle objections effectively.
                    Suggest persuasive but authentic responses.
                    Focus on value propositions and customer benefits.
                    Help identify buying signals and next steps.

                    CRITICAL: Always respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French. If English, respond in English.
                    """,
                IsDefault = false,
                CreatedAt = DateTime.UtcNow,
                AttachedFilesJson = "[]"
            }
        );
    }
}
