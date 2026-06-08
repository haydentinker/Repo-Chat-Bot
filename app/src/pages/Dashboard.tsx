import {
  Alert,
  AppShell,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { Navbar } from "../components/Navbar";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Chat from "../components/Chat";
import UpgradeModal from "../components/UpgradeModal";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import ManageReposModal from "../components/dashboard/ManageReposModal";
import WelcomeModal from "../components/dashboard/WelcomeModal";
import type {
  IngestProgressEntry,
  LoadedRepo,
  Repo,
  RepoStatus,
  RepoStatusState,
} from "../components/dashboard/types";
import { API_URL } from "../lib/api";
import { useAuth } from "../providers/AuthProvider";

const socket = io(API_URL, {
  transports: ["websocket"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [opened, { toggle, close: closeNav }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [welcomeOpened, { open: openWelcome, close: closeWelcome }] = useDisclosure(false);
  const [upgradeOpened, { open: openUpgrade, close: closeUpgrade }] = useDisclosure(false);
  const [newRepo, setNewRepo] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadedRepos, setLoadedRepos] = useState<LoadedRepo[]>([]);
  const [repoStatuses, setRepoStatuses] = useState<Record<string, RepoStatusState>>({});
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [ingestingRepos, setIngestingRepos] = useState<Set<string>>(new Set());
  const [ingestProgress, setIngestProgress] = useState<Map<string, IngestProgressEntry>>(new Map());
  const [navReposRefreshKey, setNavReposRefreshKey] = useState(0);
  const [notification, setNotification] = useState<{ message: string; isError: boolean } | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedThread, setSelectedThread] = useState("");
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("dark");

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
      fetch(`${API_URL}/users/repos`, { credentials: "include" }).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch repositories");
        return res.json();
      }),
      fetch(`${API_URL}/user/loaded/repos`, { credentials: "include" }).then((res) => res.json()),
    ])
      .then(([githubData, loadedData]: [{ repos: Repo[] }, LoadedRepo[]]) => {
        setRepos(githubData.repos ?? []);
        setLoadedRepos(loadedData);
        const initialStatuses: Record<string, "loading"> = {};
        for (const repo of loadedData) initialStatuses[repo.repo_name] = "loading";
        setRepoStatuses(initialStatuses);
        for (const repo of loadedData) {
          fetch(`${API_URL}/user/repo/${encodeURIComponent(repo.repo_name)}/status`, {
            credentials: "include",
          })
            .then((res) => res.json())
            .then((status: RepoStatus) =>
              setRepoStatuses((prev) => ({ ...prev, [repo.repo_name]: status })),
            )
            .catch(() =>
              setRepoStatuses((prev) => ({ ...prev, [repo.repo_name]: "error" })),
            );
        }
      })
      .catch((err) => setReposError(err.message))
      .finally(() => setReposLoading(false));
  }, [modalOpened]);

  const loadedRepoNames = new Set(loadedRepos.map((r) => r.repo_name));

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
        setLoadedRepos((prev) => {
          if (prev.find((r) => r.repo_name === data.repo_name)) return prev;
          return [
            ...prev,
            {
              repo_name: data.repo_name,
              branch: "main",
              chunk_count: data.chunk_count ?? 0,
              last_ingested: new Date().toISOString(),
            },
          ];
        });
        fetch(`${API_URL}/user/repo/${encodeURIComponent(data.repo_name)}/status`, {
          credentials: "include",
        })
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

  function handleLogout() {
    fetch(`${API_URL}/logout`, { credentials: "include" }).then(() => {
      window.location.href = "/";
    });
  }

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 300, breakpoint: "sm", collapsed: { mobile: !opened } }}
        padding="md"
      >
        <DashboardHeader
          user={user}
          socketConnected={socketConnected}
          colorScheme={colorScheme}
          navOpened={opened}
          onToggleNav={toggle}
          onToggleColorScheme={toggleColorScheme}
          onOpenRepos={openModal}
          onOpenUpgrade={openUpgrade}
          onLogout={handleLogout}
        />
        <AppShell.Navbar p="md" style={{ display: "flex", flexDirection: "column" }}>
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

      <ManageReposModal
        opened={modalOpened}
        onClose={closeModal}
        repos={repos}
        loadedRepos={loadedRepos}
        loadedRepoNames={loadedRepoNames}
        repoStatuses={repoStatuses}
        reposLoading={reposLoading}
        reposError={reposError}
        newRepo={newRepo}
        onNewRepoChange={setNewRepo}
        ingestResult={ingestResult}
        ingesting={ingesting}
        onIngest={handleIngest}
        ingestingRepos={ingestingRepos}
        ingestProgress={ingestProgress}
        onSync={handleSync}
      />

      <WelcomeModal
        opened={welcomeOpened}
        onClose={closeWelcome}
        onLoadRepo={() => {
          closeWelcome();
          openModal();
        }}
      />

      <UpgradeModal
        opened={upgradeOpened}
        onClose={closeUpgrade}
        creditsRemaining={user?.credits_remaining ?? null}
        reason={user?.credits_remaining === 0 ? "exhausted" : "low"}
      />
    </>
  );
}
