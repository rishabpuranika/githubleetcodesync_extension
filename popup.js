// DOM Elements
const form = document.getElementById('settings-form');
const tokenInput = document.getElementById('github-token');
const usernameInput = document.getElementById('github-username');
const repoInput = document.getElementById('repo-name');
const saveBtn = document.getElementById('save-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const statsSection = document.getElementById('stats-section');
const bulkSyncSection = document.getElementById('bulk-sync-section');
const bulkSyncBtn = document.getElementById('bulk-sync-btn');
const bulkProgress = document.getElementById('bulk-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Obsidian DOM Elements
const obsidianSection = document.getElementById('obsidian-section');
const obsidianEnabled = document.getElementById('obsidian-enabled');
const obsidianSettings = document.getElementById('obsidian-settings');
const obsidianUrl = document.getElementById('obsidian-url');
const obsidianApiKey = document.getElementById('obsidian-api-key');
const testObsidianBtn = document.getElementById('test-obsidian-btn');
const obsidianStatus = document.getElementById('obsidian-status');

// Load saved settings
document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
    const data = await chrome.storage.sync.get([
        'githubToken',
        'githubUsername',
        'repoName',
        'stats',
        'syncedProblems',
        'obsidianEnabled',
        'obsidianUrl',
        'obsidianApiKey'
    ]);

    if (data.githubToken) {
        tokenInput.value = data.githubToken;
    }
    if (data.githubUsername) {
        usernameInput.value = data.githubUsername;
    }
    if (data.repoName) {
        repoInput.value = data.repoName;
    }

    // Load Obsidian settings
    if (data.obsidianEnabled) {
        obsidianEnabled.checked = true;
        obsidianSettings.classList.remove('hidden');
    }
    if (data.obsidianUrl) {
        obsidianUrl.value = data.obsidianUrl;
    }
    if (data.obsidianApiKey) {
        obsidianApiKey.value = data.obsidianApiKey;
    }

    // Update status
    if (data.githubToken && data.githubUsername && data.repoName) {
        await verifyConnection(data.githubToken, data.githubUsername, data.repoName);
    }

    // Load stats
    if (data.stats) {
        updateStats(data.stats);
    }
}

// Save settings
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = tokenInput.value.trim();
    const username = usernameInput.value.trim();
    const repo = repoInput.value.trim();

    if (!token || !username || !repo) {
        showToast('Please fill in all fields', true);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        // Verify the credentials work
        const isValid = await verifyConnection(token, username, repo);

        if (isValid) {
            // Save to Chrome storage
            await chrome.storage.sync.set({
                githubToken: token,
                githubUsername: username,
                repoName: repo
            });

            showToast('Settings saved successfully!');
        }
    } catch (error) {
        showToast('Failed to save: ' + error.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
    }
});

// Verify GitHub connection
async function verifyConnection(token, username, repo) {
    statusText.textContent = 'Verifying...';
    statusIndicator.className = 'status-indicator';

    try {
        // First verify the token works
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid GitHub token');
        }

        const userData = await userResponse.json();

        if (userData.login.toLowerCase() !== username.toLowerCase()) {
            throw new Error('Username does not match token owner');
        }

        // Check if repo exists, if not create it
        const repoResponse = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (repoResponse.status === 404) {
            // Create the repository
            const createResponse = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repo,
                    description: '🚀 My LeetCode solutions - auto-synced by LeetCode GitHub Sync',
                    private: false,
                    auto_init: true
                })
            });

            if (!createResponse.ok) {
                throw new Error('Failed to create repository');
            }

            statusText.textContent = `Connected! Created ${repo}`;
        } else if (repoResponse.ok) {
            statusText.textContent = `Connected to ${repo}`;
        } else {
            throw new Error('Failed to access repository');
        }

        statusIndicator.classList.add('connected');
        statsSection.classList.remove('hidden');
        bulkSyncSection.classList.remove('hidden');
        obsidianSection.classList.remove('hidden');
        return true;

    } catch (error) {
        statusText.textContent = error.message;
        statusIndicator.classList.add('error');
        return false;
    }
}

