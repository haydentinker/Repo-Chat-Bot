import { Container, Select, Stack, Text } from "@mantine/core";
import React, { useEffect, useState } from "react";

interface Repo {
  id: number;
  name: string;
  full_name: string;
}

export const Navbar = () => {
  const [value, setValue] = useState<string | null>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  useEffect(() => {
    setLoading(true);
    fetch("http://localhost:5000/users/repos", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        console.log(data);
        setRepos(data.repos);
      })
      .finally(() => setLoading(false));
  }, []);
  console.log(repos);
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
          data={repos.map((repo) => repo.full_name)}
          searchable
        />
      </Stack>
    </Container>
  );
};
