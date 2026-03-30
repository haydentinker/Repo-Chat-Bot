import { Button, Container, Select, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";

export const Navbar = () => {
  const [value, setValue] = useState<string | null>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [repos, setRepos] = useState<string[]>([]);

  return (
    <Container>
      <Stack>
        <Text>Chats</Text>
        <Select
          value={value}
          onChange={setValue}
          label="Select repository to load relevant threads"
          placeholder="Repository name"
          limit={5}
          data={repos}
          searchable
        />
        <Button
          variant="outline"
          onClick={() => {
            console.log("init new chat");
          }}
        >
          New Chat +
        </Button>
      </Stack>
    </Container>
  );
};