// Update stats display
function updateStats(stats) {
    document.getElementById('total-synced').textContent = stats.total || 0;
    document.getElementById('easy-count').textContent = stats.easy || 0;
    document.getElementById('medium-count').textContent = stats.medium || 0;
    document.getElementById('hard-count').textContent = stats.hard || 0;
    statsSection.classList.remove('hidden');
}

// Show toast notification
function showToast(message, isError = false) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow for animation
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Listen for stats updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATS_UPDATED') {
        updateStats(message.stats);
    }
    if (message.type === 'BULK_SYNC_PROGRESS') {
        updateProgress(message.current, message.total, message.problemTitle);
    }
    if (message.type === 'BULK_SYNC_COMPLETE') {
        bulkSyncComplete(message.synced, message.skipped);
    }
});

// Bulk sync button handler
bulkSyncBtn.addEventListener('click', async () => {
    const data = await chrome.storage.sync.get(['githubToken', 'githubUsername', 'repoName']);

    if (!data.githubToken || !data.githubUsername || !data.repoName) {
        showToast('Please configure settings first', true);
        return;
    }

    bulkSyncBtn.disabled = true;
    bulkSyncBtn.textContent = 'Syncing...';
    bulkProgress.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = 'Fetching submissions...';

    // Send message to background script to start bulk sync
    chrome.runtime.sendMessage({
        type: 'BULK_SYNC_START',
        data: {
            githubToken: data.githubToken,
            githubUsername: data.githubUsername,
            repoName: data.repoName
        }
    });
});

function updateProgress(current, total, problemTitle) {
    const percent = Math.round((current / total) * 100);
    progressFill.style.width = percent + '%';
    progressText.textContent = `${current}/${total} - ${problemTitle || 'Processing...'}`;
}

function bulkSyncComplete(synced, skipped) {
    bulkSyncBtn.disabled = false;
    bulkSyncBtn.textContent = 'Sync All Past Solutions';
    progressFill.style.width = '100%';
    progressText.textContent = `Done! Synced: ${synced}, Skipped: ${skipped} (already synced)`;
    showToast(`Bulk sync complete! ${synced} new, ${skipped} skipped`);

    // Reload stats
    loadSettings();
}

// ========== OBSIDIAN SYNC FUNCTIONALITY ==========

// Toggle Obsidian settings visibility
obsidianEnabled.addEventListener('change', async () => {
    if (obsidianEnabled.checked) {
        obsidianSettings.classList.remove('hidden');
    } else {
        obsidianSettings.classList.add('hidden');
    }

    // Save toggle state
    await chrome.storage.sync.set({
        obsidianEnabled: obsidianEnabled.checked
    });
});

// Save Obsidian settings when inputs change
obsidianUrl.addEventListener('blur', saveObsidianSettings);
obsidianApiKey.addEventListener('blur', saveObsidianSettings);

async function saveObsidianSettings() {
    await chrome.storage.sync.set({
        obsidianUrl: obsidianUrl.value.trim(),
        obsidianApiKey: obsidianApiKey.value.trim()
    });
}

// Test Obsidian connection
testObsidianBtn.addEventListener('click', async () => {
    const url = obsidianUrl.value.trim();
    const apiKey = obsidianApiKey.value.trim();

    if (!url || !apiKey) {
        obsidianStatus.textContent = '❌ Fill both fields';
        obsidianStatus.className = 'status-text error';
        return;
    }

    testObsidianBtn.disabled = true;
    obsidianStatus.textContent = 'Testing...';
    obsidianStatus.className = 'status-text';

    try {
        const response = await fetch(`${url}/vault/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            obsidianStatus.textContent = '✅ Connected!';
            obsidianStatus.className = 'status-text success';

            // Save settings on successful test
            await saveObsidianSettings();
            showToast('Obsidian connection successful!');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        obsidianStatus.textContent = `❌ Failed: ${error.message}`;
        obsidianStatus.className = 'status-text error';
    } finally {
        testObsidianBtn.disabled = false;
    }
});
