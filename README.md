# 🔄 LeetCode GitHub Sync

A Chrome extension that automatically syncs your accepted LeetCode submissions to a GitHub repository.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- 📤 **Auto-sync on submission** - Solutions are pushed to GitHub immediately when accepted
- 📁 **Organized by difficulty** - Files are sorted into `Easy/`, `Medium/`, `Hard/` folders
- 📝 **Rich formatting** - Each solution includes problem description, code, runtime & memory stats
- 🔄 **Auto repo creation** - Creates the repository if it doesn't exist
- 📊 **Sync statistics** - Track how many problems you've synced

## 📦 Installation

### Developer Mode (Recommended)

1. **Download/Clone this repository**
   ```bash
   git clone https://github.com/yourusername/githubleetsync.git
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top right)

3. **Load the extension**
   - Click **"Load unpacked"**
   - Select the `githubleetsync` folder

4. **Pin the extension** (optional)
   - Click the puzzle icon in Chrome toolbar
   - Pin "LeetCode GitHub Sync"

## ⚙️ Setup

### 1. Generate GitHub Token

1. Go to [GitHub Token Settings](https://github.com/settings/tokens/new?scopes=repo&description=LeetCode%20Sync)
2. Select **"repo"** scope (full control of private repositories)
3. Click **"Generate token"**
4. **Copy the token** (you won't see it again!)

### 2. Configure Extension

1. Click the extension icon in Chrome
2. Enter your:
   - **GitHub Token**: The token you just generated
   - **GitHub Username**: Your GitHub username
   - **Repository Name**: Where to sync solutions (e.g., `leetcode-solutions`)
3. Click **"Save Settings"**

The extension will automatically create the repository if it doesn't exist!

## 🚀 Usage

1. Go to [LeetCode](https://leetcode.com/problems/)
2. Solve any problem
3. Submit your solution
4. When accepted, it automatically syncs to GitHub! ✅

### File Structure

Your repository will be organized like this:

```
leetcode-solutions/
├── Easy/
│   ├── 0001-two-sum.md
│   ├── 0009-palindrome-number.md
│   └── ...
├── Medium/
│   ├── 0002-add-two-numbers.md
│   ├── 0003-longest-substring-without-repeating-characters.md
│   └── ...
└── Hard/
    ├── 0004-median-of-two-sorted-arrays.md
    └── ...
```

### Solution File Format

Each synced file contains:

```markdown
# 1. Two Sum

## Difficulty: Easy

## Problem Description
Given an array of integers nums and an integer target...

---

## Solution
**Language:** Python3
**Runtime:** 52 ms
**Memory:** 14.9 MB

\```python
class Solution:
    def twoSum(self, nums, target):
        # Your solution code here
\```
```

## 🛠️ Troubleshooting

### Solution not syncing?

1. **Check extension popup** - Make sure status shows "Connected"
2. **Verify token permissions** - Token needs `repo` scope
3. **Try refreshing LeetCode** - Reload the problem page
4. **Check browser console** - Look for error messages (F12 → Console)

### "Extension not configured" error?

- Open the extension popup and fill in all fields
- Make sure to click "Save Settings"

## 🔒 Privacy

- Your GitHub token is stored locally in Chrome's sync storage
- No data is sent to any server except GitHub's API
- The extension only activates on leetcode.com

## 📄 License

MIT License - feel free to modify and share!

---

Made with ❤️ for LeetCoders
