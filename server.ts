import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Scrapes readable content from an optional reference URL to support contextual AI descriptions.
 */
async function fetchUrlPreview(url: string): Promise<string> {
  if (!url) return "";
  try {
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
    }
    const response = await fetch(target, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GitHub-Project-Pusher-Agent" 
      },
    });
    if (!response.ok) return `[Failed to retrieve reference URL context. Server responded with: HTTP ${response.status}]`;
    const text = await response.text();
    // Strip script classes and html tags to read text content easily
    const cleanText = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleanText.substring(0, 3000); // Send up to 3000 characters as prompt context
  } catch (err: any) {
    return `[Could not fetch reference URL web contents. Error: ${err.message}]`;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set up body parsers with generous limits for multi-file transfers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ---------------------------------------------------------
  // API Routes
  // ---------------------------------------------------------

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Check if server-side GitHub OAuth app is configured
  app.get("/api/auth/github/status", (req, res) => {
    res.json({
      configured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    });
  });

  // Fetch pre-configured local GitHub environment credentials for secure SSO bypass
  app.get("/api/auth/github/default-credentials", (req, res) => {
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GITHUB_ACCESS_TOKEN;
    const username = process.env.GITHUB_USERNAME || process.env.GITHUB_USER;
    if (token) {
      res.json({
        hasDefaults: true,
        token: token.trim(),
        username: (username || "authenticated-user").trim(),
      });
    } else {
      res.json({ hasDefaults: false });
    }
  });

  // Get GitHub OAuth authorization redirect url
  app.get("/api/auth/github/url", (req, res) => {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID || (req.query.client_id as string);
      const redirectUri = (req.query.redirect_uri as string) || `https://${req.get("host")}/api/auth/github/callback`;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET || (req.query.client_secret as string);

      if (!clientId) {
        return res.status(400).json({ error: "Missing GitHub Client ID. Please configure GITHUB_CLIENT_ID or provide it." });
      }

      // Pack custom secrets state payload so callback can utilize them stateless-ly
      const statePayload = {
        clientId,
        clientSecret,
        redirectUri,
        rand: Math.random().toString(36).substring(7),
      };
      const stateStr = Buffer.from(JSON.stringify(statePayload)).toString("base64");

      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo&state=${stateStr}`;
      res.json({ url: githubAuthUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to build OAuth url." });
    }
  });

  // GitHub OAuth redirect callback handler
  app.get("/api/auth/github/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code) {
      return res.send(`<html><body><p style="color: #ef4444; font-family: sans-serif;">Error: Missing "code" from GitHub auth redirect.</p></body></html>`);
    }

    try {
      let clientId = process.env.GITHUB_CLIENT_ID;
      let clientSecret = process.env.GITHUB_CLIENT_SECRET;
      let redirectUri = `${req.protocol}://${req.get("host")}/api/auth/github/callback`;

      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state as string, "base64").toString("utf-8"));
          if (decoded.clientId) clientId = decoded.clientId;
          if (decoded.clientSecret) clientSecret = decoded.clientSecret;
          if (decoded.redirectUri) redirectUri = decoded.redirectUri;
        } catch (e) {
          console.error("Failed to parse callback state:", e);
        }
      }

      if (!clientId || !clientSecret) {
        return res.send(`
          <html>
            <body style="font-family: sans-serif; background: #030712; color: #ef4444; padding: 2rem; text-align: center;">
              <h2>Configuration Mismatch</h2>
              <p>Error: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not received. Please configure this in backend env secrets or supply them in settings.</p>
              <button onclick="window.close()" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">Close Window</button>
            </body>
          </html>
        `);
      }

      // Exchange temporary code for an access token
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return res.send(`
          <html>
            <body style="font-family: sans-serif; background: #030712; color: #ef4444; padding: 2rem; text-align: center;">
              <h2>OAuth Exchange Failed</h2>
              <p>GitHub response: ${tokenData.error_description || tokenData.error}</p>
              <button onclick="window.close()" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">Close Window</button>
            </body>
          </html>
        `);
      }

      const accessToken = tokenData.access_token;
      if (!accessToken) {
        return res.send(`<html><body><p style="color: #ef4444; font-family: sans-serif;">Error: Access token not found in exchange payload.</p></body></html>`);
      }

      // Get authenticated profile
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `token ${accessToken}`,
          "User-Agent": "github-project-pusher",
          "Accept": "application/vnd.github+json",
        },
      });

      if (!userRes.ok) {
        const errText = await userRes.text();
        throw new Error(`Profile lookup error: ${errText}`);
      }

      const userData = await userRes.json();
      const username = userData.login;

      // Post OAuth result to opener container
      res.send(`
        <html>
          <head>
            <title>GitHub Login Integration Callback</title>
          </head>
          <body style="font-family: sans-serif; background: #030712; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center;">
            <div style="padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #1e293b; background: #090d16; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
              <div style="color: #10b981; font-size: 3.5rem; margin-bottom: 1rem;">✓</div>
              <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 800; tracking: -0.025em; color: white;">Connection Success</h2>
              <p style="color: #9ca3af; font-size: 0.875rem; line-height: 1.5; margin: 0 0 1.5rem 0;">Authorized as <strong style="color: #a5b4fc;">@${username}</strong>. This login tab will close automatically to return to the app.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: "OAUTH_AUTH_SUCCESS",
                    username: ${JSON.stringify(username)},
                    token: ${JSON.stringify(accessToken)}
                  }, "*");
                  window.close();
                } else {
                  // Fallback if not opened in popups
                  window.location.href = "/";
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("[OAuth Callback] Exceptional failure:", err);
      res.send(`<html><body><p style="color: #ef4444; font-family: sans-serif;">Expection occurred during OAuth Callback: ${err.message}</p></body></html>`);
    }
  });

  // AI Description and Overview Generator (Google Gemini or OpenRouter)
  app.post("/api/ai/generate-description", async (req, res) => {
    try {
      const { files, repoName, referenceUrl, aiProvider, openrouterKey, openrouterModel } = req.body;

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Please stage or upload some files so the AI can analyze your project structure." });
      }

      const fileListStr = files
        .slice(0, 100) // Keep standard sanity bounds
        .map((f: { path: string }) => `- ${f.path}`)
        .join("\n");

      let referenceContent = "";
      if (referenceUrl && referenceUrl.trim().length > 0) {
        console.log(`[AI Generator] Scoping optional reference URL: ${referenceUrl}`);
        referenceContent = await fetchUrlPreview(referenceUrl);
      }

      const prompt = `You are a professional software developer and technical writer. Please generate a highly optimized, clean, precise, and professional description (1-2 clear paragraphs, strictly 40-100 words total) for a repository based on the project properties:

Repository Name: ${repoName || "unnamed-project"}

STAGED DIRECTORY FILE TREE STRUCTURE:
${fileListStr}

${referenceContent ? `EXTERNAL REFERENCED WEBSITE DESCRIPTION CONTEXT (${referenceUrl}):\n${referenceContent}\n` : ""}

Write a clean and concise summary that fits perfectly in a GitHub repository description. Describe key frameworks, purpose, and language based on the file layout. Focus strictly on direct human readability. Do not output headings, bullet lists, markdown tags, qualifiers, or greetings. Output raw paragraph text only.`;

      if (aiProvider === "google") {
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          return res.status(400).json({ 
            error: "Google Gemini is not configured on the server-side environment. Set 'GEMINI_API_KEY' in the Secrets panel." 
          });
        }

        const ai = new GoogleGenAI({
          apiKey: geminiApiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });

        return res.json({ description: response.text?.trim() || "" });

      } else if (aiProvider === "openrouter") {
        const apiKey = openrouterKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return res.status(400).json({
            error: "OpenRouter API Key is missing. Please supply it in the AI generation configuration settings or set server-side 'OPENROUTER_API_KEY' secret."
          });
        }

        const model = openrouterModel || "meta-llama/llama-3-8b-instruct:free";
        console.log(`[AI Generator] Querying OpenRouter model: ${model}`);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai.studio/build",
            "X-Title": "GitHub Project Pusher",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "user", content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenRouter returned status code HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        return res.json({ description: content });

      } else {
        return res.status(400).json({ error: "Unsupported or unhandled AI description action provider." });
      }

    } catch (err: any) {
      console.error("[AI Generation Error]:", err);
      res.status(500).json({ error: err.message || "Failed to generate metadata description using Selected AI engine." });
    }
  });

  // Get user's GitHub Repositories
  app.get("/api/github/repos", async (req, res) => {
    try {
      const username = req.headers["x-github-username"] as string;
      const token = req.headers["x-github-token"] as string;

      if (!token) {
        return res.status(400).json({ error: "Missing GitHub access token." });
      }

      const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "github-project-pusher",
      };

      const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers,
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `GitHub API error: ${errText}` });
      }

      const repos = await response.json();
      res.json(repos);
    } catch (err: any) {
      console.error("List repos error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch repositories" });
    }
  });

  // Edit / Update an existing GitHub Repository
  app.patch("/api/github/repos/:owner/:repo", async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const token = req.headers["x-github-token"] as string;
      const { name, description, private: isPrivate } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Missing GitHub access token." });
      }

      const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "github-project-pusher",
      };

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name,
          description,
          private: isPrivate,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `GitHub API error: ${errText}` });
      }

      const updatedRepo = await response.json();
      res.json(updatedRepo);
    } catch (err: any) {
      console.error("Edit repo error:", err);
      res.status(500).json({ error: err.message || "Failed to update repository" });
    }
  });

  // Delete an existing GitHub Repository
  app.delete("/api/github/repos/:owner/:repo", async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const token = req.headers["x-github-token"] as string;

      if (!token) {
        return res.status(400).json({ error: "Missing GitHub access token." });
      }

      const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "github-project-pusher",
      };

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        method: "DELETE",
        headers,
      });

      if (response.status === 403 || response.status === 404) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: `Failed to delete repository. Note: Your Personal Access Token requires the 'delete_repo' scope to successfully delete. Original Github response: ${errText}`
        });
      }

      if (response.status !== 204) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `GitHub API error: ${errText}` });
      }

      res.status(204).send();
    } catch (err: any) {
      console.error("Delete repo error:", err);
      res.status(500).json({ error: err.message || "Failed to delete repository" });
    }
  });

  // Fetch all user ideas from 'IDEAS' GitHub repository
  app.get("/api/github/ideas", async (req, res) => {
    try {
      const username = req.headers["x-github-username"] as string;
      const token = req.headers["x-github-token"] as string;

      if (!token || !username) {
        return res.status(400).json({ error: "Missing GitHub access credentials. Please connect your account first." });
      }

      const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "github-project-pusher",
      };

      // Check if 'IDEAS' repository exists
      let repoResponse = await fetch(`https://api.github.com/repos/${username}/IDEAS`, { headers });
      
      if (repoResponse.status === 404) {
        // Auto-create the repository on first fetch
        console.log(`[Ideas] 'IDEAS' repository not found for user @${username}. Creating it now...`);
        const createResponse = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "IDEAS",
            description: "My Personal Ideas Repository - Powered by Ideas Workspace",
            private: true,
            auto_init: true,
          }),
        });

        if (!createResponse.ok) {
          const errText = await createResponse.text();
          return res.status(500).json({ error: `Failed to auto-create 'IDEAS' repository: ${errText}` });
        }

        // Newly created repository has no ideas yet
        return res.json({ ideas: [] });
      }

      if (!repoResponse.ok) {
        const errText = await repoResponse.text();
        return res.status(repoResponse.status).json({ error: `Failed to connect with 'IDEAS' repository: ${errText}` });
      }

      const repoInfo = await repoResponse.json();
      const defaultBranch = repoInfo.default_branch || "main";
      const repoFullName = repoInfo.full_name;

      // Fetch file tree of the IDEAS repository
      const treeResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/trees/${defaultBranch}?recursive=1`,
        { headers }
      );

      if (treeResponse.status === 404) {
        // Empty repository with no commits or default branch
        return res.json({ ideas: [] });
      }

      if (!treeResponse.ok) {
        const errText = await treeResponse.text();
        return res.status(treeResponse.status).json({ error: `Failed to fetch file tree: ${errText}` });
      }

      const treeData = await treeResponse.json();
      const items = treeData.tree || [];

      // Look for all 'idea.json' metadata files
      const ideaMetadataItems = items.filter((item: any) => item.type === "blob" && item.path.endsWith("/idea.json"));

      // Read each metadata file and compile file lists
      const ideas = await Promise.all(
        ideaMetadataItems.map(async (item: any) => {
          try {
            const folderName = item.path.split("/")[0];

            // Fetch file content
            const contentRes = await fetch(
              `https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(item.path)}`,
              { headers }
            );

            if (!contentRes.ok) return null;

            const contentData = await contentRes.json();
            const decoded = Buffer.from(contentData.content, "base64").toString("utf-8");
            const metadata = JSON.parse(decoded);

            // Fetch list of files in the same idea folder
            const folderFiles = items
              .filter((f: any) => f.type === "blob" && f.path.startsWith(`${folderName}/`) && f.path !== item.path)
              .map((f: any) => {
                const fileName = f.path.substring(folderName.length + 1);
                return {
                  name: fileName,
                  path: f.path,
                  size: f.size || 0,
                  downloadUrl: `https://raw.githubusercontent.com/${repoFullName}/${defaultBranch}/${encodeURIComponent(f.path)}`,
                };
              });

            return {
              id: metadata.id || folderName,
              folderName: folderName,
              name: metadata.name || folderName,
              description: metadata.description || "",
              sources: metadata.sources || [],
              updatedAt: metadata.updatedAt || new Date().toISOString(),
              files: folderFiles,
            };
          } catch (err) {
            console.error(`[Ideas] Error reading individual idea file ${item.path}:`, err);
            return null;
          }
        })
      );

      const filteredIdeas = ideas.filter((idea) => idea !== null);
      res.json({ ideas: filteredIdeas });

    } catch (err: any) {
      console.error("[Ideas] Get ideas exception:", err);
      res.status(500).json({ error: err.message || "Failed to fetch user ideas" });
    }
  });

  // Save / Update user idea in 'IDEAS' GitHub repository
  app.post("/api/github/ideas/save", async (req, res) => {
    try {
      const { username, token, name, description, sources, files, oldName } = req.body;

      if (!username || !token || !name) {
        return res.status(400).json({ error: "Missing required details: GitHub credentials or Idea Name." });
      }

      const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "github-project-pusher",
      };

      // Sanitize folder names
      const newFolderName = name.trim().replace(/[\/\\]/g, "-");
      const oldFolderName = oldName ? oldName.trim().replace(/[\/\\]/g, "-") : "";

      // Check if 'IDEAS' repository exists
      let repoResponse = await fetch(`https://api.github.com/repos/${username}/IDEAS`, { headers });
      if (repoResponse.status === 404) {
        console.log(`[Ideas] Creating IDEAS repository during save...`);
        await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "IDEAS",
            description: "My Personal Ideas Repository - Powered by Ideas Workspace",
            private: true,
            auto_init: true,
          }),
        });
        // Delay slightly for GitHub initialization
        await new Promise((resolve) => setTimeout(resolve, 2200));
        repoResponse = await fetch(`https://api.github.com/repos/${username}/IDEAS`, { headers });
      }

      if (!repoResponse.ok) {
        const errText = await repoResponse.text();
        return res.status(repoResponse.status).json({ error: `Failed to locate/initialize IDEAS repository: ${errText}` });
      }

      const repoInfo = await repoResponse.json();
      const defaultBranch = repoInfo.default_branch || "main";
      const repoFullName = repoInfo.full_name;

      // Handle folder rename: Delete files in old folder
      if (oldFolderName && oldFolderName !== newFolderName) {
        console.log(`[Ideas] Renaming idea from '${oldFolderName}' to '${newFolderName}'. Removing old folder contents...`);
        try {
          const oldFolderRes = await fetch(
            `https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(oldFolderName)}`,
            { headers }
          );
          if (oldFolderRes.ok) {
            const oldFiles = await oldFolderRes.json();
            if (Array.isArray(oldFiles)) {
              for (const file of oldFiles) {
                await fetch(`https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(file.path)}`, {
                  method: "DELETE",
                  headers,
                  body: JSON.stringify({
                    message: `Clean up renamed idea folder contents: ${oldFolderName}`,
                    sha: file.sha,
                    branch: defaultBranch,
                  }),
                });
              }
            }
          }
        } catch (renameErr) {
          console.error("[Ideas] Old folder cleanup warning:", renameErr);
        }
      }

      // Build file payloads
      const ideaMetadata = {
        id: newFolderName,
        name: name.trim(),
        description: description || "",
        sources: sources || [],
        updatedAt: new Date().toISOString(),
      };

      const filesToCommit = [
        {
          path: `${newFolderName}/idea.json`,
          content: Buffer.from(JSON.stringify(ideaMetadata, null, 2)).toString("base64"),
        },
      ];

      if (files && Array.isArray(files)) {
        for (const file of files) {
          filesToCommit.push({
            path: `${newFolderName}/${file.name}`,
            content: file.content, // base64 encoded string from frontend dropzone
          });
        }
      }

      // Perform Git Database Transaction commit to update/add idea atomically
      const refResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/ref/heads/${defaultBranch}`,
        { headers }
      );
      if (!refResponse.ok) {
        const errText = await refResponse.text();
        return res.status(500).json({ error: `Failed to fetch HEAD ref for commit transaction: ${errText}` });
      }
      const refData = await refResponse.json();
      const latestCommitSha = refData.object.sha;

      const commitResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/commits/${latestCommitSha}`,
        { headers }
      );
      const commitData = await commitResponse.json();
      const baseTreeSha = commitData.tree.sha;

      // Upload blobs
      const treeItems = [];
      for (const file of filesToCommit) {
        const blobResponse = await fetch(`https://api.github.com/repos/${repoFullName}/git/blobs`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            content: file.content,
            encoding: "base64",
          }),
        });

        if (!blobResponse.ok) {
          const errText = await blobResponse.text();
          throw new Error(`Failed to upload blob for '${file.path}': ${errText}`);
        }

        const blobData = await blobResponse.json();
        treeItems.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blobData.sha,
        });
      }

      // Create new directory tree
      const treeCreateResponse = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeItems,
        }),
      });

      if (!treeCreateResponse.ok) {
        const errText = await treeCreateResponse.text();
        throw new Error(`Failed to create git tree: ${errText}`);
      }
      const treeData = await treeCreateResponse.json();
      const newTreeSha = treeData.sha;

      // Commit tree
      const commitCreateResponse = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: `Update/Save idea details: ${name.trim()}`,
          tree: newTreeSha,
          parents: [latestCommitSha],
        }),
      });
      const newCommitData = await commitCreateResponse.json();
      const newCommitSha = newCommitData.sha;

      // Update HEAD reference
      await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${defaultBranch}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
          force: true,
        }),
      });

      res.json({ success: true, folderName: newFolderName });
    } catch (err: any) {
      console.error("[Ideas] Save idea exception:", err);
      res.status(500).json({ error: err.message || "Failed to save idea details." });
    }
  });

  // Delete an entire Idea folder (deletes all its nested files) from 'IDEAS' GitHub repository
  app.post("/api/github/ideas/delete", async (req, res) => {
    try {
      const { username, token, folderName } = req.body;

      if (!username || !token || !folderName) {
        return res.status(400).json({ error: "Missing required details: Credentials or Idea folder name." });
      }

      const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "github-project-pusher",
      };

      const repoFullName = `${username}/IDEAS`;

      // Find default branch
      const repoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
      const repoInfo = await repoResponse.json();
      const defaultBranch = repoInfo.default_branch || "main";

      // Get contents list of folder
      const folderRes = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(folderName)}`,
        { headers }
      );

      if (!folderRes.ok) {
        // Already removed or empty
        return res.json({ success: true, message: "Folder does not exist or already deleted." });
      }

      const files = await folderRes.json();
      if (Array.isArray(files)) {
        // Delete all files in parallel
        await Promise.all(
          files.map(async (file: any) => {
            await fetch(`https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(file.path)}`, {
              method: "DELETE",
              headers,
              body: JSON.stringify({
                message: `Delete file: ${file.path} as part of removing Idea: ${folderName}`,
                sha: file.sha,
                branch: defaultBranch,
              }),
            });
          })
        );
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Ideas] Delete idea folder exception:", err);
      res.status(500).json({ error: err.message || "Failed to remove idea folder" });
    }
  });

  // Create GitHub Repository and Push Files via GitHub Git Database API
  app.post("/api/github/create-and-push", async (req, res) => {
    try {
      const { username, token, repoName, description, isPrivate, commitMessage, files } = req.body;

      if (!username || !token || !repoName) {
        return res.status(400).json({ error: "Missing required details: GitHub Username, PAT, or Repository Name." });
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "No files provided to push." });
      }

      const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "github-project-pusher",
      };

      // Step 1: Create the new repository on GitHub
      console.log(`[Pusher] Creating repository: ${repoName} for user: ${username}`);
      const createResponse = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: repoName,
          description: description || "Pushed via GitHub Project Pusher",
          private: isPrivate,
          auto_init: true, // Init with README to guarantee a main branch is created immediately
        }),
      });

      if (createResponse.status !== 201) {
        const errObj = await createResponse.json().catch(() => ({}));
        const githubErrMessage = errObj.message || "Unknown error";
        console.error("[Pusher] GitHub repository creation failed:", errObj);
        
        if (createResponse.status === 422) {
          return res.status(422).json({
            error: `Repository '${repoName}' already exists or has invalid naming. (${githubErrMessage})`,
          });
        }
        
        return res.status(createResponse.status).json({
          error: `Failed to create GitHub repository. Status: ${createResponse.status}. Message: ${githubErrMessage}`,
        });
      }

      const repoInfo = await createResponse.json();
      const defaultBranch = repoInfo.default_branch || "main";
      const repoFullName = repoInfo.full_name;

      console.log(`[Pusher] Created repo ${repoFullName}. Default branch: ${defaultBranch}`);

      // Step 2: Poll for the default branch's latest commit ref (since GitHub initializes the repo asynchronously)
      let latestCommitSha = "";
      let attempts = 10;
      console.log(`[Pusher] Polling for branch ref: ${defaultBranch}`);
      
      while (attempts > 0) {
        const refResponse = await fetch(
          `https://api.github.com/repos/${repoFullName}/git/ref/heads/${defaultBranch}`,
          { headers }
        );

        if (refResponse.status === 200) {
          const refData = await refResponse.json();
          latestCommitSha = refData.object.sha;
          break;
        }

        attempts--;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!latestCommitSha) {
        return res.status(500).json({
          error: "GitHub repository was created, but initialized default branch main ref could not be fetched. Please try pushing files again directly on the repository.",
        });
      }

      console.log(`[Pusher] Found latest commit SHA: ${latestCommitSha}`);

      // Step 3: Fetch the base tree SHA of that latest commit
      const commitResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/commits/${latestCommitSha}`,
        { headers }
      );
      if (commitResponse.status !== 200) {
        const errText = await commitResponse.text();
        throw new Error(`Failed to retrieve base commit info: ${errText}`);
      }
      const commitData = await commitResponse.json();
      const baseTreeSha = commitData.tree.sha;

      console.log(`[Pusher] Retreived base tree SHA: ${baseTreeSha}`);

      // Step 4: Create individual file Blobs in parallel
      console.log(`[Pusher] Uploading ${files.length} files to git blobs`);
      const treeItems = [];

      // We upload in chunks to prevent flooding GitHub API
      const chunkSize = 5;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(async (file) => {
          const blobResponse = await fetch(
            `https://api.github.com/repos/${repoFullName}/git/blobs`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                content: file.content, // already converted to base64 on client
                encoding: "base64",
              }),
            }
          );

          if (blobResponse.status !== 201) {
            const errText = await blobResponse.text();
            throw new Error(`Failed to create blob for file: ${file.path}. Error: ${errText}`);
          }

          const blobData = await blobResponse.json();
          return {
            path: file.path,
            mode: "100644",
            type: "blob",
            sha: blobData.sha,
          };
        });

        const results = await Promise.all(chunkPromises);
        treeItems.push(...results);
      }

      console.log(`[Pusher] Created all ${treeItems.length} git blobs successfully`);

      // Step 5: Create a new Git Tree overlaying our new blobs
      console.log(`[Pusher] Creating new tree with base: ${baseTreeSha}`);
      const treeCreateResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/trees`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeItems,
          }),
        }
      );

      if (treeCreateResponse.status !== 201) {
        const errText = await treeCreateResponse.text();
        throw new Error(`Failed to create git tree: ${errText}`);
      }

      const treeData = await treeCreateResponse.json();
      const newTreeSha = treeData.sha;
      console.log(`[Pusher] Created new tree SHA: ${newTreeSha}`);

      // Step 6: Create the Commit pointing to the new Tree
      console.log(`[Pusher] Creating git commit`);
      const msg = commitMessage || "Initial project code push";
      const commitCreateResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/commits`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: msg,
            tree: newTreeSha,
            parents: [latestCommitSha],
          }),
        }
      );

      if (commitCreateResponse.status !== 201) {
        const errText = await commitCreateResponse.text();
        throw new Error(`Failed to create git commit: ${errText}`);
      }

      const newCommitData = await commitCreateResponse.json();
      const newCommitSha = newCommitData.sha;
      console.log(`[Pusher] Created git commit SHA: ${newCommitSha}`);

      // Step 7: Update the default branch reference
      console.log(`[Pusher] Updating head reference for default branch`);
      const refUpdateResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/refs/heads/${defaultBranch}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            sha: newCommitSha,
            force: true,
          }),
        }
      );

      if (refUpdateResponse.status !== 200) {
        const errText = await refUpdateResponse.text();
        throw new Error(`Failed to update branch reference: ${errText}`);
      }

      console.log(`[Pusher] Completed successfully! Repo: ${repoInfo.html_url}`);
      res.json({
        success: true,
        repoUrl: repoInfo.html_url,
        fullName: repoFullName,
        branch: defaultBranch,
      });
    } catch (error: any) {
      console.error("[Pusher] Push operations failed:", error);
      res.status(500).json({ error: error.message || "Failed to create and push project to GitHub" });
    }
  });

  // ---------------------------------------------------------
  // Vite Dev Server / Static Assets
  // ---------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
