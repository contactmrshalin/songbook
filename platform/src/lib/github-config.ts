interface GitHubRepoConfig {
  owner: string;
  name: string;
  branch: string;
  rawBaseUrl: string;
  repoUrl: string;
}

const DEFAULT_OWNER = "contactmrshalin";
const DEFAULT_NAME = "songbook";
const DEFAULT_BRANCH = "main";

/**
 * Resolve GitHub repo settings from environment, with Vercel-aware fallbacks.
 *
 * Priority (highest to lowest):
 * 1) Explicit app env vars (GITHUB_REPO_*)
 * 2) Public env vars for client-side usage (NEXT_PUBLIC_GITHUB_REPO_*)
 * 3) Vercel git metadata env vars
 * 4) Project defaults
 */
export function getGitHubRepoConfig(): GitHubRepoConfig {
  const owner =
    process.env.GITHUB_REPO_OWNER ||
    process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER ||
    process.env.VERCEL_GIT_REPO_OWNER ||
    DEFAULT_OWNER;

  const name =
    process.env.GITHUB_REPO_NAME ||
    process.env.NEXT_PUBLIC_GITHUB_REPO_NAME ||
    process.env.VERCEL_GIT_REPO_SLUG ||
    DEFAULT_NAME;

  const branch =
    process.env.GITHUB_REPO_BRANCH ||
    process.env.NEXT_PUBLIC_GITHUB_REPO_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    DEFAULT_BRANCH;

  const rawBaseUrl =
    process.env.NEXT_PUBLIC_GITHUB_RAW_BASE_URL ||
    `https://raw.githubusercontent.com/${owner}/${name}/${branch}`;

  return {
    owner,
    name,
    branch,
    rawBaseUrl,
    repoUrl: `https://github.com/${owner}/${name}`,
  };
}