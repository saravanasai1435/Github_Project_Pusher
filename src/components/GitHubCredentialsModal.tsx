import React, { useState, useEffect } from "react";
import { GitHubCredentials } from "../types";
import { Key, User, ExternalLink, ShieldCheck, X, Github, Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (creds: GitHubCredentials) => void;
  initialCreds: GitHubCredentials | null;
}

export default function GitHubCredentialsModal({ isOpen, onClose, onSave, initialCreds }: Props) {
  const [authMethod, setAuthMethod] = useState<"oauth" | "pat">(
    initialCreds?.isOAuth ? "oauth" : "pat"
  );
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  // Custom client ID / secret settings if server-side isn't configured
  const [useCustomOAuth, setUseCustomOAuth] = useState(false);
  const [customClientId, setCustomClientId] = useState("");
  const [customClientSecret, setCustomClientSecret] = useState("");

  const [oauthStatus, setOauthStatus] = useState<{
    configured: boolean;
    hasGeminiKey: boolean;
    hasOpenRouterKey: boolean;
  } | null>(null);

  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingStatus(true);
      fetch("/api/auth/github/status")
        .then((r) => r.json())
        .then((data) => {
          setOauthStatus(data);
          // Auto-select oauth if server configured it
          if (data.configured && !initialCreds) {
            setAuthMethod("oauth");
          }
        })
        .catch((err) => console.error("Could not fetch oauth status:", err))
        .finally(() => setIsLoadingStatus(false));
    }
  }, [isOpen, initialCreds]);

  useEffect(() => {
    if (initialCreds) {
      setUsername(initialCreds.username);
      setToken(initialCreds.token);
    }
  }, [initialCreds, isOpen]);

  // Listen for OAuth postMessage success events
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Allow local and preview runapp domains
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const { username: oauthUser, token: oauthToken } = event.data;
        if (oauthUser && oauthToken) {
          setError("");
          onSave({
            username: oauthUser,
            token: oauthToken,
            isOAuth: true,
          });
          onClose();
        }
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [onSave, onClose]);

  if (!isOpen) return null;

  const handleOAuthLogin = async () => {
    try {
      setError("");
      
      const params = new URLSearchParams();
      params.set("redirect_uri", `${window.location.origin}/api/auth/github/callback`);

      if (useCustomOAuth) {
        if (!customClientId.trim()) {
          setError("Custom Client ID is required for custom developer app integration.");
          return;
        }
        params.set("client_id", customClientId.trim());
        if (customClientSecret.trim()) {
          params.set("client_secret", customClientSecret.trim());
        }
      }

      const res = await fetch(`/api/auth/github/url?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate GitHub OAuth flow on back-end.");
      }

      const { url } = await res.json();

      // Open the GitHub authorization page directly in a centralized popup
      const width = 600;
      const height = 750;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        url,
        "github_oauth_popup",
        `width=${width},height=${height},top=${top},left=${left},status=yes,resizable=yes`
      );

      if (!authWindow) {
        setError("Login popup window was blocked by your browser. Please allow popups for this page to sign in with GitHub.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while starting login.");
    }
  };

  const handleSubmitPat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter your GitHub Username.");
      return;
    }
    if (!token.trim()) {
      setError("Please enter your GitHub Personal Access Token (PAT).");
      return;
    }

    setError("");
    onSave({
      username: username.trim(),
      token: token.trim(),
      isOAuth: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
        onClick={initialCreds ? onClose : undefined} 
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 z-10 animate-in fade-in zoom-in-95 duration-200">
        {initialCreds && (
          <button 
            type="button" 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors rounded-lg p-1 hover:bg-slate-800 cursor-pointer"
            id="close-creds-modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">GitHub Connection</h3>
            <p className="text-xs text-slate-400 mt-0.5">Choose secure integration pattern</p>
          </div>
        </div>

        {/* Navigation Selector */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-850 rounded-xl mb-5 text-xs text-center font-medium">
          <button
            type="button"
            onClick={() => {
              setAuthMethod("oauth");
              setError("");
            }}
            className={`py-2 rounded-lg transition-all ${
              authMethod === "oauth"
                ? "bg-indigo-650 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            GitHub Login (SSO)
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("pat");
              setError("");
            }}
            className={`py-2 rounded-lg transition-all ${
              authMethod === "pat"
                ? "bg-indigo-650 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Personal Access Token
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {authMethod === "oauth" ? (
          <div className="space-y-4">
            {/* OAuth Single Sign On Action */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-white/5 border border-white/10 text-slate-200 rounded-full flex items-center justify-center mx-auto shadow-md">
                <Github className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">OAuth Direct Integration</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  Connect without personal access tokens. Grant repo scope permissions temporarily with a secure callback flow.
                </p>
              </div>

              {isLoadingStatus ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking connection capabilities...
                </div>
              ) : oauthStatus?.configured ? (
                <button
                  type="button"
                  onClick={handleOAuthLogin}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/20 select-none border border-indigo-550 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Github className="w-4 h-4" />
                  Connect with GitHub OAuth
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-950/20 border border-slate-800 rounded-lg text-left text-xs text-slate-400 leading-relaxed">
                    💡 Server-side <strong>GITHUB_CLIENT_ID</strong> is not configured as default server env. You can connect by pasting your own GitHub app configurations below.
                  </div>

                  <button
                    type="button"
                    onClick={() => setUseCustomOAuth(!useCustomOAuth)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium select-none"
                  >
                    {useCustomOAuth ? "Hide Custom OAuth Config" : "⚙️ Provide custom Developer App config"}
                  </button>

                  {useCustomOAuth && (
                    <div className="space-y-3 pt-2 text-left border-t border-slate-900">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          Client ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Iv1.xxxxxx"
                          value={customClientId}
                          onChange={(e) => setCustomClientId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          Client Secret (Optional)
                        </label>
                        <input
                          type="password"
                          placeholder="xxxxxxxxxxxxxxxxxxx"
                          value={customClientSecret}
                          onChange={(e) => setCustomClientSecret(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleOAuthLogin}
                        className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-lg text-xs tracking-wide transition-all uppercase cursor-pointer mt-1"
                      >
                        Launch Custom OAuth Login
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 text-xs text-slate-450 space-y-1">
              <span className="font-semibold text-slate-350">📋 Direct OAuth Requirements:</span>
              <p>For custom setups, register a Developer OAuth App on GitHub with callback URL:</p>
              <p className="font-mono text-indigo-400 select-all break-all bg-slate-900 p-1.5 rounded mt-1 border border-slate-850">
                {window.location.origin}/api/auth/github/callback
              </p>
            </div>

            {initialCreds && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all text-sm font-medium"
              >
                Close Settings
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitPat} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                GitHub Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. octocat"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  required
                  id="gh-username-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Personal Access Token (PAT)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Key className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
                  required
                  id="gh-token-input"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 text-xs text-slate-400 space-y-2">
              <span className="font-semibold text-slate-350 flex items-center gap-1.5">
                💡 Scope Guidelines:
              </span>
              <p>
                Ensure your personal access token has the full <strong>repo</strong> scope scope checkmarks checked in your developers workspace page.
              </p>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Generate classic token on GitHub <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex gap-3 pt-2">
              {initialCreds && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all text-sm font-medium"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all text-sm font-semibold border border-indigo-500 cursor-pointer"
              >
                Verify &amp; Save classic PAT
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
