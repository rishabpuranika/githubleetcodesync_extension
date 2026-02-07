# 🔄 LeetCode GitHub Sync

A Chrome extension that automatically syncs your accepted LeetCode submissions to GitHub and Obsidian.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- 📤 **Auto-sync on submission** - Solutions are pushed to GitHub immediately when accepted
- 📝 **Obsidian integration** - Optionally sync to your Obsidian vault with `#leetcode` tags
- 📁 **Organized by difficulty** - Files are sorted into `Easy/`, `Medium/`, `Hard/` folders
- 📝 **Rich formatting** - Each solution includes problem description, code, runtime & memory stats
- 🔄 **Auto repo creation** - Creates the repository if it doesn't exist
- 📊 **Sync statistics** - Track how many problems you've synced
- 🔍 **Smart language detection** - Supports 20+ languages including SQL, Rust, Go, etc.

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

### 3. Obsidian Sync (Optional)

To also sync solutions to your Obsidian vault:

1. Install the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin in Obsidian
2. Enable the plugin and copy your API key from its settings
3. In the extension popup, enable **"Obsidian Sync"**
4. Enter:
   - **API URL**: `http://127.0.0.1:27123`
   - **API Key**: Your key from the plugin
5. Click **"Test Connection"** to verify

Notes will be created at `LeetCode/{Difficulty}/0001-problem-slug.md` with `#leetcode` tag.

## 🚀 Usage

1. Go to [LeetCode](https://leetcode.com/problems/)
2. Solve any problem
3. Submit your solution
4. When accepted, it automatically syncs to GitHub (and Obsidian if enabled)! ✅

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
│   └── ...
└── Hard/
    ├── 0004-median-of-two-sorted-arrays.md
    └── ...
```

### Supported Languages

Python, JavaScript, TypeScript, Java, C++, C, C#, Go, Rust, Kotlin, Swift, Ruby, Scala, PHP, Dart, MySQL, PostgreSQL, Oracle, MS SQL, Bash, Racket, Erlang, Elixir

## 🛠️ Troubleshooting

### Solution not syncing?

1. **Check extension popup** - Make sure status shows "Connected"
2. **Verify token permissions** - Token needs `repo` scope
3. **Refresh LeetCode page** - After reloading extension, refresh the page
4. **Check browser console** - Look for error messages (F12 → Console)

### "Extension context invalidated" error?

- Refresh the LeetCode page after reloading the extension

### Obsidian sync not working?

1. Make sure Obsidian is open with Local REST API plugin enabled
2. Test the connection using the "Test Connection" button
3. Check that the API URL and key are correct

## 🔒 Privacy

- Your GitHub token is stored locally in Chrome's sync storage
- Obsidian API key is stored locally
- No data is sent to any server except GitHub's API and your local Obsidian
- The extension only activates on leetcode.com

## 📄 License

MIT License - feel free to modify and share!

---

Made with ❤️ for LeetCoders

