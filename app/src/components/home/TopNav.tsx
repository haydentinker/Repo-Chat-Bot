import { Box, Button, Group } from "@mantine/core";
import { IconArrowRight, IconBrandGithub } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { API_URL } from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import Logo from "../Logo";
import classes from "../../pages/Home.module.css";

export default function TopNav() {
  const { user } = useAuth();

  return (
    <Box className={classes.navbar} px="xl" py="sm">
      <Group justify="space-between" maw={1100} mx="auto">
        <Logo withText height={32} />
        {user ? (
          <Button
            color="violet"
            variant="light"
            component={Link}
            to="/dashboard"
            rightSection={<IconArrowRight size={18} />}
          >
            Go to dashboard
          </Button>
        ) : (
          <Button
            leftSection={<IconBrandGithub size={18} />}
            color="violet"
            variant="light"
            component="a"
            href={`${API_URL}/auth/github`}
          >
            Sign in with GitHub
          </Button>
        )}
      </Group>
    </Box>
  );
}
