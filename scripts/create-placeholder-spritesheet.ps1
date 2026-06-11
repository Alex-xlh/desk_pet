$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assetDir = Join-Path $root "assets\pets\default"
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

Add-Type -AssemblyName System.Drawing

$frameWidth = 128
$frameHeight = 128
$frames = 8
$rows = 5
$sheet = New-Object System.Drawing.Bitmap ($frameWidth * $frames), ($frameHeight * $rows), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-Brush([int]$r, [int]$g, [int]$b, [int]$a = 255) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($a, $r, $g, $b))
}

function New-Pen([int]$r, [int]$g, [int]$b, [float]$w = 3, [int]$a = 255) {
  return New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($a, $r, $g, $b)), $w
}

$bodyBrush = New-Brush 246 180 81
$bellyBrush = New-Brush 255 232 180
$earBrush = New-Brush 225 127 72
$linePen = New-Pen 86 61 42 4
$eyeBrush = New-Brush 42 38 35
$blushBrush = New-Brush 244 117 117 150
$happyBrush = New-Brush 255 244 125

for ($row = 0; $row -lt $rows; $row++) {
  for ($i = 0; $i -lt $frames; $i++) {
    $x = $i * $frameWidth
    $y = $row * $frameHeight
    $phase = [Math]::Sin(($i / $frames) * [Math]::PI * 2)
    $bob = [int]($phase * 4)
    $lean = 0
    $tailLift = 0
    $mouthHappy = $false

    if ($row -eq 1) {
      $lean = [int]($phase * 3)
      $tailLift = [int]($phase * 6)
    }
    elseif ($row -eq 2) {
      $lean = 8
      $bob = [int]([Math]::Abs($phase) * -7)
      $tailLift = 10
    }
    elseif ($row -eq 3) {
      $bob = -8
      $lean = [int]($phase * 5)
    }
    elseif ($row -eq 4) {
      $mouthHappy = $true
      $bob = [int]($phase * 2) - 2
      $tailLift = 8
    }

    $cx = $x + 64 + $lean
    $cy = $y + 70 + $bob

    $tailPen = New-Pen 86 61 42 5
    $graphics.DrawBezier($tailPen, $cx + 32, $cy + 22, $cx + 60, $cy + 5 - $tailLift, $cx + 54, $cy - 26 - $tailLift, $cx + 31, $cy - 17)

    $leftEar = @(
      [System.Drawing.Point]::new($cx - 30, $cy - 38),
      [System.Drawing.Point]::new($cx - 12, $cy - 64),
      [System.Drawing.Point]::new($cx - 2, $cy - 32)
    )
    $rightEar = @(
      [System.Drawing.Point]::new($cx + 30, $cy - 38),
      [System.Drawing.Point]::new($cx + 12, $cy - 64),
      [System.Drawing.Point]::new($cx + 2, $cy - 32)
    )

    $graphics.FillPolygon($earBrush, $leftEar)
    $graphics.FillPolygon($earBrush, $rightEar)
    $graphics.DrawPolygon($linePen, $leftEar)
    $graphics.DrawPolygon($linePen, $rightEar)

    $graphics.FillEllipse($bodyBrush, $cx - 36, $cy - 44, 72, 78)
    $graphics.DrawEllipse($linePen, $cx - 36, $cy - 44, 72, 78)
    $graphics.FillEllipse($bellyBrush, $cx - 22, $cy - 5, 44, 35)

    if ($row -eq 3) {
      $graphics.FillEllipse($bodyBrush, $cx - 50, $cy - 12, 26, 14)
      $graphics.DrawEllipse($linePen, $cx - 50, $cy - 12, 26, 14)
      $graphics.FillEllipse($bodyBrush, $cx + 24, $cy - 12, 26, 14)
      $graphics.DrawEllipse($linePen, $cx + 24, $cy - 12, 26, 14)
    }
    else {
      $legOffset = [int]($phase * 5)
      $graphics.FillEllipse($bodyBrush, $cx - 26 + $legOffset, $cy + 26, 22, 16)
      $graphics.FillEllipse($bodyBrush, $cx + 4 - $legOffset, $cy + 26, 22, 16)
      $graphics.DrawEllipse($linePen, $cx - 26 + $legOffset, $cy + 26, 22, 16)
      $graphics.DrawEllipse($linePen, $cx + 4 - $legOffset, $cy + 26, 22, 16)
    }

    $graphics.FillEllipse($eyeBrush, $cx - 17, $cy - 18, 7, 9)
    $graphics.FillEllipse($eyeBrush, $cx + 10, $cy - 18, 7, 9)
    $graphics.FillEllipse($blushBrush, $cx - 27, $cy - 4, 12, 7)
    $graphics.FillEllipse($blushBrush, $cx + 15, $cy - 4, 12, 7)

    $mouthPen = New-Pen 86 61 42 2
    if ($mouthHappy) {
      $graphics.DrawArc($mouthPen, $cx - 10, $cy - 8, 20, 16, 10, 160)
      $graphics.FillEllipse($happyBrush, $cx - 42, $cy - 58, 12, 12)
      $graphics.FillEllipse($happyBrush, $cx + 32, $cy - 55, 9, 9)
    }
    else {
      $graphics.DrawArc($mouthPen, $cx - 8, $cy - 5, 16, 12, 20, 140)
    }
  }
}

$spritesheetPath = Join-Path $assetDir "spritesheet.png"
$previewPath = Join-Path $assetDir "preview.png"
$sheet.Save($spritesheetPath, [System.Drawing.Imaging.ImageFormat]::Png)

$preview = $sheet.Clone([System.Drawing.Rectangle]::new(0, 0, $frameWidth, $frameHeight), $sheet.PixelFormat)
$preview.Save($previewPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$sheet.Dispose()
$preview.Dispose()

$manifestJson = @'
{
  "name": "default",
  "frameWidth": 128,
  "frameHeight": 128,
  "defaultScale": 1,
  "anchor": {
    "x": 0.5,
    "y": 0.92
  },
  "animations": {
    "idle": { "row": 0, "frames": 8, "fps": 8 },
    "walk": { "row": 1, "frames": 8, "fps": 11 },
    "run": { "row": 2, "frames": 8, "fps": 16 },
    "drag": { "row": 3, "frames": 8, "fps": 8 },
    "happy": { "row": 4, "frames": 8, "fps": 10 }
  }
}
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $assetDir "pet.json"), $manifestJson, $utf8NoBom)
