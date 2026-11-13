# HEXA read-only Windows inventory report. Saves a CSV on the current user's Desktop.
$ErrorActionPreference = 'Stop'
try {
    $computer = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $ipv4 = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
        Select-Object -ExpandProperty IPAddress
    $result = [PSCustomObject]@{
        Hostname = $env:COMPUTERNAME
        Model = $computer.Model
        Manufacturer = $computer.Manufacturer
        SerialNumber = $bios.SerialNumber
        CPU = $cpu.Name
        RAM_GB = [math]::Round($computer.TotalPhysicalMemory / 1GB, 2)
        Windows = $os.Caption
        Version = $os.Version
        IPAddress = ($ipv4 -join ', ')
        DiskC_TotalGB = if ($disk) { [math]::Round($disk.Size / 1GB, 2) } else { $null }
        DiskC_FreeGB = if ($disk) { [math]::Round($disk.FreeSpace / 1GB, 2) } else { $null }
        CollectedAt = (Get-Date).ToString('s')
    }
    $desktop = [Environment]::GetFolderPath('Desktop')
    $output = Join-Path $desktop ('HEXA-PC-INFO-' + $env:COMPUTERNAME + '.csv')
    $result | Export-Csv -Path $output -Encoding UTF8 -NoTypeInformation
    $result | Format-List
    Write-Host "Report saved: $output"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
