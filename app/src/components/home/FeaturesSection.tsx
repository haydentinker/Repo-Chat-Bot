import { Badge, Container, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconBolt,
  IconMessageCircle,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react";
import classes from "../../pages/Home.module.css";

const FEATURES = [
  {
    icon: IconSearch,
    title: "Semantic Code Search",
    description:
      "Ask questions in plain English. The AI searches your entire codebase using vector embeddings to find exactly what you need.",
  },
  {
    icon: IconMessageCircle,
    title: "Conversational Context",
    description:
      "Maintain multi-turn conversations about your repo. Reference earlier answers, drill deeper, and build understanding incrementally.",
  },
  {
    icon: IconBolt,
    title: "Instant Ingestion",
    description:
      "Point it at any GitHub repo and it's ready in seconds. Only changed files are re-indexed on updates, so syncing is near-instant.",
  },
  {
    icon: IconShieldCheck,
    title: "Private & Secure",
    description:
      "Your code never leaves your own infrastructure. GitHub OAuth ensures only you can access your repositories.",
  },
];

export default function FeaturesSection() {
  return (
    <Container size="lg" py={100}>
      <Stack align="center" mb={60}>
        <Badge variant="light" color="violet" size="md">
          Features
        </Badge>
        <Title ta="center" order={2} style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
          Everything you need to{" "}
          <span className={classes.gradientText}>understand code faster</span>
        </Title>
        <Text ta="center" c="dimmed" maw={540} size="lg">
          Stop spelunking through files. Just ask.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {FEATURES.map((f) => (
          <Paper key={f.title} className={classes.featureCard} p="xl" radius="lg" withBorder>
            <Group align="flex-start" gap="md">
              <ThemeIcon size={48} radius="md" color="violet" variant="light">
                <f.icon size={24} />
              </ThemeIcon>
              <Stack gap={6} style={{ flex: 1 }}>
                <Text fw={700} size="lg">
                  {f.title}
                </Text>
                <Text c="dimmed" size="sm" style={{ lineHeight: 1.7 }}>
                  {f.description}
                </Text>
              </Stack>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>
    </Container>
  );
}
