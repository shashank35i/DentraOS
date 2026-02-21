$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PYTHONPATH = "$scriptDir" + ($(if ($env:PYTHONPATH) { ";$env:PYTHONPATH" } else { "" }))

python -m dental_agents.main_worker
