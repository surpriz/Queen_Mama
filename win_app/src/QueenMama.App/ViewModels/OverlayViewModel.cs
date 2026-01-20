using System.Windows.Media;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using QueenMama.Core.Interfaces;
using QueenMama.Core.Models;
using QueenMama.Core.Services.AI;

namespace QueenMama.App.ViewModels;

public partial class OverlayViewModel : ObservableObject
{
    private readonly IAIService _aiService;
    private readonly ITranscriptionService _transcriptionService;
    private readonly IScreenCaptureService _screenCaptureService;

    [ObservableProperty]
    private bool _isExpanded;

    [ObservableProperty]
    private bool _isCollapsed = true;

    [ObservableProperty]
    private bool _isSessionActive;

    [ObservableProperty]
    private bool _isGenerating;

    [ObservableProperty]
    private string _currentResponse = "";

    [ObservableProperty]
    private float _audioLevel;

    [ObservableProperty]
    private ResponseType _selectedTab = ResponseType.Assist;

    [ObservableProperty]
    private SolidColorBrush _statusColor = new(Colors.Gray);

    public bool IsAssistTab => SelectedTab == ResponseType.Assist;
    public bool IsWhatToSayTab => SelectedTab == ResponseType.WhatToSay;
    public bool IsFollowUpTab => SelectedTab == ResponseType.FollowUp;
    public bool IsRecapTab => SelectedTab == ResponseType.Recap;

    public bool HasResponse => !string.IsNullOrEmpty(CurrentResponse);
    public bool ShowEmptyState => !IsGenerating && !HasResponse;

    public OverlayViewModel(
        IAIService aiService,
        ITranscriptionService transcriptionService,
        IScreenCaptureService screenCaptureService)
    {
        _aiService = aiService;
        _transcriptionService = transcriptionService;
        _screenCaptureService = screenCaptureService;

        // Subscribe to AI service events
        _aiService.OnStreamingChunk += chunk =>
        {
            CurrentResponse += chunk;
            OnPropertyChanged(nameof(HasResponse));
            OnPropertyChanged(nameof(ShowEmptyState));
        };
    }

    partial void OnIsExpandedChanged(bool value)
    {
        IsCollapsed = !value;
    }

    [RelayCommand]
    private void ToggleExpand()
    {
        IsExpanded = !IsExpanded;
    }

    [RelayCommand]
    private void Hide()
    {
        // This will be handled by the overlay manager
    }

    [RelayCommand]
    private async Task Assist()
    {
        SelectedTab = ResponseType.Assist;
        await GenerateResponse(ResponseType.Assist);
    }

    [RelayCommand]
    private async Task WhatToSay()
    {
        SelectedTab = ResponseType.WhatToSay;
        await GenerateResponse(ResponseType.WhatToSay);
    }

    [RelayCommand]
    private async Task FollowUp()
    {
        SelectedTab = ResponseType.FollowUp;
        await GenerateResponse(ResponseType.FollowUp);
    }

    [RelayCommand]
    private async Task Recap()
    {
        SelectedTab = ResponseType.Recap;
        await GenerateResponse(ResponseType.Recap);
    }

    [RelayCommand]
    private void SelectTab(string tab)
    {
        SelectedTab = tab switch
        {
            "Assist" => ResponseType.Assist,
            "WhatToSay" => ResponseType.WhatToSay,
            "FollowUp" => ResponseType.FollowUp,
            "Recap" => ResponseType.Recap,
            _ => ResponseType.Assist
        };

        OnPropertyChanged(nameof(IsAssistTab));
        OnPropertyChanged(nameof(IsWhatToSayTab));
        OnPropertyChanged(nameof(IsFollowUpTab));
        OnPropertyChanged(nameof(IsRecapTab));
    }

    private async Task GenerateResponse(ResponseType type)
    {
        if (IsGenerating || !IsSessionActive)
            return;

        IsGenerating = true;
        CurrentResponse = "";
        OnPropertyChanged(nameof(HasResponse));
        OnPropertyChanged(nameof(ShowEmptyState));

        // Expand to show response
        if (!IsExpanded)
        {
            IsExpanded = true;
        }

        try
        {
            var transcript = _transcriptionService.CurrentTranscript;
            var screenshot = await _screenCaptureService.CaptureScreenshotAsync();

            var context = new AIContext(
                Transcript: transcript,
                ResponseType: type,
                ScreenshotData: screenshot);

            await foreach (var chunk in _aiService.GenerateStreamingResponseAsync(context))
            {
                // Chunks are handled by the event subscription
            }
        }
        catch (Exception ex)
        {
            CurrentResponse = $"Error: {ex.Message}";
        }
        finally
        {
            IsGenerating = false;
            OnPropertyChanged(nameof(HasResponse));
            OnPropertyChanged(nameof(ShowEmptyState));
        }
    }

    public void UpdateSessionState(bool isActive)
    {
        IsSessionActive = isActive;
        StatusColor = isActive
            ? new SolidColorBrush(Color.FromRgb(0x22, 0xC5, 0x5E))  // Green
            : new SolidColorBrush(Colors.Gray);
    }

    public void UpdateAudioLevel(float level)
    {
        AudioLevel = level;
    }

    public void ClearResponse()
    {
        CurrentResponse = "";
        OnPropertyChanged(nameof(HasResponse));
        OnPropertyChanged(nameof(ShowEmptyState));
    }
}
