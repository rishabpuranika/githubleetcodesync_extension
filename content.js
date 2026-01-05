// LeetCode GitHub Sync - Content Script
// Detects successful submissions and extracts problem data

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.leetcodeSyncInjected) return;
    window.leetcodeSyncInjected = true;

    console.log('🔄 LeetCode Sync: Content script loaded');

    // Language extension mapping
    const LANGUAGE_EXTENSIONS = {
        'javascript': 'js',
        'typescript': 'ts',
        'python': 'py',
        'python3': 'py',
        'java': 'java',
        'c++': 'cpp',
        'cpp': 'cpp',
        'c': 'c',
        'csharp': 'cs',
        'c#': 'cs',
        'ruby': 'rb',
        'swift': 'swift',
        'go': 'go',
        'golang': 'go',
        'scala': 'scala',
        'kotlin': 'kt',
        'rust': 'rs',
        'php': 'php',
        'sql': 'sql',
        'mysql': 'sql',
        'postgresql': 'sql',
        'oracle': 'sql',
        'mssql': 'sql',
        'bash': 'sh',
        'shell': 'sh',
        'racket': 'rkt',
        'erlang': 'erl',
        'elixir': 'ex',
        'dart': 'dart'
    };

    // Inject the fetch interceptor script from a file (to avoid CSP issues)
    function injectScript() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injected.js');
        script.onload = function () {
            console.log('🔄 LeetCode Sync: Injected script loaded');
            this.remove();
        };
        script.onerror = function () {
            console.error('🔄 LeetCode Sync: Failed to load injected script');
        };
        (document.head || document.documentElement).appendChild(script);
    }

    // Inject the script as soon as possible
    if (document.head || document.documentElement) {
        injectScript();
    } else {
        document.addEventListener('DOMContentLoaded', injectScript);
    }

    // Track the last submission to avoid duplicates
    let lastSubmissionId = null;
    let isProcessing = false;

    // Listen for custom events from injected script
    window.addEventListener('leetcode-sync-accepted', async (event) => {
        const { submissionData, checkUrl } = event.detail;
        await handleAcceptedSubmission(submissionData, checkUrl);
    });

    async function handleAcceptedSubmission(submissionData, checkUrl) {
        // Extract submission ID from URL
        const submissionIdMatch = checkUrl.match(/\/submissions\/detail\/(\d+)\//);
        if (!submissionIdMatch) return;

        const submissionId = submissionIdMatch[1];

        // Avoid duplicate processing
        if (submissionId === lastSubmissionId || isProcessing) return;
        lastSubmissionId = submissionId;
        isProcessing = true;

        console.log('🎉 LeetCode Sync: Accepted submission detected!', submissionId);
        showNotification('🔄 Syncing to GitHub...', 'info');

        try {
            // Get problem info
            const problemData = await getProblemData();
            if (!problemData) {
                console.error('LeetCode Sync: Could not get problem data');
                showNotification('❌ Could not get problem data', 'error');
                isProcessing = false;
                return;
            }

            console.log('🔄 LeetCode Sync: Got problem data', problemData.title);

            // Get the code from the editor
            const code = getCodeFromEditor();
            if (!code) {
                console.error('LeetCode Sync: Could not get code from editor');
                showNotification('❌ Could not get code from editor', 'error');
                isProcessing = false;
                return;
            }

            console.log('🔄 LeetCode Sync: Got code, length:', code.length);

            // Get language
            const language = getSelectedLanguage();
            console.log('🔄 LeetCode Sync: Detected language:', language);

            // Send to background script
            chrome.runtime.sendMessage({
                type: 'SYNC_SUBMISSION',
                data: {
                    submissionId,
                    problemId: problemData.questionId,
                    problemTitle: problemData.title,
                    problemSlug: problemData.titleSlug,
                    difficulty: problemData.difficulty,
                    problemDescription: problemData.content,
                    code: code,
                    language: language,
                    languageExt: LANGUAGE_EXTENSIONS[language.toLowerCase()] || 'txt',
                    runtime: submissionData.status_runtime || 'N/A',
                    memory: submissionData.status_memory || 'N/A',
                    timestamp: new Date().toISOString()
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('LeetCode Sync: Runtime error', chrome.runtime.lastError);
                    showNotification('❌ Extension error: ' + chrome.runtime.lastError.message, 'error');
                } else if (response && response.success) {
                    showNotification('✅ Solution synced to GitHub!', 'success');
                } else {
                    showNotification('❌ Sync failed: ' + (response?.error || 'Unknown error'), 'error');
                }
                isProcessing = false;
            });

        } catch (error) {
            console.error('LeetCode Sync: Error processing submission', error);
            showNotification('❌ Sync error: ' + error.message, 'error');
            isProcessing = false;
        }
    }

    async function getProblemData() {
        // Extract problem slug from URL
        const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
        if (!pathMatch) return null;

        const titleSlug = pathMatch[1];

        try {
            // Use LeetCode's GraphQL API
            const response = await fetch('https://leetcode.com/graphql/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `
            query getQuestionDetail($titleSlug: String!) {
              question(titleSlug: $titleSlug) {
                questionId
                title
                titleSlug
                difficulty
                content
              }
            }
          `,
                    variables: { titleSlug }
                })
            });

            const result = await response.json();
            return result.data?.question;
        } catch (error) {
            console.error('LeetCode Sync: GraphQL query failed', error);
            return null;
        }
    }

    function getCodeFromEditor() {
        // Method 1: Look for the code in view-lines (Monaco)
        const viewLines = document.querySelectorAll('.view-lines .view-line');
        if (viewLines.length > 0) {
            const lines = [];
            viewLines.forEach(line => {
                // Get text content, handling spans
                let lineText = '';
                const spans = line.querySelectorAll('span span');
                if (spans.length > 0) {
                    spans.forEach(span => {
                        lineText += span.textContent;
                    });
                } else {
                    lineText = line.textContent;
                }
                lines.push(lineText);
            });
            const code = lines.join('\n');
            if (code.trim().length > 10) {
                return code;
            }
        }

        // Method 2: Try to find code in any pre/code blocks
        const codeBlocks = document.querySelectorAll('pre code, .ace_content');
        for (const block of codeBlocks) {
            const text = block.textContent;
            if (text && text.length > 20) {
                return text;
            }
        }

        // Method 3: Get from localStorage (LeetCode sometimes stores code there)
        try {
            const pathname = window.location.pathname;
            const slugMatch = pathname.match(/\/problems\/([^/]+)/);
            if (slugMatch) {
                const slug = slugMatch[1];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.includes(slug) && key.includes('code')) {
                        const value = localStorage.getItem(key);
                        if (value && value.length > 20) {
                            try {
                                const parsed = JSON.parse(value);
                                if (typeof parsed === 'string') return parsed;
                                if (parsed.code) return parsed.code;
                            } catch {
                                return value;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('LeetCode Sync: Error reading localStorage', e);
        }

        return null;
    }

    function getSelectedLanguage() {
        // Method 1: Look for language button in new UI
        const langButtons = document.querySelectorAll('button');
        for (const button of langButtons) {
            const text = button.textContent.toLowerCase();
            const langs = ['python', 'python3', 'javascript', 'typescript', 'java', 'c++', 'cpp', 'c', 'go', 'rust', 'kotlin', 'swift'];
            for (const lang of langs) {
                if (text === lang || (text.includes(lang) && text.length < 15)) {
                    return lang === 'python' ? 'python3' : lang;
                }
            }
        }

        // Method 2: Check URL params
        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get('lang');
        if (lang) return lang.toLowerCase();

        // Method 3: Detect from code patterns
        const code = getCodeFromEditor();
        if (code) {
            if (code.includes('def ') && code.includes(':') && !code.includes('{')) return 'python3';
            if (code.includes('function') || code.includes('=>') || code.includes('const ') || code.includes('let ')) return 'javascript';
            if (code.includes('public class') || code.includes('public static void main')) return 'java';
            if (code.includes('#include') || code.includes('std::') || code.includes('vector<')) return 'cpp';
            if (code.includes('func ') && code.includes('package')) return 'go';
            if (code.includes('fn ') && code.includes('->') && code.includes('let ')) return 'rust';
        }

        return 'cpp'; // Default for LeetCode
    }

    function showNotification(message, type) {
        // Remove existing notification
        const existing = document.querySelector('.leetcode-sync-notification');
        if (existing) existing.remove();

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'leetcode-sync-notification';

        const bgColor = type === 'success' ? '#2cbb5d' : type === 'error' ? '#ef4743' : '#ffc01e';

        notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${bgColor};
      color: ${type === 'info' ? '#000' : '#fff'};
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 999999;
      animation: leetcode-sync-slideIn 0.3s ease;
    `;
        notification.textContent = message;

        // Add animation keyframes
        if (!document.querySelector('#leetcode-sync-styles')) {
            const style = document.createElement('style');
            style.id = 'leetcode-sync-styles';
            style.textContent = `
        @keyframes leetcode-sync-slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Remove after 4 seconds (except for info which gets replaced)
        if (type !== 'info') {
            setTimeout(() => {
                notification.style.animation = 'leetcode-sync-slideIn 0.3s ease reverse';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        }
    }

})();
