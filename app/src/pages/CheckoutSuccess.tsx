import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Center, Loader, Stack, Text, Button } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { useAuth } from "../providers/AuthProvider";
import Logo from "../components/Logo";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 10; // 20 seconds before giving up

export default function CheckoutSuccess() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [polls, setPolls] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // If the plan is already updated (e.g. fast webhook), skip polling.
    if (user?.plan === "pro" || user?.plan === "team") {
      setConfirmed(true);
      const t = setTimeout(() => navigate("/dashboard"), 2500);
      return () => clearTimeout(t);
    }

    if (polls >= MAX_POLLS) return;

    const t = setTimeout(async () => {
      await refreshUser();
      setPolls((p) => p + 1);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(t);
  }, [user, polls, refreshUser, navigate]);

  return (
    <Box style={{ minHeight: "100vh", backgroundColor: "var(--mantine-color-body)" }}>
      <Center h="100vh">
        <Stack align="center" gap="lg" maw={420} px="md">
          <Logo withText height={40} />

          {confirmed ? (
            <>
              <IconCircleCheck size={64} color="var(--mantine-color-teal-4)" />
              <Stack align="center" gap={6}>
                <Text fw={800} size="xl">You're on Pro!</Text>
                <Text c="dimmed" size="sm" ta="center">
                  Your subscription is active. Redirecting you to the dashboard…
                </Text>
              </Stack>
              <Loader size="xs" color="violet" />
            </>
          ) : polls >= MAX_POLLS ? (
            <>
              <IconCircleCheck size={64} color="var(--mantine-color-violet-4)" />
              <Stack align="center" gap={6}>
                <Text fw={800} size="xl">Payment received!</Text>
                <Text c="dimmed" size="sm" ta="center">
                  Your plan is being activated — it may take a moment to appear. If it
                  doesn't update within a few minutes, please contact support.
                </Text>
              </Stack>
              <Button color="violet" radius="xl" onClick={() => navigate("/dashboard")}>
                Go to dashboard
              </Button>
            </>
          ) : (
            <>
              <Loader size="lg" color="violet" />
              <Stack align="center" gap={6}>
                <Text fw={700} size="lg">Activating your plan…</Text>
                <Text c="dimmed" size="sm" ta="center">
                  Confirming your payment with Stripe. This only takes a moment.
                </Text>
              </Stack>
            </>
          )}
        </Stack>
      </Center>
    </Box>
  );
}
