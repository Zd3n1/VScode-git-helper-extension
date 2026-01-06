// The module 'vscode' contains the VS Code extensibility API

// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const dotenv = require('dotenv');
const HTML_CONTENT = require('./htmlContent')
const cp = require('child_process');
const fs = require('fs');
const util = require('util');
const {generatePrompt} = require('./utils/generatePrompt')
const { generateCommitMessage } = require('./utils/prompts/generateCommitMessage');
const {validateUserCommitMessage} = require('./utils/prompts/validateUserCommitMessage');
const exec = util.promisify(cp.exec);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// preparing key for communication with gemini
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });
const API_KEY = process.env.KEY;
const MODEL_NAME = "gemini-2.5-flash"

async function activate(context) {

    // checking if the API key and model name is correct
    // writing list of available models
    await checkConnectionWithStudio()

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	const provider = new GitAgentViewProvider(context.extensionUri, context);
	context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('gitAgentView', provider)
    );

}

async function checkConnectionWithStudio(){
if (!API_KEY) {
        console.error("Missing API key");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            _logInitialInformation(data)
        })
        .catch(err => {
            console.error("Connection error:", err);
        });
}

function _logInitialInformation(data){
    console.log("--------------------------------------------------");
    console.log("List of models:");
    console.log("--------------------------------------------------");
    
    if (data.error) {
        console.error("Error API:", data.error.message);
    } else if (data.models) {
    
        data.models.forEach(model => {
            console.log(`✅ ${model.name}`);
        });
        

        const hasFlash = data.models.some(m => m.name.includes(MODEL_NAME));
        console.log("--------------------------------------------------");
        if (!hasFlash) {
            console.log(`Model ${MODEL_NAME} is not included.`);
        } 
    }
    console.log("--------------------------------------------------");
}

class GitAgentViewProvider {
    constructor(extensionUri, context) {
        this._extensionUri = extensionUri;
        this._context = context;
        const genAI = new GoogleGenerativeAI(API_KEY);
        this._model = genAI.getGenerativeModel({ model: `${MODEL_NAME}` });
        this._isGit = false;

        // commit 
        this._pendingCommitMessage = null;
        this._isWaitingForCommitConfirmation = false;
        
        // chat history tracking
        this._currentMessages = [];
        this._currentSessionId = this._generateSessionId();
    }

    async resolveWebviewView(webviewView) {
      this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtmlContent();

        webviewView.webview.onDidReceiveMessage(async data => {
            if (data.type === 'webviewLoaded'){
                await this._checkWorkspace();
                await this._sendHistoryList();
            }
            if (data.type === 'userRequest'){ 
                if (this._isWaitingForCommitConfirmation) {
                    await this._handleManualCommitMessage(data.value);
                } else {
                    await this._handleUserRequestWithAI(data.value);
                }
            }
            if (data.type === 'quickButton') {
                if (data.command === 'generateCommit') await this._startCommitWorkflow();
                else this._handleQuickButton(data.command);
            }
            if (data.type === 'actionButton') { // buttons provided by agent 
                if (data.command === 'confirmCommit') await this._executeFinalCommit(this._pendingCommitMessage);
                if (data.command === 'push') {
                    await this._pushHandler();
                }
                if (data.command === 'undo') {
                    await this._undoCommitHandler();
                }
            }
            if (data.type === 'changeModel') {
                this._changeModel(data.value)
            }
            if (data.type === 'newChat') {
                await this._startNewChat();
            }
            if (data.type === 'loadHistory') {
                await this._loadChatSession(data.sessionId);
            }
        });
    }

    _changeModel(newModelName){
        const genAI = new GoogleGenerativeAI(API_KEY);
        this._model = genAI.getGenerativeModel({ model: newModelName });
        console.log(`Model switched to: ${newModelName}`);
    }

    async _checkWorkspace(){
         if (!vscode.workspace.workspaceFolders) {
            this._addMessageToChat('System', "⚠️ You don't have open any folder");
            this._disableButtons(['btn-status', 'btn-commit', 'btn-push', 'btn-sync', 'btn-new-branch-checkout']);
        } else {
            const isGit = await this._isGitRepository()
            if(!isGit){
                this._addMessageToChat('System', "Current folder is not a Git repository.");
                this._disableButtons(['btn-status', 'btn-commit', 'btn-push', 'btn-sync', 'btn-new-branch-checkout']);
            }
        }
    }

