import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextInput,
  ScrollArea,
  Text,
  Stack,
  Paper,
} from "@mantine/core";
import { Socket } from "socket.io-client";

interface Message {
  sender: "HUMAN" | "AI";
  text: string;
}

interface ChatProps {
  socket: Socket;
  selectedRepo: string;
}

const Chat: React.FC<ChatProps> = ({ socket, selectedRepo }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [thread, setThread] = useState("");
  useEffect(() => {
    socket.on(
      "response",
      (data: {
        message?: string;
        response?: string;
        error?: string;
        session_id: string;
      }) => {
        if (data.error) {
          console.error("RAG Error:", data.error);
        } else {
          setThread(data.session_id);
          setMessages([
            ...messages,
            { text: data.response ?? "Error", sender: "AI" },
          ]);
        }
      },
    );
    return () => {
      socket.off("response");
    };
  }, [socket]);

  const sendMessage = () => {
    socket.emit("message", {
      message: input,
      repo_name: selectedRepo,
      session_id: thread,
    });
    setMessages([...messages, { sender: "HUMAN", text: input }]);
    setInput("");
  };
  return (
    <Box
      style={{
        maxWidth: 400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        height: "80vh",
        border: "1px solid #ccc",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <ScrollArea style={{ flex: 1, marginBottom: 16 }}>
        <Stack>
          {messages.map((msg, index) => (
            <Paper
              key={`${index}-${msg.sender}`}
              style={(theme) => ({
                alignSelf: msg.sender === "HUMAN" ? "flex-end" : "flex-start",
                backgroundColor:
                  msg.sender === "HUMAN"
                    ? theme.colors.blue[5]
                    : theme.colors.gray[2],
                color: msg.sender === "HUMAN" ? "white" : "black",
                padding: "8px 12px",
                borderRadius: 12,
                maxWidth: "70%",
                wordBreak: "break-word",
              })}
            >
              <Text size="sm">{msg.text}</Text>
            </Paper>
          ))}
        </Stack>
      </ScrollArea>

      <Box style={{ display: "flex", gap: 8 }}>
        <TextInput
          placeholder="Type a message"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          style={{ flex: 1 }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <Button onClick={sendMessage}>Send</Button>
      </Box>
    </Box>
  );
};

export default Chat;
