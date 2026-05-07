"""CastKit-Codex ComfyUI bridge node.

Install by copying this `comfyui_node` folder into ComfyUI's `custom_nodes`
directory or by symlinking it there. The node always saves the image to
ComfyUI output first; CKC intake failures are logged and do not fail the
generation.
"""

import base64
import io
import json
import os
import time
import urllib.error
import urllib.request


def _env(name, fallback=""):
    value = os.environ.get(name, fallback)
    return str(value).strip()


def _post_json(url, payload, token):
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", "replace")


class CastKitCodexBridge:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
            },
            "optional": {
                "filename_prefix": ("STRING", {"default": "ckc"}),
                "character_id": ("STRING", {"default": ""}),
                "rig_id": ("STRING", {"default": ""}),
                "openpose_ref": ("STRING", {"default": ""}),
                "title": ("STRING", {"default": ""}),
                "yaw_bin": ("STRING", {"default": ""}),
                "tags": ("STRING", {"default": ""}),
                "model": ("STRING", {"default": ""}),
                "sampler": ("STRING", {"default": ""}),
                "cfg": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 100.0}),
                "steps": ("INT", {"default": 0, "min": 0, "max": 1000}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFF}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "save_and_register"
    CATEGORY = "CastKit-Codex"

    def save_and_register(
        self,
        images,
        filename_prefix="ckc",
        character_id="",
        rig_id="",
        openpose_ref="",
        title="",
        yaw_bin="",
        tags="",
        model="",
        sampler="",
        cfg=0.0,
        steps=0,
        seed=0,
        prompt=None,
        extra_pnginfo=None,
    ):
        try:
            from PIL import Image
            import folder_paths
        except Exception as exc:
            print("[castkit-codex-bridge] ComfyUI image modules unavailable:", exc)
            return ()

        out_dir = folder_paths.get_output_directory()
        os.makedirs(out_dir, exist_ok=True)

        intake_url = _env("CKC_INTAKE_URL")
        target_character = str(character_id or _env("CKC_INTAKE_CHARACTER")).strip()
        target_rig = str(rig_id or _env("CKC_INTAKE_RIG")).strip() or None
        target_openpose = str(openpose_ref or _env("CKC_INTAKE_OPENPOSE_REF")).strip() or None
        token = _env("CKC_INTAKE_TOKEN")
        session_id = _env("CKC_INTAKE_SESSION", "ckc-bridge-%s-%s" % (os.getpid(), int(time.time())))

        for batch_index in range(images.shape[0]):
            arr = (images[batch_index].cpu().numpy() * 255.0).clip(0, 255).astype("uint8")
            img = Image.fromarray(arr)
            filename = "%s_%s_%05d.png" % (filename_prefix or "ckc", int(time.time()), batch_index)
            path = os.path.join(out_dir, filename)
            img.save(path)

            if not intake_url or not target_character:
                print("[castkit-codex-bridge] saved=%s; CKC intake env/character missing, skipping POST" % path)
                continue

            buf = io.BytesIO()
            img.save(buf, format="PNG")
            payload = {
                "schema": "ckc.intake.comfyui_output@1",
                "character_id": target_character,
                "rig_id": target_rig,
                "openpose_ref": target_openpose,
                "image_b64": base64.b64encode(buf.getvalue()).decode("ascii"),
                "filename_hint": filename,
                "workflow_json": prompt if prompt is not None else {},
                "metadata": {
                    "title": title,
                    "yaw_bin": yaw_bin,
                    "tags": tags,
                    "model": model,
                    "sampler": sampler,
                    "cfg": cfg,
                    "steps": steps,
                    "seed": seed,
                    "extra_pnginfo": extra_pnginfo if extra_pnginfo is not None else {},
                },
                "session_id": session_id,
            }
            try:
                body = _post_json(intake_url, payload, token)
                print("[castkit-codex-bridge] CKC POST ok:", body)
            except urllib.error.HTTPError as exc:
                print("[castkit-codex-bridge] CKC HTTP %s: %s" % (exc.code, exc.read().decode("utf-8", "replace")))
            except Exception as exc:
                print("[castkit-codex-bridge] CKC POST failed (non-fatal):", exc)

        return ()


NODE_CLASS_MAPPINGS = {"CastKitCodexBridge": CastKitCodexBridge}
NODE_DISPLAY_NAME_MAPPINGS = {"CastKitCodexBridge": "CastKit-Codex Bridge"}