    async _isGitRepository(){
        const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        try {
            const { stdout } = await exec('git rev-parse --is-inside-work-tree', { cwd: folderPath });
            return stdout.trim() === 'true';
        } catch (e){
            return false
        }
    }
    

    _disableButtons(idsArray){
        if (this._view) {
            this._view.webview.postMessage({ 
                type: 'setButtonsState', 
                disable: idsArray.includes('all') ? [
                    'btn-status', 'btn-commit', 'btn-push', 'btn-sync', 'btn-new-branch-checkout', 'sendBtn'
                ] : idsArray 
            });
        }
    }

    async _handleUserRequestWithAI(userText) {
        try {
            this._disableButtons(['all'])
            this._addMessageToChat('Agent', '🤔 Thinking...');

            const prompt = generatePrompt(userText);

            const response = await this._model.generateContent(prompt);
            const result = response.response.text().trim();
            const resultObject = JSON.parse(result)
            /* result object has 3 attributes: message, command, isDangerous */

            if (resultObject.message){
                this._addMessageToChat('Agent', resultObject.message)
                if(resultObject.command){
                    this._executeGitCommand(resultObject.command, resultObject.isDangerous)
                }
            }

        } catch (error) {
            this._addMessageToChat('Error', `Chyba AI: ${error.message}`);
        } finally {
            this._disableButtons([])
        }
    }

    async _handleQuickButton(command) {
        this._disableButtons(['all']); 
        
        let gitCommand = "";
        let isDangerous = false;

        if (command === 'status') gitCommand = 'git status';
        if (command === 'generateCommit') {
            await this._startCommitWorkflow();
            this._disableButtons([]); 
            return;
        }
        if (command === 'pushCommit') {
            await this._pushHandler();
            this._disableButtons([]);
            return;
        }
        if (command === 'sync') {
            await this._syncHandler();
            this._disableButtons([]);
            return;
        }
        if (command === 'newBranchCheckout') {
            await this._newBranchCheckoutHandler();
            this._disableButtons([]);
            return;
        }

        if (!gitCommand) {
            this._addMessageToChat('Error', `The command "${command}" is not defined.`);
            this._disableButtons([]);
            return;
        }

        await this._executeGitCommand(gitCommand, isDangerous);

        this._disableButtons([]);
    }

    async _executeGitCommand(command, isDangerous) {
        if (!vscode.workspace.workspaceFolders) {
            this._addMessageToChat('System', "⚠️ You don't have open any folder!");
            return;
        }
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        this._addMessageToChat('Agent', `🚀 Running: ${command}`);

        try {
            const { stdout, stderr } = await exec(command, { cwd: rootPath });

            if (stdout) {
                this._addMessageToChat('Git', stdout);
            }
            if (stderr) {
                this._addMessageToChat('Git', stderr);
            }
        } catch (err) {
            this._addMessageToChat('Error', `Git Error: ${err.message}`);
        }
    }

    _addMessageToChat(sender, text, actions = []) {
        if (this._view) {
            let style = 'agent';
            if (sender === 'Git') style = 'git';
            if (sender === 'Error') style = 'error';
            if (sender === 'You') style = 'user';
            
            // Track message in current session
            this._currentMessages.push({
                sender: sender,
                text: text,
                style: style,
                actions: actions,
                timestamp: Date.now()
            });
            
            this._view.webview.postMessage({ 
                type: 'addResponse', 
                sender: sender, 
                text: text,
                actions: actions 
            });
            
            // Auto-save session after each message
            this._saveCurrentSession();
        }
    }

    _getHtmlContent() {
        return HTML_CONTENT;
    }

