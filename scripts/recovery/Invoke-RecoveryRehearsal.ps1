#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Preflight', 'Fresh', 'UpgradeAndRestore', 'Cleanup')]
    [string]$Phase,
    [switch]$Approved,
    [string]$Manifest
)

$ErrorActionPreference = 'Stop'
if (-not $Approved) { throw 'Obtain separate approval for this phase.' }
if (($Phase -eq 'Cleanup') -ne [bool]$Manifest) { throw 'Supply -Manifest only for Cleanup.' }
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).ProviderPath
if ((Get-Location).ProviderPath -ne $root) { throw 'Run from the CASE//ZERO repository root.' }
$gitRoot = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or (Resolve-Path -LiteralPath $gitRoot).ProviderPath -ne $root) {
    throw 'Unexpected Git worktree.'
}
$branch = git branch --show-current
if ($LASTEXITCODE -ne 0 -or $branch -ne 'test/v21d3-recovery-rehearsal') { throw 'Unexpected Git branch.' }
$head = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve Git HEAD.' }
$overrides = @(Get-ChildItem Env: | Where-Object Name -match '^(DOCKER_|COMPOSE_|PG|POSTGRES_|APP_ENV$|DATABASE_URL$|ALEMBIC_|PYTHONPATH$|PYTHONHOME$)')
if ($overrides.Count) { throw "Clear environment overrides: $($overrides.Name -join ', ')." }

$project = 'case-zero-v21d3-recovery'
$network = "$project" + '_default'
$database = 'casezero_test'
$image = 'postgres:18'
$source = @{ Service = 'postgres-source'; Port = 55433; User = 'recovery_source'; Password = 'source-rehearsal-only' }
$restore = @{ Service = 'postgres-restore'; Port = 55434; User = 'recovery_restore'; Password = 'restore-rehearsal-only' }
$targets = @($source, $restore)
$prior = '67c33445e501'
$expectedHead = 'e6ab1b3d315d'
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$dockerExe = (Get-Command docker.exe -CommandType Application).Source
$identity = @{}
$tableCounts = [ordered]@{
    alembic_version = 1
    alerts = 1
    case_activities = 1
    case_notes = 1
    cases = 1
    login_throttles = 0
    security_audit_events = 0
    security_events = 1
    threat_indicators = 0
    users = 0
}

function Invoke-Docker {
    $ErrorActionPreference = 'Continue'
    $output = @(& $dockerExe @args 2>&1)
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "Docker command failed with exit code $code. Diagnostic text was withheld." }
    if ($output | Where-Object { $_ -is [Management.Automation.ErrorRecord] }) {
        if ($args -contains 'up' -or $args -contains 'stop' -or $args -contains 'rm') {
            Write-Warning 'Docker emitted lifecycle diagnostics. Verify the resulting inventory.'
        } else {
            throw 'Docker emitted unexpected diagnostics. Review the command locally.'
        }
    }
    $output | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] }
}

function Get-ProjectContainers {
    Invoke-Docker @dockerArgs ps -aq --no-trunc --filter "label=com.docker.compose.project=$project"
}

function Get-ProjectNetworks {
    Invoke-Docker @dockerArgs network ls -q --no-trunc --filter "label=com.docker.compose.project=$project"
}

function Get-DevelopmentMetadata {
    $ids = @(Invoke-Docker @dockerArgs ps -aq --no-trunc --filter 'name=^/case-zero-postgres$')
    $mounts = foreach ($id in $ids) {
        Invoke-Docker @dockerArgs inspect --type container --format '{{json .Mounts}}' $id
    }
    $volumes = @(Invoke-Docker @dockerArgs volume ls -q --filter 'name=case_zero_postgres_data')
    ConvertTo-Json -Compress -InputObject @(@($ids | Sort-Object), @($mounts | Sort-Object), @($volumes | Sort-Object))
}

