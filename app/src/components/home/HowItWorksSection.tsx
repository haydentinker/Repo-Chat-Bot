import { Badge, Box, Container, Group, Stack, Text, Title } from "@mantine/core";
import classes from "../../pages/Home.module.css";

const STEPS = [
  {
    label: "Connect GitHub",
    description: "Sign in with GitHub OAuth — no tokens to manage manually.",
  },
  {
    label: "Load a repo",
    description: "Pick any repo you have access to. We ingest and embed it automatically.",
  },
  {
    label: "Start chatting",
    description: "Ask anything about the codebase. Get accurate, sourced answers instantly.",
  },
];

export default function HowItWorksSection() {
  return (
    <Box py={100} style={{ background: "rgba(124,58,237,0.03)" }}>
      <Container size="md">
        <Stack align="center" mb={60}>
          <Badge variant="light" color="violet" size="md">
            How it works
          </Badge>
          <Title ta="center" order={2} style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
            Up and running in{" "}
            <span className={classes.gradientText}>under a minute</span>
          </Title>
        </Stack>
        <Stack gap="xl">
          {STEPS.map((step, i) => (
            <Group key={step.label} gap="lg" align="flex-start">
              <div className={classes.stepBadge}>{i + 1}</div>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text fw={700} size="lg">
                  {step.label}
                </Text>
                <Text c="dimmed">{step.description}</Text>
              </Stack>
              {i < STEPS.length - 1 && (
                <Box
                  style={{
                    position: "absolute",
                    left: 19,
                    marginTop: 48,
                    width: 2,
                    height: 40,
                    background: "linear-gradient(to bottom, rgba(124,58,237,0.5), transparent)",
                  }}
                />
              )}
            </Group>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
