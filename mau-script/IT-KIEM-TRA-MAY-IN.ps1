# HEXA read-only printer diagnostics, no Print Spooler restart or deletion.
try {
    Write-Host '=== Print Spooler service ==='
    Get-Service -Name Spooler | Format-Table Name,Status,StartType -AutoSize
    Write-Host '=== Installed printers ==='
    Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus,Shared |
        Format-Table -AutoSize
    Write-Host '=== Installed printer drivers ==='
    Get-PrinterDriver | Select-Object Name,Manufacturer,MajorVersion |
        Format-Table -AutoSize
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
