import {
  ActionIcon,
  AppShell,
  Button,
  Group,
  Loader,
  NavLink,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";

const THREADS_PER_PAGE = 20;

interface LoadedRepo {
  repo_name: string;
  branch: string;
  chunk_count: number;
  last_ingested: string;
}

interface Thread {
  session_id: string;
  repo_name: string;
  name: string;
  last_updated: string;
  created_at: string;
}

interface ThreadsResponse {
  threads: Thread[];
  total: number;
  page: number;
  limit: number;
}

interface NavbarProps {
  selectedRepo: string;
  setSelectedRepo: (repo: string) => void;
  selectedThread: string;
  setSelectedThread: (thread: string) => void;
  refreshKey?: number;
  reposRefreshKey?: number;
  ingestingRepos?: Set<string>;
  onNavigate?: () => void;
}

export const Navbar = ({ selectedRepo, setSelectedRepo, selectedThread, setSelectedThread, refreshKey, reposRefreshKey, ingestingRepos, onNavigate }: NavbarProps) => {
  const [repos, setRepos] = useState<LoadedRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [threadTotal, setThreadTotal] = useState(0);
  const [threadPage, setThreadPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchRepos = () => {
    setReposLoading(true);
    setReposError(null);
    fetch(`${API_URL}/user/loaded/repos`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load repositories");
        return res.json();
      })
      .then((data: LoadedRepo[]) => setRepos(data))
      .catch((err: Error) => setReposError(err.message))
      .finally(() => setReposLoading(false));
  };

  useEffect(() => { fetchRepos(); }, []);
  useEffect(() => { if (reposRefreshKey) fetchRepos(); }, [reposRefreshKey]);

  useEffect(() => {
    if (!selectedRepo) {
      setThreads([]);
      setThreadTotal(0);
      setThreadPage(1);
      return;
    }
    setThreadsLoading(true);
    setThreadsError(null);
    setThreadPage(1);
    fetch(
      `${API_URL}/user/threads?repo_name=${encodeURIComponent(selectedRepo)}&page=1&limit=${THREADS_PER_PAGE}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load threads");
        return res.json();
      })
      .then((data: ThreadsResponse) => {
        setThreads(data.threads);
        setThreadTotal(data.total);
      })
      .catch((err: Error) => setThreadsError(err.message))
      .finally(() => setThreadsLoading(false));
  }, [selectedRepo, refreshKey]);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const loadMoreThreads = () => {
    const nextPage = threadPage + 1;
    setLoadingMore(true);
    fetch(
      `${API_URL}/user/threads?repo_name=${encodeURIComponent(selectedRepo)}&page=${nextPage}&limit=${THREADS_PER_PAGE}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load more threads");
        return res.json();
      })
      .then((data: ThreadsResponse) => {
        setThreads((prev) => [...prev, ...data.threads]);
        setThreadPage(nextPage);
        setThreadTotal(data.total);
      })
      .catch((err: Error) => setThreadsError(err.message))
      .finally(() => setLoadingMore(false));
  };

  const startEdit = (thread: Thread, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(thread.session_id);
    setEditValue(thread.name);
  };

  const deleteThread = (session_id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(session_id);
    setDeleteError(null);
    fetch(`${API_URL}/user/thread/${session_id}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete thread");
        setThreads((prev) => prev.filter((t) => t.session_id !== session_id));
        setThreadTotal((prev) => prev - 1);
        if (selectedThread === session_id) setSelectedThread("");
      })
      .catch((err: Error) => setDeleteError(err.message))
      .finally(() => setDeletingId(null));
  };

  const commitEdit = (session_id: string) => {
    const name = editValue.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    fetch(`${API_URL}/user/thread/${session_id}/name`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to rename thread");
        return res.json();
      })
      .then(() => {
        setThreads((prev) =>
          prev.map((t) => (t.session_id === session_id ? { ...t, name } : t))
        );
      })
      .catch((err: Error) => setThreadsError(err.message))
      .finally(() => setEditingId(null));
  };

  const repoOptions = repos.map((r) => ({
    value: r.repo_name,
    label: r.repo_name,
  }));

  const hasMore = threads.length < threadTotal;

  return (
    <>
      <AppShell.Section>
        <Stack gap="sm" pb="sm">
          <Text fw={600} size="sm">
            Chats
          </Text>
          {reposError && (
            <Text size="xs" c="red">{reposError}</Text>
          )}
          <Select
            value={selectedRepo}
            onChange={(value) => { setSelectedRepo(value ?? ""); onNavigate?.(); }}
            label="Repository"
            placeholder="Select a repository"
            limit={10}
            data={repoOptions}
            searchable
            disabled={reposLoading}
            rightSection={reposLoading ? <Loader size="xs" /> : undefined}
          />
          {repos.length === 0 && !reposLoading && ingestingRepos && ingestingRepos.size > 0 && (
            <Group gap={6}>
              <Loader size={10} color="violet" />
              <Text size="xs" c="dimmed">
                {ingestingRepos.size === 1
                  ? "1 repository is being ingested…"
                  : `${ingestingRepos.size} repositories are being ingested…`}
              </Text>
            </Group>
          )}
          <Button
            variant="outline"
            color="violet"
            size="xs"
            onClick={() => { setSelectedThread(""); onNavigate?.(); }}
          >
            New Chat +
          </Button>
        </Stack>
      </AppShell.Section>

      <AppShell.Section grow component={ScrollArea} scrollbarSize={6} scrollHideDelay={500}>
        <Stack gap={2}>
          {threadsLoading && <Loader size="xs" color="violet" mx="auto" mt="sm" />}

          {threadsError && (
            <Text size="xs" c="red" ta="center" mt="sm">{threadsError}</Text>
          )}

          {deleteError && (
            <Text size="xs" c="red" ta="center" mt="sm">{deleteError}</Text>
          )}

          {!threadsLoading && threads.map((thread) =>
            editingId === thread.session_id ? (
              <TextInput
                key={thread.session_id}
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.currentTarget.value)}
                onBlur={() => commitEdit(thread.session_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit(thread.session_id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                size="xs"
                radius="md"
                styles={{ input: { fontSize: 13 } }}
              />
            ) : (
              <Group key={thread.session_id} gap={0} wrap="nowrap" style={{ position: "relative" }}>
                <NavLink
                  label={thread.name}
                  description={new Date(thread.last_updated).toLocaleDateString()}
                  active={thread.session_id === selectedThread}
                  onClick={() => { setSelectedThread(thread.session_id); onNavigate?.(); }}
                  color="violet"
                  style={{ borderRadius: 8, flex: 1, paddingRight: 58 }}
                />
                <Group gap={2} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}>
                  {deletingId === thread.session_id ? (
                    <Loader size={14} color="red" />
                  ) : (
                    <>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={(e) => startEdit(thread, e)}
                        aria-label="Rename thread"
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={(e) => deleteThread(thread.session_id, e)}
                        aria-label="Delete thread"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </>
                  )}
                </Group>
              </Group>
            )
          )}

          {!threadsLoading && hasMore && (
            <Button
              variant="subtle"
              color="violet"
              size="xs"
              loading={loadingMore}
              onClick={loadMoreThreads}
              mt="xs"
            >
              Load more ({threadTotal - threads.length} remaining)
            </Button>
          )}

          {!threadsLoading && selectedRepo && threads.length === 0 && !threadsError && (
            <Text size="xs" c="dimmed" ta="center" mt="sm">
              No threads yet
            </Text>
          )}
        </Stack>
      </AppShell.Section>
    </>
  );
};
