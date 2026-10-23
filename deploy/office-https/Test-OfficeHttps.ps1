[CmdletBinding()]
param(
    [string]$DnsServer,
    [switch]$SkipHttps
)

$ErrorActionPreference = 'Stop'
$officeHostname = 'datamet.lenash.dev'
$officeExpectedAddress = '192.168.1.5'

# Solo lectura: no cambia DNS, certificados, firewall ni la configuración VPN.
$officeDnsArguments = @{ Name = $officeHostname; Type = 'A'; ErrorAction = 'Stop' }
if ($DnsServer) { $officeDnsArguments.Server = $DnsServer }
$officeAnswers = @(Resolve-DnsName @officeDnsArguments | Where-Object { $_.Type -eq 'A' } | Select-Object -ExpandProperty IPAddress)
if ($officeAnswers.Count -ne 1 -or $officeAnswers[0] -ne $officeExpectedAddress) {
    throw "DNS incorrecto para $officeHostname. Debe resolver solo a $officeExpectedAddress; resuelve a: $($officeAnswers -join ', ')."
}
Write-Output "DNS correcto: $officeHostname -> $officeExpectedAddress"

if (-not (Test-NetConnection -ComputerName $officeExpectedAddress -Port 443 -InformationLevel Quiet)) {
    throw 'No se puede conectar con 192.168.1.5:443 desde este equipo. Revisar ruta VPN, firewall y servicio Caddy.'
}
Write-Output 'Puerto HTTPS 443 accesible.'

if (-not $SkipHttps) {
    # --resolve permite comprobar nombre/SNI y certificado sin modificar hosts.
    # No se usa --insecure: el certificado debe ser válido y confiable.
    & curl.exe --fail --silent --show-error --connect-timeout 10 --max-time 30 `
        --resolve "${officeHostname}:443:${officeExpectedAddress}" `
        --output NUL "https://$officeHostname/"
    if ($LASTEXITCODE -ne 0) { throw 'Falló la comprobación HTTPS. Revisar certificado, nombre, proxy y backend.' }
    Write-Output 'HTTPS válido: nombre, confianza del certificado y respuesta del frontend correctos.'
}
