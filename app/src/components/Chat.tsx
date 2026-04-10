import { useEffect, useRef, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { API_URL } from "../lib/api";
import {
  TextInput,
  Button,
  Paper,
  Stack,
  Text,
  ScrollArea,
  Box,
  Group,
  Loader,
  Switch,
  useMantineTheme,
  Collapse,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { Socket } from "socket.io-client";

const MOCK_RESPONSES = [
  "This repository uses a React frontend with a Flask backend. The main entry point is `app.py`, which sets up the Flask app, SocketIO, and all the routes including GitHub OAuth via flask-dance.",
  "The ingestion pipeline lives in `helpers/ingestRepo.py`. It fetches files from GitHub, splits them into chunks using `RecursiveCharacterTextSplitter`, embeds them with OpenAI's `text-embedding-3-small`, and upserts them into MongoDB Atlas for vector search.",
  "Authentication is handled with flask-login. After a successful GitHub OAuth flow, `login_user()` is called and the session is managed via a MongoDB-backed user loader. Protected routes check `current_user.is_authenticated` via a `before_request` hook.",
  "The RAG agent is built with LangGraph's `create_react_agent` and a `search_mongo` tool that performs vector similarity search against the ingested repository chunks. Responses are streamed token-by-token using a `BaseCallbackHandler`.",
  "I don't see anything in the repository that matches that query. Try rephrasing or make sure the relevant files have been ingested first.",
];

function simulateStream(
  text: string,
  onToken: (token: string) => void,
  onComplete: () => void,
) {
  const words = text.split(" ");
  let i = 0;
  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval);
      onComplete();
      return;
    }
    onToken((i === 0 ? "" : " ") + words[i]);
    i++;
  }, 45);
  return interval;
}

type Role = "user" | "assistant";
type ChatStatus = "idle" | "waiting" | "streaming";

interface Message {
  role: Role;
  content: string;
  sources?: string[];
}

interface ChatProps {
  socket: Socket;
  selectedRepo: string;
  selectedThread: string;
  onNewThread?: () => void;
  onUpgradeNeeded?: () => void;
  ingestingRepos?: Set<string>;
}

