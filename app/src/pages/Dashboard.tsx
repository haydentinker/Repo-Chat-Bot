import {
  AppShell,
  Burger,
  Button,
  Group,
  Modal,
  Radio,
  Text,
  ActionIcon,
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

export default function Dashboard() {
  const [opened, { open, toggle }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [newRepo, setNewRepo] = useState("");
  const { toggleColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("dark");
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
              <Text fw={600} size="sm">
                Repo Chat
              </Text>
            </Group>
            <Group>
              <Button variant="light" color="violet" onClick={openModal} size="sm">
                Load repository
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
          <Navbar />
        </AppShell.Navbar>
        <AppShell.Main>
          <Chat socket={socket} selectedRepo="haydentinker/Repo-Chat-Bot" />
        </AppShell.Main>
      </AppShell>
      <Modal opened={modalOpened} onClose={closeModal} title="Authentication">
        <Radio.Group
          value={newRepo}
          onChange={setNewRepo}
          name="favoriteFramework"
          label="Select your favorite framework/library"
          description="This is anonymous"
          withAsterisk
        >
          <Radio value="react" label="React" />
          <Radio value="svelte" label="Svelte" />
          <Radio value="ng" label="Angular" />
          <Radio value="vue" label="Vue" />
        </Radio.Group>
      </Modal>
    </>
  );
}
