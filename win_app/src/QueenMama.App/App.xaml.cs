using System.Windows;
using Hardcodet.NotifyIcon.Wpf;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using QueenMama.App.Services;
using QueenMama.App.ViewModels;
using QueenMama.App.Views;
using QueenMama.App.Views.Overlay;
using QueenMama.Core.Data;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Services.AI;
using QueenMama.Core.Services.Audio;
using QueenMama.Core.Services.Auth;
using QueenMama.Core.Services.License;
using QueenMama.Core.Services.Screen;
using QueenMama.Core.Services.Storage;
using QueenMama.Core.Services.Transcription;
using Serilog;

namespace QueenMama.App;

public partial class App : Application
{
    private TaskbarIcon? _taskbarIcon;
    private IServiceProvider? _serviceProvider;
    private HotkeyManager? _hotkeyManager;

    public static IServiceProvider Services => ((App)Current)._serviceProvider!;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Configure Serilog
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .WriteTo.Console()
            .WriteTo.File(
                Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "QueenMama", "logs", "queenmama-.log"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7)
            .CreateLogger();

        // Configure services
        var services = new ServiceCollection();
        ConfigureServices(services);
        _serviceProvider = services.BuildServiceProvider();

        // Initialize database
        InitializeDatabase();

        // Setup system tray
        _taskbarIcon = (TaskbarIcon)FindResource("SystemTrayIcon");
        _taskbarIcon.DataContext = _serviceProvider.GetRequiredService<SystemTrayViewModel>();

        // Setup global hotkeys
        _hotkeyManager = _serviceProvider.GetRequiredService<HotkeyManager>();

        Log.Information("Queen Mama started");
    }

    private void ConfigureServices(IServiceCollection services)
    {
        // Logging
        services.AddLogging(builder =>
        {
            builder.ClearProviders();
            builder.AddSerilog(Log.Logger);
        });

        // Database
        services.AddDbContext<QueenMamaDbContext>();

        // Core Services
        services.AddSingleton<ICredentialManager, CredentialManager>();
        services.AddSingleton<ISecureStorage, SecureStorage>();
        services.AddSingleton<IAuthTokenStore, AuthTokenStore>();
        services.AddSingleton<IAuthApiClient, AuthApiClient>();
        services.AddSingleton<IAuthenticationManager, AuthenticationManager>();
        services.AddSingleton<ILicenseManager, LicenseManager>();

        // Audio & Transcription
        services.AddSingleton<IAudioCaptureService, AudioCaptureService>();
        services.AddSingleton<ITranscriptionService, TranscriptionService>();
        services.AddSingleton<ITranscriptionProvider, DeepgramProvider>();

        // AI
        services.AddSingleton<IAIService, AIService>();
        services.AddSingleton<IProxyAIProvider, ProxyAIProvider>();

        // Screen Capture
        services.AddSingleton<IScreenCaptureService, ScreenCaptureService>();

        // App Services
        services.AddSingleton<HotkeyManager>();
        services.AddSingleton<OverlayManager>();

        // HttpClient
        services.AddHttpClient();

        // ViewModels
        services.AddTransient<MainViewModel>();
        services.AddTransient<DashboardViewModel>();
        services.AddTransient<SettingsViewModel>();
        services.AddTransient<OverlayViewModel>();
        services.AddTransient<SystemTrayViewModel>();
        services.AddTransient<SessionListViewModel>();
        services.AddTransient<LiveSessionViewModel>();
        services.AddTransient<ModesListViewModel>();
    }

    private void InitializeDatabase()
    {
        using var scope = _serviceProvider!.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<QueenMamaDbContext>();
        dbContext.Database.EnsureCreated();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _hotkeyManager?.Dispose();
        _taskbarIcon?.Dispose();
        Log.CloseAndFlush();
        base.OnExit(e);
    }

    public void ShowMainWindow()
    {
        if (MainWindow == null)
        {
            MainWindow = new MainWindow
            {
                DataContext = _serviceProvider!.GetRequiredService<MainViewModel>()
            };
        }

        MainWindow.Show();
        MainWindow.Activate();
    }

    public void Quit()
    {
        _taskbarIcon?.Dispose();
        Shutdown();
    }
}
