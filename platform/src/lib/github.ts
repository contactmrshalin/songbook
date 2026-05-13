/**
 * GitHub API helpers for committing song files directly from the admin panel.
 *
 * Requires environment variable: GITHUB_TOKEN (Personal Access Token with repo scope)
 * Configured in Vercel dashboard: Settings → Environment Variables
 */

const GITHUB_API = "https://api.github.com";
const REPO_OWNER = "contactmrshalin";
const REPO_NAME = "songbook";
const BRANCH = "main";

interface GitHubFile {
  path: string;
  content: string; // plain text (will be base64-encoded)
}

interface CommitResult {
  success: boolean;
  commitSha?: string;
  error?: string;
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is not set");
  return token;
}

async function githubApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  return fetch(`${GITHUB_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * Get the current SHA of a file (needed for updates).
 * Returns null if the file doesn't exist.
 */
async function getFileSha(path: string): Promise<string | null> {
  const res = await githubApi(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`
  );
  if (res.ok) {
    const data = await res.json();
    return data.sha;
  }
  return null;
}

/**
 * Get file content from the repo.
 */
export async function getFileContent(path: string): Promise<string | null> {
  const res = await githubApi(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}

/**
 * Commit multiple files to the repo in a single commit using the Git Data API.
 *
 * This creates a proper single commit with all file changes,
 * rather than one commit per file.
 */
export async function commitFiles(
  files: GitHubFile[],
  message: string
): Promise<CommitResult> {
  try {
    // 1. Get the latest commit SHA on the branch
    const refRes = await githubApi(
      `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`
    );
    if (!refRes.ok) {
      return { success: false, error: `Failed to get branch ref: ${refRes.status}` };
    }
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get the tree SHA of the latest commit
    const commitRes = await githubApi(
      `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${latestCommitSha}`
    );
    if (!commitRes.ok) {
      return { success: false, error: `Failed to get commit: ${commitRes.status}` };
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      const blobRes = await githubApi(
        `/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
        {
          method: "POST",
          body: JSON.stringify({
            content: file.content,
            encoding: "utf-8",
          }),
        }
      );
      if (!blobRes.ok) {
        return { success: false, error: `Failed to create blob for ${file.path}` };
      }
      const blobData = await blobRes.json();
      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blobData.sha,
      });
    }

    // 4. Create a new tree with the file changes
    const treeRes = await githubApi(
      `/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeItems,
        }),
      }
    );
    if (!treeRes.ok) {
      return { success: false, error: `Failed to create tree: ${treeRes.status}` };
    }
    const treeData = await treeRes.json();

    // 5. Create the commit
    const newCommitRes = await githubApi(
      `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );
    if (!newCommitRes.ok) {
      return { success: false, error: `Failed to create commit: ${newCommitRes.status}` };
    }
    const newCommitData = await newCommitRes.json();

    // 6. Update the branch reference
    const updateRefRes = await githubApi(
      `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sha: newCommitData.sha,
        }),
      }
    );
    if (!updateRefRes.ok) {
      return { success: false, error: `Failed to update branch: ${updateRefRes.status}` };
    }

    return { success: true, commitSha: newCommitData.sha };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Upload an image (binary) to the repo.
 */
export async function uploadImage(
  imageBuffer: Buffer,
  filename: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const path = `data/images/${filename}`;
  const base64 = imageBuffer.toString("base64");

  try {
    const existingSha = await getFileSha(path);

    const res = await githubApi(
      `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `add image: ${filename}`,
          content: base64,
          branch: BRANCH,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: `GitHub API error ${res.status}: ${JSON.stringify(errData)}`,
      };
    }

    return { success: true, path: `images/${filename}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
