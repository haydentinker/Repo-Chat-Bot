import { AppShell, Burger, Button, Group, Modal, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Navbar } from "../components/Navbar";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// Connect to backend
const socket = io("http://localhost:5000", {
  transports: ["websocket"], // enforce WebSocket
});
interface ServerResponse {
  message: string;
}
export default function Dashboard() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState<string>("");

  useEffect(() => {
    socket.on("response", (data: ServerResponse) => {
      setMessages((prev) => [...prev, data.message]);
    });

    return () => {
      socket.off("response");
    };
  }, []);

  const sendMessage = (input: string) => {
    socket.send(input);
    setInput("");
  };
  const [opened, { open, toggle }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
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
          <Group h="100%" px="md">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            Github Repo Chat
            <Button variant="filled" onClick={() => sendMessage("hi")}>
              Load more repositories
            </Button>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="md">
          <Navbar />
        </AppShell.Navbar>
        <AppShell.Main>
          <Text>This is the main section, the chats will be laid out here</Text>
        </AppShell.Main>
      </AppShell>
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="Authentication"
      ></Modal>
    </>
  );
}
