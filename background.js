// LeetCode GitHub Sync - Background Service Worker
// Handles GitHub API interactions

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SYNC_SUBMISSION') {
        handleSync(message.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
    }

    if (message.type === 'BULK_SYNC_START') {
        handleBulkSync(message.data);
        sendResponse({ started: true });
        return true;
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

    // Track synced problem
    await markProblemSynced(submissionData.problemSlug);

    // Update stats
    await updateStats(submissionData.difficulty);

    console.log('✅ Background: Sync completed!');
    return { success: true };
}

// ========== BULK SYNC FUNCTIONALITY ==========

async function handleBulkSync(settings) {
    const { githubToken, githubUsername, repoName } = settings;

    console.log('🔄 Background: Starting bulk sync...');

    try {
        // Get already synced problems from storage
        const storageData = await chrome.storage.sync.get(['syncedProblems']);
        const syncedProblems = new Set(storageData.syncedProblems || []);

        // Get existing files in GitHub repo to avoid duplicates
        const existingFiles = await getExistingGitHubFiles(githubToken, githubUsername, repoName);

        // Fetch all accepted submissions from LeetCode
        const submissions = await fetchAllAcceptedSubmissions();

        console.log(`🔄 Background: Found ${submissions.length} accepted submissions`);

        let synced = 0;
        let skipped = 0;

        for (let i = 0; i < submissions.length; i++) {
            const submission = submissions[i];
            const problemSlug = submission.titleSlug;

            // Check if already synced (in storage or on GitHub)
            const filePath = `${submission.difficulty}/${String(submission.questionId).padStart(4, '0')}-${problemSlug}.md`;

            if (syncedProblems.has(problemSlug) || existingFiles.has(filePath)) {
                skipped++;
                // Send progress update
                chrome.runtime.sendMessage({
                    type: 'BULK_SYNC_PROGRESS',
                    current: i + 1,
                    total: submissions.length,
                    problemTitle: `Skipped: ${submission.title}`
                }).catch(() => { });
                continue;
            }

            try {
                // Get full problem details
                const problemData = await fetchProblemDetails(problemSlug);
                if (!problemData) continue;

                // Get submission code
                const code = await fetchSubmissionCode(submission.submissionId);
                if (!code) continue;

                // Prepare submission data
                const submissionData = {
                    problemId: submission.questionId,
                    problemTitle: submission.title,
                    problemSlug: problemSlug,
                    difficulty: submission.difficulty,
                    problemDescription: problemData.content,
                    code: code,
                    language: submission.lang,
                    languageExt: getLanguageExt(submission.lang),
                    runtime: submission.runtime || 'N/A',
                    memory: submission.memory || 'N/A',
                    timestamp: new Date().toISOString()
                };

                // Format and push to GitHub
                const fileContent = formatSolution(submissionData);
                await pushToGitHub(githubToken, githubUsername, repoName, filePath, fileContent, submissionData);

                // Mark as synced
                await markProblemSynced(problemSlug);
                await updateStats(submission.difficulty);

                synced++;

                // Send progress update
                chrome.runtime.sendMessage({
                    type: 'BULK_SYNC_PROGRESS',
                    current: i + 1,
                    total: submissions.length,
                    problemTitle: submission.title
                }).catch(() => { });

                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 500));

            } catch (error) {
                console.error(`Failed to sync ${submission.title}:`, error);
            }
        }

        // Send completion message
        chrome.runtime.sendMessage({
            type: 'BULK_SYNC_COMPLETE',
            synced,
            skipped
        }).catch(() => { });

        console.log(`✅ Background: Bulk sync complete. Synced: ${synced}, Skipped: ${skipped}`);

    } catch (error) {
        console.error('Bulk sync failed:', error);
        chrome.runtime.sendMessage({
            type: 'BULK_SYNC_COMPLETE',
            synced: 0,
            skipped: 0,
            error: error.message
        }).catch(() => { });
    }
}

