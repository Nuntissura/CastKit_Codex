# Data Recovery Guide (R‑Studio) — for total beginners

This guide is written for the situation where a large NTFS drive looks “healthy but empty” (files deleted / folder structure missing), and you are using **R‑Studio** (R‑Tools) to recover data.

If the deleted data is extremely valuable (business-critical / irreplaceable), the safest option is **stop now** and use a professional recovery service. Every minute the drive is used can reduce recoverability.

## 0) The most important rule (do this first)
**Do not write anything to the affected drive.**

That means:
- Don’t copy files *to* it
- Don’t install programs to it
- Don’t “format” it
- Don’t run “repair” tools like `chkdsk`
- Don’t “optimize/defrag” it

Recover files **to a different drive** (for example your NAS or your CKC work drive, e.g. `<CKC_ROOT>`).

## 1) Prepare a safe recovery destination
Create a folder on a different drive with lots of free space, e.g.:
- `<RECOVERY_ROOT>\Recovered_D\`

You must have enough free space to hold the recovered files (often multiple TB).

## 2) Install / run R‑Studio safely
- Install R‑Studio on your **system drive** (`C:`) or another safe drive (not the affected drive).
- Run R‑Studio **as Administrator** (right‑click → Run as administrator).

## 3) Identify the correct disk in R‑Studio
In the left panel you will see:
- **Drives** (physical disks) and
- **Volumes/Partitions** (like `D:`)

Select the **physical disk** that matches the size (you mentioned ~14.5 TB).

Tip: If you’re unsure, look for clues like model name, serial, sector size, and the partition layout.

## 4) (Recommended) Make an image first (best safety)
If you have enough space on another drive, creating an image makes recovery safer because you can retry without touching the original disk.

In R‑Studio, look for something like:
- “Create Image” / “Byte‑by‑byte image”

Save the image to your NAS (preferred) or your CKC work drive (e.g. `<CKC_ROOT>`), then run scans on the **image** instead of the real disk.

If you don’t have enough space for an image: continue without imaging, but be extra careful not to write to the disk.

## 5) Start a scan (what to check/uncheck)
Right‑click the **physical disk** → **Scan**.

### First scan (fastest, keeps folder names when possible)
Use these settings:
- File systems: **NTFS** (and you can leave others unchecked to speed up)
- **Uncheck**: “Extra search for known file types”

Why: This first pass tries to reconstruct the NTFS file system and recover original names/folders. It’s usually what you want first.

### If the first scan finds almost nothing (deeper scan)
Run another scan (or re-scan) with:
- **Check**: “Extra search for known file types”

Why: This can find files even when NTFS metadata is badly damaged, but you may lose original names/folders and it takes much longer.

For a 14.5 TB HDD, this can take **many hours to multiple days**.

## 6) Don’t stop scans unless you must
If you stop and restart scanning:
- It’s not “bad”, but you lose time because it scans again.
- If you restarted, keep it running as long as the PC is stable.

If R‑Studio offers to save scan information / session, save it to your NAS or your CKC work drive (e.g. `<CKC_ROOT>`) so you can resume later.

## 7) After the scan: where to look
When the scan finishes, you’ll see results like:
- “Recognized” partitions/volumes
- “Found” file systems

Open the result that looks most like your old `D:` volume:
- correct size
- correct NTFS
- shows folders you recognize

## 8) Preview a few files (sanity check)
Before recovering TBs of data:
- Try previewing a few common files (images/videos/docs) inside R‑Studio.
- Confirm they open and look correct.

If previews look corrupted:
- Try a different scan result (another “Found/Recognized” volume).
- Consider the deeper scan with “known file types”.

## 9) Recover files (do this carefully)
Select the folders/files you want → “Recover”.

Important:
- Recovery destination must be **NOT** the affected drive.
- Recover to `<RECOVERY_ROOT>\Recovered_D\...` or the NAS.

## 10) Demo limitations
The free demo typically:
- Lets you scan and preview
- Limits how much you can actually recover

If you can preview but can’t recover due to demo limits, you’ll need a licensed recovery tool (R‑Studio or another reputable recovery product) — but still recover to another disk.

## 11) If you get stuck, collect these details
If you want help interpreting results, write down:
- The scan settings you used (checked/unchecked boxes)
- What “Found/Recognized” entries appear (sizes / file system types)
- Whether you see your old folder structure
- Whether previews work

## 12) What NOT to do
- Don’t run `chkdsk /f` or any “repair filesystem” tools on the affected drive.
- Don’t format the drive (even “quick format”) — that overwrites metadata.
- Don’t keep using the drive normally “until later”.