function Assert-RecoveryTopology {
    $ids = @(Get-ProjectContainers)
    $nets = @(Get-ProjectNetworks)
    if ($ids.Count -ne 2 -or $nets.Count -ne 1) { throw 'Unexpected recovery project inventory.' }
    $name = Invoke-Docker @dockerArgs network inspect --format '{{.Name}}' $nets[0]
    $networkLabels = Invoke-Docker @dockerArgs network inspect --format '{{json .Labels}}' $nets[0] | ConvertFrom-Json
    $members = Invoke-Docker @dockerArgs network inspect --format '{{json .Containers}}' $nets[0] | ConvertFrom-Json
    if ($name -ne $network -or $networkLabels.'com.docker.compose.project' -ne $project -or
        $networkLabels.'com.docker.compose.network' -ne 'default' -or
        (($members.PSObject.Properties.Name | Sort-Object) -join ',') -ne (($ids | Sort-Object) -join ',')) {
        throw 'Unexpected recovery network or network members.'
    }
    if ($identity.NetworkId -and $identity.NetworkId -ne $nets[0]) { throw 'Recovery network was replaced.' }
    $identity.NetworkId = $nets[0]
    foreach ($target in $targets) {
        $service = $target.Service
        $id = @(Invoke-Docker @composeArgs ps --all --quiet $service)
        if ($id.Count -ne 1) { throw "Unexpected container count for $service." }
        $fullId = Invoke-Docker @dockerArgs inspect --type container --format '{{.Id}}' $id[0]
        if ($fullId -notin $ids) { throw "Unexpected container for $service." }
        if ($target.ContainsKey('Id') -and $target.Id -ne $fullId) { throw "Container replaced for $service." }
        $target.Id = $fullId
        $labels = Invoke-Docker @dockerArgs inspect --format '{{json .Config.Labels}}' $target.Id | ConvertFrom-Json
        $actual = Invoke-Docker @dockerArgs inspect --format '{{.Config.Image}} {{.State.Health.Status}} {{.HostConfig.RestartPolicy.Name}} {{.Image}}' $target.Id
        $ports = Invoke-Docker @dockerArgs inspect --format '{{json .NetworkSettings.Ports}}' $target.Id | ConvertFrom-Json
        $netsForContainer = Invoke-Docker @dockerArgs inspect --format '{{json .NetworkSettings.Networks}}' $target.Id | ConvertFrom-Json
        $tmpfs = Invoke-Docker @dockerArgs inspect --format '{{json .HostConfig.Tmpfs}}' $target.Id | ConvertFrom-Json
        $mounts = @(Invoke-Docker @dockerArgs inspect --format '{{range .Mounts}}{{println .Type .Destination}}{{end}}' $target.Id)
        $binding = @($ports.'5432/tcp')
        if ($labels.'com.docker.compose.project' -ne $project -or $labels.'com.docker.compose.service' -ne $service -or
            $actual -ne "$image healthy no $expectedImageId" -or
            @($ports.PSObject.Properties).Count -ne 1 -or $binding.Count -ne 1 -or
            $binding[0].HostIp -ne '127.0.0.1' -or $binding[0].HostPort -ne [string]$target.Port -or
            @($netsForContainer.PSObject.Properties).Count -ne 1 -or $netsForContainer.$network.NetworkID -ne $nets[0] -or
            @($tmpfs.PSObject.Properties).Count -ne 1 -or $tmpfs.'/var/lib/postgresql' -ne 'size=512m' -or
            ($mounts | Where-Object { $_ -and $_ -ne 'tmpfs /var/lib/postgresql' })) {
            throw "Isolation checks failed for $service."
        }
    }
    if ($source.Id -eq $restore.Id) { throw 'Source and restore must be independent containers.' }
}

function Get-PostgresCommand($target, [string]$tool) {
    @($target.Id, '/usr/bin/env', '-i', 'PATH=/usr/lib/postgresql/18/bin:/usr/local/bin:/usr/bin:/bin',
        'PGCONNECT_TIMEOUT=5', "PGPASSWORD=$($target.Password)", $tool,
        '-h', '127.0.0.1', '-p', '5432', '-U', $target.User, '-d', $database)
}

function Invoke-Sql($target, [string]$sql) {
    $command = Get-PostgresCommand $target 'psql'
    $ErrorActionPreference = 'Continue'
    $output = @($sql | & $dockerExe @dockerArgs exec -i @command -X -w -qAt -v ON_ERROR_STOP=1 2>&1)
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "psql failed on $($target.Service) with exit code $code." }
    if ($output | Where-Object { $_ -is [Management.Automation.ErrorRecord] }) {
        throw "psql emitted unexpected diagnostics on $($target.Service)."
    }
    $output
}

