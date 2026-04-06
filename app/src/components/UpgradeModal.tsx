import {
  Badge,
  Button,
  Group,
  List,
  Modal,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconCheck, IconBolt, IconSparkles } from "@tabler/icons-react";

const PRO_FEATURES = [
  "Unlimited repositories",
  "2,000 messages / month",
  "Priority indexing",
  "Email support",
];

const FREE_PLAN_CREDITS = 100;

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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="sm"
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
      <Stack gap="lg">
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

        {/* Pro pitch */}
        <Stack gap="xs">
          <Group gap="xs">
            <Badge color="violet" variant="light" leftSection={<IconSparkles size={11} />}>
              Pro plan
            </Badge>
            <Text size="sm" fw={700}>$12 / month</Text>
          </Group>

          <List
            spacing={4}
            size="sm"
            icon={
              <ThemeIcon color="violet" variant="light" size={18} radius="xl">
                <IconCheck size={11} />
              </ThemeIcon>
            }
          >
            {PRO_FEATURES.map((f) => (
              <List.Item key={f}>{f}</List.Item>
            ))}
          </List>
        </Stack>

        {/* CTAs */}
        <Stack gap="xs">
          <Button
            fullWidth
            color="violet"
            radius="xl"
            size="md"
            leftSection={<IconBolt size={16} />}
            onClick={() => {
              // TODO: navigate to Stripe checkout
              // window.location.href = STRIPE_CHECKOUT_URL;
              alert("Pro billing coming soon!");
            }}
          >
            Upgrade to Pro
          </Button>
          {!isExhausted && (
            <Button fullWidth variant="subtle" color="gray" radius="xl" onClick={onClose}>
              Keep using free plan
            </Button>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}
