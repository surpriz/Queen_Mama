using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using QueenMama.App.Services;
using QueenMama.Core.Interfaces;

namespace QueenMama.App.ViewModels;

public partial class SystemTrayViewModel : ObservableObject
{
    private readonly OverlayManager _overlayManager;
    private readonly IAuthenticationManager _authManager;

    [ObservableProperty]
    private bool _isSessionActive;

    [ObservableProperty]
    private string _sessionButtonText = "Start Session";

    public SystemTrayViewModel(
        OverlayManager overlayManager,
        IAuthenticationManager authManager)
    {
        _overlayManager = overlayManager;
        _authManager = authManager;
    }

    [RelayCommand]
    private void StartSession()
    {
        // Toggle session state - actual implementation would be in AppState
        IsSessionActive = !IsSessionActive;
        SessionButtonText = IsSessionActive ? "Stop Session" : "Start Session";
    }

    [RelayCommand]
    private void ToggleOverlay()
    {
        _overlayManager.ToggleOverlay();
    }

    [RelayCommand]
    private void OpenDashboard()
    {
        ((App)Application.Current).ShowMainWindow();
    }

    [RelayCommand]
    private void OpenSettings()
    {
        ((App)Application.Current).ShowMainWindow();
        // Navigate to settings tab
    }

    [RelayCommand]
    private void Quit()
    {
        ((App)Application.Current).Quit();
    }
}
