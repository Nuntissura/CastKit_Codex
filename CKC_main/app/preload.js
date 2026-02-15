const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('ckc', {
    initialize: () => ipcRenderer.invoke('ckc:initialize'),
    getConfig: () => ipcRenderer.invoke('ckc:getConfig'),
    getConfigInfo: () => ipcRenderer.invoke('ckc:getConfigInfo'),
    setConfig: (cfg) => ipcRenderer.invoke('ckc:setConfig', cfg),

    openReferenceWindow: () => ipcRenderer.invoke('ckc:openReferenceWindow'),
    closeReferenceWindow: () => ipcRenderer.invoke('ckc:closeReferenceWindow'),
    getReferenceWindowState: () => ipcRenderer.invoke('ckc:getReferenceWindowState'),
    setReferenceWindowOptions: (params) => ipcRenderer.invoke('ckc:setReferenceWindowOptions', params),
    setReferenceSelection: (params) => ipcRenderer.invoke('ckc:setReferenceSelection', params),
    onReferenceSelection: (cb) => {
        const handler = (_evt, payload) => cb(payload);
        ipcRenderer.on('ckc:referenceSelection', handler);
        return () => ipcRenderer.removeListener('ckc:referenceSelection', handler);
    },
    onReferenceWindowState: (cb) => {
        const handler = (_evt, payload) => cb(payload);
        ipcRenderer.on('ckc:referenceWindowState', handler);
        return () => ipcRenderer.removeListener('ckc:referenceWindowState', handler);
    },

    llmChat: (params) => ipcRenderer.invoke('ckc:llmChat', params),
    selectLibraryRoot: () => ipcRenderer.invoke('ckc:selectLibraryRoot'),
    getDefaultLibraryRootInfo: () => ipcRenderer.invoke('ckc:getDefaultLibraryRootInfo'),
    resetLibraryRootToDefault: () => ipcRenderer.invoke('ckc:resetLibraryRootToDefault'),
    getLibraryDiagnostics: (params) => ipcRenderer.invoke('ckc:getLibraryDiagnostics', params),
    listDuplicateGroups: (params) => ipcRenderer.invoke('ckc:listDuplicateGroups', params),
    listTagStats: () => ipcRenderer.invoke('ckc:listTagStats'),
    mergeTags: (params) => ipcRenderer.invoke('ckc:mergeTags', params),
    renameTag: (params) => ipcRenderer.invoke('ckc:renameTag', params),

    getTemplate: () => ipcRenderer.invoke('ckc:getTemplate'),
    listTemplates: () => ipcRenderer.invoke('ckc:listTemplates'),
    getTemplateDetail: (templateId) => ipcRenderer.invoke('ckc:getTemplateDetail', templateId),
    setDefaultTemplateId: (templateId) => ipcRenderer.invoke('ckc:setDefaultTemplateId', templateId),
    importTemplateFromDialog: () => ipcRenderer.invoke('ckc:importTemplateFromDialog'),

    listCharacters: (params) => ipcRenderer.invoke('ckc:listCharacters', params),
    listAllTags: () => ipcRenderer.invoke('ckc:listAllTags'),
    listFieldValueSuggestions: (params) => ipcRenderer.invoke('ckc:listFieldValueSuggestions', params),
    listGlobalCarouselImages: (params) => ipcRenderer.invoke('ckc:listGlobalCarouselImages', params),
    listInboxImages: () => ipcRenderer.invoke('ckc:listInboxImages'),
    listDocs: (params) => ipcRenderer.invoke('ckc:listDocs', params),
    getDoc: (params) => ipcRenderer.invoke('ckc:getDoc', params),
    upsertDoc: (params) => ipcRenderer.invoke('ckc:upsertDoc', params),
    deleteDoc: (params) => ipcRenderer.invoke('ckc:deleteDoc', params),
    getStoryBoard: (params) => ipcRenderer.invoke('ckc:getStoryBoard', params),
    setStoryBoard: (params) => ipcRenderer.invoke('ckc:setStoryBoard', params),
    resolveLinkToken: (token) => ipcRenderer.invoke('ckc:resolveLinkToken', token),
    listBacklinks: (params) => ipcRenderer.invoke('ckc:listBacklinks', params),

    listSavedSearches: () => ipcRenderer.invoke('ckc:listSavedSearches'),
    createSavedSearch: (params) => ipcRenderer.invoke('ckc:createSavedSearch', params),
    updateSavedSearch: (params) => ipcRenderer.invoke('ckc:updateSavedSearch', params),
    deleteSavedSearch: (searchId) => ipcRenderer.invoke('ckc:deleteSavedSearch', searchId),

    listTagTemplates: () => ipcRenderer.invoke('ckc:listTagTemplates'),
    listTagTemplateVersions: (templateName) => ipcRenderer.invoke('ckc:listTagTemplateVersions', templateName),
    upsertTagTemplate: (params) => ipcRenderer.invoke('ckc:upsertTagTemplate', params),
    deleteTagTemplateVersion: (params) => ipcRenderer.invoke('ckc:deleteTagTemplateVersion', params),
    applyTagTemplateToCharacter: (params) => ipcRenderer.invoke('ckc:applyTagTemplateToCharacter', params),

    listTagRules: (params) => ipcRenderer.invoke('ckc:listTagRules', params),
    createTagRule: (params) => ipcRenderer.invoke('ckc:createTagRule', params),
    updateTagRule: (params) => ipcRenderer.invoke('ckc:updateTagRule', params),
    deleteTagRule: (ruleId) => ipcRenderer.invoke('ckc:deleteTagRule', ruleId),
    recomputeDerivedTags: (characterId) => ipcRenderer.invoke('ckc:recomputeDerivedTags', characterId),
    recomputeDerivedTagsAll: () => ipcRenderer.invoke('ckc:recomputeDerivedTagsAll'),

    listAuditLog: (params) => ipcRenderer.invoke('ckc:listAuditLog', params),

    listSpinOffs: (params) => ipcRenderer.invoke('ckc:listSpinOffs', params),
    getSpinOff: (spinoffId) => ipcRenderer.invoke('ckc:getSpinOff', spinoffId),
    createSpinOff: (params) => ipcRenderer.invoke('ckc:createSpinOff', params),
    updateSpinOff: (params) => ipcRenderer.invoke('ckc:updateSpinOff', params),
    deleteSpinOff: (spinoffId) => ipcRenderer.invoke('ckc:deleteSpinOff', spinoffId),

    getCharacter: (characterId) => ipcRenderer.invoke('ckc:getCharacter', characterId),
    setCharacterIcon: (params) => ipcRenderer.invoke('ckc:setCharacterIcon', params),
    createCharacter: (params) => ipcRenderer.invoke('ckc:createCharacter', params),
    importCharacterFromSheetDialog: () => ipcRenderer.invoke('ckc:importCharacterFromSheetDialog'),
    saveCharacter: (params) => ipcRenderer.invoke('ckc:saveCharacter', params),

    addManualTag: (params) => ipcRenderer.invoke('ckc:addManualTag', params),
    removeManualTag: (params) => ipcRenderer.invoke('ckc:removeManualTag', params),

    listProtectedFieldIds: (characterId) => ipcRenderer.invoke('ckc:listProtectedFieldIds', characterId),
    listProtectedFieldIdsGlobal: () => ipcRenderer.invoke('ckc:listProtectedFieldIdsGlobal'),
    listProtectedFieldIdsForCharacter: (characterId) => ipcRenderer.invoke('ckc:listProtectedFieldIdsForCharacter', characterId),
    setProtectedFieldIdsGlobal: (fieldIds) => ipcRenderer.invoke('ckc:setProtectedFieldIdsGlobal', fieldIds),
    setProtectedFieldIdsForCharacter: (params) => ipcRenderer.invoke('ckc:setProtectedFieldIdsForCharacter', params),

    ingestPreview: (params) => ipcRenderer.invoke('ckc:ingestPreview', params),
    ingestApply: (params) => ipcRenderer.invoke('ckc:ingestApply', params),
    ingestCreateCharacter: (params) => ipcRenderer.invoke('ckc:ingestCreateCharacter', params),
    openTextFileDialog: (opts) => ipcRenderer.invoke('ckc:openTextFileDialog', opts),
    selectFolderDialog: (opts) => ipcRenderer.invoke('ckc:selectFolderDialog', opts),

    patchPreview: (params) => ipcRenderer.invoke('ckc:patchPreview', params),
    patchApply: (params) => ipcRenderer.invoke('ckc:patchApply', params),

    exportEmptyTemplate: (params) => ipcRenderer.invoke('ckc:exportEmptyTemplate', params),
    exportTemplateFieldPack: (params) => ipcRenderer.invoke('ckc:exportTemplateFieldPack', params),
    exportBundle: (params) => ipcRenderer.invoke('ckc:exportBundle', params),
    listVersions: (characterId) => ipcRenderer.invoke('ckc:listVersions', characterId),
    diffVersions: (params) => ipcRenderer.invoke('ckc:diffVersions', params),
    revertPreviewFromVersion: (params) => ipcRenderer.invoke('ckc:revertPreviewFromVersion', params),
    revertApplyFromVersion: (params) => ipcRenderer.invoke('ckc:revertApplyFromVersion', params),
    repairCharacterFolders: (characterId) => ipcRenderer.invoke('ckc:repairCharacterFolders', characterId),
    exportFieldPack: (params) => ipcRenderer.invoke('ckc:exportFieldPack', params),

    importImages: (params) => ipcRenderer.invoke('ckc:importImages', params),
    importClipboardImage: (params) => ipcRenderer.invoke('ckc:importClipboardImage', params),
    scanInbox: (params) => ipcRenderer.invoke('ckc:scanInbox', params),
    moveImagesToCharacter: (params) => ipcRenderer.invoke('ckc:moveImagesToCharacter', params),
    deleteImages: (params) => ipcRenderer.invoke('ckc:deleteImages', params),
    repairMissingImagesByHash: (params) => ipcRenderer.invoke('ckc:repairMissingImagesByHash', params),
    repairThumbnails: (characterId) => ipcRenderer.invoke('ckc:repairThumbnails', characterId),
    setImageMeta: (params) => ipcRenderer.invoke('ckc:setImageMeta', params),
    getImageAnnotations: (params) => ipcRenderer.invoke('ckc:getImageAnnotations', params),
    setImageAnnotations: (params) => ipcRenderer.invoke('ckc:setImageAnnotations', params),
    setImagesMetaBatch: (params) => ipcRenderer.invoke('ckc:setImagesMetaBatch', params),

    openPath: (filePath) => ipcRenderer.invoke('ckc:openPath', filePath),
    copyText: (text) => clipboard.writeText(String(text ?? '')),
});
