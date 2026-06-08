import { Box, Container, Group, Text } from "@mantine/core";
import { IconCode } from "@tabler/icons-react";

export default function Footer() {
  return (
    <Box py={48}>
      <Container size="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Group gap="xs">
            <IconCode size={16} color="var(--mantine-color-violet-4)" />
            <Text size="sm" c="dimmed">
              Built for developers, by developers.
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            © {new Date().getFullYear()} Repository Augur · All rights reserved
          </Text>
        </Group>
      </Container>
    </Box>
  );
}
