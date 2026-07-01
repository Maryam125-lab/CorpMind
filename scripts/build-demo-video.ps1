$ErrorActionPreference = "Stop"

$dir = "C:\Users\HP\Documents\CorpMind\docs\demo-video"
$scenes = @(
  @{ Image = "scene01-dashboard.png"; Audio = "scene01.wav"; Segment = "segment01.mp4" },
  @{ Image = "scene02-source-library.png"; Audio = "scene02.wav"; Segment = "segment02.mp4" },
  @{ Image = "scene03-document-intelligence.png"; Audio = "scene03.wav"; Segment = "segment03.mp4" },
  @{ Image = "scene04-analysis-modes.png"; Audio = "scene04.wav"; Segment = "segment04.mp4" },
  @{ Image = "scene05-answer-citations.png"; Audio = "scene05.wav"; Segment = "segment05.mp4" },
  @{ Image = "scene06-executive-summary.png"; Audio = "scene06.wav"; Segment = "segment06.mp4" }
)

foreach ($scene in $scenes) {
  $image = Join-Path $dir $scene.Image
  $audio = Join-Path $dir $scene.Audio
  $segment = Join-Path $dir $scene.Segment

  & ffmpeg -y `
    -loop 1 `
    -i $image `
    -i $audio `
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xeef2f1,setsar=1" `
    -c:v libx264 `
    -preset veryfast `
    -tune stillimage `
    -c:a aac `
    -b:a 160k `
    -shortest `
    -pix_fmt yuv420p `
    $segment
}

$concatPath = Join-Path $dir "segments.txt"
$concatLines = $scenes | ForEach-Object {
  $path = (Join-Path $dir $_.Segment).Replace("\", "/")
  "file '$path'"
}
$concatLines | Set-Content -Encoding ASCII $concatPath

$output = Join-Path $dir "corpmind-portfolio-demo.mp4"
& ffmpeg -y `
  -f concat `
  -safe 0 `
  -i $concatPath `
  -c copy `
  $output

Write-Host "Created $output"
