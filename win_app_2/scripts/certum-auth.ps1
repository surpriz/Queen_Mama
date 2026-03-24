# certum-auth.ps1
# Installs SimplySign Desktop, generates TOTP, and authenticates for code signing.
#
# Required env vars:
#   CERTUM_OTP_URI  - Full otpauth:// URI from Certum
#   CERTUM_USERID   - SimplySign login (email)
#
# The TOTP algorithm is read from the URI (SHA256 for Certum EV).

param(
    [string]$OtpUri = $env:CERTUM_OTP_URI,
    [string]$UserId = $env:CERTUM_USERID
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------- TOTP Generation (C#) ----------

Add-Type -Language CSharp @"
using System;
using System.Security.Cryptography;

public static class TotpGenerator {
    private static byte[] Base32Decode(string base32) {
        base32 = base32.TrimEnd('=').ToUpperInvariant();
        int byteCount = base32.Length * 5 / 8;
        byte[] result = new byte[byteCount];
        byte curByte = 0;
        int bitsRemaining = 8;
        int arrayIndex = 0;
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        foreach (char c in base32) {
            int cValue = alphabet.IndexOf(c);
            if (cValue < 0) throw new ArgumentException("Invalid Base32 char: " + c);
            if (bitsRemaining > 5) {
                curByte = (byte)(curByte | (cValue << (bitsRemaining - 5)));
                bitsRemaining -= 5;
            } else {
                curByte = (byte)(curByte | (cValue >> (5 - bitsRemaining)));
                result[arrayIndex++] = curByte;
                curByte = (byte)((cValue << (3 + bitsRemaining)) & 0xFF);
                bitsRemaining += 3;
            }
        }
        if (arrayIndex < byteCount) result[arrayIndex] = curByte;
        return result;
    }

    public static string Generate(string base32Secret, int digits, int period, string algorithm) {
        byte[] key = Base32Decode(base32Secret);
        long counter = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds / period;
        byte[] counterBytes = BitConverter.GetBytes(counter);
        if (BitConverter.IsLittleEndian) Array.Reverse(counterBytes);

        byte[] hash;
        if (algorithm == "SHA256") {
            using (var hmac = new HMACSHA256(key)) { hash = hmac.ComputeHash(counterBytes); }
        } else if (algorithm == "SHA512") {
            using (var hmac = new HMACSHA512(key)) { hash = hmac.ComputeHash(counterBytes); }
        } else {
            using (var hmac = new HMACSHA1(key)) { hash = hmac.ComputeHash(counterBytes); }
        }

        int offset = hash[hash.Length - 1] & 0x0F;
        int binary = ((hash[offset] & 0x7F) << 24) |
                     ((hash[offset + 1] & 0xFF) << 16) |
                     ((hash[offset + 2] & 0xFF) << 8) |
                     (hash[offset + 3] & 0xFF);
        int otp = binary % (int)Math.Pow(10, digits);
        return otp.ToString().PadLeft(digits, '0');
    }
}
"@

# ---------- Parse otpauth:// URI ----------

Write-Host "[certum-auth] Parsing OTP URI..."

# Parse manually (System.Uri doesn't handle otpauth well)
$uriMatch = [regex]::Match($OtpUri, 'secret=([A-Z2-7=]+)')
if (-not $uriMatch.Success) { throw "Cannot parse TOTP secret from URI" }
$secret = $uriMatch.Groups[1].Value

$algorithmMatch = [regex]::Match($OtpUri, 'algorithm=(\w+)')
$algorithm = if ($algorithmMatch.Success) { $algorithmMatch.Groups[1].Value } else { "SHA1" }

$digitsMatch = [regex]::Match($OtpUri, 'digits=(\d+)')
$digits = if ($digitsMatch.Success) { [int]$digitsMatch.Groups[1].Value } else { 6 }

$periodMatch = [regex]::Match($OtpUri, 'period=(\d+)')
$period = if ($periodMatch.Success) { [int]$periodMatch.Groups[1].Value } else { 30 }

Write-Host "[certum-auth] TOTP config: algorithm=$algorithm, digits=$digits, period=${period}s"

# ---------- Install SimplySign Desktop ----------

$simplysignExe = "C:\Program Files\Certum\SimplySign Desktop\SimplySignDesktop.exe"
$simplysignMsi = "$env:TEMP\SimplySign.msi"

if (-not (Test-Path $simplysignExe)) {
    Write-Host "[certum-auth] Installing SimplySign Desktop..."

    # Try winget first (version-independent)
    $wingetInstalled = $false
    try {
        $wingetResult = winget install -e --id Certum.SmartSignSimplySignDesktop --silent --accept-source-agreements --accept-package-agreements 2>&1
        Write-Host $wingetResult
        $wingetInstalled = $true
    } catch {
        Write-Host "[certum-auth] winget install failed, falling back to MSI download..."
    }

    if (-not $wingetInstalled) {
        # Fallback: direct MSI download
        $msiUrl = "https://files.certum.eu/software/SimplySignDesktop/Windows/9.3.4.72/SimplySignDesktop-9.3.4.72-64-bit-en.msi"
        Invoke-WebRequest -Uri $msiUrl -OutFile $simplysignMsi -UseBasicParsing
        Start-Process msiexec -ArgumentList "/i `"$simplysignMsi`" /qn /norestart" -Wait -NoNewWindow
    }

    Start-Sleep -Seconds 5

    if (-not (Test-Path $simplysignExe)) {
        # Search common install paths
        $searchPaths = @(
            "C:\Program Files\Certum\SimplySign Desktop\SimplySignDesktop.exe",
            "C:\Program Files (x86)\Certum\SimplySign Desktop\SimplySignDesktop.exe",
            "C:\Program Files\proCertum\SmartSign\SimplySignDesktop.exe",
            "C:\Program Files (x86)\proCertum\SmartSign\SimplySignDesktop.exe"
        )
        foreach ($p in $searchPaths) {
            if (Test-Path $p) { $simplysignExe = $p; break }
        }
        if (-not (Test-Path $simplysignExe)) {
            $found = Get-ChildItem -Path "C:\Program Files*" -Recurse -Filter "SimplySignDesktop.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $simplysignExe = $found.FullName
            } else {
                throw "[certum-auth] SimplySign Desktop not found after installation"
            }
        }
    }
    Write-Host "[certum-auth] SimplySign Desktop installed at: $simplysignExe"
} else {
    Write-Host "[certum-auth] SimplySign Desktop already installed"
}

# ---------- Wait for TOTP window alignment ----------

# Wait until we're in the first half of a TOTP period (avoid expiry during auth)
$epoch = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$remaining = $period - ($epoch % $period)
if ($remaining -lt 10) {
    Write-Host "[certum-auth] Waiting ${remaining}s for next TOTP window..."
    Start-Sleep -Seconds ($remaining + 1)
}

# ---------- Generate TOTP ----------

$totp = [TotpGenerator]::Generate($secret, $digits, $period, $algorithm)
Write-Host "[certum-auth] TOTP generated (${algorithm}, ${digits} digits)"

# ---------- Win32 API for window interaction ----------

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class Win32Window {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    public static List<IntPtr> FindWindowsByPid(uint targetPid) {
        var windows = new List<IntPtr>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == targetPid) {
                var sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                if (sb.Length > 0) {
                    windows.Add(hWnd);
                }
            }
            return true;
        }, IntPtr.Zero);
        return windows;
    }

    public static IntPtr FindWindowByTitle(string partialTitle) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            var sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            if (sb.ToString().IndexOf(partialTitle, StringComparison.OrdinalIgnoreCase) >= 0) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

Add-Type -AssemblyName System.Windows.Forms

# ---------- Launch and authenticate SimplySign Desktop ----------

Write-Host "[certum-auth] Launching SimplySign Desktop..."
$process = Start-Process -FilePath $simplysignExe -PassThru -WindowStyle Normal
Start-Sleep -Seconds 10

Write-Host "[certum-auth] SimplySign PID: $($process.Id)"

# Try multiple methods to find and activate the window
$authenticated = $false

for ($attempt = 1; $attempt -le 20; $attempt++) {
    # Method 1: Find windows by PID using Win32 API
    $windows = [Win32Window]::FindWindowsByPid([uint32]$process.Id)

    if ($windows.Count -gt 0) {
        $hwnd = $windows[0]
        $title = New-Object System.Text.StringBuilder 256
        [Win32Window]::GetWindowText($hwnd, $title, 256) | Out-Null
        Write-Host "[certum-auth] Found window: '$($title.ToString())' (handle: $hwnd)"

        [Win32Window]::ShowWindow($hwnd, [Win32Window]::SW_RESTORE) | Out-Null
        [Win32Window]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 800

        # Send credentials using System.Windows.Forms.SendKeys (more reliable than WScript)
        [System.Windows.Forms.SendKeys]::SendWait($UserId)
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.SendKeys]::SendWait($totp)
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

        $authenticated = $true
        Write-Host "[certum-auth] Credentials sent via Win32 API + SendKeys"
        break
    }

    # Method 2: Try by window title patterns
    $titlePatterns = @("SimplySign", "SmartSign", "proCertum", "Certum", "Login", "Logon")
    foreach ($pattern in $titlePatterns) {
        $hwnd = [Win32Window]::FindWindowByTitle($pattern)
        if ($hwnd -ne [IntPtr]::Zero) {
            $title = New-Object System.Text.StringBuilder 256
            [Win32Window]::GetWindowText($hwnd, $title, 256) | Out-Null
            Write-Host "[certum-auth] Found window by title pattern '$pattern': '$($title.ToString())'"

            [Win32Window]::ShowWindow($hwnd, [Win32Window]::SW_RESTORE) | Out-Null
            [Win32Window]::SetForegroundWindow($hwnd) | Out-Null
            Start-Sleep -Milliseconds 800

            [System.Windows.Forms.SendKeys]::SendWait($UserId)
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait($totp)
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

            $authenticated = $true
            Write-Host "[certum-auth] Credentials sent via title-based window discovery"
            break
        }
    }
    if ($authenticated) { break }

    # Method 3: Fallback to WScript.Shell AppActivate
    try {
        $wshell = New-Object -ComObject WScript.Shell
        if ($wshell.AppActivate($process.Id)) {
            Start-Sleep -Milliseconds 500
            $wshell.SendKeys($UserId)
            $wshell.SendKeys("{TAB}")
            Start-Sleep -Milliseconds 200
            $wshell.SendKeys($totp)
            $wshell.SendKeys("{ENTER}")
            $authenticated = $true
            Write-Host "[certum-auth] Credentials sent via WScript.Shell fallback"
            break
        }
        # Also try by window title
        if ($wshell.AppActivate("SimplySign")) {
            Start-Sleep -Milliseconds 500
            $wshell.SendKeys($UserId)
            $wshell.SendKeys("{TAB}")
            Start-Sleep -Milliseconds 200
            $wshell.SendKeys($totp)
            $wshell.SendKeys("{ENTER}")
            $authenticated = $true
            Write-Host "[certum-auth] Credentials sent via WScript.Shell title match"
            break
        }
    } catch {
        Write-Host "[certum-auth] WScript.Shell attempt failed: $_"
    }

    # Log process info for debugging
    $proc = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "[certum-auth] Attempt $attempt/20 - Process running, MainWindowTitle='$($proc.MainWindowTitle)', MainWindowHandle=$($proc.MainWindowHandle), Responding=$($proc.Responding)"
    } else {
        Write-Host "[certum-auth] WARNING: SimplySign process is no longer running!"
        break
    }

    Start-Sleep -Seconds 3
}

if (-not $authenticated) {
    Write-Host "[certum-auth] WARNING: Could not authenticate SimplySign Desktop after 20 attempts"
    Write-Host "[certum-auth] The build will continue but signing may fail if the certificate is not accessible"
    Write-Host "[certum-auth] Consider using a self-hosted Windows runner for reliable GUI automation"
    # Don't throw - let the build continue, sign.js will skip if signtool fails
}

# Wait for authentication to process
if ($authenticated) {
    Write-Host "[certum-auth] Waiting for authentication to complete..."
    Start-Sleep -Seconds 15
    Write-Host "[certum-auth] SimplySign authentication complete. Certificate should be available for signtool."
} else {
    Write-Host "[certum-auth] Proceeding without SimplySign authentication..."
}
