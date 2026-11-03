# serve.ps1 - serves the editor folder on http://localhost:8765/ for this computer only.
#
# Why: Chrome and Edge install a web app, and let it run offline, only from a secure
# origin (https, or localhost). Opened as a file, the editor works but cannot be installed.
# Run this once, open the address it prints, click "התקנה" in the editor (or the install
# icon in the address bar). From then on the installed editor starts from its own cache,
# even when this script is not running and there is no network at all.
#
# Keep the same port: the installed app, its folder permission and its cache belong to
# http://localhost:8765. Another port or 127.0.0.1 is a different app for the browser.
#
# Listens on localhost only; nothing is reachable from the network. Serves only the
# editor folder (the lesson files are opened in the editor itself, not over HTTP).

param([int]$Port = 8765, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path)).TrimEnd('\', '/')
$rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.md' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch { Write-Host "Port $Port is busy or blocked: $($_.Exception.Message)"; exit 1 }

$url = "http://localhost:$Port/index.html"
Write-Host "Editor: $url"
Write-Host "Close this window to stop the server."
if (-not $NoBrowser) { Start-Process $url }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '') { $rel = 'index.html' }
      $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if ($ctx.Request.HttpMethod -ne 'GET' -and $ctx.Request.HttpMethod -ne 'HEAD') {
        $res.StatusCode = 405
      } elseif (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $res.StatusCode = 404
      } else {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $res.Headers.Add('X-Content-Type-Options', 'nosniff')
        $bytes = [IO.File]::ReadAllBytes($full)
        $res.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -eq 'GET') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      }
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
