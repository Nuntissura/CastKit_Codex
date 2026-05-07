!include LogicLib.nsh
!include nsDialogs.nsh

Var CKC_RESET_MODE
Var CKC_UPDATE_RADIO
Var CKC_REINSTALL_RADIO
Var CKC_LIGHT_RADIO
Var CKC_FULL_RADIO

!macro customInit
  StrCpy $CKC_RESET_MODE "update"
!macroend

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
  Page custom CkcResetModePageCreate CkcResetModePageLeave
!macroend

Function CkcResetModePageCreate
  ${IfNot} ${FileExists} "$APPDATA\castkit-codex"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "Install mode" "Choose what CastKit-Codex should preserve."

  ${NSD_CreateRadioButton} 0u 0u 100% 14u "Update (preserve all data)"
  Pop $CKC_UPDATE_RADIO
  ${NSD_CreateRadioButton} 0u 20u 100% 14u "Reinstall (preserve all data)"
  Pop $CKC_REINSTALL_RADIO
  ${NSD_CreateRadioButton} 0u 40u 100% 14u "Light reset (wipe preferences only)"
  Pop $CKC_LIGHT_RADIO
  ${NSD_CreateRadioButton} 0u 60u 100% 14u "Full reset (wipe content, keep image bytes)"
  Pop $CKC_FULL_RADIO

  ${NSD_Check} $CKC_UPDATE_RADIO
  nsDialogs::Show
FunctionEnd

Function CkcResetModePageLeave
  ${NSD_GetState} $CKC_UPDATE_RADIO $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CKC_RESET_MODE "update"
  ${EndIf}

  ${NSD_GetState} $CKC_REINSTALL_RADIO $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CKC_RESET_MODE "reinstall"
  ${EndIf}

  ${NSD_GetState} $CKC_LIGHT_RADIO $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CKC_RESET_MODE "light"
  ${EndIf}

  ${NSD_GetState} $CKC_FULL_RADIO $0
  ${If} $0 == ${BST_CHECKED}
    MessageBox MB_ICONEXCLAMATION|MB_YESNO|MB_DEFBUTTON2 "Full reset wipes CastKit-Codex content rows and generated files, but keeps characters\*\images\original and characters\*\images\thumb bytes. Continue?" IDYES +2
    Abort
    StrCpy $CKC_RESET_MODE "full"
  ${EndIf}
FunctionEnd

!macro customInstall
  ${If} $CKC_RESET_MODE == "light"
    Delete "$APPDATA\castkit-codex\ckc-config.json"
    Delete "$APPDATA\castkit-codex\Preferences"
    RMDir /r "$APPDATA\castkit-codex\Local Storage"
    RMDir /r "$APPDATA\castkit-codex\Session Storage"
    RMDir /r "$APPDATA\castkit-codex\IndexedDB"
  ${EndIf}

  ${If} $CKC_RESET_MODE == "full"
    CreateDirectory "$APPDATA\castkit-codex"
    FileOpen $0 "$APPDATA\castkit-codex\.ckc-pending-full-reset" w
    FileWrite $0 '{"kind":"ckc_pending_full_reset","version":1}'
    FileClose $0
    Delete "$APPDATA\castkit-codex\ckc-config.json"
    Delete "$APPDATA\castkit-codex\Preferences"
    RMDir /r "$APPDATA\castkit-codex\Local Storage"
    RMDir /r "$APPDATA\castkit-codex\Session Storage"
    RMDir /r "$APPDATA\castkit-codex\IndexedDB"
    RMDir /r "$APPDATA\castkit-codex\CastKit-Codex-Library\exports"
    RMDir /r "$APPDATA\castkit-codex\CastKit-Codex-Library\templates"
  ${EndIf}
!macroend
