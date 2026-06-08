import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Progress,
  Select,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import type {
  IngestProgressEntry,
  LoadedRepo,
  Repo,
  RepoStatusState,
} from "./types";

interface ManageReposModalProps {
  opened: boolean;
  onClose: () => void;
  repos: Repo[];
  loadedRepos: LoadedRepo[];
  loadedRepoNames: Set<string>;
  repoStatuses: Record<string, RepoStatusState>;
  reposLoading: boolean;
  reposError: string | null;
  newRepo: string;
  onNewRepoChange: (value: string) => void;
  ingestResult: string | null;
  ingesting: boolean;
  onIngest: () => void;
  ingestingRepos: Set<string>;
  ingestProgress: Map<string, IngestProgressEntry>;
  onSync: (repoName: string) => void;
}

export default function ManageReposModal({
  opened,
  onClose,
  repos,
  loadedRepos,
  loadedRepoNames,
  repoStatuses,
  reposLoading,
  reposError,
  newRepo,
  onNewRepoChange,
  ingestResult,
  ingesting,
  onIngest,
  ingestingRepos,
  ingestProgress,
  onSync,
}: ManageReposModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Manage repositories" size="md">
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
                onChange={(value) => onNewRepoChange(value ?? "")}
                data={repos
                  .filter((r) => !loadedRepoNames.has(r.full_name))
                  .map((r) => ({ value: r.full_name, label: r.full_name }))}
                searchable
                nothingFoundMessage="No unloaded repositories found"
                withAsterisk
                comboboxProps={{ shadow: "md" }}
              />
              {ingestResult && (
                <Text size="sm" c={ingestResult.startsWith("Error") ? "red" : "teal"}>
                  {ingestResult}
                </Text>
              )}
              <Group justify="flex-end">
                <Button variant="default" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  color="violet"
                  onClick={onIngest}
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
              {loadedRepos.map((repo) => {
                const status = repoStatuses[repo.repo_name];
                const isSyncing = ingestingRepos.has(repo.repo_name);
                const syncProg = ingestProgress.get(repo.repo_name);
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
                                  {syncProg ? `Syncing… ${syncProg.progress}%` : "Syncing…"}
                                </Badge>
                              </Group>
                              {syncProg && (
                                <Progress
                                  value={syncProg.progress}
                                  color="violet"
                                  radius="xl"
                                  size="xs"
                                  animated
                                />
                              )}
                            </Stack>
                          ) : (
                            <>
                              {status === "loading" && <Loader size={10} color="gray" />}
                              {status === "error" && (
                                <Badge size="xs" color="gray">
                                  Status unavailable
                                </Badge>
                              )}
                              {status && status !== "loading" && status !== "error" && (
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
                          onClick={() => onSync(repo.repo_name)}
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
  );
}
