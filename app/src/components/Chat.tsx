import { useEffect, useRef, useState } from "react";
import {
  TextInput,
  Button,
  Paper,
  Stack,
  Text,
  ScrollArea,
  Box,
  Group,
  Affix,
} from "@mantine/core";
import { io, Socket } from "socket.io-client";

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

interface ChatTokenEvent {
  text: string;
}

interface StreamCompleteEvent {
  status: string;
  session_id: string;
}

interface ChatProps {
  socket: Socket;
  selectedRepo: string;
}

export default function Chat({ socket, selectedRepo }: ChatProps) {
  const [thread, setThread] = useState("");
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const currentMessageRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleToken = (data: ChatTokenEvent) => {
      setIsStreaming(true);
      currentMessageRef.current += data.text;

      setMessages((prev) => {
        const updated = [...prev];

        if (
          updated.length &&
          updated[updated.length - 1].role === "assistant"
        ) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: currentMessageRef.current,
          };
        } else {
          updated.push({
            role: "assistant",
            content: currentMessageRef.current,
          });
        }

        return updated;
      });
    };

    const handleComplete = (data: StreamCompleteEvent) => {
      setThread(data.session_id);
      setIsStreaming(false);
      currentMessageRef.current = "";
    };

    socket.on("chat_token", handleToken);
    socket.on("stream_complete", handleComplete);

    return () => {
      socket.off("chat_token", handleToken);
      socket.off("stream_complete", handleComplete);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);

    socket.emit("message", {
      message: input,
      repo_name: selectedRepo,
      session_id: thread,
    });

    setInput("");
  };

  return (
    <Box
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        style={{
          width: "100%",
          maxWidth: 800,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ScrollArea style={{ flex: 1, padding: 16 }} mb={"lg"}>
          <Stack>
            {messages.map((msg, index) => (
              <Paper
                key={`${index}-${msg.role}`}
                style={(theme) => ({
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  backgroundColor:
                    msg.role === "user"
                      ? theme.colors.blue[5]
                      : theme.colors.gray[2],
                  color: msg.role === "user" ? "white" : "black",
                  padding: "8px 12px",
                  borderRadius: 12,
                  maxWidth: "70%",
                  wordBreak: "break-word",
                })}
              >
                <Text size="sm">{msg.content}</Text>
              </Paper>
            ))}

            {isStreaming && (
              <Text size="sm" c="dimmed">
                AI is typing...
              </Text>
            )}

            <div ref={bottomRef} />
          </Stack>
        </ScrollArea>

        <Box p="md" pos="fixed" bottom={0} w="50%">
          <Group>
            <TextInput
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />
            <Button onClick={sendMessage} disabled={isStreaming}>
              Send
            </Button>
          </Group>
        </Box>
      </Box>
    </Box>
  );
}
