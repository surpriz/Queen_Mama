using System.Windows;
using QueenMama.App.ViewModels;

namespace QueenMama.App.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    protected override void OnClosed(EventArgs e)
    {
        // Hide to tray instead of closing
        Hide();
        e.Handled = true;
    }
}
