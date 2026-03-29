import { Container, Select, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";

export const Navbar = () => {
  const [value, setValue] = useState<string | null>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [repos, setRepos] = useState<string[]>([]);
  useEffect(() => {
    setLoading(true);
    fetch("http://localhost:5000/user/loaded/repos", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        setRepos(data.repoNames);
      })
      .finally(() => setLoading(false));
  }, []);
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
      </Stack>
    </Container>
  );
};
