// Injected script for fetch interception
// This runs in the page context to intercept network requests

(function () {
    if (window.__leetcodeSyncInterceptorInjected) return;
    window.__leetcodeSyncInterceptorInjected = true;

    console.log('🔄 LeetCode Sync: Fetch interceptor injected');

    // Function to get code from Monaco editor model (not just visible lines)
    function getMonacoEditorCode() {
        try {
            // Try to find Monaco editor instance
            const editorElements = document.querySelectorAll('.monaco-editor');
            for (const editorElement of editorElements) {
                // Access Monaco's internal model through the DOM element
                const editorInstance = editorElement?.__proto__?.ownerDocument?.defaultView?.monaco?.editor?.getEditors?.();
                if (editorInstance && editorInstance.length > 0) {
                    const model = editorInstance[0].getModel();
                    if (model) {
                        return {
                            code: model.getValue(),
                            language: model.getLanguageId()
                        };
                    }
                }
            }

            // Alternative: Try window.monaco
            if (window.monaco && window.monaco.editor) {
                const editors = window.monaco.editor.getEditors();
                if (editors && editors.length > 0) {
                    const model = editors[0].getModel();
                    if (model) {
                        return {
                            code: model.getValue(),
                            language: model.getLanguageId()
                        };
                    }
                }
            }
        } catch (e) {
            console.error('🔄 LeetCode Sync: Error getting Monaco code', e);
        }
        return null;
    }

    // Expose function for content script to call
    window.__leetcodeSyncGetCode = getMonacoEditorCode;

    // Dispatch code when requested by content script
    window.addEventListener('leetcode-sync-request-code', () => {
        const result = getMonacoEditorCode();
        window.dispatchEvent(new CustomEvent('leetcode-sync-code-response', {
            detail: result
        }));
    });

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        try {
            const url = args[0]?.url || args[0];

            // Check for submission check endpoint
            if (typeof url === 'string' && url.includes('/submissions/detail/') && url.includes('/check/')) {
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();

                console.log('🔄 LeetCode Sync: Submission check response', data.state, data.status_msg);

                if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                    // Get code from Monaco before dispatching event
                    const codeData = getMonacoEditorCode();

                    // Dispatch custom event for content script to catch
                    window.dispatchEvent(new CustomEvent('leetcode-sync-accepted', {
                        detail: {
                            submissionData: data,
                            checkUrl: url,
                            monacoCode: codeData?.code,
                            monacoLanguage: codeData?.language
                        }
                    }));
                }
            }
        } catch (e) {
            // Ignore parsing errors
        }

        return response;
    };

    // Also intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._leetcodeUrl = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
            try {
                if (this._leetcodeUrl && this._leetcodeUrl.includes('/submissions/detail/') && this._leetcodeUrl.includes('/check/')) {
                    const data = JSON.parse(this.responseText);
                    console.log('🔄 LeetCode Sync: XHR Submission check response', data.state, data.status_msg);

                    if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                        // Get code from Monaco
                        const codeData = getMonacoEditorCode();

                        window.dispatchEvent(new CustomEvent('leetcode-sync-accepted', {
                            detail: {
                                submissionData: data,
                                checkUrl: this._leetcodeUrl,
                                monacoCode: codeData?.code,
                                monacoLanguage: codeData?.language
                            }
                        }));
                    }
                }
            } catch (e) { }
        });
        return originalXHRSend.apply(this, arguments);
    };
})();

