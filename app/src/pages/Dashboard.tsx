import {
  AppShell,
  Box,
  Burger,
  Button,
  Group,
  Image,
  Modal,
  Radio,
  Text,
  ActionIcon,
  Stack,
  Loader,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Navbar } from "../components/Navbar";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Chat from "../components/Chat";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  withCredentials: true,
});

interface Repo {
  full_name: string;
  name: string;
  description: string | null;
}

export default function Dashboard() {
  const [opened, { open, toggle }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [newRepo, setNewRepo] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedThread, setSelectedThread] = useState("");
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("dark");

  useEffect(() => {
    if (!modalOpened) {
      setIngestResult(null);
      return;
    }
    setReposLoading(true);
    setReposError(null);
    fetch("http://localhost:5000/users/repos", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch repositories");
        return res.json();
      })
      .then((data) => setRepos(data.repos ?? []))
      .catch((err) => setReposError(err.message))
      .finally(() => setReposLoading(false));
  }, [modalOpened]);

  async function handleIngest() {
    if (!newRepo) return;
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch("http://localhost:5000/ingest", {
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
      } else {
        setIngestResult(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setIngestResult(`Error: ${err.message}`);
    } finally {
      setIngesting(false);
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
              <Box
                bg={colorScheme === "dark" ? "white" : "transparent"}
                style={{ borderRadius: 8, padding: colorScheme === "dark" ? "4px 10px" : 0, margin: "8px 0 10px" }}
              >
                <Image src="/logo.png" h={38} fit="contain" />
              </Box>
            </Group>
            <Group>
              <Button
                variant="light"
                color="violet"
                onClick={openModal}
                size="sm"
              >
                Load a repository
              </Button>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={toggleColorScheme}
                title="Toggle color scheme"
              >
                {colorScheme === "dark" ? "☀️" : "🌙"}
              </ActionIcon>
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="md">
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

      <Modal opened={modalOpened} onClose={closeModal} title="Load repository">
        <Stack gap="md">
          {reposLoading && (
            <Group justify="center">
              <Loader size="sm" color="violet" />
              <Text size="sm" c="dimmed">
                Loading your repositories…
              </Text>
            </Group>
          )}

          {reposError && (
            <Text size="sm" c="red">
              {reposError}
            </Text>
          )}

          {!reposLoading && !reposError && (
            <Radio.Group
              value={newRepo}
              onChange={setNewRepo}
              name="repoSelect"
              label="Select a repository to ingest"
              withAsterisk
            >
              <Stack gap="xs" mt="xs">
                {repos.map((repo) => (
                  <Radio
                    key={repo.full_name}
                    value={repo.full_name}
                    label={repo.full_name}
                    description={repo.description ?? undefined}
                  />
                ))}
                {repos.length === 0 && (
                  <Text size="sm" c="dimmed">
                    No repositories found.
                  </Text>
                )}
              </Stack>
            </Radio.Group>
          )}

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
      </Modal>
    </>
  );
}
