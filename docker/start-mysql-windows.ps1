$workspace = Split-Path -Parent $PSScriptRoot
$env:UFO_WINDOWS_PORT = '3308'
$env:UFO_DOCKER_PORT = '3306'
$env:UFO_DOCKER_CONTAINER = 'ufo-portal-mysql-1'
try {
    Start-Process -FilePath (Get-Command node).Source -ArgumentList 'docker/windows-wsl-forward.cjs' -WorkingDirectory $workspace -WindowStyle Hidden
} finally {
    Remove-Item Env:UFO_WINDOWS_PORT, Env:UFO_DOCKER_PORT, Env:UFO_DOCKER_CONTAINER
}
