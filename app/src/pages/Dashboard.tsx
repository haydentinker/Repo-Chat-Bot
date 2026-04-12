import {
  Alert,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Group,
  Modal,
  Progress,
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
import { IconCheck, IconX } from "@tabler/icons-react";
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
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Chat from "../components/Chat";
import UpgradeModal from "../components/UpgradeModal";
import { API_URL } from "../lib/api";
import Logo from "../components/Logo";
import { useAuth } from "../providers/AuthProvider";

const socket = io(API_URL, {
  transports: ["websocket"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [opened, { toggle, close: closeNav }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [welcomeOpened, { open: openWelcome, close: closeWelcome }] =
    useDisclosure(false);
  const [upgradeOpened, { open: openUpgrade, close: closeUpgrade }] =
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
  const [ingestingRepos, setIngestingRepos] = useState<Set<string>>(new Set());
  const [ingestProgress, setIngestProgress] = useState<Map<string, { progress: number; message: string }>>(new Map());
  const [navReposRefreshKey, setNavReposRefreshKey] = useState(0);
  const [notification, setNotification] = useState<{ message: string; isError: boolean } | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedThread, setSelectedThread] = useState("");
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("dark");

  // Redirect users who haven't selected a plan yet
  useEffect(() => {
    if (user && user.plan === null) {
      navigate("/plans");
    }
  }, [user, navigate]);

  useEffect(() => {
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/user/loaded/repos`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_URL}/user/ingesting/repos`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([loadedData, ingestingData]: [LoadedRepo[], string[]]) => {
        if (ingestingData.length > 0) {
          setIngestingRepos(new Set(ingestingData));
        }
        if (loadedData.length === 0 && ingestingData.length === 0) {
          openWelcome();
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalOpened) {
      setIngestResult(null);
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

  // Listen for async ingestion completions pushed from the server
  useEffect(() => {
    const onIngestComplete = (data: {
      status: string;
      repo_name: string;
      message?: string;
      chunk_count?: number;
    }) => {
      setIngestingRepos((prev) => {
        const next = new Set(prev);
        next.delete(data.repo_name);
        return next;
      });
      setIngestProgress((prev) => {
        const next = new Map(prev);
        next.delete(data.repo_name);
        return next;
      });

      if (data.status === "success") {
        const msg = data.message ?? `${data.repo_name} ingested successfully`;
        setNotification({ message: msg, isError: false });
        setNavReposRefreshKey((k) => k + 1);
        // Refresh loaded repos and statuses in the modal if it's open
        setLoadedRepos((prev) => {
          if (prev.find((r) => r.repo_name === data.repo_name)) return prev;
          return [...prev, { repo_name: data.repo_name, branch: "main", chunk_count: data.chunk_count ?? 0, last_ingested: new Date().toISOString() }];
        });
        fetch(
          `${API_URL}/user/repo/${encodeURIComponent(data.repo_name)}/status`,
          { credentials: "include" },
        )
          .then((res) => res.json())
          .then((status: RepoStatus) =>
            setRepoStatuses((prev) => ({ ...prev, [data.repo_name]: status })),
          )
          .catch(() => {});
      } else {
        setNotification({
          message: `Failed to ingest ${data.repo_name}: ${data.message ?? "unknown error"}`,
          isError: true,
        });
      }
    };

    const onIngestProgress = (data: { repo_name: string; progress: number; message: string }) => {
      setIngestProgress((prev) => {
        const next = new Map(prev);
        next.set(data.repo_name, { progress: data.progress, message: data.message });
        return next;
      });
    };

    socket.on("ingest_complete", onIngestComplete);
    socket.on("ingest_progress", onIngestProgress);
    return () => {
      socket.off("ingest_complete", onIngestComplete);
      socket.off("ingest_progress", onIngestProgress);
    };
  }, []);

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
      if (data.status === "queued") {
        setIngestingRepos((prev) => new Set([...prev, newRepo]));
        setIngestResult(`Ingestion started for ${newRepo}. You'll be notified when it's ready.`);
        setNewRepo("");
      } else if (data.limit_reached) {
        openUpgrade();
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
    try {
      const res = await fetch(`${API_URL}/ingest`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_name: repoName }),
      });
      const data = await res.json();
      if (data.status === "queued") {
        setIngestingRepos((prev) => new Set([...prev, repoName]));
      }
    } catch {
      setNotification({ message: `Failed to start sync for ${repoName}`, isError: true });
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
            <Group gap="xs">
              {/* Credits badge — desktop only */}
              {user?.plan === "free" && user.credits_remaining !== null && (
                <Tooltip label="Free plan messages remaining this month" withArrow>
                  <Badge
                    size="xs"
                    visibleFrom="sm"
                    color={user.credits_remaining <= 10 ? "red" : user.credits_remaining <= 30 ? "orange" : "teal"}
                    variant="light"
                    style={{ cursor: "pointer" }}
                    onClick={openUpgrade}
                  >
                    {user.credits_remaining} credits
                  </Badge>
                </Tooltip>
              )}
              {/* Live/Offline badge — desktop only */}
              <Tooltip label={socketConnected ? "Connected" : "Disconnected — reconnecting…"} withArrow>
                <Badge
                  size="xs"
                  visibleFrom="sm"
                  color={socketConnected ? "teal" : "orange"}
                  variant="dot"
                  style={{ cursor: "default" }}
                >
                  {socketConnected ? "Live" : "Offline"}
                </Badge>
              </Tooltip>
              {/* Manage repos — full button on desktop, icon-only on mobile */}
              <Tooltip label="Manage repositories" withArrow>
                <Button
                  variant="light"
                  color="violet"
                  onClick={openModal}
                  size="sm"
                  visibleFrom="sm"
                >
                  Manage repositories
                </Button>
              </Tooltip>
              <Tooltip label="Manage repositories" withArrow>
                <ActionIcon
                  variant="light"
                  color="violet"
                  size="lg"
                  hiddenFrom="sm"
                  onClick={openModal}
                  aria-label="Manage repositories"
                >
                  <IconFolderOpen size={18} />
                </ActionIcon>
              </Tooltip>
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
            reposRefreshKey={navReposRefreshKey}
            ingestingRepos={ingestingRepos}
            onNavigate={closeNav}
          />
        </AppShell.Navbar>
        <AppShell.Main>
          {notification && (
            <Alert
              color={notification.isError ? "red" : "teal"}
              icon={notification.isError ? <IconX size={16} /> : <IconCheck size={16} />}
              withCloseButton
              onClose={() => setNotification(null)}
              mb="sm"
              mx="md"
              mt="sm"
              radius="md"
            >
              {notification.message}
            </Alert>
          )}
          <Chat
            socket={socket}
            selectedRepo={selectedRepo}
            selectedThread={selectedThread}
            onNewThread={() => setThreadRefreshKey((k) => k + 1)}
            onUpgradeNeeded={openUpgrade}
            ingestingRepos={ingestingRepos}
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
                {loadedRepos.length === 0 && ingestingRepos.size === 0 && (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No repositories loaded yet.
                  </Text>
                )}
                {/* Repos currently being ingested for the first time */}
                {[...ingestingRepos]
                  .filter((name) => !loadedRepoNames.has(name))
                  .map((name) => {
                    const prog = ingestProgress.get(name);
                    return (
                      <Box
                        key={`ingesting-${name}`}
                        p="sm"
                        style={{
                          borderRadius: 8,
                          border: "1px solid var(--mantine-color-default-border)",
                          opacity: 0.85,
                        }}
                      >
                        <Stack gap={6}>
                          <Group justify="space-between" wrap="nowrap">
                            <Text size="sm" fw={500}>{name}</Text>
                            <Badge size="xs" color="violet" variant="light">
                              {prog ? `${prog.progress}%` : "Queued"}
                            </Badge>
                          </Group>
                          <Progress
                            value={prog?.progress ?? 0}
                            color="violet"
                            radius="xl"
                            size="sm"
                            animated={!!prog}
                          />
                          <Text size="xs" c="dimmed">
                            {prog?.message ?? "Waiting to start…"}
                          </Text>
                        </Stack>
                      </Box>
                    );
                  })}
                {/* Already-loaded repos */}
                {loadedRepos.map((repo) => {
                  const status = repoStatuses[repo.repo_name];
                  const isSyncing = ingestingRepos.has(repo.repo_name);
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
                            {isSyncing ? (
                              <Stack gap={4} style={{ flex: 1 }}>
                                <Group gap={6}>
                                  <Loader size={10} color="violet" />
                                  <Badge size="xs" color="violet" variant="light">
                                    {ingestProgress.get(repo.repo_name)
                                      ? `Syncing… ${ingestProgress.get(repo.repo_name)!.progress}%`
                                      : "Syncing…"}
                                  </Badge>
                                </Group>
                                {ingestProgress.get(repo.repo_name) && (
                                  <Progress
                                    value={ingestProgress.get(repo.repo_name)!.progress}
                                    color="violet"
                                    radius="xl"
                                    size="xs"
                                    animated
                                  />
                                )}
                              </Stack>
                            ) : (
                              <>
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
                                        color={status.up_to_date ? "teal" : "orange"}
                                        variant="light"
                                        style={{ cursor: "default" }}
                                      >
                                        {status.up_to_date ? "Up to date" : "Update available"}
                                      </Badge>
                                    </Tooltip>
                                  )}
                              </>
                            )}
                          </Group>
                        </Stack>
                        <Tooltip label="Sync latest changes" withArrow>
                          <ActionIcon
                            variant="subtle"
                            color="violet"
                            disabled={isSyncing}
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

      <UpgradeModal
        opened={upgradeOpened}
        onClose={closeUpgrade}
        creditsRemaining={user?.credits_remaining ?? null}
        reason={user?.credits_remaining === 0 ? "exhausted" : "low"}
      />
    </>
  );
}
