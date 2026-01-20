using Microsoft.Extensions.Logging;
using QueenMama.App.ViewModels;
using QueenMama.App.Views.Overlay;

namespace QueenMama.App.Services;

/// <summary>
/// Manages the overlay window lifecycle
/// </summary>
public class OverlayManager
{
    private readonly ILogger<OverlayManager> _logger;
    private readonly OverlayViewModel _viewModel;

    private OverlayWindow? _overlayWindow;
    private bool _isVisible;

    public bool IsVisible => _isVisible;

    public OverlayManager(
        ILogger<OverlayManager> logger,
        OverlayViewModel viewModel)
    {
        _logger = logger;
        _viewModel = viewModel;
    }

    public void ShowOverlay()
    {
        if (_overlayWindow == null)
        {
            _overlayWindow = new OverlayWindow
            {
                DataContext = _viewModel
            };
        }

        _overlayWindow.Show();
        _isVisible = true;
        _logger.LogDebug("Overlay shown");
    }

    public void HideOverlay()
    {
        _overlayWindow?.Hide();
        _isVisible = false;
        _logger.LogDebug("Overlay hidden");
    }

    public void ToggleOverlay()
    {
        if (_isVisible)
        {
            HideOverlay();
        }
        else
        {
            ShowOverlay();
        }
    }

    public void SetUndetectable(bool enabled)
    {
        _overlayWindow?.SetUndetectable(enabled);
        _logger.LogInformation("Overlay undetectable mode: {Enabled}", enabled);
    }

    public void MoveOverlay(HotkeyManager.Direction direction, int pixels = 20)
    {
        if (_overlayWindow == null || !_isVisible)
            return;

        switch (direction)
        {
            case HotkeyManager.Direction.Up:
                _overlayWindow.Top -= pixels;
                break;
            case HotkeyManager.Direction.Down:
                _overlayWindow.Top += pixels;
                break;
            case HotkeyManager.Direction.Left:
                _overlayWindow.Left -= pixels;
                break;
            case HotkeyManager.Direction.Right:
                _overlayWindow.Left += pixels;
                break;
        }
    }

    public void Expand()
    {
        _overlayWindow?.Expand();
        _viewModel.IsExpanded = true;
    }

    public void Collapse()
    {
        _overlayWindow?.Collapse();
        _viewModel.IsExpanded = false;
    }
}
