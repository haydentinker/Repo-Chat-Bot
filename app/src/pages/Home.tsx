import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconBrandGithub,
  IconBolt,
  IconSearch,
  IconMessageCircle,
  IconShieldCheck,
  IconCheck,
  IconCode,
  IconGitBranch,
} from "@tabler/icons-react";
import { API_URL } from "../lib/api";
import Logo from "../components/Logo";
import classes from "./Home.module.css";

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

const STEPS = [
  {
    label: "Connect GitHub",
    description: "Sign in with GitHub OAuth — no tokens to manage manually.",
  },
  {
    label: "Load a repo",
    description:
      "Pick any repo you have access to. We ingest and embed it automatically.",
  },
  {
    label: "Start chatting",
    description:
      "Ask anything about the codebase. Get accurate, sourced answers instantly.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring your own projects.",
    features: ["3 repositories", "100 messages / month", "Community support"],
    cta: "Get started",
    featured: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    description: "For developers who live in their codebase.",
    features: [
      "Unlimited repositories",
      "2,000 messages / month",
      "Priority indexing",
      "Email support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Team",
    price: "$49",
    period: "per month",
    description: "Share context across your whole engineering team.",
    features: [
      "Everything in Pro",
      "Up to 10 seats",
      "Shared repo library",
      "Slack integration (soon)",
      "Dedicated support",
    ],
    cta: "Contact us",
    featured: false,
  },
];

export default function Home() {
  return (
    <Box
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--mantine-color-body)",
      }}
    >
      <Box className={classes.navbar} px="xl" py="sm">
        <Group justify="space-between" maw={1100} mx="auto">
          <Logo withText height={32} />
          <Button
            leftSection={<IconBrandGithub size={18} />}
            color="violet"
            variant="light"
            component="a"
            href={`${API_URL}/auth/github`}
          >
            Sign in with GitHub
          </Button>
        </Group>
      </Box>

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
              style={{
                fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
                fontWeight: 900,
                lineHeight: 1.1,
              }}
            >
              Chat with your{" "}
              <span className={classes.gradientText}>codebase</span>
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
                component="a"
                href={`${API_URL}/auth/github`}
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

            <Paper
              className={classes.codeBlock}
              p="lg"
              radius="lg"
              maw={640}
              w="100%"
              mt="md"
            >
              <Stack gap="sm">
                <Group gap="xs">
                  <IconGitBranch
                    size={14}
                    color="var(--mantine-color-violet-4)"
                  />
                  <Text size="xs" c="violet" fw={600}>
                    haydentinker / Repo-Chat-Bot · main
                  </Text>
                </Group>
                <Box
                  style={{
                    borderTop: "1px solid rgba(124,58,237,0.2)",
                    paddingTop: 12,
                  }}
                >
                  <Text size="sm" c="dimmed" mb={6}>
                    <Text span c="violet" fw={600}>
                      You{" "}
                    </Text>
                    How does authentication work in this repo?
                  </Text>
                  <Text size="sm" c="dimmed">
                    <Text
                      span
                      fw={600}
                      style={{ color: "var(--mantine-color-violet-3)" }}
                    >
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

      <div className={classes.divider} />

      <Container size="lg" py={100}>
        <Stack align="center" mb={60}>
          <Badge variant="light" color="violet" size="md">
            Features
          </Badge>
          <Title
            ta="center"
            order={2}
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
          >
            Everything you need to{" "}
            <span className={classes.gradientText}>understand code faster</span>
          </Title>
          <Text ta="center" c="dimmed" maw={540} size="lg">
            Stop spelunking through files. Just ask.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {FEATURES.map((f) => (
            <Paper
              key={f.title}
              className={classes.featureCard}
              p="xl"
              radius="lg"
              withBorder
            >
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

      <div className={classes.divider} />

      <Box py={100} style={{ background: "rgba(124,58,237,0.03)" }}>
        <Container size="md">
          <Stack align="center" mb={60}>
            <Badge variant="light" color="violet" size="md">
              How it works
            </Badge>
            <Title
              ta="center"
              order={2}
              style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
            >
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
                      background:
                        "linear-gradient(to bottom, rgba(124,58,237,0.5), transparent)",
                    }}
                  />
                )}
              </Group>
            ))}
          </Stack>
        </Container>
      </Box>

      <div className={classes.divider} />

      <Container size="lg" py={100} id="pricing">
        <Stack align="center" mb={60}>
          <Badge variant="light" color="violet" size="md">
            Pricing
          </Badge>
          <Title
            ta="center"
            order={2}
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
          >
            Simple,{" "}
            <span className={classes.gradientText}>transparent pricing</span>
          </Title>
          <Text ta="center" c="dimmed" maw={500} size="lg">
            Start free, upgrade when you need more. No hidden fees.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {PLANS.map((plan) => (
            <Paper
              key={plan.name}
              className={
                plan.featured
                  ? classes.pricingCardFeatured
                  : classes.pricingCard
              }
              p="xl"
              radius="lg"
              withBorder={!plan.featured}
              style={{ display: "flex", flexDirection: "column" }}
            >
              {plan.featured && (
                <Badge
                  color="violet"
                  variant="filled"
                  size="sm"
                  mb="md"
                  style={{ alignSelf: "flex-start" }}
                >
                  Most popular
                </Badge>
              )}
              <Text fw={700} size="lg">
                {plan.name}
              </Text>
              <Group align="baseline" gap={4} mt={8} mb={4}>
                <Text
                  style={{ fontSize: "2.6rem", fontWeight: 900, lineHeight: 1 }}
                  className={plan.featured ? classes.gradientText : undefined}
                >
                  {plan.price}
                </Text>
                <Text size="sm" c="dimmed">
                  / {plan.period}
                </Text>
              </Group>
              <Text size="sm" c="dimmed" mb="lg">
                {plan.description}
              </Text>
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon
                    color="violet"
                    variant="light"
                    size={20}
                    radius="xl"
                  >
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
                mb="xl"
                style={{ flex: 1 }}
              >
                {plan.features.map((f) => (
                  <List.Item key={f}>{f}</List.Item>
                ))}
              </List>
              <Button
                fullWidth
                color="violet"
                variant={plan.featured ? "filled" : "light"}
                radius="xl"
                size="md"
                component="a"
                href={
                  plan.name === "Team"
                    ? "mailto:hello@repochat.dev"
                    : `${API_URL}/auth/github`
                }
              >
                {plan.cta}
              </Button>
            </Paper>
          ))}
        </SimpleGrid>

        <Text ta="center" size="xs" c="dimmed" mt="xl">
          Payments powered by Stripe · Cancel anytime · No credit card required
          for free tier
        </Text>
      </Container>

      <div className={classes.divider} />

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
              © {new Date().getFullYear()} Repository Augur · All rights
              reserved
            </Text>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
