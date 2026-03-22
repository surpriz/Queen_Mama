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
    $msiUrl = "https://www.files.certum.eu/software/SimplySignDesktop/SimplySignDesktop-x64.msi"
    Invoke-WebRequest -Uri $msiUrl -OutFile $simplysignMsi -UseBasicParsing
    Start-Process msiexec -ArgumentList "/i `"$simplysignMsi`" /qn /norestart" -Wait -NoNewWindow
    Start-Sleep -Seconds 5

    if (-not (Test-Path $simplysignExe)) {
        # Try alternative install path
        $altPath = "C:\Program Files (x86)\Certum\SimplySign Desktop\SimplySignDesktop.exe"
        if (Test-Path $altPath) {
            $simplysignExe = $altPath
        } else {
            # Search for it
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

# ---------- Launch and authenticate SimplySign Desktop ----------

Write-Host "[certum-auth] Launching SimplySign Desktop..."
$process = Start-Process -FilePath $simplysignExe -PassThru
Start-Sleep -Seconds 8

$wshell = New-Object -ComObject WScript.Shell
$authenticated = $false

for ($attempt = 1; $attempt -le 15; $attempt++) {
    if ($wshell.AppActivate($process.Id)) {
        Write-Host "[certum-auth] Window activated (attempt $attempt), sending credentials..."
        Start-Sleep -Milliseconds 500

        # Send User ID
        $wshell.SendKeys($UserId)
        Start-Sleep -Milliseconds 300
        $wshell.SendKeys("{TAB}")
        Start-Sleep -Milliseconds 300

        # Send TOTP
        $wshell.SendKeys($totp)
        Start-Sleep -Milliseconds 300
        $wshell.SendKeys("{ENTER}")

        $authenticated = $true
        Write-Host "[certum-auth] Credentials sent to SimplySign Desktop"
        break
    }
    Write-Host "[certum-auth] Waiting for SimplySign window... (attempt $attempt/15)"
    Start-Sleep -Seconds 2
}

if (-not $authenticated) {
    throw "[certum-auth] Could not activate SimplySign Desktop window after 15 attempts"
}

# Wait for authentication to complete
Write-Host "[certum-auth] Waiting for authentication to complete..."
Start-Sleep -Seconds 15

Write-Host "[certum-auth] SimplySign authentication complete. Certificate should be available for signtool."