function Invoke-BinaryArchive([string]$mode, [string]$archive, [string[]]$command) {
    @'
import subprocess
import sys

mode, archive, *command = sys.argv[1:]
try:
    if mode == "dump":
        with open(archive, "xb") as stream:
            result = subprocess.run(command, stdout=stream, stderr=subprocess.PIPE)
    elif mode in ("inspect", "restore"):
        with open(archive, "rb") as stream:
            result = subprocess.run(command, stdin=stream, stderr=subprocess.PIPE,
                                    stdout=subprocess.DEVNULL if mode == "inspect" else None)
    else:
        raise ValueError("Unknown archive operation")
    if result.returncode:
        sys.exit(f"PostgreSQL archive tool exited with code {result.returncode}.")
    if result.stderr:
        sys.exit("PostgreSQL archive tool emitted diagnostics. Diagnostic text was withheld.")
except OSError:
    sys.exit("Cannot open the archive or start the archive tool.")
'@ | & $python -I -B - $mode $archive $dockerExe @command
    if ($LASTEXITCODE -ne 0) { throw "Binary archive $mode failed with exit code $LASTEXITCODE." }
}

function Invoke-AppDatabase($target, [string[]]$arguments, [string]$program) {
    $env:APP_ENV = 'test'
    $env:POSTGRES_HOST = '127.0.0.1'
    $env:POSTGRES_PORT = [string]$target.Port
    $env:POSTGRES_DB = $database
    $env:POSTGRES_USER = $target.User
    $env:POSTGRES_PASSWORD = $target.Password
    try {
        Push-Location (Join-Path $root 'backend')
        try {
            $ErrorActionPreference = 'Continue'
            if ($program) { $output = @($program | & $python -I -B @arguments 2>&1) }
            else { $output = @(& $python -I -B @arguments 2>&1) }
            $code = $LASTEXITCODE
            if ($code -ne 0) { throw "Python operation failed with exit code $code." }
            if ($output | Where-Object { $_ -is [Management.Automation.ErrorRecord] }) {
                if ($program) { throw 'Database identity query emitted unexpected diagnostics.' }
                Write-Warning 'Alembic emitted diagnostics. The revision will be verified independently.'
            }
            $output | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] }
        } finally {
            Pop-Location
        }
    } finally {
        Remove-Item Env:APP_ENV, Env:POSTGRES_HOST, Env:POSTGRES_PORT, Env:POSTGRES_DB, Env:POSTGRES_USER, Env:POSTGRES_PASSWORD
    }
}

