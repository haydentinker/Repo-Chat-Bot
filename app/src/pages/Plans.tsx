import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  IconCheck,
  IconBolt,
  IconBrandGithub,
} from "@tabler/icons-react";
import Logo from "../components/Logo";
import { useAuth } from "../providers/AuthProvider";
import { API_URL } from "../lib/api";
import classes from "./Home.module.css";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring your own projects.",
    features: ["3 repositories", "100 messages / month", "Community support"],
    cta: "Start for free",
    featured: false,
  },
  {
    id: "pro" as const,
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
    id: "team" as const,
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

export default function Plans() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (planId: "free" | "pro" | "team") => {
    if (planId === "team") {
      window.location.href = "mailto:hello@repochat.dev";
      return;
    }
    if (planId === "pro") {
      // TODO: redirect to Stripe checkout
      // window.location.href = STRIPE_CHECKOUT_URL;
      setError("Pro billing is coming soon. Start with the free plan for now.");
      return;
    }

    setActivating(planId);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/user/plan/activate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      if (!res.ok) throw new Error("Failed to activate plan");
      await refreshUser();
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActivating(null);
    }
  };

  return (
    <Box style={{ minHeight: "100vh", backgroundColor: "var(--mantine-color-body)" }}>
      {/* Header */}
      <Box className={classes.navbar} px="xl" py="sm">
        <Group justify="space-between" maw={1100} mx="auto">
          <Logo withText height={32} />
          {user && (
            <Group gap="xs">
              <IconBrandGithub size={16} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                Signed in as{" "}
                <Text span fw={600} c="violet">
                  @{user.username}
                </Text>
              </Text>
            </Group>
          )}
        </Group>
      </Box>

      {/* Hero */}
      <Box className={classes.heroBg} py={80}>
        <div className={`${classes.orb} ${classes.orb1}`} />
        <div className={`${classes.orb} ${classes.orb2}`} />

        <Container size="sm" style={{ position: "relative", zIndex: 1 }}>
          <Stack align="center" gap="md">
            <Badge size="lg" variant="light" color="violet" leftSection={<IconBolt size={14} />} radius="xl">
              Choose your plan
            </Badge>
            <Title
              ta="center"
              style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, lineHeight: 1.15 }}
            >
              Start chatting with your{" "}
              <span className={classes.gradientText}>codebase</span>
            </Title>
            <Text ta="center" size="lg" c="dimmed" maw={480}>
              Pick the plan that fits your workflow. Upgrade or cancel anytime.
            </Text>
          </Stack>
        </Container>
      </Box>

      <div className={classes.divider} />

      {/* Plan cards */}
      <Container size="lg" py={80}>
        {error && (
          <Text ta="center" c="orange" size="sm" mb="xl">
            {error}
          </Text>
        )}

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {PLANS.map((plan) => (
            <Paper
              key={plan.id}
              className={plan.featured ? classes.pricingCardFeatured : classes.pricingCard}
              p="xl"
              radius="lg"
              withBorder={!plan.featured}
              style={{ display: "flex", flexDirection: "column" }}
            >
              {plan.featured && (
                <Badge color="violet" variant="filled" size="sm" mb="md" style={{ alignSelf: "flex-start" }}>
                  Most popular
                </Badge>
              )}

              <Text fw={700} size="lg">{plan.name}</Text>
              <Group align="baseline" gap={4} mt={8} mb={4}>
                <Text
                  style={{ fontSize: "2.6rem", fontWeight: 900, lineHeight: 1 }}
                  className={plan.featured ? classes.gradientText : undefined}
                >
                  {plan.price}
                </Text>
                <Text size="sm" c="dimmed">/ {plan.period}</Text>
              </Group>
              <Text size="sm" c="dimmed" mb="lg">{plan.description}</Text>

              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon color="violet" variant="light" size={20} radius="xl">
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
                loading={activating === plan.id}
                disabled={!!activating}
                onClick={() => handleSelect(plan.id)}
              >
                {plan.cta}
              </Button>
            </Paper>
          ))}
        </SimpleGrid>

        <Text ta="center" size="xs" c="dimmed" mt="xl">
          Payments powered by Stripe · Cancel anytime · No credit card required for free tier
        </Text>
      </Container>
    </Box>
  );
}
