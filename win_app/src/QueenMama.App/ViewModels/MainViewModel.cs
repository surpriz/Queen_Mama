using System.Collections.ObjectModel;
using System.Windows.Media;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using QueenMama.Core.Interfaces;

namespace QueenMama.App.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly IAuthenticationManager _authManager;
    private readonly ILicenseManager _licenseManager;

    [ObservableProperty]
    private object? _currentView;

    [ObservableProperty]
    private NavigationItem? _selectedNavItem;

    [ObservableProperty]
    private string _statusText = "Ready";

    [ObservableProperty]
    private SolidColorBrush _statusColor = new(Colors.Gray);

    [ObservableProperty]
    private string _userName = "Guest";

    [ObservableProperty]
    private string _licenseTier = "Free";

    public ObservableCollection<NavigationItem> NavigationItems { get; } = new()
    {
        new NavigationItem { Title = "Dashboard", Icon = "\uE80F" },
        new NavigationItem { Title = "Sessions", Icon = "\uE8BD" },
        new NavigationItem { Title = "Modes", Icon = "\uE713" },
        new NavigationItem { Title = "History", Icon = "\uE81C" }
    };

    public MainViewModel(
        IAuthenticationManager authManager,
        ILicenseManager licenseManager)
    {
        _authManager = authManager;
        _licenseManager = licenseManager;

        // Subscribe to auth changes
        _authManager.OnAuthStateChanged += OnAuthStateChanged;

        // Set initial state
        UpdateUserInfo();
    }

    private void OnAuthStateChanged(AuthState state)
    {
        UpdateUserInfo();
    }

    private void UpdateUserInfo()
    {
        if (_authManager.IsAuthenticated && _authManager.CurrentUser != null)
        {
            UserName = _authManager.CurrentUser.DisplayName;
            LicenseTier = _licenseManager.CurrentTier.ToString();
        }
        else
        {
            UserName = "Guest";
            LicenseTier = "Free";
        }
    }

    partial void OnSelectedNavItemChanged(NavigationItem? value)
    {
        // Navigate to selected view
        // CurrentView = value?.Title switch { ... };
    }

    [RelayCommand]
    private void OpenSettings()
    {
        // Open settings window
    }
}

public class NavigationItem
{
    public string Title { get; set; } = "";
    public string Icon { get; set; } = "";
}
