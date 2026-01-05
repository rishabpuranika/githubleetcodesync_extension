// DOM Elements
const form = document.getElementById('settings-form');
const tokenInput = document.getElementById('github-token');
const usernameInput = document.getElementById('github-username');
const repoInput = document.getElementById('repo-name');
const saveBtn = document.getElementById('save-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const statsSection = document.getElementById('stats-section');

// Load saved settings
document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
    const data = await chrome.storage.sync.get([
        'githubToken',
        'githubUsername',
        'repoName',
        'stats'
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
});
