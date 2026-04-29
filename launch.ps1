param(
  [switch]$SkipInstall,
  [switch]$SkipDocker,
  [switch]$SkipPrisma
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Logs = Join-Path $Root "logs"
$BackendPidFile = Join-Path $Logs "backend-launch.pid"
$RootEnv = Join-Path $Root ".env"
$BackendEnv = Join-Path $Root "backend\.env"
$BackendEnvExample = Join-Path $Root "backend\.env.example"

function Invoke-Npm {
  param(
    [string[]]$Arguments,
    [string]$WorkingDirectory = $Root
  )

  Push-Location $WorkingDirectory
  try {
    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Test-RequiredFiles {
  param([string[]]$RelativePaths)

  foreach ($RelativePath in $RelativePaths) {
    if (-not (Test-Path (Join-Path $Root $RelativePath))) {
      return $false
    }
  }

  return $true
}

function Install-Dependencies {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string[]]$RequiredFiles
  )

  if (Test-RequiredFiles $RequiredFiles) {
    return
  }

  Write-Host "Installing or repairing $Name dependencies..."
  if (Test-Path (Join-Path $WorkingDirectory "package-lock.json")) {
    Invoke-Npm @("ci") $WorkingDirectory
  } else {
    Invoke-Npm @("install") $WorkingDirectory
  }
}

function Set-DotEnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $Line = "$Key=$Value"
  if (-not (Test-Path $Path)) {
    $Line | Set-Content -Path $Path -Encoding UTF8
    return
  }

  $Lines = Get-Content $Path
  $Matched = $false
  $NextLines = $Lines | ForEach-Object {
    if ($_ -match "^$([regex]::Escape($Key))=") {
      $Matched = $true
      $Line
    } else {
      $_
    }
  }

  if (-not $Matched) {
    $NextLines = @($NextLines) + $Line
  }

  $NextLines | Set-Content -Path $Path -Encoding UTF8
}

function Test-PortAvailable {
  param([int]$Port)

  $Listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return -not $Listener
}

function Get-FreePort {
  param([int]$PreferredPort)

  for ($Port = $PreferredPort; $Port -le ($PreferredPort + 20); $Port++) {
    if (Test-PortAvailable $Port) {
      return $Port
    }
  }

  throw "Could not find a free backend port from $PreferredPort to $($PreferredPort + 20)."
}

function Test-DockerReady {
  try {
    $StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $StartInfo.FileName = "docker.exe"
    $StartInfo.Arguments = "info"
    $StartInfo.RedirectStandardOutput = $true
    $StartInfo.RedirectStandardError = $true
    $StartInfo.UseShellExecute = $false
    $StartInfo.CreateNoWindow = $true

    $Process = [System.Diagnostics.Process]::Start($StartInfo)
    if (-not $Process.WaitForExit(10000)) {
      $Process.Kill()
      return $false
    }

    return $Process.ExitCode -eq 0
  } catch {
    return $false
  }
}

function Invoke-DockerComposeUp {
  for ($Attempt = 1; $Attempt -le 3; $Attempt++) {
    & docker compose up -d
    if ($LASTEXITCODE -eq 0) {
      return
    }

    if ($Attempt -lt 3) {
      Write-Warning "Docker Compose did not start cleanly; retrying in 5 seconds..."
      Start-Sleep -Seconds 5
    }
  }

  throw "docker compose up -d failed after 3 attempts. Open Docker Desktop, wait for it to finish starting, then run npm run launch again."
}

function Test-TcpConnection {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMilliseconds = 1000
  )

  $Client = [System.Net.Sockets.TcpClient]::new()
  try {
    $ConnectTask = $Client.ConnectAsync($HostName, $Port)
    if (-not $ConnectTask.Wait($TimeoutMilliseconds)) {
      return $false
    }

    return $Client.Connected
  } catch {
    return $false
  } finally {
    $Client.Dispose()
  }
}

