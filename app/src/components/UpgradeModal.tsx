import {
  Badge,
  Button,
  Group,
  List,
  Modal,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconCheck, IconBolt, IconSparkles, IconUsers } from "@tabler/icons-react";
import { redirectToCheckout } from "../lib/stripe";

const FREE_PLAN_CREDITS = 100;

const PAID_PLANS = [
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
    cta: "Upgrade to Pro",
    icon: IconSparkles,
    color: "violet" as const,
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
    icon: IconUsers,
    color: "grape" as const,
  },
];

interface UpgradeModalProps {
  opened: boolean;
  onClose: () => void;
  creditsRemaining: number | null;
  reason?: "exhausted" | "low";
}

export default function UpgradeModal({
  opened,
  onClose,
  creditsRemaining,
  reason = "exhausted",
}: UpgradeModalProps) {
  const used =
    creditsRemaining !== null ? FREE_PLAN_CREDITS - creditsRemaining : FREE_PLAN_CREDITS;
  const pct = Math.min(100, Math.round((used / FREE_PLAN_CREDITS) * 100));
  const isExhausted = reason === "exhausted" || creditsRemaining === 0;

  const handlePlanClick = (planId: "pro" | "team") => {
    if (planId === "team") {
      window.location.href = "mailto:hello@repochat.dev";
      return;
    }
    redirectToCheckout("pro").catch((err) => console.error("Checkout error:", err));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      radius="lg"
      padding="xl"
      withCloseButton
      title={
        <Group gap="xs">
          <IconBolt size={18} color="var(--mantine-color-violet-4)" />
          <Text fw={700} size="md">
            {isExhausted ? "You've used all your credits" : "Running low on credits"}
          </Text>
        </Group>
      }
    >
      <Stack gap="xl">
        {/* Usage bar */}
        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Free plan usage</Text>
            <Text size="sm" fw={600} c={pct >= 100 ? "red" : pct >= 75 ? "orange" : "teal"}>
              {used} / {FREE_PLAN_CREDITS} messages
            </Text>
          </Group>
          <Progress
            value={pct}
            color={pct >= 100 ? "red" : pct >= 75 ? "orange" : "violet"}
            radius="xl"
            size="md"
          />
          {isExhausted && (
            <Text size="xs" c="dimmed">
              Your free credits reset on the 1st of next month, or upgrade now for
              immediate access.
            </Text>
          )}
        </Stack>

        {/* Plan cards */}
        <Stack gap="xs">
          <Title order={5} c="dimmed">Upgrade your plan</Title>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
            {PAID_PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <Stack
                  key={plan.id}
                  gap="md"
                  p="md"
                  style={{
                    borderRadius: 12,
                    border: `1px solid var(--mantine-color-${plan.color}-4)`,
                    background: `color-mix(in srgb, var(--mantine-color-${plan.color}-9) 30%, transparent)`,
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Group gap={6}>
                        <Icon size={15} color={`var(--mantine-color-${plan.color}-4)`} />
                        <Text fw={700} size="sm">{plan.name}</Text>
                      </Group>
                      <Group align="baseline" gap={4}>
                        <Text fw={900} size="xl">{plan.price}</Text>
                        <Text size="xs" c="dimmed">/ {plan.period}</Text>
                      </Group>
                    </Stack>
                    <Badge color={plan.color} variant="light" size="xs">
                      {plan.id === "pro" ? "Most popular" : "For teams"}
                    </Badge>
                  </Group>

                  <List
                    spacing={4}
                    size="xs"
                    icon={
                      <ThemeIcon color={plan.color} variant="light" size={16} radius="xl">
                        <IconCheck size={10} />
                      </ThemeIcon>
                    }
                    style={{ flex: 1 }}
                  >
                    {plan.features.map((f) => (
                      <List.Item key={f}>{f}</List.Item>
                    ))}
                  </List>

                  <Button
                    fullWidth
                    color={plan.color}
                    variant="filled"
                    radius="xl"
                    size="sm"
                    leftSection={<Icon size={14} />}
                    onClick={() => handlePlanClick(plan.id)}
                  >
                    {plan.cta}
                  </Button>
                </Stack>
              );
            })}
          </SimpleGrid>
        </Stack>

        {!isExhausted && (
          <Button fullWidth variant="subtle" color="gray" radius="xl" size="sm" onClick={onClose}>
            Keep using free plan
          </Button>
        )}
      </Stack>
    </Modal>
  );
}
