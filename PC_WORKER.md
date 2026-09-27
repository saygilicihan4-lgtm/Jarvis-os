# JARVIS PC Worker

Bu worker, telefondaki JARVIS Command Center ile bilgisayar arasında güvenli köprü kurar.

Node.js 18+ gerekir.

macOS / Linux:

```bash
export JARVIS_URL="https://jarvis-os-1iuv.onrender.com"
export JARVIS_TOKEN="<erişim-anahtarın>"
npm run worker
```

Windows PowerShell:

```powershell
$env:JARVIS_URL="https://jarvis-os-1iuv.onrender.com"
$env:JARVIS_TOKEN="<erişim-anahtarın>"
npm run worker
```

Varsayılan çalışma klasörü: `./jarvis-workspace`

İlk güvenli araçlar:
- `PC: sistem durumu`
- `PC: dosyaları listele`
- `PC: not al ...`

Worker keyfi shell/terminal komutu çalıştırmaz.