function Wait-PostgresReady {
  param([int]$TimeoutSeconds = 60)

  $Deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $Deadline) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
      & docker compose exec -T postgres pg_isready -U postgres -d vce_study_tracker *> $null
      if ($LASTEXITCODE -eq 0) {
        return $true
      }
    }

    if (Test-TcpConnection "localhost" 5432 1000) {
      return $true
    }

    Start-Sleep -Seconds 2
  }

  return $false
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [System.Diagnostics.Process]$Process,
    [int]$TimeoutSeconds = 45
  )

  $Deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $Deadline) {
    if ($Process -and $Process.HasExited) {
      return $false
    }

    try {
      $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
      if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 300) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

function Get-ChildProcessIds {
  param([int]$ParentProcessId)

  $Children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentProcessId" -ErrorAction SilentlyContinue
  foreach ($Child in $Children) {
    Get-ChildProcessIds -ParentProcessId $Child.ProcessId
    $Child.ProcessId
  }
}

function Stop-ProcessTree {
  param([int]$ProcessId)

  $ProcessIds = @()
  $ProcessIds += Get-ChildProcessIds -ParentProcessId $ProcessId
  $ProcessIds += $ProcessId

  foreach ($Id in ($ProcessIds | Select-Object -Unique)) {
    $Process = Get-Process -Id $Id -ErrorAction SilentlyContinue
    if ($Process) {
      Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue
    }
  }
}

function Stop-PreviousBackend {
  if (-not (Test-Path $BackendPidFile)) {
    return
  }

  $PreviousPidText = (Get-Content -Raw $BackendPidFile).Trim()
  if ($PreviousPidText -match "^\d+$") {
    $PreviousPid = [int]$PreviousPidText
    if (Get-Process -Id $PreviousPid -ErrorAction SilentlyContinue) {
      Write-Host "Stopping previous backend process..."
      Stop-ProcessTree -ProcessId $PreviousPid
    }
  }

  Remove-Item -Path $BackendPidFile -Force -ErrorAction SilentlyContinue
}

function Stop-WorkspaceBackendProcesses {
  $BackendNodeModulesPattern = [regex]::Escape((Join-Path $Root "backend\node_modules"))
  $Candidates = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and
    $_.CommandLine -match $BackendNodeModulesPattern -and
    ($_.CommandLine -match "src[\\/]index\.ts" -or $_.CommandLine -match "tsx")
  }

  if (-not $Candidates) {
    return
  }

  Write-Host "Stopping stale backend process..."
  $RootProcessIds = @()
  foreach ($Candidate in ($Candidates | Sort-Object ProcessId -Unique)) {
    $RootProcess = $Candidate
    while ($true) {
      $Parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($RootProcess.ParentProcessId)" -ErrorAction SilentlyContinue
      if (-not $Parent -or -not $Parent.CommandLine) {
        break
      }

      $ParentLooksLikeBackend =
        $Parent.CommandLine -match $BackendNodeModulesPattern -or
        $Parent.CommandLine -match "tsx watch src[\\/]index\.ts" -or
        ($Parent.CommandLine -match "npm" -and $Parent.CommandLine -match "run dev")

      if (-not $ParentLooksLikeBackend) {
        break
      }

      $RootProcess = $Parent
    }

    $RootProcessIds += $RootProcess.ProcessId
  }

  foreach ($ProcessId in ($RootProcessIds | Select-Object -Unique)) {
    Stop-ProcessTree -ProcessId $ProcessId
  }
}

Set-Location $Root
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
Stop-PreviousBackend
Stop-WorkspaceBackendProcesses

if (-not (Test-Path $RootEnv)) {
  Set-DotEnvValue $RootEnv "EXPO_PUBLIC_API_URL" "http://localhost:3000/api"
  Write-Host "Created .env for Expo API URL."
}

if (-not (Test-Path $BackendEnv) -and (Test-Path $BackendEnvExample)) {
  Copy-Item -Path $BackendEnvExample -Destination $BackendEnv
  Write-Host "Created backend\.env from backend\.env.example."
}

