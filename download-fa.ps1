$baseUrl = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0"
$destDir = "c:\Users\esth633\Desktop\hk\wwwroot\lib\fontawesome"
New-Item -ItemType Directory -Force -Path "$destDir\css" | Out-Null
New-Item -ItemType Directory -Force -Path "$destDir\webfonts" | Out-Null

Invoke-WebRequest -Uri "$baseUrl/css/all.min.css" -OutFile "$destDir\css\all.min.css"

$fonts = @(
    "fa-solid-900.woff2", "fa-solid-900.ttf",
    "fa-regular-400.woff2", "fa-regular-400.ttf",
    "fa-brands-400.woff2", "fa-brands-400.ttf",
    "fa-v4compatibility.woff2", "fa-v4compatibility.ttf"
)

foreach ($font in $fonts) {
    try {
        Invoke-WebRequest -Uri "$baseUrl/webfonts/$font" -OutFile "$destDir\webfonts/$font" -ErrorAction Stop
        Write-Host "Downloaded $font"
    } catch {
        Write-Host "Failed or skipped $font"
    }
}
Write-Host "All assets downloaded successfully."
