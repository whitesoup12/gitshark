/**
 * Utilities for parsing Git remote URLs and generating web links
 * for repositories and Pull / Merge Requests across GitHub, GitLab, Bitbucket, etc.
 */

export interface RemoteWebInfo {
  provider: "github" | "gitlab" | "bitbucket" | "generic";
  repoWebUrl: string;
  createPrUrl: (sourceBranch?: string) => string;
}

export function parseGitRemoteUrl(rawUrl: string): RemoteWebInfo | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let url = rawUrl.trim();
  if (!url) return null;

  // Remove trailing .git
  if (url.endsWith(".git")) {
    url = url.slice(0, -4);
  }

  let host = "";
  let path = "";

  // Check for SSH syntax: git@host:owner/repo or ssh://git@host/owner/repo
  if (url.startsWith("git@") || url.startsWith("ssh://git@")) {
    const clean = url.replace(/^ssh:\/\/git@/, "").replace(/^git@/, "");
    const colonIdx = clean.indexOf(":");
    const slashIdx = clean.indexOf("/");
    if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
      host = clean.substring(0, colonIdx);
      path = clean.substring(colonIdx + 1);
    } else if (slashIdx !== -1) {
      host = clean.substring(0, slashIdx);
      path = clean.substring(slashIdx + 1);
    }
  } else if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      path = parsed.pathname.replace(/^\//, "");
    } catch {
      return null;
    }
  } else {
    // Other format e.g. host:owner/repo
    const parts = url.split(":");
    if (parts.length === 2) {
      host = parts[0];
      path = parts[1];
    }
  }

  if (!host || !path) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return {
        provider: "generic",
        repoWebUrl: url,
        createPrUrl: () => url,
      };
    }
    return null;
  }

  path = path.replace(/^\//, "").replace(/\/+$/, "");
  const repoWebUrl = `https://${host}/${path}`;

  if (host.includes("github.com")) {
    return {
      provider: "github",
      repoWebUrl,
      createPrUrl: (sourceBranch?: string) => {
        if (!sourceBranch || sourceBranch === "HEAD" || sourceBranch === "main" || sourceBranch === "master") {
          return `${repoWebUrl}/pulls`;
        }
        return `${repoWebUrl}/compare/${encodeURIComponent(sourceBranch)}?expand=1`;
      },
    };
  }

  if (host.includes("gitlab.com")) {
    return {
      provider: "gitlab",
      repoWebUrl,
      createPrUrl: (sourceBranch?: string) => {
        if (!sourceBranch || sourceBranch === "HEAD" || sourceBranch === "main" || sourceBranch === "master") {
          return `${repoWebUrl}/-/merge_requests`;
        }
        return `${repoWebUrl}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(sourceBranch)}`;
      },
    };
  }

  if (host.includes("bitbucket.org")) {
    return {
      provider: "bitbucket",
      repoWebUrl,
      createPrUrl: (sourceBranch?: string) => {
        if (!sourceBranch || sourceBranch === "HEAD" || sourceBranch === "main" || sourceBranch === "master") {
          return `${repoWebUrl}/pull-requests/`;
        }
        return `${repoWebUrl}/pull-requests/new?source=${encodeURIComponent(sourceBranch)}`;
      },
    };
  }

  return {
    provider: "generic",
    repoWebUrl,
    createPrUrl: () => repoWebUrl,
  };
}
