import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Button,
  Group,
  Tooltip,
} from "@mantine/core";
import {
  IconSun,
  IconMoon,
  IconLogout,
  IconFolderOpen,
} from "@tabler/icons-react";
import Logo from "../Logo";
import type { User } from "../../providers/AuthProvider";

interface DashboardHeaderProps {
  user: User | null;
  socketConnected: boolean;
  colorScheme: "light" | "dark";
  navOpened: boolean;
  onToggleNav: () => void;
  onToggleColorScheme: () => void;
  onOpenRepos: () => void;
  onOpenUpgrade: () => void;
  onLogout: () => void;
}

export default function DashboardHeader({
  user,
  socketConnected,
  colorScheme,
  navOpened,
  onToggleNav,
  onToggleColorScheme,
  onOpenRepos,
  onOpenUpgrade,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <AppShell.Header>
      <Group h="100%" px="md" justify="space-between">
        <Group>
          <Burger opened={navOpened} onClick={onToggleNav} hiddenFrom="sm" size="sm" />
          <Logo withText height={36} />
        </Group>
        <Group gap="xs">
          {user?.plan === "free" && user.credits_remaining !== null && (
            <Tooltip label="Free plan messages remaining this month" withArrow>
              <Badge
                size="xs"
                visibleFrom="sm"
                color={user.credits_remaining <= 10 ? "red" : user.credits_remaining <= 30 ? "orange" : "teal"}
                variant="light"
                style={{ cursor: "pointer" }}
                onClick={onOpenUpgrade}
              >
                {user.credits_remaining} credits
              </Badge>
            </Tooltip>
          )}
          <Tooltip label={socketConnected ? "Connected" : "Disconnected — reconnecting…"} withArrow>
            <Badge
              size="xs"
              visibleFrom="sm"
              color={socketConnected ? "teal" : "orange"}
              variant="dot"
              style={{ cursor: "default" }}
            >
              {socketConnected ? "Live" : "Offline"}
            </Badge>
          </Tooltip>
          <Tooltip label="Manage repositories" withArrow>
            <Button variant="light" color="violet" onClick={onOpenRepos} size="sm" visibleFrom="sm">
              Manage repositories
            </Button>
          </Tooltip>
          <Tooltip label="Manage repositories" withArrow>
            <ActionIcon
              variant="light"
              color="violet"
              size="lg"
              hiddenFrom="sm"
              onClick={onOpenRepos}
              aria-label="Manage repositories"
            >
              <IconFolderOpen size={18} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            variant="light"
            color="violet"
            size="lg"
            onClick={onToggleColorScheme}
            title="Toggle color scheme"
          >
            {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="violet"
            size="lg"
            title="Log out"
            onClick={onLogout}
          >
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </Group>
    </AppShell.Header>
  );
}
