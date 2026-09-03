# Lists resident Sidekick workers: pid, parent process, pid file.
$d = "$env:APPDATA\sidekick"
$ws = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'worker\.ps1' }
foreach ($w in $ws) { $par = Get-Process -Id $w.ParentProcessId -ErrorAction SilentlyContinue; $p = Get-Process -Id $w.ProcessId; "worker pid $($w.ProcessId) parent $($w.ParentProcessId) ($(if ($par) { $par.ProcessName } else { 'gone' })) ws $([math]::Round($p.WorkingSet64/1MB)) MB cpu $($p.TotalProcessorTime.TotalSeconds)s" }
"pid file: [$(Get-Content "$d\worker.pid" -ErrorAction SilentlyContinue)] ready: [$(Get-Content "$d\worker.ready" -ErrorAction SilentlyContinue)]"