function SourcesList({ sources }: { sources: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Box mt={6}>
      <Group gap={4} style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        {open ? <IconChevronUp size={11} /> : <IconChevronDown size={11} />}
        <Text size="xs" c="dimmed">
          {sources.length} source{sources.length !== 1 ? "s" : ""}
        </Text>
      </Group>
      <Collapse in={open}>
        <Stack gap={2} mt={4}>
          {sources.map((src) => (
            <Text key={src} size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
              {src}
            </Text>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

export default function Chat({ socket, selectedRepo, selectedThread, onNewThread, onUpgradeNeeded, ingestingRepos }: ChatProps) {
  const theme = useMantineTheme();
  const { user, refreshUser } = useAuth();
  const isFree = user?.plan === "free";
  const [thread, setThread] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);

  const currentMessageRef = useRef("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      setThread("");
      setThreadError(null);
      return;
    }
    setThread(selectedThread);
    setLoadingThread(true);
    setThreadError(null);
    fetch(`${API_URL}/user/thread/${selectedThread}/messages`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load thread messages");
        return res.json();
      })
      .then((data: Message[]) => setMessages(data))
      .catch((err: Error) => setThreadError(err.message))
      .finally(() => setLoadingThread(false));
  }, [selectedThread]);

  useEffect(() => {
    const handleToken = ({ text }: { text: string }) => {
      currentMessageRef.current += text;
      const content = currentMessageRef.current;

      setStatus("streaming");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [...prev.slice(0, -1), { ...last, content }];
        }
        return [...prev, { role: "assistant", content }];
      });
    };

    const handleComplete = ({
      session_id,
      sources,
    }: {
      status: string;
      session_id: string;
      sources?: string[];
    }) => {
      if (sources && sources.length > 0) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, sources }];
          }
          return prev;
        });
      }
      setThread((prev) => {
        if (!prev) onNewThread?.();
        return session_id;
      });
      setStatus("idle");
      currentMessageRef.current = "";
      if (isFree) refreshUser();
    };

    const handleError = ({ error }: { error: string }) => {
      setStatus("idle");
      currentMessageRef.current = "";
      if (error === "credits_exhausted") {
        onUpgradeNeeded?.();
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error}` },
      ]);
    };

    socket.on("chat_token", handleToken);
    socket.on("stream_complete", handleComplete);
    socket.on("response", handleError);

    return () => {
      socket.off("chat_token", handleToken);
      socket.off("stream_complete", handleComplete);
      socket.off("response", handleError);
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const sendMessage = () => {
    if (!input.trim() || status !== "idle") return;

    currentMessageRef.current = "";
    const userInput = input;
    setMessages((prev) => [...prev, { role: "user", content: userInput }]);
    setInput("");

    if (mockMode) {
      setStatus("waiting");
      setTimeout(() => {
        setStatus("streaming");
        const response =
          MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
        mockIntervalRef.current = simulateStream(
          response,
          (token) => {
            currentMessageRef.current += token;
            const content = currentMessageRef.current;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { role: "assistant", content }];
              }
              return [...prev, { role: "assistant", content }];
            });
          },
          () => {
            setStatus("idle");
            currentMessageRef.current = "";
          },
        );
      }, 600);
      return;
    }

    socket.emit("message", {
      message: userInput,
      repo_name: selectedRepo,
      session_id: thread || undefined,
    });
    setStatus("waiting");
  };

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - var(--app-shell-header-height, 60px) - 32px)",
      }}
    >
      <ScrollArea style={{ flex: 1 }} px="md" pb="md">
        <Stack gap="md" py="md" style={{ maxWidth: 900, margin: "0 auto" }}>
          {loadingThread && (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
              }}
            >
              <Loader size="sm" color="violet" />
            </Box>
          )}

          {threadError && (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
              }}
            >
              <Text size="sm" c="red">{threadError}</Text>
            </Box>
          )}

          {!loadingThread && !threadError && messages.length === 0 && (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
              }}
            >
              {selectedRepo ? (
                <Text c="dimmed" size="sm">
                  Ask anything about{" "}
                  <Text span fw={600} c="violet">
                    {selectedRepo}
                  </Text>
                </Text>
              ) : ingestingRepos && ingestingRepos.size > 0 ? (
                <Stack align="center" gap={6}>
                  <Loader size="sm" color="violet" />
                  <Text size="sm" c="dimmed" ta="center">
                    {ingestingRepos.size === 1
                      ? "Your repository is being ingested — it will appear in the sidebar when ready."
                      : `${ingestingRepos.size} repositories are being ingested — they'll appear in the sidebar when ready.`}
                  </Text>
                </Stack>
              ) : (
                <Text size="sm" span fw={600} c="violet">
                  Select or load a repo to begin chatting
                </Text>
              )}
            </Box>
          )}

          {!loadingThread && messages.map((msg, index) => (
            <Box
              key={`${index}-${msg.role}`}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <Paper
                style={{
                  maxWidth: "82%",
                  padding: "10px 16px",
                  backgroundColor:
                    msg.role === "user"
                      ? theme.colors.violet[8]
                      : "var(--mantine-color-default)",
                  borderRadius:
                    msg.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
                shadow="xs"
              >
                <Text size="sm" style={{ lineHeight: 1.6 }}>
                  {msg.content}
                </Text>
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <SourcesList sources={msg.sources} />
                )}
              </Paper>
            </Box>
          ))}

          {status === "waiting" && (
            <Group gap="xs">
              <Loader size="xs" color="violet" />
              <Text size="sm" c="dimmed">
                Thinking…
              </Text>
            </Group>
          )}

          <div ref={bottomRef} />
        </Stack>
      </ScrollArea>

      <Box
        px="md"
        py="sm"
        style={{
          borderTop: "1px solid var(--mantine-color-default-border)",
          backgroundColor: "var(--mantine-color-body)",
        }}
      >
        <Stack gap="xs" style={{ maxWidth: 900, margin: "0 auto" }}>
          <Group>
            <TextInput
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder={`Message ${selectedRepo}…`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) sendMessage();
              }}
              disabled={status !== "idle" || !selectedRepo}
              size="md"
              radius="xl"
              styles={{
                input: {
                  backgroundColor: "var(--mantine-color-default)",
                  border: "1px solid var(--mantine-color-default-border)",
                },
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={status !== "idle" || !selectedRepo}
              size="md"
              radius="xl"
              color="violet"
              px="xl"
            >
              Send
            </Button>
          </Group>
          <Group justify="flex-end">
            <Switch
              size="xs"
              checked={mockMode}
              onChange={(e) => setMockMode(e.currentTarget.checked)}
              label={
                <Text size="xs" c="dimmed">
                  Mock mode
                </Text>
              }
              color="violet"
            />
          </Group>
        </Stack>
      </Box>
    </Box>
  );
}
