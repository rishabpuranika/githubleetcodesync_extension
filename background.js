// LeetCode GitHub Sync - Background Service Worker
// Handles GitHub API interactions

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SYNC_SUBMISSION') {
        handleSync(message.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
    }
});

async function handleSync(submissionData) {
    console.log('🔄 Background: Processing sync request', submissionData.problemTitle);

    // Get settings from storage
    const settings = await chrome.storage.sync.get(['githubToken', 'githubUsername', 'repoName']);

    if (!settings.githubToken || !settings.githubUsername || !settings.repoName) {
        throw new Error('Extension not configured. Please set up GitHub credentials.');
    }

    const { githubToken, githubUsername, repoName } = settings;

    // Format the file content
    const fileContent = formatSolution(submissionData);

    // Generate file path
    const filePath = generateFilePath(submissionData);

    // Push to GitHub
    await pushToGitHub(githubToken, githubUsername, repoName, filePath, fileContent, submissionData);

    // Update stats
    await updateStats(submissionData.difficulty);

    console.log('✅ Background: Sync completed!');
    return { success: true };
}

function formatSolution(data) {
    // Clean HTML from problem description
    const cleanDescription = data.problemDescription
        ? stripHtml(data.problemDescription)
        : 'No description available';

    // Build the file content
    const content = `# ${data.problemId}. ${data.problemTitle}

## Difficulty: ${data.difficulty}

## Problem Description

${cleanDescription}

---

## Solution

**Language:** ${data.language}  
**Runtime:** ${data.runtime}  
**Memory:** ${data.memory}  

\`\`\`${data.language.toLowerCase()}
${data.code}
\`\`\`

---

*Synced at: ${data.timestamp}*
`;

    return content;
}

function stripHtml(html) {
    // Create a temporary element to parse HTML
    // Since we're in a service worker, use regex-based approach
    let text = html
        // Replace common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Remove HTML tags but keep content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<[^>]+>/g, '')
        // Clean up whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

    return text;
}

function generateFilePath(data) {
    // Pad problem ID to 4 digits
    const paddedId = String(data.problemId).padStart(4, '0');

    // Create slug-friendly filename
    const fileName = `${paddedId}-${data.problemSlug}.md`;

    // Organize by difficulty
    const difficulty = data.difficulty || 'Unknown';

    return `${difficulty}/${fileName}`;
}

async function pushToGitHub(token, username, repo, path, content, submissionData) {
    const apiBase = 'https://api.github.com';
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    // Check if file already exists (to get SHA for update)
    let sha = null;
    try {
        const existingFile = await fetch(`${apiBase}/repos/${username}/${repo}/contents/${path}`, {
            headers
        });
        if (existingFile.ok) {
            const fileData = await existingFile.json();
            sha = fileData.sha;
        }
    } catch (e) {
        // File doesn't exist, that's fine
    }

    // Create or update file
    const commitMessage = sha
        ? `Update: ${submissionData.problemTitle}`
        : `Add: ${submissionData.problemId}. ${submissionData.problemTitle} (${submissionData.difficulty})`;

    const response = await fetch(`${apiBase}/repos/${username}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            message: commitMessage,
            content: btoa(unescape(encodeURIComponent(content))), // Base64 encode with UTF-8 support
            sha: sha || undefined
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to push to GitHub');
    }

    return await response.json();
}

async function updateStats(difficulty) {
    const data = await chrome.storage.sync.get(['stats']);
    const stats = data.stats || { total: 0, easy: 0, medium: 0, hard: 0 };

    stats.total++;

    const difficultyLower = difficulty.toLowerCase();
    if (difficultyLower === 'easy') stats.easy++;
    else if (difficultyLower === 'medium') stats.medium++;
    else if (difficultyLower === 'hard') stats.hard++;

    await chrome.storage.sync.set({ stats });

    // Notify popup if open
    chrome.runtime.sendMessage({ type: 'STATS_UPDATED', stats }).catch(() => {
        // Popup not open, ignore
    });
}

// Initialize stats if not present
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['stats'], (data) => {
        if (!data.stats) {
            chrome.storage.sync.set({
                stats: { total: 0, easy: 0, medium: 0, hard: 0 }
            });
        }
    });
});
