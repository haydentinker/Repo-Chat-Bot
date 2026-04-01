import { ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

function Wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider defaultColorScheme="dark">{children}</MantineProvider>;
}

export function renderWithMantine(ui: ReactNode, options?: RenderOptions) {
  return render(ui, { wrapper: Wrapper, ...options });
}
