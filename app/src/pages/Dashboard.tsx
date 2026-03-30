import {
  AppShell,
  Burger,
  Button,
  Group,
  Modal,
  Radio,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Navbar } from "../components/Navbar";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Chat from "../components/Chat";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
});

export default function Dashboard() {
  const [opened, { open, toggle }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [newRepo, setNewRepo] = useState("");
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
            <Button variant="filled" onClick={openModal}>
              Load more repositories
            </Button>
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
