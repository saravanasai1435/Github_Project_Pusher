import React, { useState, useEffect } from "react";
import { 
  getCredentials, 
  saveCredentials, 
  clearCredentials 
} from "./lib/cookieUtils";
import { 
  GitHubCredentials, 
  UploadedFile, 
  RepoDetails, 
  PushStatusStep,
  GitHubRepository
} from "./types";
import GitHubCredentialsModal from "./components/GitHubCredentialsModal";
import UploadDropZone from "./components/UploadDropZone";
import { 
  Github, 
  Settings, 
  Trash2, 
  FileCode, 
  Eye, 
  Globe, 
  Lock, 
  Database,
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  Plus, 
  LogOut, 
  Search, 
  ExternalLink, 
  Check, 
  Copy, 
  FolderIcon, 
  X,
  RefreshCw,
  FolderOpen,
  Edit2,
  AlertTriangle,
  Sparkles,
  Unlock,
  Lightbulb,
  Upload
} from "lucide-react";

export default function App() {
  // Authentication & Credentials
  const [creds, setCreds] = useState<GitHubCredentials | null>(null);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"push" | "manage" | "ideas">("push");

  // Files Staged (for pushing new repo)
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Repository details (for pushing new repo)
  const [repoDetails, setRepoDetails] = useState<RepoDetails>({
    name: "",
    description: "",
    isPrivate: true,
    commitMessage: "Initial project setup via GitHub Project Pusher",
  });

  // AI Description Generator states
  const [aiProvider, setAiProvider] = useState<"google" | "openrouter">("google");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("meta-llama/llama-3-8b-instruct:free");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [aiGenerationError, setAiGenerationError] = useState("");
  const [showAiOptions, setShowAiOptions] = useState(false);

  // Previewing a specific text file
  const [previewingFile, setPreviewingFile] = useState<UploadedFile | null>(null);

  // Push pipeline state (for pushing new repo)
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatusSteps, setPushStatusSteps] = useState<PushStatusStep[]>([]);
  const [pushSuccessResult, setPushSuccessResult] = useState<{
    repoUrl: string;
    fullName: string;
    branch: string;
  } | null>(null);
  const [globalError, setGlobalError] = useState("");

  // Manage Repositories state
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState("");
  const [repoSearchQuery, setRepoSearchQuery] = useState("");

  // Editing Repository states
  const [editingRepo, setEditingRepo] = useState<GitHubRepository | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [isUpdatingRepo, setIsUpdatingRepo] = useState(false);
  const [editError, setEditError] = useState("");

  // Deleting Repository states
  const [deletingRepo, setDeletingRepo] = useState<GitHubRepository | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeletingRepo, setIsDeletingRepo] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Copied clipboard helper state
  const [copiedText, setCopiedText] = useState(false);

  // Security Passcode states
  const [isLocked, setIsLocked] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  // Ideas Workspace states
  const [ideas, setIdeas] = useState<any[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [ideasError, setIdeasError] = useState("");
  const [ideaSearchQuery, setIdeaSearchQuery] = useState("");

  // Idea Form & modal states
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<any | null>(null);
  const [ideaName, setIdeaName] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [ideaSources, setIdeaSources] = useState("");
  const [ideaFiles, setIdeaFiles] = useState<any[]>([]);
  const [isSavingIdea, setIsSavingIdea] = useState(false);
  const [ideaSaveError, setIdeaSaveError] = useState("");

  // Deleting Idea states
  const [deletingIdea, setDeletingIdea] = useState<any | null>(null);
  const [isDeletingIdea, setIsDeletingIdea] = useState(false);
  const [ideaDeleteError, setIdeaDeleteError] = useState("");

  // Load saved credentials on mount or fetch default server presets
  useEffect(() => {
    const saved = getCredentials();
    if (saved) {
      setCreds(saved);
    } else {
      // Direct shortcut checks if GITHUB_TOKEN is specified in environment settings
      fetch("/api/auth/github/default-credentials")
        .then((r) => r.json())
        .then((data) => {
          if (data.hasDefaults && data.token) {
            const defaultCreds = {
              username: data.username,
              token: data.token,
              isOAuth: false, // treat custom PAT secret as seamless default session
            };
            saveCredentials(defaultCreds);
            setCreds(defaultCreds);
          } else {
            // Prompt settings modal immediately if no credentials are configured
            setIsCredsModalOpen(true);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch backend credentials:", err);
          setIsCredsModalOpen(true);
        });
    }
  }, []);

  // Fetch repositories of the user when tab is repositories
  const fetchRepositories = async () => {
    if (!creds) return;
    setIsLoadingRepos(true);
    setReposError("");
    try {
      const res = await fetch("/api/github/repos", {
        headers: {
          "x-github-username": creds.username,
          "x-github-token": creds.token,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch repositories.");
      }
      setRepositories(data);
    } catch (err: any) {
      console.error(err);
      setReposError(err.message || "An unexpected error occurred while fetching repositories.");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (creds && activeTab === "manage") {
      fetchRepositories();
    }
  }, [creds, activeTab]);

  // Fetch Ideas Workspace from GitHub 'IDEAS' repository
  const fetchIdeas = async () => {
    if (!creds) return;
    setIsLoadingIdeas(true);
    setIdeasError("");
    try {
      const res = await fetch("/api/github/ideas", {
        headers: {
          "x-github-username": creds.username,
          "x-github-token": creds.token,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch ideas.");
      }
      setIdeas(data.ideas || []);
    } catch (err: any) {
      console.error("[Ideas] Fetch ideas error:", err);
      setIdeasError(err.message || "An unexpected error occurred while fetching ideas.");
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  useEffect(() => {
    if (creds && activeTab === "ideas") {
      fetchIdeas();
    }
  }, [creds, activeTab]);

  // Idea Form file selector & base64 reader helper
  const handleIdeaFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;

    const loaded: any[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const reader = new FileReader();
      const fileData = await new Promise<any>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] || "";
          resolve({
            name: file.name,
            size: file.size,
            content: base64,
          });
        };
        reader.readAsDataURL(file);
      });
      loaded.push(fileData);
    }

    setIdeaFiles((prev) => {
      const updated = [...prev];
      loaded.forEach((newFile) => {
        const idx = updated.findIndex((f) => f.name === newFile.name);
        if (idx !== -1) {
          updated[idx] = newFile; // overwrite
        } else {
          updated.push(newFile);
        }
      });
      return updated;
    });
  };

  const handleRemoveIdeaFile = (name: string) => {
    setIdeaFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleStartNewIdea = () => {
    setEditingIdea(null);
    setIdeaName("");
    setIdeaDescription("");
    setIdeaSources("");
    setIdeaFiles([]);
    setIdeaSaveError("");
    setIsIdeaModalOpen(true);
  };

  const handleStartEditIdea = (idea: any) => {
    setEditingIdea(idea);
    setIdeaName(idea.name);
    setIdeaDescription(idea.description || "");
    setIdeaSources((idea.sources || []).join("\n"));
    setIdeaFiles([]); // Start fresh for editing (existing files on GitHub are preserved, newly uploaded are added)
    setIdeaSaveError("");
    setIsIdeaModalOpen(true);
  };

  const handleSaveIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creds) {
      alert("GitHub credentials are required.");
      return;
    }
    if (!ideaName.trim()) {
      setIdeaSaveError("Idea name is required.");
      return;
    }

    setIsSavingIdea(true);
    setIdeaSaveError("");

    try {
      const sourceList = ideaSources
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const payload = {
        username: creds.username,
        token: creds.token,
        name: ideaName.trim(),
        description: ideaDescription,
        sources: sourceList,
        files: ideaFiles,
        oldName: editingIdea ? editingIdea.name : undefined,
      };

      const res = await fetch("/api/github/ideas/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save the idea.");
      }

      setIsIdeaModalOpen(false);
      setEditingIdea(null);
      setIdeaName("");
      setIdeaDescription("");
      setIdeaSources("");
      setIdeaFiles([]);
      fetchIdeas();
    } catch (err: any) {
      console.error("[Ideas] Save idea error:", err);
      setIdeaSaveError(err.message || "An unexpected error occurred while saving the idea.");
    } finally {
      setIsSavingIdea(false);
    }
  };

  const handleDeleteIdea = async () => {
    if (!deletingIdea || !creds) return;
    setIsDeletingIdea(true);
    setIdeaDeleteError("");

    try {
      const res = await fetch("/api/github/ideas/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: creds.username,
          token: creds.token,
          folderName: deletingIdea.folderName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete idea.");
      }

      setDeletingIdea(null);
      fetchIdeas();
    } catch (err: any) {
      console.error("[Ideas] Delete idea error:", err);
      setIdeaDeleteError(err.message || "Failed to delete idea.");
    } finally {
      setIsDeletingIdea(false);
    }
  };

  // Update repository name automatically based on folder upload if name is blank
  const handleFilesUploaded = (newFiles: UploadedFile[]) => {
    setFiles((prev) => {
      const updated = [...prev];
      // Keep only unique files by their path to avoid duplicate staging confusion
      newFiles.forEach((newFile) => {
        const idx = updated.findIndex((f) => f.path === newFile.path);
        if (idx !== -1) {
          updated[idx] = newFile; // Overwrite
        } else {
          updated.push(newFile);
        }
      });

      // Simple auto-slug name detection from path of first file
      if (!repoDetails.name && updated.length > 0) {
        const firstPath = updated[0].path;
        let inferredName = "";
        const parts = firstPath.split("/");
        if (parts.length > 1) {
          inferredName = parts[0];
        } else {
          inferredName = "my-awesome-project";
        }
        // Clean name to follow GitHub repo naming convention
        const cleanedName = inferredName
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
          
        setRepoDetails((prevDetails) => ({
          ...prevDetails,
          name: cleanedName || "my-web-project",
        }));
      }

      return updated;
    });
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAllFiles = () => {
    if (window.confirm("Are you sure you want to remove all staged files?")) {
      setFiles([]);
    }
  };

  const handleSaveCredentials = (newCreds: GitHubCredentials) => {
    saveCredentials(newCreds);
    setCreds(newCreds);
    setGlobalError("");
    setRepositories([]);
  };

  const handleSignOut = () => {
    if (window.confirm("Are you sure you want to sign out? This removes stored credentials from your local cookies.")) {
      clearCredentials();
      setCreds(null);
      setRepositories([]);
      setIsCredsModalOpen(true);
    }
  };

  // AI generation of description
  const handleGenerateDescription = async (isForEdit: boolean = false) => {
    const targetFiles = files;
    if (targetFiles.length === 0) {
      alert("Please upload or stage some files first so the AI has project structure and file context to analyze.");
      return;
    }
    
    setIsGeneratingDescription(true);
    setAiGenerationError("");
    
    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: targetFiles.map((f) => ({ path: f.path })),
          repoName: isForEdit ? editName : repoDetails.name,
          referenceUrl: referenceUrl,
          aiProvider,
          openrouterKey: openrouterKey || undefined,
          openrouterModel: openrouterModel || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate metadata description.");
      }

      if (isForEdit) {
        setEditDescription(data.description || "");
      } else {
        setRepoDetails((prev) => ({
          ...prev,
          description: data.description || "",
        }));
      }
    } catch (err: any) {
      console.error(err);
      setAiGenerationError(err.message || "An error occurred during description generation.");
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  // Push to GitHub pipeline execution
  const handlePushProject = async () => {
    if (!creds) {
      setIsCredsModalOpen(true);
      return;
    }
    if (!repoDetails.name.trim()) {
      alert("Please enter a valid GitHub repository name.");
      return;
    }
    if (files.length === 0) {
      alert("Please upload/stage some files before pushing.");
      return;
    }

    setIsPushing(true);
    setPushSuccessResult(null);
    setGlobalError("");

    // Setup initial steps
    const steps: PushStatusStep[] = [
      { id: "create", label: "Creating new repository on GitHub", status: "loading" },
      { id: "init", label: "Resolving master branch & fetching revision refs", status: "idle" },
      { id: "blobs", label: "Uploading git workspace blobs", status: "idle" },
      { id: "tree", label: "Staging git repository tree structure", status: "idle" },
      { id: "commit", label: "Generating commit and updating git references", status: "idle" },
    ];
    setPushStatusSteps(steps);

    try {
      const response = await fetch("/api/github/create-and-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: creds.username,
          token: creds.token,
          repoName: repoDetails.name,
          description: repoDetails.description,
          isPrivate: repoDetails.isPrivate,
          commitMessage: repoDetails.commitMessage,
          files: files.map((f) => ({
            path: f.path,
            content: f.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "GitHub sync operation encountered an error");
      }

      // Mark all steps as complete
      setPushStatusSteps((prev) => 
        prev.map((step) => ({ ...step, status: "success" }))
      );

      setPushSuccessResult({
        repoUrl: data.repoUrl,
        fullName: data.fullName,
        branch: data.branch,
      });

    } catch (err: any) {
      console.error(err);
      const message = err.message || "An unexpected error occurred during raw git operations.";
      setGlobalError(message);

      // Set the active/loading step as standard error
      setPushStatusSteps((prev) => {
        return prev.map((step) => {
          if (step.status === "loading") {
            return { ...step, status: "error", errorDetails: message };
          }
          return step;
        });
      });
    } finally {
      setIsPushing(false);
    }
  };

  // Edit Repository Actions
  const handleStartEdit = (repo: GitHubRepository) => {
    setEditingRepo(repo);
    setEditName(repo.name);
    setEditDescription(repo.description || "");
    setEditIsPrivate(repo.private);
    setEditError("");
  };

  const handleUpdateRepo = async () => {
    if (!creds || !editingRepo) return;
    if (!editName.trim()) {
      setEditError("Repository name is required.");
      return;
    }

    setIsUpdatingRepo(true);
    setEditError("");
    try {
      const owner = editingRepo.owner.login;
      const originalName = editingRepo.name;
      const res = await fetch(`/api/github/repos/${owner}/${originalName}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-github-token": creds.token,
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          private: editIsPrivate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to edit user repository structure.");
      }

      setRepositories((prev) =>
        prev.map((r) => (r.id === editingRepo.id ? (data as GitHubRepository) : r))
      );
      setEditingRepo(null);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "An unexpected error occurred while saving updates.");
    } finally {
      setIsUpdatingRepo(false);
    }
  };

  // Delete Repository Actions
  const handleStartDelete = (repo: GitHubRepository) => {
    setDeletingRepo(repo);
    setDeleteConfirmInput("");
    setDeleteError("");
  };

  const handleDeleteRepo = async () => {
    if (!creds || !deletingRepo) return;
    if (deleteConfirmInput !== deletingRepo.name) {
      setDeleteError(`Name check failed. Please type '${deletingRepo.name}' exactly.`);
      return;
    }

    setIsDeletingRepo(true);
    setDeleteError("");
    try {
      const owner = deletingRepo.owner.login;
      const repoName = deletingRepo.name;
      const res = await fetch(`/api/github/repos/${owner}/${repoName}`, {
        method: "DELETE",
        headers: {
          "x-github-token": creds.token,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete repository.");
      }

      setRepositories((prev) => prev.filter((r) => r.id !== deletingRepo.id));
      setDeletingRepo(null);
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || "An unexpected error occurred during database command execution.");
    } finally {
      setIsDeletingRepo(false);
    }
  };

  // Filter local staging list by search query
  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter GitHub repositories list by search query
  const filteredRepos = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(repoSearchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(repoSearchQuery.toLowerCase()))
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleCopyCloneCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleResetForNewPush = () => {
    setPushSuccessResult(null);
    setFiles([]);
    setRepoDetails({
      name: "",
      description: "",
      isPrivate: true,
      commitMessage: "Initial project setup via GitHub Project Pusher",
    });
    setGlobalError("");
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 px-6 font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_100%)]" />
        
        <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center space-y-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="space-y-2">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 mx-auto flex items-center justify-center text-indigo-400">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Security Lock</h1>
            <p className="text-xs text-slate-400">Enter passcode to unlock Workspace</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (passcodeInput === "2012") {
                setIsLocked(false);
              } else {
                setPasscodeError("Incorrect passcode. Access denied.");
                setPasscodeInput("");
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <input
                type="password"
                maxLength={8}
                placeholder="••••"
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value);
                  setPasscodeError("");
                }}
                className="w-full text-center tracking-[0.5em] text-lg font-mono font-bold py-3 bg-slate-955 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                autoFocus
                id="passcode-input-field"
              />
              {passcodeError && (
                <p className="text-[11px] text-rose-450 font-medium" id="passcode-error-msg">{passcodeError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              id="passcode-submit-btn"
            >
              <Unlock className="w-4 h-4" />
              Unlock Applet
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-45 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Github className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight leading-none" id="app-title">GitHub Project Pusher</h1>
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/25 text-indigo-400">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Stage files and push recursive trees or manage existing repositories</p>
          </div>
        </div>

        {/* Global Connection Settings */}
        <div className="flex items-center gap-3">
          {creds ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl text-sm" id="user-status-card">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-300 font-medium">@{creds.username}</span>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              <button
                onClick={() => setIsCredsModalOpen(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                title="Change API Keys"
                id="edit-creds-btn"
              >
                Settings
              </button>
              <button
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-colors ml-1"
                title="Disconnect GitHub"
                id="sign-out-btn"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCredsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-650 text-white rounded-xl text-xs font-semibold shadow-lg hover:shadow-indigo-500/25 transition-all outline-none"
              id="set-creds-btn"
            >
              <Settings className="w-4 h-4 text-white" />
              Connect GitHub
            </button>
          )}
        </div>
      </header>

      {/* Tabs navigation */}
      <div className="bg-slate-900/40 border-b border-slate-900 px-6 py-2">
        <div className="max-w-7xl mx-auto flex gap-4">
          <button
            onClick={() => setActiveTab("push")}
            className={`px-4 py-2 text-xs font-bold leading-none uppercase tracking-wide rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "push"
                ? "bg-indigo-650 text-white shadow-md shadow-indigo-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
            id="tab-push-btn"
          >
            <FolderOpen className="w-4 h-4" />
            Push Project Staging
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`px-4 py-2 text-xs font-bold leading-none uppercase tracking-wide rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "manage"
                ? "bg-indigo-650 text-white shadow-md shadow-indigo-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
            id="tab-manage-btn"
          >
            <Database className="w-4 h-4" />
            Manage Repositories ({creds ? repositories.length || "..." : "0"})
          </button>
          <button
            onClick={() => setActiveTab("ideas")}
            className={`px-4 py-2 text-xs font-bold leading-none uppercase tracking-wide rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "ideas"
                ? "bg-indigo-650 text-white shadow-md shadow-indigo-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
            id="tab-ideas-btn"
          >
            <Lightbulb className="w-4 h-4 text-amber-400" />
            Ideas Workspace ({creds ? ideas.length || "..." : "0"})
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        
        {activeTab === "push" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Repository Details */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Card 1: Repository details */}
              <section className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden" id="repo-settings-card">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  1. New Repository Properties
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. awesome-node-boilerplate"
                      value={repoDetails.name}
                      onChange={(e) => {
                        const cleaned = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-_]/g, "-")
                          .replace(/-+/g, "-");
                        setRepoDetails({ ...repoDetails, name: cleaned });
                      }}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
                      required
                      id="repo-name-input"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      GitHub URLs accept letters, numbers, hyphens, and underscores.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Description
                    </label>
                    <textarea
                      placeholder="A short descriptive text that explains what your project does..."
                      value={repoDetails.description}
                      onChange={(e) => setRepoDetails({ ...repoDetails, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                      id="repo-description-input"
                    />

                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => setShowAiOptions(!showAiOptions)}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors select-none cursor-pointer"
                        id="toggle-ai-desc-btn"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        ✨ Optional: Auto-Generate with AI
                      </button>
                    </div>

                    {showAiOptions && (
                      <div className="mt-3 p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                          <span className="text-xs font-bold text-slate-300">AI Description Settings</span>
                          <span className="text-[10px] text-slate-500 font-medium">Gemini or OpenRouter</span>
                        </div>

                        {aiGenerationError && (
                          <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 font-sans">
                            {aiGenerationError}
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Reference Website/Source URL (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., https://my-documentation.com or api/docs"
                            value={referenceUrl}
                            onChange={(e) => setReferenceUrl(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none"
                            id="ai-ref-url"
                          />
                          <p className="text-[9px] text-slate-500 mt-1">
                            Scrapes the website URL to supply live workspace context to the LLM.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              AI Provider
                            </label>
                            <select
                              value={aiProvider}
                              onChange={(e) => setAiProvider(e.target.value as any)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              id="ai-provider"
                            >
                              <option value="google">Google Gemini (Server-side)</option>
                              <option value="openrouter">OpenRouter AI (Custom Key)</option>
                            </select>
                          </div>

                          {aiProvider === "openrouter" && (
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                OpenRouter Model
                              </label>
                              <input
                                type="text"
                                placeholder="meta-llama/llama-3-8b-instruct:free"
                                value={openrouterModel}
                                onChange={(e) => setOpenrouterModel(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-200 font-mono focus:outline-none"
                                id="ai-or-model"
                              />
                            </div>
                          )}
                        </div>

                        {aiProvider === "openrouter" && (
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              OpenRouter API Key (Optional if configured on server)
                            </label>
                            <input
                              type="password"
                              placeholder="sk-or-v1-xxxxxxxxxxxxxxxxx"
                              value={openrouterKey}
                              onChange={(e) => setOpenrouterKey(e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-200 font-mono focus:outline-none"
                              id="ai-or-key"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleGenerateDescription(false)}
                          disabled={isGeneratingDescription || files.length === 0}
                          className="w-full py-2 bg-indigo-650 hover:bg-indigo-650 disabled:bg-indigo-600/20 text-white font-bold rounded-lg text-xs tracking-wide transition-all uppercase flex items-center justify-center gap-1.5 text-center cursor-pointer disabled:cursor-not-allowed"
                          id="submit-ai-desc-btn"
                        >
                          {isGeneratingDescription ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Analyzing Files &amp; Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Generate Description
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Commit Announcement Message
                    </label>
                    <input
                      type="text"
                      placeholder="Initial project setup via GitHub Project Pusher"
                      value={repoDetails.commitMessage}
                      onChange={(e) => setRepoDetails({ ...repoDetails, commitMessage: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                      id="commit-message-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Repository Privacy Setting
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRepoDetails({ ...repoDetails, isPrivate: true })}
                        className={`flex items-center justify-center gap-2 p-3 text-sm font-semibold rounded-xl border transition-all ${
                          repoDetails.isPrivate
                            ? "bg-slate-950 border-indigo-500/50 text-white shadow-inner shadow-indigo-500/5"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-300"
                        }`}
                        id="privacy-private-btn"
                      >
                        <Lock className={`w-4 h-4 ${repoDetails.isPrivate ? "text-indigo-400" : "text-slate-500"}`} />
                        Private Repo
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepoDetails({ ...repoDetails, isPrivate: false })}
                        className={`flex items-center justify-center gap-2 p-3 text-sm font-semibold rounded-xl border transition-all ${
                          !repoDetails.isPrivate
                            ? "bg-slate-950 border-indigo-500/50 text-white shadow-inner shadow-indigo-500/5"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-300"
                        }`}
                        id="privacy-public-btn"
                      >
                        <Globe className={`w-4 h-4 ${!repoDetails.isPrivate ? "text-indigo-400" : "text-slate-500"}`} />
                        Public Repo
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 text-xs text-slate-400 space-y-2">
                <h4 className="font-semibold text-slate-200">ℹ️ Secure Direct Pushes</h4>
                <p>GitHub Project Pusher writes transaction records directly using Git APIs without checking out local clones. This is faster and uses less resources.</p>
              </div>

            </div>

            {/* Right Column: Upload, Staging, list */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* Staging workspace */}
              <section className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl flex-1 flex flex-col min-h-[460px]" id="staging-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-indigo-400" />
                      2. Upload &amp; Staged Files
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Staged directories overlay local git trees</p>
                  </div>

                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllFiles}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/10 hover:border-rose-500/25 transition-all flex items-center gap-1.5"
                      id="clear-all-btn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Workspace
                    </button>
                  )}
                </div>

                {/* Drop Zone Component */}
                <div className="mb-5">
                  <UploadDropZone 
                    onFilesUploaded={handleFilesUploaded} 
                    existingFilesCount={files.length} 
                  />
                </div>

                {/* Search and Filters */}
                {files.length > 0 && (
                  <div className="relative mb-3">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Filter staged files by name or path..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-mono"
                      id="file-filter-input"
                    />
                  </div>
                )}

                {/* Files List Display */}
                <div className="flex-1 overflow-y-auto max-h-[350px] border border-slate-850 bg-slate-950/20 rounded-xl divide-y divide-slate-850/55" id="staged-files-list">
                  {filteredFiles.length > 0 ? (
                    filteredFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between p-3 hover:bg-slate-900/40 transition-colors text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-4">
                          <div className="p-1.5 bg-slate-950 rounded-lg text-slate-400">
                            <FileCode className="w-4 h-4 shrink-0 text-slate-450" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-slate-200 font-semibold truncate hover:text-white transition-colors" title={file.path}>
                              {file.path}
                            </p>
                            <p className="text-[10px] text-slate-550 mt-0.5">
                              Size: {formatSize(file.size)} | {file.isBinary ? "Binary Raw Bytes" : "Text document"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!file.isBinary && (
                            <button
                              type="button"
                              onClick={() => setPreviewingFile(file)}
                              className="p-1 px-2.5 rounded-lg border border-slate-800 hover:border-slate-750 bg-slate-950 hover:bg-slate-900 text-indigo-400 hover:text-indigo-300 transition-all font-sans text-[10px] flex items-center gap-1 font-semibold"
                              id={`preview-file-btn-${file.id}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(file.id)}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-500/20 bg-slate-950 hover:bg-rose-500/10 text-slate-400 hover:text-rose-450 transition-all"
                            title="Remove file"
                            id={`delete-file-btn-${file.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 text-center font-sans space-y-2">
                      <FolderIcon className="w-10 h-10 text-slate-800 stroke-1" />
                      <div>
                        <p className="text-xs font-semibold text-slate-400">No staged files matching query</p>
                        <p className="text-[10px] text-slate-500 max-w-[245px] mx-auto mt-1">
                          Drag files above to start loading files, or check selection filters as configured.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Staging Info and Counter */}
                {files.length > 0 && (
                  <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between font-sans px-1">
                    <span>
                      Showing <strong>{filteredFiles.length}</strong> of <strong>{files.length}</strong> files
                    </span>
                    <span>
                      Total staged: <strong>{formatSize(files.reduce((acc, f) => acc + f.size, 0))}</strong>
                    </span>
                  </div>
                )}
              </section>

              {/* Action Trigger Box */}
              <section className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4" id="action-trigger-card">
                
                {globalError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                    <p className="font-semibold mb-1">Push Operations Error:</p>
                    <p className="opacity-90">{globalError}</p>
                  </div>
                )}

                {!creds ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setIsCredsModalOpen(true)}
                      className="w-full py-4 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl shadow-xl hover:shadow-indigo-500/25 transition-all text-sm font-bold border border-indigo-500 select-none flex items-center justify-center gap-2 cursor-pointer"
                      id="cta-connect-creds-btn"
                    >
                      <Settings className="w-4.5 h-4.5 text-white" />
                      Connect GitHub to Start Push
                    </button>
                    <p className="text-center text-[10px] text-slate-400 font-medium">
                      Authentication requires a Personal Access Token with write repo permission scopes.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handlePushProject}
                    disabled={files.length === 0 || isPushing}
                    className="w-full py-4 bg-indigo-650 hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-500/10 disabled:opacity-50 disabled:bg-indigo-600/30 disabled:hover:shadow-none text-white rounded-xl border border-indigo-500/50 flex items-center justify-center gap-2 font-bold text-sm tracking-wide transition-all uppercase cursor-pointer disabled:cursor-not-allowed"
                    id="cta-push-btn"
                  >
                    {isPushing ? (
                      <>
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        Deploying Project Database...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4.5 h-4.5" />
                        Push {files.length} staged file{files.length === 1 ? "" : "s"} to github
                      </>
                    )}
                  </button>
                )}

                {/* Pipeline Step Tracker Modal/Overlay during active push */}
                {(isPushing || pushStatusSteps.length > 0) && !pushSuccessResult && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                      <span className="text-xs font-bold text-slate-300">Operations Pipeline Tracking</span>
                      {isPushing ? (
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-450 border border-indigo-500/20 px-2 py-0.5 rounded animate-pulse font-semibold">
                          Running Pipeline
                        </span>
                      ) : (
                        <span className="text-[10px] bg-rose-500/10 text-rose-450 border border-rose-500/20 px-2 py-0.5 rounded font-semibold">
                          Pipeline Failed
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 pt-1">
                      {pushStatusSteps.map((step) => {
                        const isLoading = step.status === "loading";
                        const isSuccess = step.status === "success";
                        const isError = step.status === "error";

                        return (
                          <div key={step.id} className="flex items-start gap-2.5 text-xs text-slate-300">
                            <div className="mt-0.5 shrink-0">
                              {isLoading && <Loader2 className="w-4.5 h-4.5 text-indigo-400 animate-spin" />}
                              {isSuccess && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />}
                              {isError && <X className="w-4.5 h-4.5 text-rose-400" />}
                              {step.status === "idle" && <div className="w-4.5 h-4.5 border border-slate-800 rounded-full" />}
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${isLoading ? "text-indigo-300" : isSuccess ? "text-slate-400" : isError ? "text-rose-450" : "text-slate-500"}`}>
                                {step.label}
                              </p>
                              {step.errorDetails && (
                                <p className="text-[10px] text-rose-400 font-mono mt-1 whitespace-pre-wrap leading-relaxed py-1.5 px-2 bg-rose-500/5 rounded border border-rose-500/10">
                                  {step.errorDetails}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Success Layout Panel */}
                {pushSuccessResult && (
                  <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 text-slate-100 flex flex-col items-center justify-center text-center space-y-4" id="success-panel">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                      <Check className="w-6 h-6" />
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">Repository Created &amp; Synced</h3>
                      <p className="text-xs text-slate-300 mt-1 max-w-[345px] mx-auto">
                        The files are now deployed directly to GitHub branches using transactional database commits.
                      </p>
                    </div>

                    <div className="w-full bg-slate-950 border border-slate-855 rounded-xl p-3 text-xs text-left text-slate-300 font-mono space-y-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block">REPOSITORY DETAILS</span>
                        <a 
                          href={pushSuccessResult.repoUrl}
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-indigo-400 hover:text-indigo-300 hover:underline inline-flex items-center gap-1 break-all select-all pt-0.5"
                        >
                          {pushSuccessResult.fullName} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="pt-2 border-t border-slate-900">
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">CLONE LOCAL COMMAND</span>
                        <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                          <span className="text-xs text-slate-400 truncate max-w-[280px]">
                            git clone {pushSuccessResult.repoUrl}.git
                          </span>
                          <button
                            onClick={() => handleCopyCloneCmd(`git clone ${pushSuccessResult.repoUrl}.git`)}
                            className="p-1 hover:bg-slate-850 rounded text-slate-300 hover:text-white transition-colors"
                            title="Copy to clipboard"
                            id="copy-clone-cmd"
                          >
                            {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full">
                      <a 
                        href={pushSuccessResult.repoUrl}
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex-1 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow border border-indigo-555 transition-all flex items-center justify-center gap-1"
                        id="success-view-github-btn"
                      >
                        View Repo on GitHub
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={handleResetForNewPush}
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-705 transition-all"
                        id="success-new-push-btn"
                      >
                        Push Another Project
                      </button>
                    </div>
                  </div>
                )}

              </section>

            </div>
          </div>
        )}

        {activeTab === "manage" && (
          /* "Manage Repositories" Tab View */
          <div className="space-y-6">
            <section className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-12 h-1 bg-indigo-500" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    Existing User Repositories
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Viewing repos belonging to <strong className="text-indigo-400">@{creds?.username}</strong>. You can edit their names/metadata or delete them directly.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchRepositories}
                    disabled={isLoadingRepos || !creds}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRepos ? "animate-spin" : ""}`} />
                    Refresh Repos
                  </button>
                </div>
              </div>

              {!creds ? (
                <div className="text-center py-12 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
                  <Lock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-300">GitHub accounts disconnected</p>
                  <p className="text-xs text-slate-550 mt-1 max-w-sm mx-auto">Please enter your username and Personal Access Token (PAT) first using the connect button above.</p>
                  <button
                    onClick={() => setIsCredsModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-650 hover:bg-indigo-650 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10"
                  >
                    Connect GitHub Account
                  </button>
                </div>
              ) : (
                <>
                  {/* Search and Filters */}
                  <div className="relative mb-5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search existing repositories by name or descriptions..."
                      value={repoSearchQuery}
                      onChange={(e) => setRepoSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                    />
                  </div>

                  {reposError && (
                    <div className="p-3.5 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                      <p className="font-semibold">Failed to load repositories:</p>
                      <p className="opacity-90">{reposError}</p>
                    </div>
                  )}

                  {isLoadingRepos ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-400 font-medium">Querying GitHub API for repositories list...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredRepos.length > 0 ? (
                        filteredRepos.map((repo) => (
                          <div 
                            key={repo.id}
                            className="bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl p-4 transition-all flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-[9px] uppercase tracking-wider font-bold border px-2 py-0.5 rounded ${
                                  repo.private 
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                }`}>
                                  {repo.private ? "Private" : "Public"}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Updated: {new Date(repo.updated_at).toLocaleDateString()}
                                </span>
                              </div>

                              <h3 className="text-sm font-bold text-white hover:text-indigo-400 transition-colors truncate">
                                <a href={repo.html_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                                  {repo.name}
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                </a>
                              </h3>

                              <p className="text-xs text-slate-400 mt-1 lines-clamp-2 h-8 overflow-hidden break-words">
                                {repo.description || <span className="text-slate-600 italic">No description provided</span>}
                              </p>

                              {repo.default_branch && (
                                <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-550 font-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                  <span>Default branch: <strong className="text-slate-400">{repo.default_branch}</strong></span>
                                </div>
                              )}
                            </div>

                            <div className="mt-4 pt-3.5 border-t border-slate-900 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-slate-600">ID: {repo.id}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(repo)}
                                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all"
                                >
                                  <Edit2 className="w-3 h-3 text-indigo-400" />
                                  Edit Metadata
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartDelete(repo)}
                                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 text-[10px] font-bold flex items-center gap-1 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 py-16 text-center">
                          <FolderIcon className="w-8 h-8 text-slate-800 mx-auto mb-2" />
                          <p className="text-xs text-slate-400 font-semibold">No repositories found matching your query</p>
                          <p className="text-[10px] text-slate-500 mt-1">Make sure you have repositories under this account or check the search filters.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {activeTab === "ideas" && (
          <div className="space-y-6">
            <section className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-12 h-1 bg-amber-500" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    Ideas Sandbox Workspace
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage and persist your creative ideas directly inside folder structures within <strong className="text-indigo-400">@{creds?.username}/IDEAS</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 self-end md:self-auto">
                  <button
                    onClick={fetchIdeas}
                    disabled={isLoadingIdeas || !creds}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIdeas ? "animate-spin" : ""}`} />
                    Refresh Ideas
                  </button>
                  <button
                    onClick={handleStartNewIdea}
                    disabled={!creds}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/10"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    New Idea
                  </button>
                </div>
              </div>

              {!creds ? (
                <div className="text-center py-12 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
                  <Lock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-300">GitHub accounts disconnected</p>
                  <p className="text-xs text-slate-550 mt-1 max-w-sm mx-auto">Please enter your username and Personal Access Token (PAT) first using the connect button above.</p>
                  <button
                    onClick={() => setIsCredsModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-650 hover:bg-indigo-650 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10"
                  >
                    Connect GitHub Account
                  </button>
                </div>
              ) : (
                <>
                  {/* Search filter */}
                  <div className="relative mb-5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search saved ideas by name, features, or external resources..."
                      value={ideaSearchQuery}
                      onChange={(e) => setIdeaSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                    />
                  </div>

                  {ideasError && (
                    <div className="p-3.5 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                      <p className="font-semibold">Workspace connection error:</p>
                      <p className="opacity-90">{ideasError}</p>
                    </div>
                  )}

                  {isLoadingIdeas ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-400 font-medium font-mono">Synchronizing folder branches inside 'IDEAS' repository...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {ideas.filter(idea => 
                        idea.name.toLowerCase().includes(ideaSearchQuery.toLowerCase()) ||
                        idea.description.toLowerCase().includes(ideaSearchQuery.toLowerCase())
                      ).length > 0 ? (
                        ideas.filter(idea => 
                          idea.name.toLowerCase().includes(ideaSearchQuery.toLowerCase()) ||
                          idea.description.toLowerCase().includes(ideaSearchQuery.toLowerCase())
                        ).map((idea) => (
                          <div 
                            key={idea.id}
                            className="bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl p-5 transition-all flex flex-col justify-between space-y-4"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-550 font-mono">
                                  Updated: {new Date(idea.updatedAt).toLocaleDateString()}
                                </span>
                                <span className="text-[10px] bg-slate-900 border border-slate-800 text-indigo-400 font-semibold font-mono px-2 py-0.5 rounded">
                                  /{idea.folderName}
                                </span>
                              </div>

                              <div>
                                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  {idea.name}
                                </h3>
                                <p className="text-xs text-slate-300 mt-1.5 whitespace-pre-wrap leading-relaxed">
                                  {idea.description || <span className="text-slate-600 italic">No description provided for this idea.</span>}
                                </p>
                              </div>

                              {idea.sources && idea.sources.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reference Sources</h4>
                                  <div className="space-y-1">
                                    {idea.sources.map((src: string, sIdx: number) => (
                                      <a 
                                        key={sIdx}
                                        href={src.startsWith("http") ? src : `https://${src}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 break-all truncate"
                                      >
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                        {src}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {idea.files && idea.files.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attached File Resources</h4>
                                  <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-900 divide-y divide-slate-900 max-h-[140px] overflow-y-auto">
                                    {idea.files.map((file: any, fIdx: number) => (
                                      <div key={fIdx} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 text-[11px] font-mono">
                                        <span className="text-slate-300 truncate pr-2" title={file.name}>{file.name}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[9px] text-slate-600">{formatSize(file.size)}</span>
                                          <a 
                                            href={file.downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-400 hover:text-indigo-300 font-sans text-[10px] font-bold"
                                          >
                                            Download
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-3.5 border-t border-slate-900 flex items-center justify-between">
                              <span className="text-[10px] font-mono text-slate-600">ID: {idea.id}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditIdea(idea)}
                                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3 text-indigo-400" />
                                  Edit Idea
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingIdea(idea)}
                                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-455 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 py-16 text-center">
                          <Lightbulb className="w-10 h-10 text-slate-800 mx-auto mb-3" />
                          <p className="text-xs text-slate-400 font-semibold">No saved ideas found</p>
                          <p className="text-[10px] text-slate-550 mt-1">Get started by clicking the 'New Idea' button above to commit your first inspiration folder.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

      </main>

      {/* Footer / Info */}
      <footer className="border-t border-slate-900 bg-slate-950 mt-12 py-5 px-6 text-center text-xs text-slate-500">
        <div className="flex items-center justify-center gap-1 text-slate-550">
          <span>Google AI Studio Applet</span>
          <div className="h-1 w-1 rounded-full bg-slate-755" />
          <span>Integrated Gemini &amp; OpenRouter AI | Fully Interactive Workspace Hub</span>
        </div>
      </footer>

      {/* ------------------------------------------------------------- */}
      {/* 1. Modal: GitHub Credentials settings */}
      {/* ------------------------------------------------------------- */}
      <GitHubCredentialsModal
        isOpen={isCredsModalOpen}
        onClose={() => setIsCredsModalOpen(false)}
        onSave={handleSaveCredentials}
        initialCreds={creds}
      />

      {/* ------------------------------------------------------------- */}
      {/* 2. Modal: Full file viewer preview */}
      {/* ------------------------------------------------------------- */}
      {previewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setPreviewingFile(null)} />
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-850">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm truncate font-mono">{previewingFile.path}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Size: {formatSize(previewingFile.size)} | Plain Text Preview</p>
              </div>
              <button 
                onClick={() => setPreviewingFile(null)} 
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1 rounded-lg transition-colors"
                id="close-preview-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-5 bg-slate-950/60 font-mono text-xs leading-relaxed max-h-[60vh] text-slate-300 select-all scrollbar-thin">
              <pre className="whitespace-pre-wrap">{previewingFile.text || "// No content to display or file is empty"}</pre>
            </div>

            <div className="px-5 py-3 border-t border-slate-850 bg-slate-905 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setPreviewingFile(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
                id="preview-close-btn"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. Modal: Edit Existing Repository */}
      {/* ------------------------------------------------------------- */}
      {editingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setEditingRepo(null)} />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-slate-250 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-855">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Edit Repository Properties</h3>
                  <p className="text-[10px] text-slate-450 mt-0.5">Modify repository name, description, and accessibility status.</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingRepo(null)} 
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1 rounded-lg transition-colors"
                id="close-edit-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => {
                    const cleaned = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-_]/g, "-")
                      .replace(/-+/g, "-");
                    setEditName(cleaned);
                  }}
                  className="w-full px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-mono"
                  placeholder="name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-655 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs"
                  placeholder="Add an optional explanation for this project repository..."
                />

                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setShowAiOptions(!showAiOptions)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors select-none cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Description Builder Options
                  </button>
                </div>

                {showAiOptions && (
                  <div className="mt-2.5 p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-3.5 text-left animate-in fade-in duration-200">
                    {aiGenerationError && (
                      <p className="text-xs text-rose-450">{aiGenerationError}</p>
                    )}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-450 mb-1">
                        Optional Reference Website URL
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. https://docs.my-project.com"
                        value={referenceUrl}
                        onChange={(e) => setReferenceUrl(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-450 mb-1">
                          Provider
                        </label>
                        <select
                          value={aiProvider}
                          onChange={(e) => setAiProvider(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                        >
                          <option value="google">Google Gemini</option>
                          <option value="openrouter">OpenRouter AI</option>
                        </select>
                      </div>
                      {aiProvider === "openrouter" && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-450 mb-1">
                            Model Identifier
                          </label>
                          <input
                            type="text"
                            placeholder="Model identity"
                            value={openrouterModel}
                            onChange={(e) => setOpenrouterModel(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                          />
                        </div>
                      )}
                    </div>
                    {aiProvider === "openrouter" && (
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-455 mb-1">
                          OpenRouter Key
                        </label>
                        <input
                          type="password"
                          placeholder="OpenRouter Key"
                          value={openrouterKey}
                          onChange={(e) => setOpenrouterKey(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleGenerateDescription(true)}
                      disabled={isGeneratingDescription || files.length === 0}
                      className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                    >
                      {isGeneratingDescription ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analyzing Staged Code...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Generate Metadata Suggestion
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Privacy Classification
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditIsPrivate(true)}
                    className={`flex items-center justify-center gap-2 p-2.5 text-xs font-semibold rounded-xl border transition-all ${
                      editIsPrivate
                        ? "bg-slate-955 border-indigo-500/50 text-white shadow-inner"
                        : "bg-slate-950 border-slate-800 text-slate-450 hover:text-slate-300"
                    }`}
                  >
                    <Lock className={`w-3.5 h-3.5 ${editIsPrivate ? "text-indigo-400" : "text-slate-500"}`} />
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIsPrivate(false)}
                    className={`flex items-center justify-center gap-2 p-2.5 text-xs font-semibold rounded-xl border transition-all ${
                      !editIsPrivate
                        ? "bg-slate-955 border-indigo-500/50 text-white shadow-inner"
                        : "bg-slate-950 border-slate-800 text-slate-455 hover:text-slate-300"
                    }`}
                  >
                    <Globe className={`w-3.5 h-3.5 ${!editIsPrivate ? "text-indigo-400" : "text-slate-500"}`} />
                    Public
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-850 bg-slate-905 flex items-center justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setEditingRepo(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-305 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleUpdateRepo}
                disabled={isUpdatingRepo}
                className="px-4.5 py-2 bg-indigo-650 hover:bg-indigo-650 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                {isUpdatingRepo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Metadata Changes
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. Modal: Safe Repository Delete Confirmation */}
      {/* ------------------------------------------------------------- */}
      {deletingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDeletingRepo(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-855">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-455">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Dangerous Operation Danger</h3>
                  <p className="text-[10px] text-slate-450 mt-0.5">Please read instruction to verify repository drop.</p>
                </div>
              </div>
              <button 
                onClick={() => setDeletingRepo(null)} 
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1 rounded-lg transition-colors"
                id="close-delete-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                This action <strong className="text-rose-400">CANNOT</strong> be undone. This will permanently delete the GitHub repository <strong>{deletingRepo.owner.login}/{deletingRepo.name}</strong>, including all branches, issues, comments, commits and files completely.
              </p>

              <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/15 text-orange-400 text-xs text-left">
                ⚠️ **Personal Access Token requirements:** Your stored GitHub Personal Access Token MUST possess the <code className="px-1 py-0.5 rounded bg-slate-950 text-white border border-slate-850 font-mono">delete_repo</code> authentication scope for this request to complete successfully.
              </div>

              {deleteError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {deleteError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Please type <strong className="text-white select-all font-mono">'{deletingRepo.name}'</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-750 focus:outline-none focus:ring-1 focus:ring-rose-555 transition-all text-xs font-mono"
                  placeholder={deletingRepo.name}
                />
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-850 bg-slate-905 flex items-center justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setDeletingRepo(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-305 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                No, Keep Repository
              </button>
              <button
                type="button"
                onClick={handleDeleteRepo}
                disabled={isDeletingRepo || deleteConfirmInput !== deletingRepo.name}
                className="px-4.5 py-2.5 bg-rose-650 hover:bg-rose-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                {isDeletingRepo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Executing Deletion...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Delete Repository Permanently
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. Modal: Create / Edit Idea Sandbox Folder */}
      {/* ------------------------------------------------------------- */}
      {isIdeaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsIdeaModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-855">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {editingIdea ? "Edit Sandbox Idea" : "Pitch New Sandbox Idea"}
                  </h3>
                  <p className="text-[10px] text-slate-450 mt-0.5">
                    Describe your inspiration and attach dynamic source URLs or custom documents.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsIdeaModalOpen(false)} 
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1 rounded-lg transition-colors"
                id="close-idea-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIdea} className="flex-1 overflow-y-auto max-h-[75vh]">
              <div className="p-5 space-y-4">
                {ideaSaveError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {ideaSaveError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-1.5">
                    Idea Name / Concept Title
                  </label>
                  <input
                    type="text"
                    required
                    value={ideaName}
                    onChange={(e) => setIdeaName(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-semibold"
                    placeholder="e.g. Real-time Multi-agent Collaborative Editor"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-1.5">
                    Detailed Explanation &amp; Specifications
                  </label>
                  <textarea
                    value={ideaDescription}
                    onChange={(e) => setIdeaDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs"
                    placeholder="Describe how your idea works, target demographics, and required tech-stack..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-1.5 flex items-center justify-between">
                    <span>Reference URLs &amp; Resources</span>
                    <span className="text-[10px] text-slate-500 lowercase normal-case">one link per line</span>
                  </label>
                  <textarea
                    value={ideaSources}
                    onChange={(e) => setIdeaSources(e.target.value)}
                    rows={3}
                    className="w-full px-4.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-mono"
                    placeholder="e.g. https://github.com/some/framework&#10;https://medium.com/design-tips"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-1.5">
                    Attach Resource Files <span className="text-[10px] text-slate-500 normal-case">(optional)</span>
                  </label>
                  
                  <div className="relative border-2 border-dashed border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 bg-slate-950/40 text-center transition-all cursor-pointer">
                    <input 
                      type="file" 
                      multiple 
                      onChange={handleIdeaFilesSelect}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" 
                      id="idea-files-input"
                    />
                    <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-semibold">Click or drag documents to attach</p>
                    <p className="text-[9px] text-slate-600 mt-1">Files are saved as commit entities inside the idea folder</p>
                  </div>

                  {ideaFiles.length > 0 && (
                    <div className="mt-3 bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Staged Uploads ({ideaFiles.length})</p>
                      <div className="divide-y divide-slate-900 max-h-[120px] overflow-y-auto">
                        {ideaFiles.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 text-xs font-mono">
                            <span className="text-slate-300 truncate pr-4">{f.name}</span>
                            <div className="flex items-center gap-2.5">
                              <span className="text-[9px] text-slate-600">{formatSize(f.size)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveIdeaFile(f.name)}
                                className="text-rose-450 hover:text-rose-350 hover:underline font-sans text-[10px]"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-slate-850 bg-slate-905 flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsIdeaModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-305 rounded-xl text-xs font-semibold border border-slate-700 transition"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={isSavingIdea}
                  className="px-4.5 py-2 bg-amber-600 hover:bg-amber-550 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isSavingIdea ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving to Github...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Sandbox Idea
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. Modal: Delete Idea Sandbox Confirmation */}
      {/* ------------------------------------------------------------- */}
      {deletingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDeletingIdea(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-855">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-455">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Delete Sandbox Idea</h3>
                  <p className="text-[10px] text-slate-450 mt-0.5">Please confirm sandbox folder removal.</p>
                </div>
              </div>
              <button 
                onClick={() => setDeletingIdea(null)} 
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1 rounded-lg transition-colors"
                id="close-delete-idea-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{deletingIdea.name}</strong>? This action will permanently drop the corresponding folder and all associated file commits within the <strong className="text-amber-400 font-mono">/{deletingIdea.folderName}</strong> tree.
              </p>

              {ideaDeleteError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {ideaDeleteError}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-850 bg-slate-905 flex items-center justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setDeletingIdea(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-305 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteIdea}
                disabled={isDeletingIdea}
                className="px-4.5 py-2.5 bg-rose-650 hover:bg-rose-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingIdea ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting Folder...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Delete Folder
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
