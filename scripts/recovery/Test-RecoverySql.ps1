#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'Invoke-RecoveryRehearsal.ps1'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
if ($errors) { throw ($errors -join [Environment]::NewLine) }

# Load only the functions under test. The rehearsal's top-level code never runs.
foreach ($name in 'Get-PostgresCommand', 'Invoke-Sql', 'Assert-Identity', 'Assert-RenderedProject', 'Assert-RenderedService') {
    $definition = $ast.Find({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $false)
    if (-not $definition) { throw "Missing function $name." }
    . ([scriptblock]::Create($definition.Extent.Text))
}

function Invoke-MockDocker {
    $program = switch ($script:mode) {
        'echo' { '[Console]::Write([Console]::In.ReadToEnd())' }
        'fail' { '[void][Console]::In.ReadToEnd(); exit 7' }
        'warn' { '[void][Console]::In.ReadToEnd(); [Console]::Error.WriteLine("private diagnostic")' }
        'empty' { '[void][Console]::In.ReadToEnd()' }
        'malformed' { '[void][Console]::In.ReadToEnd(); [Console]::WriteLine("malformed")' }
        default { throw 'Unexpected mock mode.' }
    }
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($program))
    $input | & "$PSHOME\powershell.exe" -NoProfile -NonInteractive -EncodedCommand $encoded
    $global:LASTEXITCODE = $LASTEXITCODE
}

function Invoke-AppDatabase {
    'casezero_test|recovery_source|18|123456789'
}

function Assert-Throws($operation, [string]$message) {
    try {
        & $operation
    } catch {
        if ($_.Exception.Message -like $message) { return }
        throw
    }
    throw "Expected failure matching $message."
}

$dockerExe = 'Invoke-MockDocker'
$dockerArgs = @('--context', 'mock')
$database = 'casezero_test'
$target = @{ Id = 'mock-container'; Service = 'postgres-source'; User = 'recovery_source'; Password = 'mock' }
$mode = 'echo'
$lineBreak = [Environment]::NewLine
$sql = @('BEGIN;', 'SELECT 123;', 'COMMIT;') -join $lineBreak
$result = @(Invoke-Sql $target $sql)
if (($result -join $lineBreak) -cne $sql) { throw 'SQL text did not reach the native process intact.' }
Write-Host 'PASS: multiline transactional SQL reached native stdin.'

$mode = 'fail'
Assert-Throws { Invoke-Sql $target $sql } '*exit code 7*'
Write-Host 'PASS: nonzero native exit stopped SQL execution.'

$mode = 'warn'
Assert-Throws { Invoke-Sql $target $sql } '*unexpected diagnostics*'
Write-Host 'PASS: stderr with a zero exit was rejected without exposing its text.'

foreach ($mode in 'empty', 'malformed') {
    Assert-Throws { Assert-Identity $target } '*Database identity mismatch*'
    if ($target.ContainsKey('Identity')) { throw 'Identity was recorded after a failed check.' }
    Write-Host "PASS: $mode identity output was rejected."
}

$project = 'case-zero-v21d3-recovery'
$network = 'case-zero-v21d3-recovery_default'
$projectJson = '{"name":"case-zero-v21d3-recovery","services":{"postgres-source":{},"postgres-restore":{}},"networks":NETWORKS}'
$defaultNetworkName = '{"default":{"name":"case-zero-v21d3-recovery_default"'
foreach ($suffix in '}}', ',"ipam":{}}}') {
    $rendered = ConvertFrom-Json ($projectJson.Replace('NETWORKS', $defaultNetworkName + $suffix))
    Assert-RenderedProject $rendered $project $network
}
Write-Host 'PASS: name-only and empty-IPAM Compose networks were accepted.'

