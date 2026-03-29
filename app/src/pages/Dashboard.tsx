import { AppShell, Burger, Button, Group, Modal, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Navbar } from "../components/Navbar";

export default function Dashboard() {
  const [opened, { toggle }] = useDisclosure();
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
            <Button variant="filled" onClick={openModal}>
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