if (-not $SkipInstall) {
  Install-Dependencies "frontend" $Root @(
    "node_modules\expo\bin\cli",
    "node_modules\typescript\lib\tsc.js"
  )

  Install-Dependencies "backend" (Join-Path $Root "backend") @(
    "backend\node_modules\@prisma\engines\dist\index.js",
    "backend\node_modules\prisma\build\index.js",
    "backend\node_modules\typescript\lib\tsc.js"
  )
}

if (-not $SkipDocker) {
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    if (-not (Test-DockerReady)) {
      $DockerDesktop = Join-Path $Env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
      if (Test-Path $DockerDesktop) {
        Write-Host "Starting Docker Desktop..."
        Start-Process -FilePath $DockerDesktop -WindowStyle Hidden | Out-Null
      }

      Write-Host "Waiting for Docker Desktop..."
      $DockerReady = $false
      for ($Attempt = 1; $Attempt -le 24; $Attempt++) {
        Start-Sleep -Seconds 5
        if (Test-DockerReady) {
          $DockerReady = $true
          break
        }
      }

      if (-not $DockerReady) {
        throw "Docker Desktop is not running. Open Docker Desktop, wait for it to finish starting, then run npm run launch again."
      }
    }

    Write-Host "Starting Postgres with Docker Compose..."
    Invoke-DockerComposeUp

    Write-Host "Waiting for Postgres..."
    if (-not (Wait-PostgresReady)) {
      throw "Postgres did not become ready within 60 seconds. Check Docker Desktop, then run npm run launch again."
    }
  } else {
    Write-Warning "Docker was not found. Start Postgres manually or rerun after Docker is installed."
  }
}

if (-not $SkipPrisma) {
  Write-Host "Preparing Prisma..."
  Invoke-Npm @("run", "backend:prisma")
  Invoke-Npm @("run", "prisma:push", "--prefix", "backend")
}

$BackendPort = Get-FreePort 3000
$ApiUrl = "http://localhost:$BackendPort/api"
Set-DotEnvValue $RootEnv "EXPO_PUBLIC_API_URL" $ApiUrl
Set-DotEnvValue $BackendEnv "PORT" "$BackendPort"
$env:PORT = "$BackendPort"
$env:EXPO_PUBLIC_API_URL = $ApiUrl

if ($BackendPort -ne 3000) {
  Write-Host "Port 3000 is busy, using backend port $BackendPort."
}

$BackendOut = Join-Path $Logs "backend-launch.log"
$BackendErr = Join-Path $Logs "backend-launch.err.log"

Write-Host "Starting backend API..."
$BackendProcess = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev") `
  -WorkingDirectory (Join-Path $Root "backend") `
  -RedirectStandardOutput $BackendOut `
  -RedirectStandardError $BackendErr `
  -WindowStyle Hidden `
  -PassThru

$BackendProcess.Id | Set-Content -Path $BackendPidFile -Encoding UTF8

Write-Host "Waiting for backend API on http://localhost:$BackendPort..."
if (-not (Wait-HttpOk "http://localhost:$BackendPort/health" $BackendProcess)) {
  if ($BackendProcess -and -not $BackendProcess.HasExited) {
    Stop-ProcessTree -ProcessId $BackendProcess.Id
  }

  Remove-Item -Path $BackendPidFile -Force -ErrorAction SilentlyContinue
  throw "Backend API did not become ready. Check $BackendErr and $BackendOut for details."
}

Write-Host "Backend running on http://localhost:$BackendPort"
Write-Host "Backend logs: $BackendOut"

$FrontendPort = Get-FreePort 8081
if ($FrontendPort -ne 8081) {
  Write-Host "Port 8081 is busy, using Expo port $FrontendPort."
}

Write-Host "Launching Expo web on http://localhost:$FrontendPort. Press Ctrl+C here to stop the frontend and backend."

try {
  Invoke-Npm @("run", "web", "--", "--port", "$FrontendPort")
} finally {
  if ($BackendProcess -and -not $BackendProcess.HasExited) {
    Write-Host "Stopping backend API..."
    Stop-ProcessTree -ProcessId $BackendProcess.Id
  }

  Remove-Item -Path $BackendPidFile -Force -ErrorAction SilentlyContinue
}