async function fetchAllAcceptedSubmissions() {
    const submissions = [];
    let offset = 0;
    const limit = 20;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch('https://leetcode.com/graphql/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `
            query submissionList($offset: Int!, $limit: Int!) {
              submissionList(offset: $offset, limit: $limit, questionSlug: "") {
                lastKey
                hasNext
                submissions {
                  id
                  statusDisplay
                  lang
                  runtime
                  memory
                  timestamp
                  title
                  titleSlug
                }
              }
            }
          `,
                    variables: { offset, limit }
                })
            });

            const result = await response.json();
            const data = result.data?.submissionList;

            if (!data || !data.submissions) break;

            // Filter only accepted submissions and dedupe by problem
            const acceptedMap = new Map();
            for (const sub of data.submissions) {
                if (sub.statusDisplay === 'Accepted' && !acceptedMap.has(sub.titleSlug)) {
                    acceptedMap.set(sub.titleSlug, {
                        submissionId: sub.id,
                        title: sub.title,
                        titleSlug: sub.titleSlug,
                        lang: sub.lang,
                        runtime: sub.runtime,
                        memory: sub.memory
                    });
                }
            }

            submissions.push(...acceptedMap.values());

            hasMore = data.hasNext;
            offset += limit;

            // Safety limit
            if (offset > 2000) break;

        } catch (error) {
            console.error('Error fetching submissions:', error);
            break;
        }
    }

    // Get problem details (difficulty, questionId) for each submission
    const enrichedSubmissions = [];
    for (const sub of submissions) {
        try {
            const details = await fetchProblemDetails(sub.titleSlug);
            if (details) {
                enrichedSubmissions.push({
                    ...sub,
                    questionId: details.questionId,
                    difficulty: details.difficulty
                });
            }
        } catch (e) {
            console.error(`Failed to get details for ${sub.titleSlug}`);
        }
    }

    return enrichedSubmissions;
}

async function fetchProblemDetails(titleSlug) {
    try {
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
        console.error('Error fetching problem details:', error);
        return null;
    }
}

async function fetchSubmissionCode(submissionId) {
    try {
        const response = await fetch('https://leetcode.com/graphql/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: `
          query submissionDetails($submissionId: Int!) {
            submissionDetails(submissionId: $submissionId) {
              code
              lang {
                name
              }
            }
          }
        `,
                variables: { submissionId: parseInt(submissionId) }
            })
        });

        const result = await response.json();
        return result.data?.submissionDetails?.code;
    } catch (error) {
        console.error('Error fetching submission code:', error);
        return null;
    }
}

async function getExistingGitHubFiles(token, username, repo) {
    const files = new Set();

    try {
        // Get all files in repo recursively
        const response = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees/main?recursive=1`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.tree) {
                for (const item of data.tree) {
                    if (item.type === 'blob') {
                        files.add(item.path);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error fetching GitHub files:', error);
    }

    return files;
}

async function markProblemSynced(problemSlug) {
    const data = await chrome.storage.sync.get(['syncedProblems']);
    const syncedProblems = data.syncedProblems || [];
    if (!syncedProblems.includes(problemSlug)) {
        syncedProblems.push(problemSlug);
        await chrome.storage.sync.set({ syncedProblems });
    }
}

function getLanguageExt(lang) {
    const map = {
        'javascript': 'js',
        'typescript': 'ts',
        'python': 'py',
        'python3': 'py',
        'java': 'java',
        'c++': 'cpp',
        'cpp': 'cpp',
        'c': 'c',
        'csharp': 'cs',
        'ruby': 'rb',
        'swift': 'swift',
        'go': 'go',
        'golang': 'go',
        'scala': 'scala',
        'kotlin': 'kt',
        'rust': 'rs',
        'php': 'php',
        'sql': 'sql',
        'mysql': 'sql'
    };
    return map[lang?.toLowerCase()] || 'txt';
}

// ========== END BULK SYNC ==========

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
    let text = html
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<[^>]+>/g, '')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

    return text;
}

function generateFilePath(data) {
    const paddedId = String(data.problemId).padStart(4, '0');
    const fileName = `${paddedId}-${data.problemSlug}.md`;
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
            content: btoa(unescape(encodeURIComponent(content))),
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
    chrome.runtime.sendMessage({ type: 'STATS_UPDATED', stats }).catch(() => { });
}

// Initialize stats if not present
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['stats', 'syncedProblems'], (data) => {
        if (!data.stats) {
            chrome.storage.sync.set({
                stats: { total: 0, easy: 0, medium: 0, hard: 0 }
            });
        }
        if (!data.syncedProblems) {
            chrome.storage.sync.set({ syncedProblems: [] });
        }
    });
});
