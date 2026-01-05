// Injected script for fetch interception
// This runs in the page context to intercept network requests

(function () {
    if (window.__leetcodeSyncInterceptorInjected) return;
    window.__leetcodeSyncInterceptorInjected = true;

    console.log('🔄 LeetCode Sync: Fetch interceptor injected');

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
                    // Dispatch custom event for content script to catch
                    window.dispatchEvent(new CustomEvent('leetcode-sync-accepted', {
                        detail: {
                            submissionData: data,
                            checkUrl: url
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
                        window.dispatchEvent(new CustomEvent('leetcode-sync-accepted', {
                            detail: {
                                submissionData: data,
                                checkUrl: this._leetcodeUrl
                            }
                        }));
                    }
                }
            } catch (e) { }
        });
        return originalXHRSend.apply(this, arguments);
    };
})();
