param([string]$Manifest = "$PSScriptRoot/scenes.json", [switch]$Force)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft David Desktop')
$speaker.Rate = 2
$speaker.Volume = 95
$scenes = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$audioDirectory = Join-Path $PSScriptRoot 'audio'
New-Item -ItemType Directory -Force -Path $audioDirectory | Out-Null
try {
    foreach ($scene in $scenes) {
        $index = 0
        foreach ($sentence in $scene.narration) {
            $target = Join-Path $audioDirectory ('{0}-{1:D2}.wav' -f $scene.id, $index)
            if ($Force -or -not (Test-Path -LiteralPath $target)) {
                $speaker.SetOutputToWaveFile($target)
                $speaker.Speak($sentence)
                $speaker.SetOutputToNull()
            }
            $index++
        }
        Write-Output ('Narrated: ' + $scene.id)
    }
} finally {
    $speaker.Dispose()
}