function Assert-Identity($target) {
    $sql = "SELECT current_database(), current_user, current_setting('server_version_num')::int / 10000, system_identifier FROM pg_control_system();"
    $inside = @(Invoke-Sql $target $sql)
    $outside = @(Invoke-AppDatabase $target @('-') @'
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
import psycopg
from app import config

assert config.EXPLICIT_TEST_MODE and config.POSTGRES_DB == "casezero_test"
config.validate_test_database_environment()
with psycopg.connect(config.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://", 1),
                     connect_timeout=5, options="-c default_transaction_read_only=on") as conn:
    row = conn.execute("""
        SELECT current_database(), current_user, current_setting('server_version_num')::int / 10000,
               system_identifier FROM pg_control_system()
    """).fetchone()
    print("|".join(map(str, row)))
'@)
    $expected = "^casezero_test\|$($target.User)\|18\|[0-9]+$"
    if ($inside.Count -ne 1 -or $outside.Count -ne 1 -or $inside[0] -notmatch $expected -or
        $inside[0] -ne $outside[0]) { throw "Database identity mismatch for $($target.Service)." }
    if ($target.ContainsKey('Identity') -and $target.Identity -ne $inside[0]) { throw 'Database cluster changed.' }
    $target.Identity = $inside[0]
    Write-Host "Verified $($target.Service) at 127.0.0.1:$($target.Port), $database / $($target.User), PostgreSQL 18."
}

function Assert-Empty($target) {
    $state = Invoke-Sql $target @'
SELECT (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace),
       (SELECT count(*) FROM pg_namespace
        WHERE nspname NOT IN ('public', 'pg_catalog', 'information_schema', 'pg_toast'));
'@
    if ($state -ne '0|0') { throw "Expected an empty disposable database on $($target.Service)." }
}

function Invoke-Upgrade([string]$revision) {
    Assert-RecoveryTopology
    Assert-Identity $source
    Invoke-AppDatabase $source @('-m', 'alembic', 'upgrade', $revision)
}

function Assert-Revision($target, [string]$revision) {
    $rows = @(Invoke-Sql $target 'SELECT version_num FROM public.alembic_version;')
    if ($rows.Count -ne 1 -or $rows[0] -ne $revision) { throw "Unexpected revision on $($target.Service)." }
    Write-Host "$($target.Service) revision: $revision"
}

function Assert-SyntheticData($target) {
    $rows = @(Invoke-Sql $target @'
SELECT (SELECT count(*) FROM public.security_events),
       (SELECT count(*) FROM public.alerts), (SELECT count(*) FROM public.cases),
       (SELECT count(*) FROM public.case_notes), (SELECT count(*) FROM public.case_activities);
SELECT e.id, a.id, c.id, n.id, t.id, e.source, a.title, c.title, n.content, t.message
FROM public.alerts a JOIN public.security_events e ON e.id = a.source_event_id
JOIN public.cases c ON c.id = a.case_id
JOIN public.case_notes n ON n.case_id = c.id
JOIN public.case_activities t ON t.case_id = c.id;
'@)
    $expected = ('00000000-0000-4000-8000-000000000001|00000000-0000-4000-8000-000000000002|' +
        '00000000-0000-4000-8000-000000000003|00000000-0000-4000-8000-000000000004|' +
        '00000000-0000-4000-8000-000000000005|rehearsal|Synthetic alert|Synthetic case|Synthetic note|Synthetic activity')
    if ($rows.Count -ne 2 -or $rows[0] -ne '1|1|1|1|1' -or $rows[1] -ne $expected) {
        throw "Synthetic data verification failed on $($target.Service)."
    }
    Assert-OperationalForeignKeys $target
    Write-Host "Verified synthetic row counts, IDs, links, and foreign keys on $($target.Service)."
}

function Assert-OperationalForeignKeys($target) {
    $keys = Invoke-Sql $target @'
SELECT count(*) FROM pg_constraint
WHERE contype = 'f' AND convalidated AND (
    (conrelid = 'public.alerts'::regclass AND confdeltype = 'n' AND
        ((confrelid = 'public.cases'::regclass AND conname = 'fk_alerts_case_id_cases') OR
         (confrelid = 'public.security_events'::regclass AND conname = 'fk_alerts_source_event_id_security_events')))
    OR (conrelid = 'public.case_notes'::regclass AND confrelid = 'public.cases'::regclass
        AND confdeltype = 'c' AND conname = 'fk_case_notes_case_id_cases')
    OR (conrelid = 'public.case_activities'::regclass AND confrelid = 'public.cases'::regclass
        AND confdeltype = 'c' AND conname = 'fk_case_activities_case_id_cases'));
'@
    if ($keys -ne '4') { throw "Expected four validated operational foreign keys on $($target.Service)." }
}

function Assert-ArchiveInventory($target) {
    Assert-Revision $target $expectedHead
    Assert-SyntheticData $target
    $primaryKeys = @($tableCounts.Keys | ForEach-Object {
        if ($_ -eq 'alembic_version') { 'alembic_version_pkc' } else { $_ + '_pkey' }
    })
    $indexes = @(
        'ix_alerts_detection_rule_id', 'ix_alerts_source_event_id',
        'ix_case_activities_case_id', 'ix_case_notes_case_id',
        'ix_security_audit_events_created_at', 'ix_security_audit_events_event_type',
        'ix_security_audit_events_identity_hash', 'ix_security_audit_events_outcome',
        'ix_security_audit_events_severity', 'ix_security_audit_events_user_id',
        'ix_security_events_event_time', 'ix_security_events_event_type', 'ix_security_events_hostname',
        'ix_security_events_source', 'ix_security_events_source_ip', 'ix_security_events_username',
        'ix_threat_indicators_indicator_type', 'ix_threat_indicators_reputation',
        'ix_threat_indicators_source', 'ix_threat_indicators_value', 'uq_threat_indicators_type_value',
        'ix_users_email', 'ix_users_role'
    ) + $primaryKeys
    $expected = @($tableCounts.Keys | ForEach-Object { "r|$_" }) + @($indexes | ForEach-Object { "i|$_" })
    $relations = @(Invoke-Sql $target @'
SELECT relkind, relname FROM pg_class WHERE relnamespace = 'public'::regnamespace;
'@)
    if (($relations.Count -ne $expected.Count) -or (Compare-Object $expected $relations -CaseSensitive)) {
        throw "Unexpected public relation inventory on $($target.Service)."
    }
    $expectedConstraints = $primaryKeys + @(
        'uq_threat_indicators_type_value', 'fk_alerts_case_id_cases', 'fk_alerts_source_event_id_security_events',
        'fk_case_notes_case_id_cases', 'fk_case_activities_case_id_cases', 'ck_users_role',
        'ck_login_throttles_failure_count', 'ck_security_audit_events_outcome', 'ck_security_audit_events_severity'
    )
    $constraints = @(Invoke-Sql $target @'
SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype <> 'n';
'@)
    if (($constraints.Count -ne $expectedConstraints.Count) -or
        (Compare-Object $expectedConstraints $constraints -CaseSensitive)) {
        throw "Unexpected public constraint inventory on $($target.Service)."
    }
    $extra = Invoke-Sql $target @'
SELECT (SELECT count(*) FROM pg_namespace
        WHERE nspname NOT IN ('public', 'pg_catalog', 'information_schema', 'pg_toast')),
       (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace),
       (SELECT count(*) FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype <> 'c'
        AND NOT (typtype = 'b' AND typelem <> 0 AND typcategory = 'A')),
       (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal),
       (SELECT count(*) FROM pg_event_trigger),
       (SELECT count(*) FROM pg_extension WHERE extname <> 'plpgsql');
'@
    if ($extra -ne '0|0|0|0|0|0') { throw "Unexpected database objects on $($target.Service)." }
    $queries = foreach ($table in $tableCounts.Keys) { "SELECT count(*) FROM public.$table;" }
    $counts = @(Invoke-Sql $target ($queries -join "`n"))
    if (($counts -join '|') -ne ($tableCounts.Values -join '|')) {
        throw "Unexpected application row counts on $($target.Service)."
    }
    Write-Host "Verified the head relation inventory and expected row counts for all ten tables on $($target.Service)."
}

function Get-VerifiedTempRoot {
    $item = Get-Item -LiteralPath ([IO.Path]::GetTempPath())
    $path = $item.FullName.TrimEnd('\')
    if (-not $item.PSIsContainer -or $path -notmatch '^[A-Za-z]:\\' -or
        $path -eq $root -or $path.StartsWith(($root.TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase) -or
        [IO.DriveInfo]::new([IO.Path]::GetPathRoot($item.FullName)).DriveType -ne [IO.DriveType]::Fixed) {
        throw 'Expected a local temporary directory outside the repository.'
    }
    while ($item) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Temporary path traverses a reparse point.' }
        $item = $item.Parent
    }
    $path
}

function Assert-RenderedProject($rendered, [string]$project, [string]$network) {
    $defaultNetwork = $rendered.networks.default
    if ($rendered.name -cne $project -or
        (($rendered.services.PSObject.Properties.Name | Sort-Object) -join ',') -cne 'postgres-restore,postgres-source' -or
        @($rendered.networks.PSObject.Properties).Count -ne 1 -or
        $defaultNetwork -isnot [pscustomobject] -or $defaultNetwork.name -cne $network -or
        ($defaultNetwork.PSObject.Properties.Name | Where-Object { $_ -cnotin @('name','ipam') }) -or
        ($rendered.PSObject.Properties.Name | Where-Object { $_ -cnotin @('name','services','networks') })) {
        throw 'Unexpected rendered Compose project.'
    }

    # Compose may emit an empty IPAM object for the implicit default network.
    $ipamProperty = $defaultNetwork.PSObject.Properties['ipam']
    if ($null -ne $ipamProperty -and
        ($ipamProperty.Value -isnot [pscustomobject] -or @($ipamProperty.Value.PSObject.Properties).Count -ne 0)) {
        throw 'Unexpected rendered Compose project. Default network IPAM must be an empty object when present.'
    }
}

function Assert-RenderedService($definition, $target, [string]$image, [string]$database) {
    $prefix = "Unexpected rendered configuration for $($target.Service)"
    if ($definition -isnot [pscustomobject]) { throw "$prefix (service object)." }
    $allowed = @('image','environment','ports','tmpfs','healthcheck','restart','networks','command','entrypoint')
    if ($definition.PSObject.Properties.Name | Where-Object { $_ -cnotin $allowed }) {
        throw "$prefix (unexpected service property)."
    }
    foreach ($field in 'command', 'entrypoint') {
        if ($null -ne $definition.$field) { throw "$prefix ($field must be null when present)." }
    }
    if ($definition.image -ne $image) { throw "$prefix (image)." }
    if ($definition.restart -cne 'no') { throw "$prefix (restart)." }

    $tmpfsEntries = @($definition.tmpfs)
    if ($tmpfsEntries.Count -ne 1 -or $tmpfsEntries[0] -ne '/var/lib/postgresql:size=512m') {
        throw "$prefix (tmpfs)."
    }
    $serviceNetworks = if ($definition.networks -is [array]) { $definition.networks }
        else { $definition.networks.PSObject.Properties.Name }
    if ((@($serviceNetworks) -join ',') -ne 'default') { throw "$prefix (networks)." }

    $binding = @($definition.ports)
    if ($binding.Count -ne 1 -or $binding[0].host_ip -ne '127.0.0.1' -or
        $binding[0].published -ne [string]$target.Port -or $binding[0].target -ne 5432 -or $binding[0].protocol -ne 'tcp') {
        throw "$prefix (ports)."
    }
    if (@($definition.environment.PSObject.Properties).Count -ne 3) { throw "$prefix (environment keys)." }
    if ($definition.environment.POSTGRES_DB -ne $database) { throw "$prefix (environment.POSTGRES_DB)." }
    if ($definition.environment.POSTGRES_USER -cne $target.User) { throw "$prefix (environment.POSTGRES_USER)." }
    if ($definition.environment.POSTGRES_PASSWORD -cne $target.Password) { throw "$prefix (environment.POSTGRES_PASSWORD)." }
    if (($definition.healthcheck.test -join '|') -ne "CMD|pg_isready|-h|127.0.0.1|-U|$($target.User)|-d|$database" -or
        $definition.healthcheck.disable) {
        throw "$prefix (healthcheck)."
    }
}

$stage = 'Docker preflight'
try {
    $contextResult = @(Invoke-Docker context show)
    if ($contextResult.Count -ne 1 -or -not $contextResult[0]) { throw 'Ambiguous Docker context.' }
    $context = $contextResult[0]
    $endpoint = Invoke-Docker context inspect $context --format '{{.Endpoints.docker.Host}}'
    if ($endpoint -notin @('npipe:////./pipe/docker_engine', 'npipe:////./pipe/dockerDesktopLinuxEngine')) {
        throw 'Select a local Docker Desktop named-pipe context.'
    }
    $dockerArgs = @('--context', $context)
    $engine = Invoke-Docker @dockerArgs info --format '{{.OSType}}/{{.OperatingSystem}}'
    if ($engine -ne 'linux/Docker Desktop') { throw 'Expected the Docker Desktop Linux engine.' }
    $engineId = Invoke-Docker @dockerArgs info --format '{{.ID}}'
    if (-not $engineId) { throw 'Missing Docker engine identity.' }
    $envFile = Join-Path $root 'compose.test.env'
    if (Get-Content -LiteralPath $envFile | Where-Object { $_ -notmatch '^\s*(#.*)?$' }) {
        throw 'The explicit Compose env file must contain only comments or blank lines.'
    }
    $composeArgs = $dockerArgs + @('compose', '--project-name', $project, '--project-directory', $root,
        '--env-file', $envFile, '--file', (Join-Path $root 'compose.recovery.yaml'))
    $composeVersion = Invoke-Docker @dockerArgs compose version --short
    Invoke-Docker @composeArgs config --quiet
    $rendered = (Invoke-Docker @composeArgs config --format json | Out-String) | ConvertFrom-Json
    Assert-RenderedProject $rendered $project $network
    foreach ($target in $targets) {
        Assert-RenderedService $rendered.services.($target.Service) $target $image $database
    }
    $recoveryVolumes = @(Invoke-Docker @dockerArgs volume ls -q --filter "label=com.docker.compose.project=$project")
    if ($recoveryVolumes.Count) { throw 'Unexpected recovery project volumes.' }
    $developmentBefore = Get-DevelopmentMetadata
    Write-Host "Rehearsal $Phase on $branch at $head using context $context and Compose $composeVersion."

    if ($Phase -ne 'Cleanup') {
        if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw 'Prepare the backend virtual environment.' }
        if (@(Get-ProjectContainers).Count -or @(Get-ProjectNetworks).Count) { throw 'Recovery project must be empty.' }
        if (@(Invoke-Docker @dockerArgs network ls -q --filter "name=^$network$").Count) {
            throw 'The recovery network name is already in use.'
        }
        $targetPorts = @($source.Port, $restore.Port)
        $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
        if ($listeners | Where-Object Port -in $targetPorts) { throw 'A recovery port is occupied.' }
        $excluded = netsh interface ipv4 show excludedportrange protocol=tcp
        if ($LASTEXITCODE -ne 0) { throw 'Cannot check Windows excluded TCP ports.' }
        foreach ($line in $excluded) {
            if ($line -match '^\s*(\d+)\s+(\d+)\s*\*?\s*$') {
                $first = [int]$Matches[1]
                $last = [int]$Matches[2]
                if ($targetPorts | Where-Object { $_ -ge $first -and $_ -le $last }) { throw 'A recovery port is reserved.' }
            }
        }
        if ($Phase -eq 'Preflight') {
            Write-Host 'PASS: read-only preflight. Confirmed rendered service, port, health check, network, environment and tmpfs configuration.'
            return
        }
        $stage = 'starting disposable services'
        $temp = Get-VerifiedTempRoot
        $artifactDirectory = Join-Path $temp ("case-zero-rehearsal-" + [guid]::NewGuid())
        New-Item -ItemType Directory -Path $artifactDirectory | Out-Null
        $manifestPath = Join-Path $artifactDirectory 'resources.json'
        Write-Host "Run evidence directory: $artifactDirectory"
        Invoke-Docker @composeArgs up --wait --wait-timeout 120 postgres-source postgres-restore
    }

    $stage = 'container isolation'
    if ($Phase -eq 'Cleanup') {
        $temp = Get-VerifiedTempRoot
        $manifestItem = Get-Item -LiteralPath $Manifest
        if ($manifestItem.PSIsContainer -or $manifestItem.Name -ne 'resources.json' -or
            $manifestItem.Directory.Parent.FullName.TrimEnd('\') -ne $temp -or
            $manifestItem.Directory.Name -notmatch '^case-zero-rehearsal-[0-9a-f-]{36}$' -or
            ($manifestItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            ($manifestItem.Directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Manifest must be a regular rehearsal file in the verified temporary directory.'
        }
        $saved = Get-Content -LiteralPath $manifestItem.FullName -Raw | ConvertFrom-Json
        if ($saved.Project -ne $project -or $saved.Context -ne $context -or $saved.Endpoint -ne $endpoint -or
            $saved.EngineId -ne $engineId -or $saved.ImageId -notmatch '^sha256:[0-9a-f]{64}$' -or
            $saved.NetworkId -notmatch '^[0-9a-f]{64}$' -or $saved.SourceId -notmatch '^[0-9a-f]{64}$' -or
            $saved.RestoreId -notmatch '^[0-9a-f]{64}$' -or $saved.SourceId -eq $saved.RestoreId) {
            throw 'Manifest does not identify this recovery project and local engine.'
        }
        $identity.NetworkId = $saved.NetworkId
        $source.Id = $saved.SourceId
        $restore.Id = $saved.RestoreId
        $expectedImageId = $saved.ImageId
    } else {
        $expectedImageId = Invoke-Docker @dockerArgs image inspect --format '{{.Id}}' $image
    }
    Assert-RecoveryTopology
    if ($Phase -eq 'Cleanup') {
        $stage = 'scoped cleanup'
        Invoke-Docker @dockerArgs container stop $source.Id $restore.Id
        Invoke-Docker @dockerArgs container rm $source.Id $restore.Id
        Invoke-Docker @dockerArgs network rm $identity.NetworkId
        if (@(Get-ProjectContainers).Count -or @(Get-ProjectNetworks).Count) { throw 'Recovery resources remain.' }
    } else {
        $manifestData = @{
            Project = $project; Context = $context; Endpoint = $endpoint; EngineId = $engineId
            ImageId = $expectedImageId; NetworkId = $identity.NetworkId; SourceId = $source.Id; RestoreId = $restore.Id
        } | ConvertTo-Json
        $file = [IO.File]::Open($manifestPath, [IO.FileMode]::CreateNew)
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes($manifestData)
            $file.Write($bytes, 0, $bytes.Length)
        } finally {
            $file.Dispose()
        }
        Write-Host "Cleanup manifest: $manifestPath"
        $stage = 'database identity and emptiness'
        Assert-Identity $source
        Assert-Identity $restore
        if (($source.Identity -split '\|')[-1] -eq ($restore.Identity -split '\|')[-1]) { throw 'Database clusters are identical.' }
        Assert-Empty $source
        Assert-Empty $restore

        if ($Phase -eq 'Fresh') {
            $stage = 'fresh migration and repeat'
            Invoke-Upgrade $expectedHead
            Assert-Revision $source $expectedHead
            Invoke-Upgrade $expectedHead
            Assert-Revision $source $expectedHead
            Assert-OperationalForeignKeys $source
        } else {
            $stage = 'prior migration and synthetic fixture'
            Invoke-Upgrade $prior
            Assert-Revision $source $prior
            Assert-RecoveryTopology
            Assert-Identity $source
            Invoke-Sql $source @'
BEGIN;
INSERT INTO public.security_events (id, event_type, source, event_time)
VALUES ('00000000-0000-4000-8000-000000000001', 'authentication', 'rehearsal', '2026-01-01T00:00:00Z');
INSERT INTO public.cases (id, title, status, priority)
VALUES ('00000000-0000-4000-8000-000000000003', 'Synthetic case', 'open', 'high');
INSERT INTO public.alerts (id, title, severity, status, source, source_event_id, case_id)
VALUES ('00000000-0000-4000-8000-000000000002', 'Synthetic alert', 'high', 'new', 'rehearsal',
        '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003');
INSERT INTO public.case_notes (id, case_id, author, content)
VALUES ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'Rehearsal', 'Synthetic note');
INSERT INTO public.case_activities (id, case_id, event_type, message)
VALUES ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 'case_created', 'Synthetic activity');
COMMIT;
'@
            Assert-SyntheticData $source
            $stage = 'prior-to-head upgrade'
            Invoke-Upgrade $expectedHead
            Assert-Revision $source $expectedHead
            Assert-SyntheticData $source

            $stage = 'binary backup and restore'
            $archive = Join-Path $artifactDirectory 'synthetic.dump'
            $partial = "$archive.partial"
            Assert-RecoveryTopology
            Assert-Identity $source
            Assert-ArchiveInventory $source
            $include = @($tableCounts.Keys | ForEach-Object { "--table=public.$_" })
            $dump = $dockerArgs + @('exec') + @(Get-PostgresCommand $source 'pg_dump') +
                @('-w', '--format=custom', '--strict-names') + $include
            Write-Host "Archive staging path: $partial"
            Invoke-BinaryArchive 'dump' $partial $dump
            $length = (Get-Item -LiteralPath $partial).Length
            if ($length -le 0) { throw 'Archive is empty.' }
            $inspect = $dockerArgs + @('exec', '-i', $source.Id, 'pg_restore', '--list')
            Invoke-BinaryArchive 'inspect' $partial $inspect
            $hash = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash
            [IO.File]::Move($partial, $archive)
            Write-Host "Synthetic archive: $archive ($length bytes, SHA-256 $hash)"
            Assert-RecoveryTopology
            Assert-Identity $restore
            Assert-Empty $restore
            $load = $dockerArgs + @('exec', '-i') + @(Get-PostgresCommand $restore 'pg_restore') +
                @('-w', '--single-transaction', '--exit-on-error', '--no-owner', '--no-acl')
            if ((Get-Item -LiteralPath $archive).Length -ne $length -or
                (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -cne $hash) {
                throw 'Archive digest or size changed before restore.'
            }
            Invoke-BinaryArchive 'restore' $archive $load
            Assert-ArchiveInventory $restore
        }
    }
    $stage = 'development metadata comparison'
    if ((Get-DevelopmentMetadata) -cne $developmentBefore) { throw 'Development container or volume metadata changed.' }
    Write-Host "PASS: $Phase. Development container and volume metadata match preflight."
} catch {
    throw "Recovery rehearsal stopped during $stage. $($_.Exception.Message)"
}
