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

interface NavbarProps {
  selectedRepo: string;
  setSelectedRepo: (repo: string) => void;
  selectedThread: string;
  setSelectedThread: (thread: string) => void;
  refreshKey?: number;
}

export const Navbar = ({ selectedRepo, setSelectedRepo, selectedThread, setSelectedThread, refreshKey }: NavbarProps) => {
  const [repos, setRepos] = useState<LoadedRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setReposLoading(true);
    fetch(`${API_URL}/user/loaded/repos`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: LoadedRepo[]) => setRepos(data))
      .catch(console.error)
      .finally(() => setReposLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRepo) {
      setThreads([]);
      return;
    }
    setThreadsLoading(true);
    fetch(
      `${API_URL}/user/threads?repo_name=${encodeURIComponent(selectedRepo)}`,
      { credentials: "include" },
    )
      .then((res) => res.json())
      .then((data: Thread[]) => setThreads(data))
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [selectedRepo, refreshKey]);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

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
    fetch(`${API_URL}/user/thread/${session_id}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then(() => {
        setThreads((prev) => prev.filter((t) => t.session_id !== session_id));
        if (selectedThread === session_id) setSelectedThread("");
      })
      .catch(console.error)
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
      .then((res) => res.json())
      .then(() => {
        setThreads((prev) =>
          prev.map((t) => (t.session_id === session_id ? { ...t, name } : t))
        );
      })
      .catch(console.error)
      .finally(() => setEditingId(null));
  };

  const repoOptions = repos.map((r) => ({
    value: r.repo_name,
    label: r.repo_name,
  }));

  return (
    <>
      <AppShell.Section>
        <Stack gap="sm" pb="sm">
          <Text fw={600} size="sm">
            Chats
          </Text>
          <Select
            value={selectedRepo}
            onChange={(value) => setSelectedRepo(value ?? "")}
            label="Repository"
            placeholder="Select a repository"
            limit={10}
            data={repoOptions}
            searchable
            disabled={reposLoading}
            rightSection={reposLoading ? <Loader size="xs" /> : undefined}
          />
          <Button
            variant="outline"
            color="violet"
            size="xs"
            onClick={() => setSelectedThread("")}
          >
            New Chat +
          </Button>
        </Stack>
      </AppShell.Section>

      <AppShell.Section grow component={ScrollArea} scrollbarSize={6} scrollHideDelay={500}>
        <Stack gap={2}>
          {threadsLoading && <Loader size="xs" color="violet" mx="auto" mt="sm" />}

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
                  onClick={() => setSelectedThread(thread.session_id)}
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

          {!threadsLoading && selectedRepo && threads.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" mt="sm">
              No threads yet
            </Text>
          )}
        </Stack>
      </AppShell.Section>
    </>
  );
};
