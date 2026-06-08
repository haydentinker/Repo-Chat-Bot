import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import {
  IconBrandGithub,
  IconFolderOpen,
  IconMessageCircle,
  IconArrowRight,
} from "@tabler/icons-react";
import Logo from "../Logo";

interface WelcomeModalProps {
  opened: boolean;
  onClose: () => void;
  onLoadRepo: () => void;
}

const HIGHLIGHTS = [
  { icon: IconFolderOpen, label: "Load a GitHub repository" },
  { icon: IconMessageCircle, label: "Ask questions in plain English" },
  { icon: IconBrandGithub, label: "Answers grounded in your actual code" },
];

export default function WelcomeModal({ opened, onClose, onLoadRepo }: WelcomeModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      centered
      withCloseButton={false}
      radius="lg"
      padding="xl"
    >
      <Stack gap="lg" align="center">
        <Logo height={52} />

        <Stack gap={6} align="center">
          <Text fw={800} size="xl" ta="center">
            Welcome to Repository Augur
          </Text>
          <Text c="dimmed" ta="center" size="sm" maw={340}>
            You don't have any repositories loaded yet. Load one to start
            chatting with your codebase.
          </Text>
        </Stack>

        <Stack gap="xs" w="100%">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <Group
              key={label}
              gap="sm"
              p="sm"
              style={{ borderRadius: 8, background: "var(--mantine-color-default)" }}
            >
              <IconArrowRight size={14} color="var(--mantine-color-violet-4)" />
              <Icon size={16} color="var(--mantine-color-violet-4)" />
              <Text size="sm">{label}</Text>
            </Group>
          ))}
        </Stack>

        <Group w="100%">
          <Button variant="default" flex={1} onClick={onClose}>
            I'll do it later
          </Button>
          <Button
            flex={2}
            color="violet"
            leftSection={<IconFolderOpen size={16} />}
            onClick={onLoadRepo}
          >
            Load a repository
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
