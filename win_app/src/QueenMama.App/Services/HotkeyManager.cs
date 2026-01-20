using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Extensions.Logging;

namespace QueenMama.App.Services;

/// <summary>
/// Global hotkey manager for Windows
/// Maps macOS shortcuts to Windows equivalents
/// </summary>
public class HotkeyManager : IDisposable
{
    private readonly ILogger<HotkeyManager> _logger;
    private IntPtr _windowHandle;
    private HwndSource? _source;
    private bool _disposed;

    // Hotkey IDs
    private const int HOTKEY_START_SESSION = 1;      // Ctrl+Shift+S
    private const int HOTKEY_TOGGLE_OVERLAY = 2;     // Ctrl+\
    private const int HOTKEY_TRIGGER_ASSIST = 3;     // Ctrl+Enter
    private const int HOTKEY_CLEAR_CONTEXT = 4;      // Ctrl+R
    private const int HOTKEY_MOVE_UP = 5;            // Ctrl+Up
    private const int HOTKEY_MOVE_DOWN = 6;          // Ctrl+Down
    private const int HOTKEY_MOVE_LEFT = 7;          // Ctrl+Left
    private const int HOTKEY_MOVE_RIGHT = 8;         // Ctrl+Right

    // Modifiers
    private const uint MOD_CONTROL = 0x0002;
    private const uint MOD_SHIFT = 0x0004;
    private const uint MOD_NOREPEAT = 0x4000;

    // Virtual keys
    private const uint VK_S = 0x53;
    private const uint VK_OEM_5 = 0xDC;  // Backslash key
    private const uint VK_RETURN = 0x0D;
    private const uint VK_R = 0x52;
    private const uint VK_UP = 0x26;
    private const uint VK_DOWN = 0x28;
    private const uint VK_LEFT = 0x25;
    private const uint VK_RIGHT = 0x27;

    // Events
    public event Action? OnStartStopSession;
    public event Action? OnToggleOverlay;
    public event Action? OnTriggerAssist;
    public event Action? OnClearContext;
    public event Action<Direction>? OnMoveOverlay;

    public enum Direction { Up, Down, Left, Right }

    public HotkeyManager(ILogger<HotkeyManager> logger)
    {
        _logger = logger;
    }

    public void Initialize(Window window)
    {
        var helper = new WindowInteropHelper(window);
        _windowHandle = helper.EnsureHandle();

        _source = HwndSource.FromHwnd(_windowHandle);
        _source?.AddHook(WndProc);

        RegisterAllHotkeys();
        _logger.LogInformation("Global hotkeys registered");
    }

    private void RegisterAllHotkeys()
    {
        // Ctrl+Shift+S - Start/Stop Session
        RegisterHotkey(HOTKEY_START_SESSION, MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT, VK_S);

        // Ctrl+\ - Toggle Overlay
        RegisterHotkey(HOTKEY_TOGGLE_OVERLAY, MOD_CONTROL | MOD_NOREPEAT, VK_OEM_5);

        // Ctrl+Enter - Trigger Assist
        RegisterHotkey(HOTKEY_TRIGGER_ASSIST, MOD_CONTROL | MOD_NOREPEAT, VK_RETURN);

        // Ctrl+R - Clear Context
        RegisterHotkey(HOTKEY_CLEAR_CONTEXT, MOD_CONTROL | MOD_NOREPEAT, VK_R);

        // Ctrl+Arrow keys - Move Overlay
        RegisterHotkey(HOTKEY_MOVE_UP, MOD_CONTROL | MOD_NOREPEAT, VK_UP);
        RegisterHotkey(HOTKEY_MOVE_DOWN, MOD_CONTROL | MOD_NOREPEAT, VK_DOWN);
        RegisterHotkey(HOTKEY_MOVE_LEFT, MOD_CONTROL | MOD_NOREPEAT, VK_LEFT);
        RegisterHotkey(HOTKEY_MOVE_RIGHT, MOD_CONTROL | MOD_NOREPEAT, VK_RIGHT);
    }

    private void RegisterHotkey(int id, uint modifiers, uint key)
    {
        if (!RegisterHotKey(_windowHandle, id, modifiers, key))
        {
            var error = Marshal.GetLastWin32Error();
            _logger.LogWarning("Failed to register hotkey {Id}, error: {Error}", id, error);
        }
    }

    private void UnregisterAllHotkeys()
    {
        UnregisterHotKey(_windowHandle, HOTKEY_START_SESSION);
        UnregisterHotKey(_windowHandle, HOTKEY_TOGGLE_OVERLAY);
        UnregisterHotKey(_windowHandle, HOTKEY_TRIGGER_ASSIST);
        UnregisterHotKey(_windowHandle, HOTKEY_CLEAR_CONTEXT);
        UnregisterHotKey(_windowHandle, HOTKEY_MOVE_UP);
        UnregisterHotKey(_windowHandle, HOTKEY_MOVE_DOWN);
        UnregisterHotKey(_windowHandle, HOTKEY_MOVE_LEFT);
        UnregisterHotKey(_windowHandle, HOTKEY_MOVE_RIGHT);
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        const int WM_HOTKEY = 0x0312;

        if (msg == WM_HOTKEY)
        {
            var hotkeyId = wParam.ToInt32();

            switch (hotkeyId)
            {
                case HOTKEY_START_SESSION:
                    _logger.LogDebug("Hotkey: Start/Stop Session");
                    OnStartStopSession?.Invoke();
                    handled = true;
                    break;

                case HOTKEY_TOGGLE_OVERLAY:
                    _logger.LogDebug("Hotkey: Toggle Overlay");
                    OnToggleOverlay?.Invoke();
                    handled = true;
                    break;

                case HOTKEY_TRIGGER_ASSIST:
                    _logger.LogDebug("Hotkey: Trigger Assist");
                    OnTriggerAssist?.Invoke();
                    handled = true;
                    break;

                case HOTKEY_CLEAR_CONTEXT:
                    _logger.LogDebug("Hotkey: Clear Context");
                    OnClearContext?.Invoke();
                    handled = true;
                    break;

                case HOTKEY_MOVE_UP:
                    OnMoveOverlay?.Invoke(Direction.Up);
                    handled = true;
                    break;

                case HOTKEY_MOVE_DOWN:
                    OnMoveOverlay?.Invoke(Direction.Down);
                    handled = true;
                    break;

                case HOTKEY_MOVE_LEFT:
                    OnMoveOverlay?.Invoke(Direction.Left);
                    handled = true;
                    break;

                case HOTKEY_MOVE_RIGHT:
                    OnMoveOverlay?.Invoke(Direction.Right);
                    handled = true;
                    break;
            }
        }

        return IntPtr.Zero;
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;
        UnregisterAllHotkeys();
        _source?.RemoveHook(WndProc);
        _source?.Dispose();

        _logger.LogInformation("Global hotkeys unregistered");
    }

    #region Native Methods

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    #endregion
}
