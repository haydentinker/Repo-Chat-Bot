import {
  Button,
  Container,
  Loader,
  NavLink,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useState } from "react";

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
}
export const Navbar = ({ selectedRepo, setSelectedRepo }: NavbarProps) => {
  const [repos, setRepos] = useState<LoadedRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  useEffect(() => {
    setReposLoading(true);
    fetch("http://localhost:5000/user/loaded/repos", { credentials: "include" })
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
      `http://localhost:5000/user/threads?repo_name=${encodeURIComponent(selectedRepo)}`,
      { credentials: "include" },
    )
      .then((res) => res.json())
      .then((data: Thread[]) => setThreads(data))
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [selectedRepo]);

  const repoOptions = repos.map((r) => ({
    value: r.repo_name,
    label: r.repo_name,
  }));

  return (
    <Container p={0}>
      <Stack gap="sm">
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
          onClick={() => console.log("init new chat")}
        >
          New Chat +
        </Button>

        {threadsLoading && <Loader size="xs" color="violet" mx="auto" />}

        {!threadsLoading && threads.length > 0 && (
          <Stack gap={2}>
            {threads.map((thread) => (
              <NavLink
                key={thread.session_id}
                label={thread.name}
                description={new Date(thread.last_updated).toLocaleDateString()}
                onClick={() => console.log("load thread", thread.session_id)}
              />
            ))}
          </Stack>
        )}

        {!threadsLoading && selectedRepo && threads.length === 0 && (
          <Text size="xs" c="dimmed" ta="center">
            No threads yet
          </Text>
        )}
      </Stack>
    </Container>
  );
};
