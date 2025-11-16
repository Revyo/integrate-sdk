/**
 * GitHub Integration Client Types
 * Fully typed interface for GitHub integration methods
 */

import type { MCPToolCallResponse } from "../protocol/messages.js";

/**
 * GitHub Issue
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  html_url: string;
  user?: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  labels?: Array<{
    name: string;
    color: string;
  }>;
}

/**
 * GitHub Pull Request
 */
export interface GitHubPullRequest {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed" | "merged";
  html_url: string;
  user?: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  merged_at?: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

/**
 * GitHub Repository
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  language?: string;
  default_branch: string;
}

/**
 * GitHub Branch
 */
export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

/**
 * GitHub User
 */
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name?: string;
  email?: string;
  bio?: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

/**
 * GitHub Commit
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  author?: {
    login: string;
    avatar_url: string;
  };
  committer?: {
    login: string;
    avatar_url: string;
  };
}

/**
 * GitHub Integration Client Interface
 * Provides type-safe methods for all GitHub operations
 */
export interface GitHubIntegrationClient {
  /**
   * Create a new issue in a repository
   */
  createIssue(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<MCPToolCallResponse>;

  /**
   * List issues in a repository
   */
  listIssues(params: {
    owner: string;
    repo: string;
    state?: "open" | "closed" | "all";
    labels?: string[];
    sort?: "created" | "updated" | "comments";
    direction?: "asc" | "desc";
    per_page?: number;
    page?: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get a specific issue
   */
  getIssue(params: {
    owner: string;
    repo: string;
    issue_number: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Update an existing issue
   */
  updateIssue(params: {
    owner: string;
    repo: string;
    issue_number: number;
    title?: string;
    body?: string;
    state?: "open" | "closed";
    labels?: string[];
    assignees?: string[];
  }): Promise<MCPToolCallResponse>;

  /**
   * Close an issue
   */
  closeIssue(params: {
    owner: string;
    repo: string;
    issue_number: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Create a pull request
   */
  createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
  }): Promise<MCPToolCallResponse>;

  /**
   * List pull requests in a repository
   */
  listPullRequests(params: {
    owner: string;
    repo: string;
    state?: "open" | "closed" | "all";
    sort?: "created" | "updated" | "popularity" | "long-running";
    direction?: "asc" | "desc";
    per_page?: number;
    page?: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get a specific pull request
   */
  getPullRequest(params: {
    owner: string;
    repo: string;
    pull_number: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Merge a pull request
   */
  mergePullRequest(params: {
    owner: string;
    repo: string;
    pull_number: number;
    commit_title?: string;
    commit_message?: string;
    merge_method?: "merge" | "squash" | "rebase";
  }): Promise<MCPToolCallResponse>;

  /**
   * List repositories (for a user or organization)
   */
  listRepos(params: {
    owner: string;
    type?: "all" | "owner" | "member";
    sort?: "created" | "updated" | "pushed" | "full_name";
    direction?: "asc" | "desc";
    per_page?: number;
    page?: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * List repositories for the authenticated user
   */
  listOwnRepos(params?: {
    visibility?: "all" | "public" | "private";
    affiliation?: string;
    type?: "all" | "owner" | "public" | "private" | "member";
    sort?: "created" | "updated" | "pushed" | "full_name";
    direction?: "asc" | "desc";
    per_page?: number;
    page?: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get a specific repository
   */
  getRepo(params: {
    owner: string;
    repo: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Create a new repository
   */
  createRepo(params: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    gitignore_template?: string;
    license_template?: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * List branches in a repository
   */
  listBranches(params: {
    owner: string;
    repo: string;
    protected?: boolean;
    per_page?: number;
    page?: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Create a new branch
   */
  createBranch(params: {
    owner: string;
    repo: string;
    branch: string;
    from_branch?: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get information about a user
   */
  getUser(params: {
    username: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * List commits in a repository
   */
  listCommits(params: {
    owner: string;
    repo: string;
    sha?: string;
    path?: string;
    author?: string;
    since?: string;
    until?: string;
    per_page?: number;
    page?: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get a specific commit
   */
  getCommit(params: {
    owner: string;
    repo: string;
    ref: string;
  }): Promise<MCPToolCallResponse>;
}