    // QUICK BUTTONS HANDLERS 
    async _startCommitWorkflow() {
        if (!vscode.workspace.workspaceFolders) return;
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const { stdout: status } = await exec('git status --porcelain', { cwd: rootPath });
            if (!status.trim()) {
                this._addMessageToChat('Agent', "ℹ️ Nothing to commit.");
                return;
            }

            const { stdout: diff } = await exec('git diff --cached', { cwd: rootPath });
            if (!diff.trim()) {
                this._addMessageToChat('Agent', "❌ No changes staged. Please 'git add' files first.");
                return;
            }

            this._addMessageToChat('Agent', "🤖 Generating suggested message...");
            const response = await this._model.generateContent(generateCommitMessage(diff));
            this._pendingCommitMessage = response.response.text().trim().replace(/['"]/g, '');
            this._isWaitingForCommitConfirmation = true;

            this._addMessageToChat('Agent', `I suggest this commit message:\n\n**${this._pendingCommitMessage}**\n\nDo you agree? If so, click confirm. If you want a different name, just type it below and press Enter.`, [
                { label: "✅ Confirm & Commit", command: "confirmCommit", secondary: false }
            ]);

        } catch (error) {
            this._addMessageToChat('Error', `Workflow error: ${error.message}`);
        }
    }

    async _handleManualCommitMessage(userInput) {
        const cleanedInput = userInput.trim();

        if (cleanedInput.length < 2) {
            this._addMessageToChat('Agent', `⚠️ "${cleanedInput}" is too short for a commit message. Using my original suggestion instead.`);
            await this._executeFinalCommit(this._pendingCommitMessage);
            return;
        }

        this._addMessageToChat('Agent', "🔍 Checking your message...");
        try {
            const response = await this._model.generateContent(validateUserCommitMessage(cleanedInput));
            const result = response.response.text().trim();

            if (result.toUpperCase() === "INVALID") {
                this._addMessageToChat('Agent', "❌ That doesn't look like a valid commit message. Falling back to suggestion.");
                await this._executeFinalCommit(this._pendingCommitMessage);
            } else {
                await this._executeFinalCommit(result);
            }
        } catch (e) {
            await this._executeFinalCommit(cleanedInput);
        }
    }

    async _executeFinalCommit(message) {
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        try {
            this._disableButtons(['all']);
            await exec(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: rootPath });
            
            this._isWaitingForCommitConfirmation = false;
            this._pendingCommitMessage = null;

            this._addMessageToChat('Agent', `✅ Committed with message: "${message}"`, [
                { label: "🚀 Push", command: "push", secondary: false },
                { label: "🔄 Undo", command: "undo", secondary: true }
            ]);
        } catch (error) {
            this._addMessageToChat('Error', `Git error: ${error.message}`);
        } finally {
            this._disableButtons([]);
        }
    }

    async _pushHandler() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            this._addMessageToChat('Agent', "⚠️ No workspace folder open. Please open a project first.");
            return;
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const isGit = await this._isGitRepository();
            if (!isGit) {
                this._addMessageToChat('Agent', "⚠️ This folder is not a Git repository.");
                return;
            }

            const { stdout: statusOutput } = await exec('git status -sb', { cwd: rootPath });

            if (!statusOutput.includes('ahead')) {
                this._addMessageToChat('Agent', "ℹ️ Your branch is up to date with remote. There are no local commits to push.");
                return;
            }

            this._addMessageToChat('Agent', "🚀 Pushing commits to remote repository...");
            
            const { stdout, stderr } = await exec('git push', { cwd: rootPath });

            this._addMessageToChat('Agent', "✅ Successfully pushed to remote.");
            
