using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using QueenMama.App.ViewModels;

namespace QueenMama.App.Views.Overlay;

/// <summary>
/// Overlay window that is hidden from screen capture (Windows 10 2004+)
/// Uses SetWindowDisplayAffinity for undetectability
/// </summary>
public partial class OverlayWindow : Window
{
    private const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011;
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    private bool _isUndetectableEnabled = true;

    public OverlayWindow()
    {
        InitializeComponent();

        // Position in bottom-right corner by default
        var workArea = SystemParameters.WorkArea;
        Left = workArea.Right - Width - 20;
        Top = workArea.Bottom - Height - 20;
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);

        var hwnd = new WindowInteropHelper(this).Handle;

        // Exclude from Alt+Tab
        var exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
        SetWindowLong(hwnd, GWL_EXSTYLE, exStyle | WS_EX_TOOLWINDOW);

        // Make undetectable in screen captures (Windows 10 2004+)
        if (_isUndetectableEnabled)
        {
            SetUndetectable(true);
        }
    }

    public void SetUndetectable(bool enabled)
    {
        _isUndetectableEnabled = enabled;

        var hwnd = new WindowInteropHelper(this).Handle;
        if (hwnd == IntPtr.Zero)
            return;

        if (enabled)
        {
            // WDA_EXCLUDEFROMCAPTURE makes the window invisible to screen capture
            // This requires Windows 10 version 2004 (20H1) or later
            var result = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
            if (!result)
            {
                // Fallback: WDA_MONITOR makes window invisible when captured but shows black
                SetWindowDisplayAffinity(hwnd, 0x00000001);
            }
        }
        else
        {
            // WDA_NONE - window is visible to screen capture
            SetWindowDisplayAffinity(hwnd, 0);
        }
    }

    private void Border_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2)
        {
            // Double-click to toggle expand
            if (DataContext is OverlayViewModel vm)
            {
                vm.ToggleExpandCommand.Execute(null);
            }
        }
        else
        {
            // Single click to drag
            DragMove();
        }
    }

    public void Expand()
    {
        var storyboard = (System.Windows.Media.Animation.Storyboard)FindResource("ExpandAnimation");
        storyboard.Begin(this);
    }

    public void Collapse()
    {
        var storyboard = (System.Windows.Media.Animation.Storyboard)FindResource("CollapseAnimation");
        storyboard.Begin(this);
    }

    #region Native Methods

    [DllImport("user32.dll")]
    private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    #endregion
}
