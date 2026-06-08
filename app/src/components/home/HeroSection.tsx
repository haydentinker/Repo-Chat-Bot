import { Badge, Box, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconBolt, IconBrandGithub, IconGitBranch } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import classes from "../../pages/Home.module.css";

export default function HeroSection() {
  return (
    <Box className={classes.heroBg} py={120}>
      <div className={`${classes.orb} ${classes.orb1}`} />
      <div className={`${classes.orb} ${classes.orb2}`} />
      <div className={`${classes.orb} ${classes.orb3}`} />

      <Container size="lg" style={{ position: "relative", zIndex: 1 }}>
        <Stack align="center" gap="xl">
          <Badge
            size="lg"
            variant="light"
            color="violet"
            leftSection={<IconBolt size={14} />}
            radius="xl"
          >
            AI-powered repo intelligence
          </Badge>

          <Title
            ta="center"
            style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)", fontWeight: 900, lineHeight: 1.1 }}
          >
            Chat with your <span className={classes.gradientText}>codebase</span>
            <br />
            like it's a teammate
          </Title>

          <Text ta="center" size="xl" c="dimmed" maw={600}>
            Ask questions, trace logic, and understand any GitHub repository —
            in seconds, not hours. Powered by RAG and your own GitHub account.
          </Text>

          <Group gap="md">
            <Button
              size="xl"
              color="violet"
              leftSection={<IconBrandGithub size={22} />}
              component={Link}
              to="/dashboard"
              radius="xl"
              className={classes.githubBtn}
              styles={{ root: { paddingLeft: 28, paddingRight: 28 } }}
            >
              Get started free
            </Button>
            <Button
              size="xl"
              variant="default"
              radius="xl"
              component="a"
              href="#pricing"
              styles={{ root: { paddingLeft: 28, paddingRight: 28 } }}
            >
              See pricing
            </Button>
          </Group>

          <Paper className={classes.codeBlock} p="lg" radius="lg" maw={640} w="100%" mt="md">
            <Stack gap="sm">
              <Group gap="xs">
                <IconGitBranch size={14} color="var(--mantine-color-violet-4)" />
                <Text size="xs" c="violet" fw={600}>
                  haydentinker / Repo-Chat-Bot · main
                </Text>
              </Group>
              <Box style={{ borderTop: "1px solid rgba(124,58,237,0.2)", paddingTop: 12 }}>
                <Text size="sm" c="dimmed" mb={6}>
                  <Text span c="violet" fw={600}>
                    You{" "}
                  </Text>
                  How does authentication work in this repo?
                </Text>
                <Text size="sm" c="dimmed">
                  <Text span fw={600} style={{ color: "var(--mantine-color-violet-3)" }}>
                    AI{" "}
                  </Text>
                  Authentication is handled via GitHub OAuth using{" "}
                  <Text span c="violet" component="code">
                    flask-dance
                  </Text>
                  . After the OAuth callback,{" "}
                  <Text span c="violet" component="code">
                    login_user()
                  </Text>{" "}
                  is called and sessions are persisted in MongoDB via{" "}
                  <Text span c="violet" component="code">
                    flask-login
                  </Text>
                  …
                </Text>
              </Box>
              <Group gap={4} mt={4}>
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--mantine-color-violet-5)",
                    animation: "pulse 1.5s infinite",
                  }}
                />
                <Text size="xs" c="dimmed">
                  Streaming response…
                </Text>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
