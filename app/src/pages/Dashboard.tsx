import {
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Group,
  Modal,
  Select,
  Text,
  ActionIcon,
  Stack,
  Loader,
  Tabs,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconSun,
  IconMoon,
  IconRefresh,
  IconLogout,
  IconBrandGithub,
  IconFolderOpen,
  IconMessageCircle,
  IconArrowRight,
} from "@tabler/icons-react";
import { Navbar } from "../components/Navbar";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Chat from "../components/Chat";
import { API_URL } from "../lib/api";
import Logo from "../components/Logo";

const socket = io(API_URL, {
  transports: ["websocket"],
  withCredentials: true,
});

interface Repo {
  full_name: string;
  name: string;
  description: string | null;
}

interface LoadedRepo {
  repo_name: string;
  branch: string;
  chunk_count: number;
  last_ingested: string;
}

interface RepoStatus {
  up_to_date: boolean;
  stored_sha: string | null;
  latest_sha: string;
}

export default function Dashboard() {
  const [opened, { toggle }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [welcomeOpened, { open: openWelcome, close: closeWelcome }] =
    useDisclosure(false);
  const [newRepo, setNewRepo] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadedRepos, setLoadedRepos] = useState<LoadedRepo[]>([]);
  const [repoStatuses, setRepoStatuses] = useState<
    Record<string, RepoStatus | "loading" | "error">
  >({});
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [syncingRepo, setSyncingRepo] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedThread, setSelectedThread] = useState("");
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("dark");

  useEffect(() => {
    fetch(`${API_URL}/user/loaded/repos`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: LoadedRepo[]) => {
        if (data.length === 0) openWelcome();
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalOpened) {
      setIngestResult(null);
      setSyncResults({});
      return;
    }
    setReposLoading(true);
    setReposError(null);
    setRepoStatuses({});
    Promise.all([
      fetch(`${API_URL}/users/repos`, { credentials: "include" }).then(
        (res) => {
          if (!res.ok) throw new Error("Failed to fetch repositories");
          return res.json();
        },
      ),
      fetch(`${API_URL}/user/loaded/repos`, { credentials: "include" }).then(
        (res) => res.json(),
      ),
    ])
      .then(([githubData, loadedData]: [{ repos: Repo[] }, LoadedRepo[]]) => {
        setRepos(githubData.repos ?? []);
        setLoadedRepos(loadedData);
        const initialStatuses: Record<string, "loading"> = {};
        for (const repo of loadedData)
          initialStatuses[repo.repo_name] = "loading";
        setRepoStatuses(initialStatuses);
        for (const repo of loadedData) {
          fetch(
            `${API_URL}/user/repo/${encodeURIComponent(repo.repo_name)}/status`,
            { credentials: "include" },
          )
            .then((res) => res.json())
            .then((status: RepoStatus) =>
              setRepoStatuses((prev) => ({
                ...prev,
                [repo.repo_name]: status,
              })),
            )
            .catch(() =>
              setRepoStatuses((prev) => ({
                ...prev,
                [repo.repo_name]: "error",
              })),
            );
        }
      })
      .catch((err) => setReposError(err.message))
      .finally(() => setReposLoading(false));
  }, [modalOpened]);

  const loadedRepoNames = new Set(loadedRepos.map((r) => r.repo_name));

  async function handleIngest() {
    if (!newRepo) return;
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch(`${API_URL}/ingest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_name: newRepo }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setIngestResult(
          data.message ??
            `Ingested ${data.chunk_count ?? 0} chunks (${data.updated_chunks ?? 0} updated)`,
        );
        setNewRepo("");
      } else {
        setIngestResult(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setIngestResult(`Error: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  }

  async function handleSync(repoName: string) {
    setSyncingRepo(repoName);
    setSyncResults((prev) => ({ ...prev, [repoName]: "" }));
    try {
      const res = await fetch(`${API_URL}/ingest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_name: repoName }),
      });
      const data = await res.json();
      const msg =
        data.status === "success"
          ? (data.message ?? `Updated ${data.updated_chunks ?? 0} chunks`)
          : `Error: ${data.message}`;
      setSyncResults((prev) => ({ ...prev, [repoName]: msg }));
      fetch(`${API_URL}/user/repo/${encodeURIComponent(repoName)}/status`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((status: RepoStatus) =>
          setRepoStatuses((prev) => ({ ...prev, [repoName]: status })),
        )
        .catch(() => {});
    } catch (err: any) {
      setSyncResults((prev) => ({
        ...prev,
        [repoName]: `Error: ${err.message}`,
      }));
    } finally {
      setSyncingRepo(null);
    }
  }

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 300,
          breakpoint: "sm",
          collapsed: { mobile: !opened },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="sm"
                size="sm"
              />
              <Logo withText height={36} />
            </Group>
            <Group>
              <Button
                variant="light"
                color="violet"
                onClick={openModal}
                size="sm"
              >
                Manage repositories
              </Button>
              <ActionIcon
                variant="light"
                color="violet"
                size="lg"
                onClick={toggleColorScheme}
                title="Toggle color scheme"
              >
                {colorScheme === "dark" ? (
                  <IconSun size={18} />
                ) : (
                  <IconMoon size={18} />
                )}
              </ActionIcon>
              <ActionIcon
                variant="light"
                color="violet"
                size="lg"
                title="Log out"
                onClick={() =>
                  fetch(`${API_URL}/logout`, { credentials: "include" }).then(
                    () => {
                      window.location.href = "/";
                    },
                  )
                }
              >
                <IconLogout size={18} />
              </ActionIcon>
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar
          p="md"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <Navbar
            selectedRepo={selectedRepo}
            setSelectedRepo={setSelectedRepo}
            selectedThread={selectedThread}
            setSelectedThread={setSelectedThread}
            refreshKey={threadRefreshKey}
          />
        </AppShell.Navbar>
        <AppShell.Main>
          <Chat
            socket={socket}
            selectedRepo={selectedRepo}
            selectedThread={selectedThread}
            onNewThread={() => setThreadRefreshKey((k) => k + 1)}
          />
        </AppShell.Main>
      </AppShell>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="Manage repositories"
        size="md"
      >
        {reposLoading && (
          <Group justify="center" py="md">
            <Loader size="sm" color="violet" />
            <Text size="sm" c="dimmed">
              Loading repositories…
            </Text>
          </Group>
        )}
        {reposError && (
          <Text size="sm" c="red">
            {reposError}
          </Text>
        )}

        {!reposLoading && !reposError && (
          <Tabs defaultValue="load" color="violet">
            <Tabs.List mb="md">
              <Tabs.Tab value="load">Load new</Tabs.Tab>
              <Tabs.Tab value="loaded">
                Loaded
                {loadedRepos.length > 0 && (
                  <Badge size="xs" color="violet" ml={6} variant="light">
                    {loadedRepos.length}
                  </Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="load">
              <Stack gap="md">
                <Select
                  label="Select a repository to ingest"
                  placeholder="Search repositories…"
                  value={newRepo}
                  onChange={(value) => setNewRepo(value ?? "")}
                  data={repos
                    .filter((r) => !loadedRepoNames.has(r.full_name))
                    .map((r) => ({ value: r.full_name, label: r.full_name }))}
                  searchable
                  nothingFoundMessage="No unloaded repositories found"
                  withAsterisk
                  comboboxProps={{ shadow: "md" }}
                />
                {ingestResult && (
                  <Text
                    size="sm"
                    c={ingestResult.startsWith("Error") ? "red" : "teal"}
                  >
                    {ingestResult}
                  </Text>
                )}
                <Group justify="flex-end">
                  <Button variant="default" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button
                    color="violet"
                    onClick={handleIngest}
                    disabled={!newRepo || ingesting}
                    loading={ingesting}
                  >
                    Ingest
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="loaded">
              <Stack gap="xs">
                {loadedRepos.length === 0 && (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No repositories loaded yet.
                  </Text>
                )}
                {loadedRepos.map((repo) => {
                  const status = repoStatuses[repo.repo_name];
                  const isSyncing = syncingRepo === repo.repo_name;
                  const syncMsg = syncResults[repo.repo_name];
                  return (
                    <Box
                      key={repo.repo_name}
                      p="sm"
                      style={{
                        borderRadius: 8,
                        border: "1px solid var(--mantine-color-default-border)",
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap={2}>
                          <Text size="sm" fw={500}>
                            {repo.repo_name}
                          </Text>
                          <Group gap={6}>
                            {status === "loading" && (
                              <Loader size={10} color="gray" />
                            )}
                            {status === "error" && (
                              <Badge size="xs" color="gray">
                                Status unavailable
                              </Badge>
                            )}
                            {status &&
                              status !== "loading" &&
                              status !== "error" && (
                                <Tooltip
                                  label={`Stored: ${status.stored_sha ?? "none"} · Latest: ${status.latest_sha}`}
                                  withArrow
                                >
                                  <Badge
                                    size="xs"
                                    color={
                                      status.up_to_date ? "teal" : "orange"
                                    }
                                    variant="light"
                                    style={{ cursor: "default" }}
                                  >
                                    {status.up_to_date
                                      ? "Up to date"
                                      : "Update available"}
                                  </Badge>
                                </Tooltip>
                              )}
                          </Group>
                          {syncMsg && (
                            <Text
                              size="xs"
                              c={syncMsg.startsWith("Error") ? "red" : "teal"}
                            >
                              {syncMsg}
                            </Text>
                          )}
                        </Stack>
                        <Tooltip label="Sync latest changes" withArrow>
                          <ActionIcon
                            variant="subtle"
                            color="violet"
                            loading={isSyncing}
                            onClick={() => handleSync(repo.repo_name)}
                          >
                            <IconRefresh size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        )}
      </Modal>

      {/* ── Welcome / onboarding modal ── */}
      <Modal
        opened={welcomeOpened}
        onClose={closeWelcome}
        size="md"
        centered
        withCloseButton={false}
        radius="lg"
        padding="xl"
      >
        <Stack gap="lg" align="center">
          <Logo height={52} />

          <Stack gap={6} align="center">
            <Text fw={800} size="xl" ta="center">
              Welcome to Repository Augur
            </Text>
            <Text c="dimmed" ta="center" size="sm" maw={340}>
              You don't have any repositories loaded yet. Load one to start
              chatting with your codebase.
            </Text>
          </Stack>

          <Stack gap="xs" w="100%">
            {[
              { icon: IconFolderOpen, label: "Load a GitHub repository" },
              {
                icon: IconMessageCircle,
                label: "Ask questions in plain English",
              },
              {
                icon: IconBrandGithub,
                label: "Answers grounded in your actual code",
              },
            ].map(({ icon: Icon, label }) => (
              <Group
                key={label}
                gap="sm"
                p="sm"
                style={{
                  borderRadius: 8,
                  background: "var(--mantine-color-default)",
                }}
              >
                <IconArrowRight
                  size={14}
                  color="var(--mantine-color-violet-4)"
                />
                <Icon size={16} color="var(--mantine-color-violet-4)" />
                <Text size="sm">{label}</Text>
              </Group>
            ))}
          </Stack>

          <Group w="100%">
            <Button variant="default" flex={1} onClick={closeWelcome}>
              I'll do it later
            </Button>
            <Button
              flex={2}
              color="violet"
              leftSection={<IconFolderOpen size={16} />}
              onClick={() => {
                closeWelcome();
                openModal();
              }}
            >
              Load a repository
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
