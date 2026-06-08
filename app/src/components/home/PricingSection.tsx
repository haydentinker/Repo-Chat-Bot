import { Badge, Button, Container, Group, List, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { API_URL } from "../../lib/api";
import classes from "../../pages/Home.module.css";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring your own projects.",
    features: ["2 repositories", "100 messages / month", "Community support"],
    cta: "Get started",
    featured: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    description: "For developers who live in their codebase.",
    features: ["5 repositories", "Unlimited messages", "Priority indexing", "Email support"],
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

export default function PricingSection() {
  return (
    <Container size="lg" py={100} id="pricing">
      <Stack align="center" mb={60}>
        <Badge variant="light" color="violet" size="md">
          Pricing
        </Badge>
        <Title ta="center" order={2} style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
          Simple, <span className={classes.gradientText}>transparent pricing</span>
        </Title>
        <Text ta="center" c="dimmed" maw={500} size="lg">
          Start free, upgrade when you need more. No hidden fees.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        {PLANS.map((plan) => (
          <Paper
            key={plan.name}
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
              component="a"
              href={plan.name === "Team" ? "mailto:hello@repochat.dev" : `${API_URL}/auth/github`}
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
  );
}
