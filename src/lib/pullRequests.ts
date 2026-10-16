import { PullRequestInfo } from "@/types";
import { parseGitRemoteUrl } from "./remoteUrl";
import { getGitAuthTokenIpc } from "./ipc";

interface CacheEntry {
  timestamp: number;
  data: PullRequestInfo[];
}

const prCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Fetches active pull/merge requests for a repository from GitHub, GitLab, or Bitbucket.
 */
export async function fetchRepoPullRequests(remoteUrl: string): Promise<PullRequestInfo[]> {
  if (!remoteUrl) return [];

  const now = Date.now();
  const cached = prCache.get(remoteUrl);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const parsed = parseGitRemoteUrl(remoteUrl);
  if (!parsed) return [];

  let results: PullRequestInfo[] = [];

  try {
    if (parsed.provider === "github") {
      results = await fetchGitHubPullRequests(parsed.repoWebUrl);
    } else if (parsed.provider === "gitlab") {
      results = await fetchGitLabMergeRequests(parsed.repoWebUrl);
    } else if (parsed.provider === "bitbucket") {
      results = await fetchBitbucketPullRequests(parsed.repoWebUrl);
    }
  } catch (err) {
    console.warn("Failed to fetch pull requests for repository:", err);
    // Return stale cache if available on network error
    if (cached) return cached.data;
    return [];
  }

  prCache.set(remoteUrl, { timestamp: now, data: results });
  return results;
}

/**
 * Fetch GitHub open pull requests
 */
async function fetchGitHubPullRequests(repoWebUrl: string): Promise<PullRequestInfo[]> {
  // Extract owner and repo from https://github.com/owner/repo
  const cleanUrl = repoWebUrl.replace(/\/+$/, "");
  const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return [];

  const [, owner, repo] = match;
  const token = await getGitAuthTokenIpc("github.com").catch(() => null);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=100`,
    { headers }
  );

  if (!res.ok) {
    // 404 or rate-limited or private without auth
    return [];
  }

  const items = await res.json();
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    number: item.number,
    title: item.title,
    url: item.html_url,
    state: item.state === "open" ? "open" : item.merged_at ? "merged" : "closed",
    is_draft: Boolean(item.draft),
    source_branch: item.head?.ref || "",
    target_branch: item.base?.ref || "",
    author: item.user?.login,
    author_avatar: item.user?.avatar_url,
    updated_at: item.updated_at,
    comments_count: item.comments,
  }));
}

/**
 * Fetch GitLab open merge requests
 */
async function fetchGitLabMergeRequests(repoWebUrl: string): Promise<PullRequestInfo[]> {
  const cleanUrl = repoWebUrl.replace(/\/+$/, "");
  const match = cleanUrl.match(/gitlab\.com\/(.+)$/);
  if (!match) return [];

  const projectPath = match[1];
  const token = await getGitAuthTokenIpc("gitlab.com").catch(() => null);

  const headers: Record<string, string> = {};
  if (token) {
    headers["PRIVATE-TOKEN"] = token;
  }

  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests?state=opened&per_page=100`,
    { headers }
  );

  if (!res.ok) return [];

  const items = await res.json();
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    number: item.iid,
    title: item.title,
    url: item.web_url,
    state: item.state === "opened" ? "open" : item.state,
    is_draft: Boolean(item.work_in_progress || item.draft),
    source_branch: item.source_branch || "",
    target_branch: item.target_branch || "",
    author: item.author?.username,
    author_avatar: item.author?.avatar_url,
    updated_at: item.updated_at,
    comments_count: item.user_notes_count,
  }));
}

/**
 * Fetch Bitbucket open pull requests
 */
async function fetchBitbucketPullRequests(repoWebUrl: string): Promise<PullRequestInfo[]> {
  const cleanUrl = repoWebUrl.replace(/\/+$/, "");
  const match = cleanUrl.match(/bitbucket\.org\/([^/]+)\/([^/]+)/);
  if (!match) return [];

  const [, owner, repo] = match;
  const res = await fetch(
    `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests?q=state="OPEN"&pagelen=50`
  );

  if (!res.ok) return [];

  const data = await res.json();
  const items = data.values;
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    number: item.id,
    title: item.title,
    url: item.links?.html?.href || `${repoWebUrl}/pull-requests/${item.id}`,
    state: "open",
    is_draft: false,
    source_branch: item.source?.branch?.name || "",
    target_branch: item.destination?.branch?.name || "",
    author: item.author?.display_name || item.author?.nickname,
    author_avatar: item.author?.links?.avatar?.href,
    updated_at: item.updated_on,
    comments_count: item.comment_count,
  }));
}