$unexpected = @(
    ',"ipam":{"config":[{"subnet":"172.28.0.0/16","gateway":"172.28.0.1"}]}}}',
    ',"ipam":{"driver":"default"}}}',
    ',"ipam":{"config":[]}}}',
    ',"ipam":null}}',
    ',"ipam":[]}}',
    ',"ipam":false}}',
    ',"ipam":"{}"}}',
    ',"external":true}}',
    ',"driver":"bridge"}}',
    ',"unexpected":{}}}',
    '},"extra":{"name":"extra"}}'
)
foreach ($suffix in $unexpected) {
    $rendered = ConvertFrom-Json ($projectJson.Replace('NETWORKS', $defaultNetworkName + $suffix))
    Assert-Throws { Assert-RenderedProject $rendered $project $network } 'Unexpected rendered Compose project.*'
}
Write-Host "PASS: all $($unexpected.Count) unexpected network variants were rejected."

$validProject = $projectJson.Replace('NETWORKS', $defaultNetworkName + ',"ipam":{}}}')
foreach ($changedProject in @(
    $validProject.Replace('"name":"case-zero-v21d3-recovery"', '"name":"other-project"'),
    $validProject.Replace('"postgres-source"', '"other-service"'),
    $validProject.Replace('"case-zero-v21d3-recovery_default"', '"other-network"'),
    $validProject.Replace('"default":', '"other":')
)) {
    $rendered = ConvertFrom-Json $changedProject
    Assert-Throws { Assert-RenderedProject $rendered $project $network } 'Unexpected rendered Compose project.*'
}
Write-Host 'PASS: unexpected project, service, network name, and network key were rejected.'

$target.Port = 55433
$serviceJson = @'
{
  "image":"postgres:18",
  "environment":{"POSTGRES_USER":"recovery_source","POSTGRES_PASSWORD":"mock","POSTGRES_DB":"casezero_test"},
  "ports":[{"host_ip":"127.0.0.1","published":"55433","target":5432,"protocol":"tcp"}],
  "tmpfs":["/var/lib/postgresql:size=512m"],
  "healthcheck":{"test":["CMD","pg_isready","-h","127.0.0.1","-U","recovery_source","-d","casezero_test"]},
  "restart":"no",
  "networks":{"default":null}STARTUP
}
'@
foreach ($startup in '', ',"command":null', ',"entrypoint":null', ',"command":null,"entrypoint":null') {
    $definition = ConvertFrom-Json ($serviceJson.Replace('STARTUP', $startup))
    Assert-RenderedService $definition $target 'postgres:18' $database
}
$numericPort = $serviceJson.Replace('"55433"', '55433').Replace('{"default":null}', '["default"]')
Assert-RenderedService (ConvertFrom-Json ($numericPort.Replace('STARTUP', ''))) $target 'postgres:18' $database
Write-Host 'PASS: absent and null startup metadata, numeric port, and list-form network were accepted.'

foreach ($field in 'command', 'entrypoint') {
    foreach ($value in '""', '[]', '"/bin/sh"', '["/bin/sh"]', '[null]', 'false', '0', '{}') {
        $startup = ',"{0}":{1}' -f $field, $value
        $definition = ConvertFrom-Json ($serviceJson.Replace('STARTUP', $startup))
        Assert-Throws { Assert-RenderedService $definition $target 'postgres:18' $database } "*($field must be null when present).*"
    }
}
Write-Host 'PASS: all 16 nonnull command and entrypoint values were rejected.'

foreach ($invalid in @(
    @{ Json = $serviceJson.Replace('STARTUP', ',"unexpected":null'); Field = 'unexpected service property' },
    @{ Json = $serviceJson.Replace('127.0.0.1","published', '0.0.0.0","published'); Field = 'ports' },
    @{ Json = $serviceJson.Replace('size=512m', 'size=1g'); Field = 'tmpfs' },
    @{ Json = $serviceJson.Replace('"mock"', '"different-fixture-value"'); Field = 'environment.POSTGRES_PASSWORD' }
)) {
    $definition = ConvertFrom-Json ($invalid.Json.Replace('STARTUP', ''))
    Assert-Throws { Assert-RenderedService $definition $target 'postgres:18' $database } "Unexpected rendered configuration for postgres-source ($($invalid.Field))."
}
Write-Host 'PASS: unrelated service, port, tmpfs, and credential errors were identified without values.'
