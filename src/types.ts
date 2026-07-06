export interface UploadedFile {
  id: string;
  path: string;
  name: string;
  size: number;
  content: string; // Base64 encoded string
  text?: string;    // Decoded UTF-8 content for previews (if text file)
  isBinary: boolean;
}

export interface GitHubCredentials {
  username: string;
  token: string;
  isOAuth?: boolean;
}

export interface RepoDetails {
  name: string;
  description: string;
  isPrivate: boolean;
  commitMessage: string;
}

export interface AiConfig {
  provider: "google" | "openrouter";
  openrouterKey?: string;
  openrouterModel?: string;
  referenceUrl?: string;
}

export interface PushStatusStep {
  id: string;
  label: string;
  status: "idle" | "loading" | "success" | "error";
  errorDetails?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
  created_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  default_branch: string;
}
