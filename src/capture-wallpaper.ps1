param([switch]$Capture)

$ErrorActionPreference = 'Stop'

if (-not $Capture) {

    $command = '& $env:WALLPAPER_SYNC_QUERY_SCRIPT -Capture'
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $worker = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') `
        -ArgumentList @('-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) `
        -WindowStyle Hidden -PassThru
    $null = $worker.Handle
    if (-not $worker.WaitForExit(12000)) {
        $worker.Kill()
        throw 'Hidden wallpaper console timed out.'
    }
    if ($null -ne $worker.ExitCode -and $worker.ExitCode -ne 0) { throw "Hidden wallpaper console exited with code $($worker.ExitCode)." }
    exit 0
}

try {
    $raw = $Host.UI.RawUI
    $before = $raw.CursorPosition
    $queryArgs = @('-control', 'getWallpaper')
    $monitor = [int]$env:WALLPAPER_SYNC_QUERY_MONITOR
    if ($monitor -ge 0) { $queryArgs += @('-monitor', [string]$monitor) }

    $query = Start-Process -FilePath $env:WALLPAPER_SYNC_QUERY_EXE `
        -ArgumentList $queryArgs -NoNewWindow -PassThru
    $null = $query.Handle
    if (-not $query.WaitForExit(8000)) {
        $query.Kill()
        throw 'Wallpaper Engine query timed out.'
    }
    if ($null -ne $query.ExitCode -and $query.ExitCode -ne 0) { throw "Wallpaper Engine exited with code $($query.ExitCode)." }

    $after = $raw.CursorPosition
    $size = $raw.BufferSize
    if ($after.Y -lt $before.Y) { throw 'Wallpaper console buffer scrolled unexpectedly.' }
    $rect = New-Object System.Management.Automation.Host.Rectangle(0, $before.Y, ($size.Width - 1), $after.Y)
    $cells = $raw.GetBufferContents($rect)
    $text = New-Object System.Text.StringBuilder
    for ($row = 0; $row -lt $cells.GetLength(0); $row++) {
        $start = 0
        if ($row -eq 0) { $start = $before.X }
        $end = $size.Width
        if ($row -eq ($cells.GetLength(0) - 1)) { $end = $after.X }
        for ($col = $start; $col -lt $end; $col++) {
            $cell = $cells[$row, $col]
            # 中文這種寬字會占兩格，只抓一次就好，不然路徑會重複。
            if ($cell.BufferCellType -ne 'Trailing') { [void]$text.Append($cell.Character) }
        }
    }
    $result = @{ source = $text.ToString().Trim() }
} catch {
    $result = @{ error = $_.Exception.Message }
}

$json = ConvertTo-Json -InputObject $result -Compress
[IO.File]::WriteAllText($env:WALLPAPER_SYNC_QUERY_RESULT, $json, (New-Object Text.UTF8Encoding($false)))
