# CastKit Codex (CKC)

Source repo: `K:\CastKit Codex\CKC_main`  
Governance / artifacts: `K:\CastKit Codex\CKC_GOV`

## Dev
```powershell
cd "K:\CastKit Codex\CKC_main"
npm install
npm run dev
```

Run the full Electron app (renderer + main process):
```powershell
npm run electron:dev
```

## Build (local)
Build output goes to `K:\CastKit Codex\CKC_GOV\targets\scratch\renderer-dist`.
```powershell
npm run build
```

## Package (Windows)
Outputs to `K:\CastKit Codex\CKC_GOV\targets\CKC\artifacts`.
```powershell
npm run package:win
```

Packaging creates a **versioned** output folder under:
- `K:\CastKit Codex\CKC_GOV\targets\CKC\artifacts\`