            if (stdout) {
                this._addMessageToChat('Git', stdout);
            }
            if (stderr && !stderr.includes('To ')) {
                this._addMessageToChat('Git', stderr);
            }

        } catch (error) {
            if (error.message.includes("no upstream branch")) {
                this._addMessageToChat('Error', "Push failed: The current branch has no upstream branch. Set it using 'git push -u origin <branch_name>'.");
            } else if (error.message.includes("rejected") || error.message.includes("non-fast-forward")) {
                this._addMessageToChat('Error', "Push rejected: Remote contains work that you do not have locally. Try pulling first.");
            } else {
                this._addMessageToChat('Error', `Push failed: ${error.message}`);
            }
        }
    }

    async _undoCommitHandler() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            this._addMessageToChat('Agent', "⚠️ No workspace folder open.");
            return;
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const isGit = await this._isGitRepository();
            if (!isGit) {
                this._addMessageToChat('Agent', "⚠️ This folder is not a Git repository.");
                return;
            }

            const { stdout: commitCount } = await exec('git rev-list --count HEAD', { cwd: rootPath });
            if (parseInt(commitCount.trim()) === 0) {
                this._addMessageToChat('Agent', "ℹ️ There are no commits to undo in this repository.");
                return;
            }

            this._addMessageToChat('Agent', "🔄 Undoing last commit...");
            
            await exec('git reset --soft HEAD~1', { cwd: rootPath });

            this._addMessageToChat('Agent', "✅ Last commit has been undone. Your changes are preserved in the staged area.");
            
        } catch (error) {
            if (error.message.includes("ambiguous argument 'HEAD~1'")) {
                this._addMessageToChat('Error', "Undo failed: You are likely at the initial commit of the repository.");
            } else {
                this._addMessageToChat('Error', `Undo failed: ${error.message}`);
            }
        }
    }

    async _syncHandler() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            this._addMessageToChat('Agent', "⚠️ No workspace folder open.");
            return;
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const isGit = await this._isGitRepository();
            if (!isGit) {
                this._addMessageToChat('Agent', "⚠️ This folder is not a Git repository.");
                return;
            }

            this._addMessageToChat('Agent', "📡 Synchronizing with remote...");

            this._addMessageToChat('Agent', "📥 Fetching latest information...");
            const { stdout: fetchOut } = await exec('git fetch', { cwd: rootPath });
            if (fetchOut) this._addMessageToChat('Git', fetchOut);

            this._addMessageToChat('Agent', "🚀 Pulling changes...");
            const { stdout: pullOut, stderr: pullErr } = await exec('git pull', { cwd: rootPath });

            if (pullOut) this._addMessageToChat('Git', pullOut);
            
            if (pullOut.includes('Already up to date')) {
                this._addMessageToChat('Agent', "✅ Everything is already up to date.");
            } else {
                this._addMessageToChat('Agent', "✅ Synchronization complete.");
            }

        } catch (error) {
            if (error.message.includes("merge conflict")) {
                this._addMessageToChat('Error', "❌ Sync failed: Merge conflicts detected. Please resolve them in your editor.");
            } else if (error.message.includes("no upstream branch")) {
                this._addMessageToChat('Error', "❌ Sync failed: The current branch has no remote tracking branch.");
            } else if (error.message.includes("could not resolve host")) {
                this._addMessageToChat('Error', "❌ Sync failed: Network error. Could not reach the remote repository.");
            } else {
                this._addMessageToChat('Error', `Sync failed: ${error.message}`);
            }
        }
    }

    async _newBranchCheckoutHandler() {
        if (!vscode.workspace.workspaceFolders) return;
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const { stdout: currentBranchOut } = await exec('git rev-parse --abbrev-ref HEAD', { cwd: rootPath });
            const currentBranch = currentBranchOut.trim();

            const { stdout: branchListOut } = await exec('git branch --format="%(refname:short)"', { cwd: rootPath });
            const allBranches = branchListOut.trim().split('\n').map(b => b.trim());

            const sortedBranchItems = [
                { 
                    label: currentBranch, 
                    description: "(current branch)", 
                    alwaysShow: true 
                },
                ...allBranches
                    .filter(b => b !== currentBranch)
                    .map(b => ({ label: b }))
            ];

            const selection = await vscode.window.showQuickPick(sortedBranchItems, {
                placeHolder: "Select the source branch (base)",
                title: "Source Branch Selection",
            });

            if (!selection) return;
            const sourceBranch = selection.label;

            const newBranchName = await vscode.window.showInputBox({
                prompt: `Creating new branch from "${sourceBranch}". Enter new branch name:`,
                placeHolder: "feature/new-feature",
                validateInput: text => {
                    if (!text || text.trim().length === 0) return "Branch name cannot be empty";
                    if (text.includes(" ")) return "Branch name cannot contain spaces (use - or _)";
                    if (allBranches.includes(text.trim())) return "This branch already exists";
                    return null;
                }
            });

            if (!newBranchName) return;
            const finalNew = newBranchName.trim();

            this._addMessageToChat('Agent', `🛠 Creating branch **${finalNew}** from **${sourceBranch}**...`);
            
            await exec(`git checkout -b "${finalNew}" "${sourceBranch}"`, { cwd: rootPath });
            this._addMessageToChat('Git', `Switched to a new branch '${finalNew}'`);

            this._addMessageToChat('Agent', `🚀 Publishing branch **${finalNew}** to origin...`);
            const { stdout: pushOut, stderr: pushErr } = await exec(`git push -u origin "${finalNew}"`, { cwd: rootPath });
            
            if (pushOut) this._addMessageToChat('Git', pushOut);
            if (pushErr && pushErr.includes('branch')) this._addMessageToChat('Git', pushErr);

            this._addMessageToChat('Agent', `✅ Done. Branch **${finalNew}** is ready and published.`);

        } catch (error) {
            this._addMessageToChat('Error', `Operation failed: ${error.message}`);
        }
    }
    
    // ==================== CHAT HISTORY METHODS ====================
    
    _generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    _getSessionName(messages) {
        if (messages.length === 0) return 'Empty Chat';
        
        // Find first user message to use as name
        const firstUserMsg = messages.find(m => m.sender === 'You');
        if (firstUserMsg) {
            const words = firstUserMsg.text.trim().split(/\s+/);
            return words.slice(0, 3).join(' ');
        }
        
        // Fallback to timestamp
        const date = new Date(messages[0].timestamp);
        return `Chat ${date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    async _saveCurrentSession() {
        if (this._currentMessages.length === 0) return;
        
        const sessions = this._context.globalState.get('chatSessions', []);
        const existingIndex = sessions.findIndex(s => s.id === this._currentSessionId);
        
        const sessionData = {
            id: this._currentSessionId,
            name: this._getSessionName(this._currentMessages),
            messages: this._currentMessages,
            updatedAt: Date.now()
        };
        
        if (existingIndex >= 0) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }
        
        // Keep only last 50 sessions
        const trimmedSessions = sessions.slice(0, 50);
        await this._context.globalState.update('chatSessions', trimmedSessions);
    }
    
    async _sendHistoryList() {
        const sessions = this._context.globalState.get('chatSessions', []);
        let sessionsUpdated = false;
        
        const sessionList = sessions.map(s => {
            // Fix old session names that start with "Chat" followed by date
            if (s.name && s.name.startsWith('Chat ') && s.messages) {
                s.name = this._getSessionName(s.messages);
                sessionsUpdated = true;
            }
            
            const date = new Date(s.updatedAt);
            const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            return {
                id: s.id,
                name: s.name,
                displayName: `${dateStr} ${timeStr}`
            };
        });
        
        // Save updated sessions if any were fixed
        if (sessionsUpdated) {
            await this._context.globalState.update('chatSessions', sessions);
        }
        
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateHistoryList',
                sessions: sessionList
            });
        }
    }
    
    async _startNewChat() {
        // Save current session before starting new one
        if (this._currentMessages.length > 0) {
            await this._saveCurrentSession();
        }
        
        // Reset state
        this._currentMessages = [];
        this._currentSessionId = this._generateSessionId();
        this._pendingCommitMessage = null;
        this._isWaitingForCommitConfirmation = false;
        
        // Clear UI
        if (this._view) {
            this._view.webview.postMessage({ type: 'clearChat' });
        }
        
        // Update history list
        await this._sendHistoryList();
    }
    
    async _cleanupOldSessions() {
        // Clear ALL old sessions to start fresh
        await this._context.globalState.update('chatSessions', []);
    }
    
    async _loadChatSession(sessionId) {
        const sessions = this._context.globalState.get('chatSessions', []);
        const session = sessions.find(s => s.id === sessionId);
        
        if (!session) return;
        
        // Save current session before switching
        if (this._currentMessages.length > 0) {
            await this._saveCurrentSession();
        }
        
        // Load the selected session
        this._currentMessages = session.messages || [];
        this._currentSessionId = sessionId;
        
        // Send to webview
        if (this._view) {
            this._view.webview.postMessage({
                type: 'loadChatHistory',
                messages: this._currentMessages
            });
        }
    }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
