export interface Repo {
  full_name: string;
  name: string;
  description: string | null;
}

export interface LoadedRepo {
  repo_name: string;
  branch: string;
  chunk_count: number;
  last_ingested: string;
}

export interface RepoStatus {
  up_to_date: boolean;
  stored_sha: string | null;
  latest_sha: string;
}

export type RepoStatusState = RepoStatus | "loading" | "error";

export interface IngestProgressEntry {
  progress: number;
  message: string;
}
